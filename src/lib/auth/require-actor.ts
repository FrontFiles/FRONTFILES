'use server'

/**
 * Frontfiles — requireActor (spec-canonical actor resolution)
 *
 * Single entry point used by every spec-canonical replacement
 * route handler (concern 4) to resolve the request's actor
 * against the `actor_handles` pseudonymisation table.
 *
 * References:
 *   - ECONOMIC_FLOW_v1 §8.4 — actor_handles shape and tombstone
 *     semantics; system-actor sentinel invariant.
 *   - docs/audits/P4_IMPLEMENTATION_PLAN.md §6.2 — source-of-truth
 *     row in the concern-3 file table.
 *   - docs/audits/P4_CONCERN_3_DIRECTIVE.md — this file's
 *     governing directive, including the fail-closed contract
 *     and the token-extraction scope.
 *
 * Contract (four outcomes):
 *
 *   1. Flag off (`isAuthWired() === false`) →
 *      `{ ok: false, reason: 'FEATURE_DISABLED' }`.
 *      Fail-closed. The route handler turns this into a 404
 *      `FEATURE_DISABLED` response (FFF Sharing pattern).
 *
 *   2. Flag on, no session token on the request →
 *      `{ ok: false, reason: 'UNAUTHENTICATED' }`.
 *
 *   3. Flag on, session token present but no matching
 *      `actor_handles` row (or the row is tombstoned) →
 *      `{ ok: false, reason: 'ACTOR_NOT_FOUND' }`.
 *
 *   4. Flag on, session token present, live `actor_handles`
 *      row resolved →
 *      `{ ok: true, actor: { handle, authUserId } }`.
 *
 * The §8.4 system-actor sentinel (seeded by M5 at
 * supabase/migrations/20260421000005_seed_system_actor.sql
 * with handle `00000000-0000-0000-0000-000000000001` and
 * `auth_user_id = NULL`) is structurally unreachable from this
 * helper: the step-3 lookup filters by `auth_user_id = <caller>`
 * and `auth_user_id` on the sentinel is NULL, so no real
 * `auth.uid()` ever matches it. §8.4's "never exposed to
 * clients" invariant therefore holds without an explicit guard.
 *
 * 'use server' note: the two `export type` declarations below
 * are erased at compile time and do not become Server Functions.
 * The only runtime export is `requireActor`, matching AC #7.
 */

import { isAuthWired } from '@/lib/flags'

export type Actor = {
  /** uuid — actor_handles.handle (§8.4). */
  handle: string
  /** uuid — actor_handles.auth_user_id (§8.4). */
  authUserId: string
}

export type RequireActorResult =
  | { ok: true; actor: Actor }
  | {
      ok: false
      reason: 'FEATURE_DISABLED' | 'UNAUTHENTICATED' | 'ACTOR_NOT_FOUND'
    }

/**
 * Extract a Supabase access token from the request.
 *
 * v1 scope: Authorization header only (`Authorization: Bearer <jwt>`).
 * Cookie-based session extraction is deferred — concern 4's
 * replacement routes can surface their token-carrying shape
 * (header, cookie, or both) and this helper extends accordingly.
 * The discriminated-union return shape is stable either way.
 */
function extractAccessToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export async function requireActor(
  req: Request,
): Promise<RequireActorResult> {
  if (!isAuthWired()) {
    return { ok: false, reason: 'FEATURE_DISABLED' }
  }

  const token = extractAccessToken(req)
  if (!token) {
    return { ok: false, reason: 'UNAUTHENTICATED' }
  }

  // Lazy import mirrors src/lib/auth/provider.ts — keeps the
  // module-load graph trivial when the flag is off and the
  // Supabase client never needs to materialise.
  const { getSupabaseClient } = await import('@/lib/db/client')
  const client = getSupabaseClient()

  // `auth.getUser(jwt)` validates the JWT against Supabase's auth
  // server and returns the user record. This works with the
  // service-role client because the token argument short-circuits
  // the session path — the key only authorises the verify call.
  const { data: userData, error: userError } = await client.auth.getUser(
    token,
  )
  if (userError || !userData?.user) {
    return { ok: false, reason: 'UNAUTHENTICATED' }
  }
  const authUserId = userData.user.id

  // §8.4 system-actor sentinel cannot match here (auth_user_id IS
  // NULL on that row); see the module header for the invariant.
  const { data: row, error: lookupError } = await client
    .from('actor_handles')
    .select('handle, auth_user_id')
    .eq('auth_user_id', authUserId)
    .is('tombstoned_at', null)
    .maybeSingle()
  if (lookupError || !row) {
    return { ok: false, reason: 'ACTOR_NOT_FOUND' }
  }

  return {
    ok: true,
    actor: {
      handle: row.handle as string,
      authUserId: row.auth_user_id as string,
    },
  }
}
