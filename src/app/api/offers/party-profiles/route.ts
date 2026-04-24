// ═══════════════════════════════════════════════════════════════
// Frontfiles — GET /api/offers/party-profiles (P4 concern 4A.2.C1 §F1–F3)
//
// Returns counterparty display identity (`{id, username, display_name,
// account_state}`) for users the authenticated caller shares an
// offer thread with. Sources from `public.users`, NOT from the
// ledger-pseudonym `actor_handles` table (directive §CONTEXT
// distinction).
//
// ─── Auth + flag gate (§F3) ─────────────────────────────────────
//
// - `FFF_AUTH_WIRED = false`  → 200 `{ users: [], flag: 'AUTH_WIRED_OFF' }`
//   Graceful-empty short-circuit per §F3 L102. UI renders empty
//   without branching on HTTP status.
// - `FFF_AUTH_WIRED = true` + no auth → 401 `UNAUTHENTICATED`.
// - `FFF_AUTH_WIRED = true` + auth + no actor row → 403 `ACTOR_NOT_FOUND`.
// - `FFF_AUTH_WIRED = true` + authed actor → normal query path.
//
// ─── Query contract (§F1) ───────────────────────────────────────
//
// - `ids` — comma-separated uuid csv. Max 100 per request; >100 →
//   414 `TOO_MANY_IDS`. Empty/absent → 400 `MISSING_IDS`.
// - Duplicates in the csv are deduped client-side; §F1 L61 also
//   says server-side `ANY` would dedupe regardless.
//
// ─── Party-scope enforcement (§F2 equivalent) ───────────────────
//
// §F2 specifies SECURITY INVOKER inline SQL with an EXISTS
// semi-join against `public.offers`. supabase-js does not expose
// a raw-SQL escape hatch, and the directive forbids RPC / stored
// procedures / SECURITY DEFINER. We achieve the same outcome in
// two PostgREST calls:
//
//   Step 1 — read the caller's own offers (party-scoped by
//            existing offers RLS). Extract counterparty user_ids.
//   Step 2 — read `public.users` for request-ids ∩ counterparty-ids.
//
// Users whose id is not in the caller's counterparty set are
// silently filtered — no 403, no carve-out — matching the spec's
// "silent filter" convention (§F1 L68).
//
// ─── Response shape ─────────────────────────────────────────────
//
// 200 `{ users: Array<{ id, username, display_name, account_state }> }`
// on success, with optional `flag: 'AUTH_WIRED_OFF'` on the
// flag-off short-circuit.
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { requireActor } from '@/lib/auth/require-actor'
import { getSupabaseClientForUser } from '@/lib/db/client'

const ROUTE = 'GET /api/offers/party-profiles'
const MAX_IDS = 100

// ─── Helpers ────────────────────────────────────────────────────

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

function errorResponse(
  httpStatus: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status: httpStatus },
  )
}

// ─── Handler ────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Validate query param shape independent of auth state.
  //    (Keeps behaviour consistent with the existing /api/offers
  //    validation-before-lookup pattern; MISSING_IDS / TOO_MANY_IDS
  //    surface before we ever touch the flag or the DB.)
  const idsParam = new URL(request.url).searchParams.get('ids')
  if (idsParam === null || idsParam.trim().length === 0) {
    return errorResponse(400, 'MISSING_IDS', 'Provide at least one id.')
  }
  const rawIds = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (rawIds.length === 0) {
    return errorResponse(400, 'MISSING_IDS', 'Provide at least one id.')
  }
  if (rawIds.length > MAX_IDS) {
    return errorResponse(
      414,
      'TOO_MANY_IDS',
      `Maximum ${MAX_IDS} ids per request.`,
    )
  }
  // Client-side dedup per §F1 L61 — keeps the two-call pattern
  // under predictable bounds regardless of csv duplication.
  const ids = Array.from(new Set(rawIds))

  // 2. Auth gate. Note the §F3 override: FEATURE_DISABLED returns
  //    200 with an empty users array, NOT 404 — the graceful-empty
  //    shape lets the UI render empty state without status branching.
  const actorResult = await requireActor(request)
  if (!actorResult.ok) {
    if (actorResult.reason === 'FEATURE_DISABLED') {
      return NextResponse.json(
        { users: [], flag: 'AUTH_WIRED_OFF' },
        { status: 200 },
      )
    }
    if (actorResult.reason === 'UNAUTHENTICATED') {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
    }
    if (actorResult.reason === 'ACTOR_NOT_FOUND') {
      return errorResponse(403, 'ACTOR_NOT_FOUND', 'Actor profile not found.')
    }
    // Exhaustiveness guard — the union is three-valued today.
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  const actor = actorResult.actor

  // 3. Build the user-JWT Supabase client. Token must still be on
  //    the request at this point (requireActor already validated
  //    it); defensive check mirrors /api/offers/route.ts pattern.
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const supabase = getSupabaseClientForUser(accessToken)

  // 4. Step 1 — enumerate the caller's offers. Existing offers
  //    RLS scopes the result to rows where buyer_id or creator_id
  //    equals auth.uid(); the explicit .or() is belt-and-braces.
  const { data: offerRows, error: offersErr } = await supabase
    .from('offers')
    .select('buyer_id, creator_id')
    .or(
      `buyer_id.eq.${actor.authUserId},creator_id.eq.${actor.authUserId}`,
    )

  if (offersErr) {
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }

  // 5. Build the counterparty set. For each offer the caller is
  //    party to, add the OTHER party's user id.
  const counterpartySet = new Set<string>()
  const typedRows = (offerRows ?? []) as Array<{
    buyer_id: string
    creator_id: string
  }>
  for (const row of typedRows) {
    if (row.buyer_id !== actor.authUserId) counterpartySet.add(row.buyer_id)
    if (row.creator_id !== actor.authUserId)
      counterpartySet.add(row.creator_id)
  }

  // 6. Silent-filter requested ids to the counterparty set (§F1 L68).
  const allowedIds = ids.filter((id) => counterpartySet.has(id))
  if (allowedIds.length === 0) {
    return NextResponse.json({ users: [] }, { status: 200 })
  }

  // 7. Step 2 — fetch profile columns for the surviving ids.
  const { data: userRows, error: usersErr } = await supabase
    .from('users')
    .select('id, username, display_name, account_state')
    .in('id', allowedIds)

  if (usersErr) {
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }

  const users = (userRows ?? []) as Array<{
    id: string
    username: string
    display_name: string
    account_state: string
  }>

  // Route identifier is captured for future log-wiring — the
  // existing /api/offers routes attach a pino logger via
  // @/lib/logger; this module deliberately stays log-silent in
  // its first cut to keep the surface minimal. Follow-up concern.
  void ROUTE

  return NextResponse.json({ users }, { status: 200 })
}
