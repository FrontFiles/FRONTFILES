// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/
//                transition                            (NR-D9b, F7)
//
// Single-method route. Bearer auth → admin membership → call
// `transitionPack` (NR-D9a wrapper) → return the discriminated
// `TransitionResult`.
//
// Distinct from the embargo / warranty routes: NO pack-status
// guard at the application layer. The state-machine RPC enforces
// the legal transition matrix internally; an
// "illegal-transition" failure is surfaced to the caller via the
// `ok: false, errorCode: 'illegal-transition'` shape. The route
// trusts the RPC as the single state-mutation gate (per
// DIRECTIVE_SEQUENCE.md NR-D9a closure note: "transitionPack is
// the SOLE entry point for newsroom_packs.status mutations").
//
// Auth posture mirrors NR-D9b/F6's warranty route: inline
// `extractBearerToken`, `supabase.auth.getUser`, direct membership
// query (the `is_newsroom_editor_or_admin` RPC is broken under
// service-role per NR-D6b IP-3).
//
// Response shape:
//   200 { ok: true, newStatus, newVisibility, newPublishedAt, newArchivedAt }
//   200 { ok: false, errorCode, missingPreconditions?, from?, to?, hint? }
//   400 invalid-body / validation
//   401 unauthenticated
//   403 forbidden
//   404 not-found / feature-disabled
//   500 internal (transport-level RPC failure)
//
// Note: 200-with-`ok:false` is the canonical shape for predictable
// business-logic failures (illegal transition, preconditions not
// met, embargo accessed). Only transport-level RPC errors (RPC
// unreachable, malformed response) escalate to 500. The client
// (F5 publish-confirmation modal) pattern-matches on `ok` and
// surfaces the error inline.
//
// Spec cross-references:
//   - directives/NR-D9b-publish-flow.md §F7
//   - src/lib/newsroom/pack-transition.ts — `transitionPack`
//     wrapper + `TransitionResult`
//   - src/lib/newsroom/publish-checklist.ts — `transitionRequestSchema`
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import { transitionPack } from '@/lib/newsroom/pack-transition'
import { transitionRequestSchema } from '@/lib/newsroom/publish-checklist'

export const runtime = 'nodejs'

const ROUTE_POST =
  'POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/transition'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

interface AuthContext {
  authUserId: string
  companyId: string
  packId: string
}

/**
 * Auth + admin + pack lookup. NO pack-status guard — the RPC is
 * the canonical state-mutation gate, and admins may legitimately
 * transition packs out of non-draft states (e.g. published →
 * archived, scheduled → draft pullback).
 */
async function resolveAuthContext(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string }> },
  routeLabel: string,
): Promise<AuthContext | NextResponse> {
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
      '[newsroom.transition] companies lookup failed',
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
      '[newsroom.transition] membership lookup failed',
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
    .select('id')
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
      '[newsroom.transition] pack lookup failed',
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

  return {
    authUserId,
    companyId,
    packId: pack.id as string,
  }
}

// ─── POST (request a state transition) ─────────────────────────

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

  const ctx = await resolveAuthContext(request, context, ROUTE_POST)
  if (ctx instanceof NextResponse) return ctx

  const parsed = transitionRequestSchema.safeParse(rawBody)
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

  let result
  try {
    result = await transitionPack(supabase, {
      packId: ctx.packId,
      targetStatus: data.targetStatus,
      callerUserId: ctx.authUserId,
      overrideEmbargoCancel: data.overrideEmbargoCancel ?? false,
    })
  } catch (err) {
    logger.error(
      {
        route: ROUTE_POST,
        companyId: ctx.companyId,
        packId: ctx.packId,
        targetStatus: data.targetStatus,
        rawMessage: err instanceof Error ? err.message : String(err),
      },
      '[newsroom.transition] RPC transport failure',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  if (result.ok) {
    logger.info(
      {
        route: ROUTE_POST,
        companyId: ctx.companyId,
        packId: ctx.packId,
        targetStatus: data.targetStatus,
        newStatus: result.newStatus,
      },
      '[newsroom.transition] transition succeeded',
    )
  } else {
    logger.info(
      {
        route: ROUTE_POST,
        companyId: ctx.companyId,
        packId: ctx.packId,
        targetStatus: data.targetStatus,
        errorCode: result.errorCode,
      },
      '[newsroom.transition] transition rejected by RPC',
    )
  }

  // 200 regardless of `ok` — the discriminated union signals
  // success/failure to the client. Transport-level errors raised
  // above as 500.
  return NextResponse.json(result, { status: 200 })
}
