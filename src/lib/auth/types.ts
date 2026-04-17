/**
 * Auth provider — result types.
 *
 * These types are imported by `src/lib/auth/provider.ts`
 * (which carries a `'use server'` directive and therefore
 * cannot export types of its own) and by
 * `src/lib/onboarding/account-creation.ts` (which orchestrates
 * the auth provider and the identity store).
 *
 * Keeping them in a dedicated file:
 *   1. Keeps provider.ts export-clean for the 'use server'
 *      directive (which forbids non-async-function exports).
 *   2. Gives tests a single import point for the type union
 *      without dragging in the provider implementation.
 */

/**
 * The subset of an auth user that onboarding cares about.
 *
 * The real provider (Supabase) exposes much more on its user
 * object (created_at, app_metadata, user_metadata, app_id,
 * phone, etc.) but PR 3 deliberately doesn't ship any of that
 * through the seam. The onboarding flow only needs an id to
 * adopt as `users.id`, the email to stamp on the Frontfiles
 * row, and a confirmation flag to drive the Phase 0 checkpoint.
 */
export interface AuthUser {
  id: string
  email: string
  /**
   * `true` iff the auth provider considers the email address
   * verified. In Supabase this maps to `email_confirmed_at`
   * being non-null. In mock mode it's a test-controlled flag.
   */
  emailConfirmed: boolean
}

/**
 * The outcome of calling `signUpOrAdoptAuthUser`.
 *
 *   - `created`  — no auth user existed for this email; a new
 *                  one was minted.
 *   - `adopted`  — an auth user for this email already existed,
 *                  the caller's password matched, and the
 *                  provider returned the existing row. This is
 *                  how a partial-failure retry finds its way
 *                  back to the same auth id without leaving a
 *                  dangling Supabase user behind.
 *
 * Both outcomes carry `needsEmailVerification` so the caller
 * can drive the Phase 0 checkpoint. An adopted row that is
 * still unconfirmed will have `needsEmailVerification: true`
 * until the user clicks the confirmation link.
 */
export type AuthSignUpOutcome =
  | {
      kind: 'created'
      authUser: AuthUser
      needsEmailVerification: boolean
    }
  | {
      kind: 'adopted'
      authUser: AuthUser
      needsEmailVerification: boolean
    }
