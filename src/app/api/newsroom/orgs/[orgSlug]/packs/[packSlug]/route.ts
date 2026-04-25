// ═══════════════════════════════════════════════════════════════
// Frontfiles — PATCH /api/newsroom/orgs/[orgSlug]/packs/[packSlug]
//                              (NR-D6b, F6)
//
// Updates an existing draft Pack. Same auth posture as F5
// (POST): Bearer → service-role + admin membership check (IP-3)
// → service-role UPDATE.
//
// Status guard: only `draft` packs are editable in NR-D6b.
// scheduled / published / archived / takedown all flow through
// NR-D9's state-machine RPC, not this route. We refuse with 409
// `not-editable` if the caller targets a non-draft pack — F4
// (the client form) should never reach here in that state
// because F2 (the page) refuses to render the form for non-
// drafts, but we re-gate at the API for direct-call safety.
//
// Slug uniqueness on rename: if the body includes a `slug` field
// different from the current pack's slug, run the same UNIQUE-
// (company_id, slug) pre-check as F5, but EXCLUDING the current
// pack's id (otherwise the pack would conflict with itself).
//
// Response shape:
//   200 { ok: true,  pack }
//   400 { ok: false, reason: 'invalid-body' | 'validation', errors? }
//   401 { ok: false, reason: 'unauthenticated' }
//   403 { ok: false, reason: 'forbidden' | 'unverified' }
//   404 { ok: false, reason: 'not-found' | 'feature-disabled' }
//   409 { ok: false, reason: 'slug-conflict' | 'not-editable' }
//   500 { ok: false, reason: 'internal' }
//
// Spec cross-references:
//   - directives/NR-D6b-pack-creation-details-tab.md §F6
//   - sibling: F5 packs/route.ts
//   - src/lib/newsroom/pack-form.ts (updatePackSchema)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import type { NewsroomPackRow } from '@/lib/db/schema'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import { updatePackSchema } from '@/lib/newsroom/pack-form'

export const runtime = 'nodejs'

const ROUTE =
  'PATCH /api/newsroom/orgs/[orgSlug]/packs/[packSlug]'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string }> },
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

  const { orgSlug, packSlug } = await context.params

  // ── body parse ───────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }

  const supabase = getSupabaseClient()

  // ── auth ─────────────────────────────────────────────────────
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }
  const authUserId = userData.user.id

  // ── company lookup ───────────────────────────────────────────
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
      '[newsroom.packs.update] companies lookup failed',
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

  // ── admin gate (direct membership, admin-only — IP-3) ────────
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
      '[newsroom.packs.update] membership lookup failed',
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

  // ── pack lookup by (company_id, slug) ────────────────────────
  const { data: existingPack, error: packLookupError } = await supabase
    .from('newsroom_packs')
    .select('id, status, slug')
    .eq('company_id', companyId)
    .eq('slug', packSlug)
    .maybeSingle()
  if (packLookupError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: packLookupError.code,
        rawMessage: packLookupError.message,
      },
      '[newsroom.packs.update] pack lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!existingPack) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  const packId = existingPack.id as string
  const currentStatus = existingPack.status as NewsroomPackRow['status']

  // ── status guard: only drafts are editable ───────────────────
  if (currentStatus !== 'draft') {
    return NextResponse.json(
      { ok: false, reason: 'not-editable' },
      { status: 409 },
    )
  }

  // ── zod validation ───────────────────────────────────────────
  const parsed = updatePackSchema.safeParse(rawBody)
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

  // ── slug uniqueness pre-check on rename ──────────────────────
  // Only relevant when the body specifies a new slug different
  // from the current one. Exclude the current pack from the
  // collision check.
  if (data.slug && data.slug !== existingPack.slug) {
    const { data: collision, error: collisionError } = await supabase
      .from('newsroom_packs')
      .select('id')
      .eq('company_id', companyId)
      .eq('slug', data.slug)
      .neq('id', packId)
      .maybeSingle()
    if (collisionError) {
      logger.error(
        {
          route: ROUTE,
          companyId,
          rawCode: collisionError.code,
          rawMessage: collisionError.message,
        },
        '[newsroom.packs.update] slug collision check failed',
      )
      return NextResponse.json(
        { ok: false, reason: 'internal' },
        { status: 500 },
      )
    }
    if (collision) {
      return NextResponse.json(
        { ok: false, reason: 'slug-conflict' },
        { status: 409 },
      )
    }
  }

  // ── UPDATE ───────────────────────────────────────────────────
  // Only carry forward fields the body actually supplied. zod's
  // partial() preserves undefined for absent fields; we strip
  // those before passing to .update() so we don't accidentally
  // null-out columns the user didn't touch.
  const updatePayload: Record<string, unknown> = {}
  if (data.title !== undefined) updatePayload.title = data.title
  if (data.subtitle !== undefined)
    updatePayload.subtitle = data.subtitle ?? null
  if (data.description !== undefined)
    updatePayload.description = data.description
  if (data.credit_line !== undefined)
    updatePayload.credit_line = data.credit_line
  if (data.licence_class !== undefined)
    updatePayload.licence_class = data.licence_class
  if (data.slug !== undefined) updatePayload.slug = data.slug

  const { data: updated, error: updateError } = await supabase
    .from('newsroom_packs')
    .update(updatePayload)
    .eq('id', packId)
    .select()
    .single()
  if (updateError || !updated) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        packId,
        rawCode: updateError?.code,
        rawMessage: updateError?.message,
      },
      '[newsroom.packs.update] update failed',
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
      packId,
      authUserId,
      slugChanged: data.slug !== undefined && data.slug !== existingPack.slug,
    },
    '[newsroom.packs.update] pack updated',
  )
  return NextResponse.json({ ok: true, pack: updated }, { status: 200 })
}
