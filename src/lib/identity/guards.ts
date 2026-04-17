/**
 * Frontfiles — Role Grant Guards
 *
 * Server-side authorization primitives built on the Phase A
 * identity store. Every API route that performs a role-scoped
 * action (upload, create offer, fund assignment, accept offer,
 * etc.) should assert that the acting user holds the expected
 * `user_granted_types` entry before side-effects run.
 *
 * Phase B scope:
 *   - Provide the `requireGrant` primitive and a companion
 *     helper `hasGrant`.
 *   - Wire the guard into one or two obvious role-scoped
 *     POST routes (direct-offer create, assignment create)
 *     as a proof of concept.
 *   - Keep the guard compatible with the existing mock
 *     auth model — callers pass a user id explicitly.
 *
 * Phase B intentionally does NOT:
 *   - Extract the user id from a real session cookie
 *     (there is no real auth backend yet — see `signin/page.tsx`).
 *   - Retrofit every API route (too broad a scope for this
 *     phase — B.8 is groundwork, not a full migration).
 */

import { NextResponse } from 'next/server'
import { getGrantsForUser, getUserById } from './store'
import type { UserType } from './types'

// ══════════════════════════════════════════════
// LOW-LEVEL CHECK
// ══════════════════════════════════════════════

/**
 * Returns `true` if `userId` holds the requested grant.
 *
 * Use this when the caller just needs a boolean and does
 * not want to throw or emit an HTTP response.
 */
export async function hasGrant(
  userId: string,
  required: UserType,
): Promise<boolean> {
  const grants = await getGrantsForUser(userId)
  return grants.includes(required)
}

// ══════════════════════════════════════════════
// FAILURE SHAPES
// ══════════════════════════════════════════════

export type GrantCheckFailure =
  | { kind: 'missing_user_id' }
  | { kind: 'user_not_found'; userId: string }
  | { kind: 'missing_grant'; userId: string; required: UserType; held: UserType[] }

/**
 * Returns `null` when the check passes, otherwise a structured
 * failure describing why. Does not throw.
 *
 * Use this when you want to bail out of a handler with a
 * typed failure and craft your own response shape.
 */
export async function checkGrant(
  userId: string | null | undefined,
  required: UserType,
): Promise<GrantCheckFailure | null> {
  if (!userId) return { kind: 'missing_user_id' }
  const user = await getUserById(userId)
  if (!user) return { kind: 'user_not_found', userId }
  const grants = await getGrantsForUser(userId)
  if (!grants.includes(required)) {
    return { kind: 'missing_grant', userId, required, held: grants }
  }
  return null
}

// ══════════════════════════════════════════════
// HTTP RESPONSE HELPER
// ══════════════════════════════════════════════

/**
 * Checks a grant and, on failure, returns a `NextResponse`
 * suitable for immediate return from a route handler. On
 * success returns `null`, letting the handler continue.
 *
 * Typical usage inside a Next.js App Router route:
 *
 *   const denial = await requireGrant(body.buyerId, 'buyer')
 *   if (denial) return denial
 *   // proceed with the buyer-scoped write
 */
export async function requireGrant(
  userId: string | null | undefined,
  required: UserType,
): Promise<NextResponse | null> {
  const failure = await checkGrant(userId, required)
  if (!failure) return null

  switch (failure.kind) {
    case 'missing_user_id':
      return NextResponse.json(
        {
          error: 'MISSING_USER_ID',
          message: `This endpoint requires a user id (expected a '${required}' grant).`,
        },
        { status: 401 },
      )
    case 'user_not_found':
      return NextResponse.json(
        {
          error: 'USER_NOT_FOUND',
          message: `User '${failure.userId}' is not known to the identity store.`,
        },
        { status: 401 },
      )
    case 'missing_grant':
      return NextResponse.json(
        {
          error: 'MISSING_GRANT',
          message: `User '${failure.userId}' does not hold the '${required}' grant.`,
          required,
          held: failure.held,
        },
        { status: 403 },
      )
  }
}
