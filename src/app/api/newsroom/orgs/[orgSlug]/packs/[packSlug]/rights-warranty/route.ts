// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/
//                rights-warranty                       (NR-D9b, F6)
//
// Single-method route. Bearer auth → admin membership → pack-status
// ='draft' guard → service-role two-step write:
//
//   1. INSERT newsroom_rights_warranties (3 booleans + narrative +
//      confirmed_by_user_id from session) RETURNING id.
//   2. UPDATE newsroom_packs SET rights_warranty_id = <new id>.
//
// Auth posture mirrors NR-D8/D7a/D7b precedent: inline
// `extractBearerToken`, `supabase.auth.getUser`, direct membership
// query (the `is_newsroom_editor_or_admin` RPC is broken under
// service-role per NR-D6b IP-3).
//
// Service-role bypasses RLS, but the `confirmed_by_user_id` column
// is set to the session user's ID to mirror the RLS policy intent
// (`confirmed_by_user_id = auth.uid()`).
//
// Two-INSERT atomicity caveat: step 2 failure after step 1 success
// leaves an orphan warranty row (warranty exists, pack still
// rights_warranty_id IS NULL). v1 acceptance per existing
// DIRECTIVE_SEQUENCE.md v1.1 backlog. Detection: warranty row
// without a pack pointing at it.
//
// Idempotency: pack with `rights_warranty_id` already set → 409
// `already-confirmed`. Caller (UI) shouldn't open P9 in that
// case — defensive against double-submit.
//
// Pack-status guard: warranty creation is permitted only on draft
// packs. Post-publish warranties are immutable (PRD §5.1 P9 line
// 937 — "If warranty was made in error, remedy is takedown and
// reissue, not edit").
//
// Response shape:
//   201 { ok: true, warranty }
//   400 invalid-body / validation
//   401 unauthenticated
//   403 forbidden
//   404 not-found / feature-disabled
//   409 not-editable (pack non-draft) / already-confirmed
//   500 internal
//
// Spec cross-references:
//   - directives/NR-D9b-publish-flow.md §F6
//   - PRD.md §5.1 P9 (line 919) — UI verbatim authority
//   - PRD.md §3.2 — warranty schema authority
//   - src/lib/newsroom/publish-checklist.ts — `createWarrantySchema`
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomPackRow,
  NewsroomRightsWarrantyRow,
} from '@/lib/db/schema'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import { createWarrantySchema } from '@/lib/newsroom/publish-checklist'

export const runtime = 'nodejs'

const ROUTE_POST =
  'POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/rights-warranty'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

interface PackContext {
  authUserId: string
  companyId: string
  packId: string
  rightsWarrantyId: string | null
}

/**
 * Resolves auth + admin membership + pack lookup. Mirrors the
 * embargo route's helper but additionally returns
 * `rightsWarrantyId` so the handler can short-circuit on
 * already-confirmed.
 */
async function resolvePackContext(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string }> },
  routeLabel: string,
): Promise<PackContext | NextResponse> {
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
  const { orgSlug, packSlug } = await context.params
  const supabase = getSupabaseClient()

  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }
  const authUserId = userData.user.id

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (companyError) {
    logger.error(
      {
        route: routeLabel,
        rawCode: companyError.code,
        rawMessage: companyError.message,
      },
      '[newsroom.warranty] companies lookup failed',
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
        route: routeLabel,
        rawCode: membershipError.code,
        rawMessage: membershipError.message,
      },
      '[newsroom.warranty] membership lookup failed',
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

  const { data: pack, error: packError } = await supabase
    .from('newsroom_packs')
    .select('id, status, rights_warranty_id')
    .eq('company_id', companyId)
    .eq('slug', packSlug)
    .maybeSingle()
  if (packError) {
    logger.error(
      {
        route: routeLabel,
        rawCode: packError.code,
        rawMessage: packError.message,
      },
      '[newsroom.warranty] pack lookup failed',
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
  const packStatus = pack.status as NewsroomPackRow['status']
  if (packStatus !== 'draft') {
    return NextResponse.json(
      { ok: false, reason: 'not-editable' },
      { status: 409 },
    )
  }

  return {
    authUserId,
    companyId,
    packId: pack.id as string,
    rightsWarrantyId:
      (pack.rights_warranty_id as string | null) ?? null,
  }
}

// ─── POST (create rights warranty) ─────────────────────────────

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string }> },
): Promise<NextResponse> {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }

  const ctx = await resolvePackContext(request, context, ROUTE_POST)
  if (ctx instanceof NextResponse) return ctx

  // Defensive: if the pack already has a warranty attached, do not
  // overwrite — caller (UI) shouldn't have opened P9. PRD line 937
  // guarantees post-publish immutability; we extend that guarantee
  // to draft to prevent silent overwrites.
  if (ctx.rightsWarrantyId !== null) {
    return NextResponse.json(
      { ok: false, reason: 'already-confirmed' },
      { status: 409 },
    )
  }

  const parsed = createWarrantySchema.safeParse(rawBody)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || '_root'
      if (!errors[path]) errors[path] = issue.message
    }
    return NextResponse.json(
      { ok: false, reason: 'validation', errors },
      { status: 400 },
    )
  }
  const data = parsed.data

  const supabase = getSupabaseClient()

  // Step 1: INSERT warranty.
  const { data: inserted, error: insertError } = await supabase
    .from('newsroom_rights_warranties')
    .insert({
      pack_id: ctx.packId,
      subject_releases_confirmed: data.subject_releases_confirmed,
      third_party_content_cleared: data.third_party_content_cleared,
      music_cleared: data.music_cleared,
      narrative_text:
        data.narrative_text === undefined ? null : data.narrative_text,
      confirmed_by_user_id: ctx.authUserId,
      // confirmed_at defaults to now() per migration
    })
    .select()
    .single()
  if (insertError || !inserted) {
    logger.error(
      {
        route: ROUTE_POST,
        companyId: ctx.companyId,
        packId: ctx.packId,
        rawCode: insertError?.code,
        rawMessage: insertError?.message,
      },
      '[newsroom.warranty.create] insert failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  const warrantyRow = inserted as NewsroomRightsWarrantyRow

  // Step 2: UPDATE pack with the new warranty id.
  // Two-INSERT atomicity caveat: failure here leaves a warranty
  // row without a pack pointing at it. v1 acceptance per
  // DIRECTIVE_SEQUENCE.md v1.1 backlog "Two-INSERT atomicity for
  // compound writes".
  const { error: updateError } = await supabase
    .from('newsroom_packs')
    .update({ rights_warranty_id: warrantyRow.id })
    .eq('id', ctx.packId)
  if (updateError) {
    logger.error(
      {
        route: ROUTE_POST,
        companyId: ctx.companyId,
        packId: ctx.packId,
        warrantyId: warrantyRow.id,
        rawCode: updateError.code,
        rawMessage: updateError.message,
      },
      '[newsroom.warranty.create] pack update failed (orphan warranty row persists)',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  logger.info(
    {
      route: ROUTE_POST,
      companyId: ctx.companyId,
      packId: ctx.packId,
      warrantyId: warrantyRow.id,
    },
    '[newsroom.warranty.create] warranty created + pack updated',
  )
  return NextResponse.json(
    { ok: true, warranty: warrantyRow },
    { status: 201 },
  )
}
