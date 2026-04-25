// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST/PATCH/DELETE /api/newsroom/orgs/[orgSlug]/
//                packs/[packSlug]/embargo            (NR-D8, F5)
//
// Three methods, single file. All require: Bearer auth → admin
// membership → pack-status='draft' guard → service-role write.
//
// Auth + admin pattern matches NR-D6b / NR-D7a / NR-D7b
// precedent: inline `extractBearerToken`, `supabase.auth.getUser`,
// direct membership-table query (admin only — IP-3 of NR-D6b
// established that the `is_newsroom_editor_or_admin` RPC is
// broken under service-role).
//
// Status guard: NR-D8 only mutates the embargo while the parent
// pack is in `draft`. Post-schedule actions (early-lift, revoke
// past `accessed_at_first IS NOT NULL`) ship in NR-D9 alongside
// the state-machine RPC.
//
// DELETE refuses if any recipient has accessed the embargo (PRD
// §3.3 transition: "Embargo cancellable when no recipient has
// accessed"). In NR-D8 this guard is structural — the resolver
// (NR-D11) hasn't shipped yet, so `first_accessed_at` is NULL on
// every row. The check is implemented now so NR-D11 doesn't need
// to revisit this route.
//
// Response shape:
//   POST:    201 { ok: true, embargo }
//   PATCH:   200 { ok: true, embargo }
//   DELETE:  204
//   400 invalid-body / validation
//   401 unauthenticated
//   403 forbidden
//   404 not-found / feature-disabled
//   409 not-editable (pack non-draft) / accessed (DELETE-with-accesses)
//   500 internal
//
// Spec cross-references:
//   - directives/NR-D8-embargo-configuration.md §F5
//   - PRD.md §3.3 (cancel-embargo precondition)
//   - src/lib/newsroom/embargo.ts (createEmbargoSchema,
//     updateEmbargoSchema)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomEmbargoRow,
  NewsroomPackRow,
} from '@/lib/db/schema'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import {
  createEmbargoSchema,
  updateEmbargoSchema,
} from '@/lib/newsroom/embargo'

export const runtime = 'nodejs'

const ROUTE_POST =
  'POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo'
const ROUTE_PATCH =
  'PATCH /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo'
const ROUTE_DELETE =
  'DELETE /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo'

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
}

