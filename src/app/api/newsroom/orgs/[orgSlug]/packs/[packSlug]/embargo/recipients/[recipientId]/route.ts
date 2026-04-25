// ═══════════════════════════════════════════════════════════════
// Frontfiles — DELETE /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/
//                  embargo/recipients/[recipientId]   (NR-D8, F7)
//
// Revokes a recipient's pre-lift access. Sets `revoked_at = now()`
// on the `newsroom_embargo_recipients` row. NR-D11's preview
// resolver will return 410 Gone for tokens whose row has
// `revoked_at IS NOT NULL` (PRD §5.1 P8).
//
// `recipientId` path param is the `newsroom_embargo_recipients.id`
// (the join row), NOT `newsroom_recipients.id` (the email-keyed
// person). Cross-org tamper guard: look up the row, walk
// embargo → pack → company, refuse if company doesn't match the
// orgSlug.
//
// Pack-status='draft' guard. NR-D9 may relax this for post-
// schedule revocation per PRD §5.1 P8 ("Revoke access" is
// available post-schedule); not in NR-D8's scope.
//
// Re-add semantic: a revoked row stays in the table; F6's
// re-add branch UPDATES it back to active with a fresh token.
// Hard delete would lose the unique-(embargo_id, recipient_id)
// audit trail.
//
// Response shape:
//   204 (no body)
//   401 / 403 / 404 / 409 (not-editable) / 500
//
// Spec cross-references:
//   - directives/NR-D8-embargo-configuration.md §F7
//   - PRD.md §5.1 P8 (revoke wording)
//   - PRD.md §5.3 J5 (410 Gone token response — NR-D11 territory)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import type { NewsroomPackRow } from '@/lib/db/schema'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const ROUTE =
  'DELETE /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo/recipients/[recipientId]'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      orgSlug: string
      packSlug: string
      recipientId: string
    }>
  },
): Promise<NextResponse> {
  if (!isAuthWired()) {
    return NextResponse.json(
      { ok: false, reason: 'feature-disabled' },
      { status: 404 },
    )
  }
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }

  const { orgSlug, packSlug, recipientId } = await context.params
  const supabase = getSupabaseClient()

  // ── auth ──
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }
  const authUserId = userData.user.id

  // ── company + admin gate ──
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (companyError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: companyError.code,
        rawMessage: companyError.message,
      },
      '[newsroom.embargo.recipient.revoke] companies lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!company) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  const companyId = company.id as string

  const { data: membership, error: membershipError } = await supabase
    .from('company_memberships')
    .select('role, status')
    .eq('company_id', companyId)
    .eq('user_id', authUserId)
    .maybeSingle()
  if (membershipError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: membershipError.code,
        rawMessage: membershipError.message,
      },
      '[newsroom.embargo.recipient.revoke] membership lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (
    !membership ||
    membership.role !== 'admin' ||
    membership.status !== 'active'
  ) {
    return NextResponse.json(
      { ok: false, reason: 'forbidden' },
      { status: 403 },
    )
  }

  // ── pack lookup + draft guard ──
  const { data: pack, error: packError } = await supabase
    .from('newsroom_packs')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('slug', packSlug)
    .maybeSingle()
  if (packError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: packError.code,
        rawMessage: packError.message,
      },
      '[newsroom.embargo.recipient.revoke] pack lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!pack) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  if ((pack.status as NewsroomPackRow['status']) !== 'draft') {
    return NextResponse.json(
      { ok: false, reason: 'not-editable' },
      { status: 409 },
    )
  }
  const packId = pack.id as string

  // ── embargo lookup ──
  const { data: embargo, error: embargoError } = await supabase
    .from('newsroom_embargoes')
    .select('id')
    .eq('pack_id', packId)
    .maybeSingle()
  if (embargoError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: embargoError.code,
        rawMessage: embargoError.message,
      },
      '[newsroom.embargo.recipient.revoke] embargo lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!embargo) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  const embargoId = embargo.id as string

  // ── embargo_recipient lookup (cross-org tamper guard) ──
  const { data: er, error: erError } = await supabase
    .from('newsroom_embargo_recipients')
    .select('id, embargo_id, revoked_at')
    .eq('id', recipientId)
    .maybeSingle()
  if (erError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: erError.code,
        rawMessage: erError.message,
      },
      '[newsroom.embargo.recipient.revoke] er lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!er || er.embargo_id !== embargoId) {
    // Either missing entirely or belongs to a different embargo
    // — both surface as 404 from the caller's perspective.
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }

  if (er.revoked_at !== null) {
    // Already revoked — idempotent success.
    return new NextResponse(null, { status: 204 })
  }

  // ── UPDATE revoked_at ──
  const { error: revokeError } = await supabase
    .from('newsroom_embargo_recipients')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', recipientId)
  if (revokeError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        embargoId,
        recipientRowId: recipientId,
        rawCode: revokeError.code,
        rawMessage: revokeError.message,
      },
      '[newsroom.embargo.recipient.revoke] revoke update failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  logger.info(
    {
      route: ROUTE,
      companyId,
      embargoId,
      recipientRowId: recipientId,
      authUserId,
    },
    '[newsroom.embargo.recipient.revoke] revoked',
  )
  return new NextResponse(null, { status: 204 })
}
