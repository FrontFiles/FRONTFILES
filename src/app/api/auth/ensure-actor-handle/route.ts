// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/auth/ensure-actor-handle
// (P4 concern 4A.2.AUTH, F4)
//
// Idempotently provisions the caller's `actor_handles` row. Called
// by the client immediately after a successful sign-in (and as a
// safety-net during onboarding completion in a future concern).
// Returns `{ data: { provisioned: boolean } }` where:
//
//   provisioned: true  → the row did NOT exist; this call inserted it
//   provisioned: false → the row already existed; this was a no-op
//
// ─── Why this route does NOT use `requireActor` ────────────────
//
// `requireActor` (src/lib/auth/require-actor.ts) is fail-closed on
// the actor_handles lookup: a signed-in user with no row gets
// 403 ACTOR_NOT_FOUND. That is the correct contract for every
// other API route — but THIS route exists precisely to create the
// missing row. Reusing requireActor would lock new users out of
// their own provisioning call. We therefore inline the prefix
// (flag check + Bearer extract + token validation) and skip the
// actor_handles lookup that requireActor does last.
//
// ─── Why this route uses the SERVICE-ROLE client ───────────────
//
// User-JWT requests are gated by RLS. The `actor_handles` insert
// policy in migration 20260421000004 is restrictive — RLS would
// reject an INSERT from a session whose `auth.uid()` has no
// existing row, which is exactly the case we need to handle. The
// service-role client bypasses RLS so the upsert can land. This
// is the SINGLE sanctioned use of service-role inside a user-
// facing route handler in this concern (P4_CONCERN_4A_2_AUTH
// _DIRECTIVE.md §D2). Any other route attempting it requires an
// R-revision.
//
// The token is still validated via `auth.getUser(token)` before
// the upsert runs, so the row that gets created is always pinned
// to a real, currently-authenticated `auth.users.id`.
//
// ─── Re-signup tombstone semantics (per §AUDIT-1 S3) ───────────
//
// `actor_handles.auth_user_id` has `ON DELETE SET NULL` (DDL L86).
// If a user deletes their auth account and re-signs-up with the
// same email, Supabase issues a NEW `auth.users.id`. The old
// `actor_handles` row persists with `auth_user_id = NULL` (a
// pseudonymisation tombstone, frozen for ledger references per
// ECONOMIC_FLOW_v1 §8.4). This route then creates a NEW row
// with a fresh `handle`. That is correct, expected behaviour —
// not a bug. The partial unique index `(auth_user_id) WHERE
// auth_user_id IS NOT NULL` allows multiple NULL rows but only
// one live row per auth_user_id, which is exactly the invariant
// we want.
//
// ─── Why explicit INSERT + catch 23505, NOT supabase-js upsert ─
//
// The unique constraint we need to honour is a PARTIAL index:
//
//   CREATE UNIQUE INDEX actor_handles_auth_user_id_unique
//     ON actor_handles (auth_user_id) WHERE auth_user_id IS NOT NULL;
//
// PostgreSQL's index-inference rules for `ON CONFLICT (col) DO
// NOTHING` REQUIRE the partial-index predicate to appear in the
// conflict target as well — `ON CONFLICT (auth_user_id) WHERE
// auth_user_id IS NOT NULL DO NOTHING`. supabase-js's `.upsert()`
// with `onConflict: 'auth_user_id'` cannot pass that predicate
// through PostgREST, and Postgres rejects the inference with
// "there is no unique or exclusion constraint matching the
// ON CONFLICT specification". §AUDIT-1 S1 in the directive
// flagged this exact scenario.
//
// Two viable paths: (a) raw INSERT and catch the unique-violation
// (Postgres error code 23505) as the "already exists" branch;
// (b) a Postgres function that wraps the INSERT with the proper
// inference predicate, called via `.rpc()`. Path (a) is what we
// use: it needs no migration, is race-safe (the partial unique
// index handles concurrent inserts at the storage layer; the
// loser's transaction errors with 23505), and is one round-trip.
// Path (b) would be marginally cleaner for transactional bundling
// but is worth its own concern, not a side-task here.
//
// ─── Provisioning outcomes ────────────────────────────────────
//
// INSERT succeeds                  → 200 { provisioned: true }
// INSERT fails with code === '23505' → 200 { provisioned: false }
// INSERT fails with anything else  → 500 INTERNAL
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

import { isAuthWired } from '@/lib/flags'
import { getSupabaseClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

const ROUTE = 'POST /api/auth/ensure-actor-handle'

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Flag gate — fail-closed when auth is not wired.
  if (!isAuthWired()) {
    return errorResponse(404, 'FEATURE_DISABLED', 'Feature not enabled.')
  }

  // 2. Bearer extract — empty/malformed Authorization fails 401.
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }

  // 3. Validate the token. Use the service-role client purely as
  //    the carrier for `auth.getUser(token)` — the token argument
  //    short-circuits the session path, so the key is only
  //    authorising the verify call. This is the same pattern
  //    `requireActor` uses (and is documented in src/lib/db/client.ts).
  const supabase = getSupabaseClient()
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const authUserId = userData.user.id

  // 4. Idempotent INSERT. We rely on the partial unique index to
  //    enforce one live row per auth_user_id; concurrent second
  //    inserts get a 23505 unique-violation from Postgres and we
  //    translate that into the "already provisioned" outcome.
  const { error: insertError } = await supabase
    .from('actor_handles')
    .insert({ auth_user_id: authUserId })

  if (insertError) {
    // Postgres SQLSTATE 23505 = unique_violation. The PostgREST /
    // supabase-js path surfaces it on `error.code`.
    if (insertError.code === '23505') {
      logger.info(
        { route: ROUTE, authUserId, provisioned: false },
        '[auth.ensure-actor-handle] already provisioned',
      )
      return NextResponse.json(
        { data: { provisioned: false } },
        { status: 200 },
      )
    }
    logger.error(
      {
        route: ROUTE,
        authUserId,
        rawCode: insertError.code,
        rawMessage: insertError.message,
      },
      '[auth.ensure-actor-handle] insert failed',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }

  logger.info(
    { route: ROUTE, authUserId, provisioned: true },
    '[auth.ensure-actor-handle] ok',
  )

  return NextResponse.json(
    { data: { provisioned: true } },
    { status: 200 },
  )
}