/**
 * Shared auth + admin + pack-resolution chain. Returns either
 * a NextResponse for short-circuit shapes or the resolved IDs.
 *
 * Mirrors the helper pattern from NR-D7a's asset DELETE route
 * (resolveAssetContext) — keeps the three handlers tidy.
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
      '[newsroom.embargo] companies lookup failed',
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
      '[newsroom.embargo] membership lookup failed',
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
    .select('id, status')
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
      '[newsroom.embargo] pack lookup failed',
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
  }
}

// ─── POST (create embargo) ─────────────────────────────────────

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

  const parsed = createEmbargoSchema.safeParse(rawBody)
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
  const { data: existing, error: existingError } = await supabase
    .from('newsroom_embargoes')
    .select('id')
    .eq('pack_id', ctx.packId)
    .maybeSingle()
  if (existingError) {
    logger.error(
      {
        route: ROUTE_POST,
        rawCode: existingError.code,
        rawMessage: existingError.message,
      },
      '[newsroom.embargo.create] existing-embargo check failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (existing) {
    // POST is for create only — caller should PATCH to update.
    return NextResponse.json(
      { ok: false, reason: 'already-exists' },
      { status: 409 },
    )
  }

  const { data: inserted, error: insertError } = await supabase
    .from('newsroom_embargoes')
    .insert({
      pack_id: ctx.packId,
      lift_at: data.lift_at,
      policy_text: data.policy_text,
      notify_on_lift: data.notify_on_lift,
      // state defaults to 'active' per migration
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
      '[newsroom.embargo.create] insert failed',
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
      embargoId: (inserted as { id: string }).id,
    },
    '[newsroom.embargo.create] embargo created',
  )
  return NextResponse.json(
    { ok: true, embargo: inserted as NewsroomEmbargoRow },
    { status: 201 },
  )
}

// ─── PATCH (update existing embargo) ───────────────────────────

export async function PATCH(
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

  const ctx = await resolvePackContext(request, context, ROUTE_PATCH)
  if (ctx instanceof NextResponse) return ctx

  const parsed = updateEmbargoSchema.safeParse(rawBody)
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
  // Resolve embargo by pack_id. PATCH-with-no-existing is a 404
  // shape — the form should POST first.
  const { data: existing, error: existingError } = await supabase
    .from('newsroom_embargoes')
    .select('id')
    .eq('pack_id', ctx.packId)
    .maybeSingle()
  if (existingError) {
    logger.error(
      {
        route: ROUTE_PATCH,
        rawCode: existingError.code,
        rawMessage: existingError.message,
      },
      '[newsroom.embargo.update] lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!existing) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }

  const updatePayload: Record<string, unknown> = {}
  if (data.lift_at !== undefined) updatePayload.lift_at = data.lift_at
  if (data.policy_text !== undefined)
    updatePayload.policy_text = data.policy_text
  if (data.notify_on_lift !== undefined)
    updatePayload.notify_on_lift = data.notify_on_lift

  const { data: updated, error: updateError } = await supabase
    .from('newsroom_embargoes')
    .update(updatePayload)
    .eq('id', existing.id)
    .select()
    .single()
  if (updateError || !updated) {
    logger.error(
      {
        route: ROUTE_PATCH,
        companyId: ctx.companyId,
        packId: ctx.packId,
        rawCode: updateError?.code,
        rawMessage: updateError?.message,
      },
      '[newsroom.embargo.update] update failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  logger.info(
    {
      route: ROUTE_PATCH,
      companyId: ctx.companyId,
      packId: ctx.packId,
      embargoId: existing.id,
    },
    '[newsroom.embargo.update] embargo updated',
  )
  return NextResponse.json(
    { ok: true, embargo: updated as NewsroomEmbargoRow },
    { status: 200 },
  )
}

// ─── DELETE (cancel embargo) ───────────────────────────────────

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string }> },
): Promise<NextResponse> {
  const ctx = await resolvePackContext(request, context, ROUTE_DELETE)
  if (ctx instanceof NextResponse) return ctx

  const supabase = getSupabaseClient()
  const { data: existing, error: existingError } = await supabase
    .from('newsroom_embargoes')
    .select('id')
    .eq('pack_id', ctx.packId)
    .maybeSingle()
  if (existingError) {
    logger.error(
      {
        route: ROUTE_DELETE,
        rawCode: existingError.code,
        rawMessage: existingError.message,
      },
      '[newsroom.embargo.delete] lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!existing) {
    // Idempotent — no embargo means delete is a no-op success.
    return new NextResponse(null, { status: 204 })
  }

  // Cancel-embargo precondition (PRD §3.3): no recipient has
  // accessed. Implementation: SELECT recipients with
  // first_accessed_at IS NOT NULL; if any, refuse with 409.
  const { data: accessed, error: accessedError } = await supabase
    .from('newsroom_embargo_recipients')
    .select('id')
    .eq('embargo_id', existing.id)
    .not('first_accessed_at', 'is', null)
    .limit(1)
  if (accessedError) {
    logger.error(
      {
        route: ROUTE_DELETE,
        rawCode: accessedError.code,
        rawMessage: accessedError.message,
      },
      '[newsroom.embargo.delete] accessed-check failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if ((accessed ?? []).length > 0) {
    return NextResponse.json(
      { ok: false, reason: 'accessed' },
      { status: 409 },
    )
  }

  // Schema-conformant cancellation per PRD §3.2 / §3.3:
  //   1. UPDATE newsroom_embargoes SET state='cancelled',
  //      cancelled_at=now()  — state-machine transition; NR-D9's
  //      lift-worker + state-machine reasoning depends on
  //      cancelled rows existing as historical record.
  //   2. UPDATE newsroom_packs SET embargo_id=NULL — detaches
  //      the pack from the cancelled embargo so toggling embargo
  //      back on creates a fresh active row (vs. trying to
  //      reanimate the cancelled one).
  //
  // Recipients remain attached to the now-cancelled embargo as
  // historical record (their tokens become moot once the embargo
  // is no longer active; NR-D11's resolver will treat
  // state='cancelled' the same as revoked_at IS NOT NULL → 410
  // Gone).
  //
  // Two-INSERT atomicity caveat: same shape as NR-D7a + NR-D8
  // recipient creation. If step 2 (pack UPDATE) fails after step
  // 1 (embargo UPDATE), the embargo is cancelled but the pack
  // still references it — orphan reference. v1 acceptance per
  // existing DIRECTIVE_SEQUENCE.md backlog. Detection:
  // newsroom_packs.embargo_id pointing at a state='cancelled'
  // row is the orphan signal.
  const cancelledAt = new Date().toISOString()
  const { error: cancelError } = await supabase
    .from('newsroom_embargoes')
    .update({ state: 'cancelled', cancelled_at: cancelledAt })
    .eq('id', existing.id)
  if (cancelError) {
    logger.error(
      {
        route: ROUTE_DELETE,
        companyId: ctx.companyId,
        packId: ctx.packId,
        rawCode: cancelError.code,
        rawMessage: cancelError.message,
      },
      '[newsroom.embargo.delete] cancel-state update failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  const { error: detachError } = await supabase
    .from('newsroom_packs')
    .update({ embargo_id: null })
    .eq('id', ctx.packId)
  if (detachError) {
    logger.error(
      {
        route: ROUTE_DELETE,
        companyId: ctx.companyId,
        packId: ctx.packId,
        embargoId: existing.id,
        rawCode: detachError.code,
        rawMessage: detachError.message,
      },
      '[newsroom.embargo.delete] pack detach failed (orphan reference; cancelled embargo persists)',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  logger.info(
    {
      route: ROUTE_DELETE,
      companyId: ctx.companyId,
      packId: ctx.packId,
      embargoId: existing.id,
    },
    '[newsroom.embargo.delete] embargo cancelled',
  )
  return new NextResponse(null, { status: 204 })
}
