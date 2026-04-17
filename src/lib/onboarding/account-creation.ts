'use server'

/**
 * Onboarding — account creation seam.
 *
 * Single Server Action that Phase 0 calls to create (or adopt)
 * a Frontfiles account. PR 3 upgraded this from a wizard-only
 * helper into the real auth entry point:
 *
 *   1. `signUpOrAdoptAuthUser` mints (or adopts) the auth user
 *      and returns a stable `authUserId`.
 *   2. `getUserById(authUserId)` checks whether a Frontfiles
 *      `users` row already exists for that auth id. If so, the
 *      call re-grants the selected role (idempotent) and
 *      returns the existing row — this is the partial-failure
 *      retry path.
 *   3. Otherwise `createUser({ id: authUserId, ... })` writes a
 *      fresh row whose primary key is the auth user id, so
 *      `users.id === auth.users.id`. Migration 9 documents this
 *      rule at the top of the `users` table: the FK to
 *      `auth.users` is added at the RLS phase, but the id shape
 *      is already locked.
 *   4. `grantUserType` applies the role. It's idempotent on
 *      both the mock and Supabase paths.
 *
 * AUTH ↔ APP LINKING MODEL
 *
 * There is NO separate `auth_user_id` column. The Frontfiles
 * `users` row and the Supabase `auth.users` row share the same
 * primary key. That keeps joins trivial, matches the migration
 * 9 intent, and means the only thing this function has to get
 * right is "use the auth id as the users id on insert."
 *
 * PARTIAL-FAILURE RECOVERY
 *
 * Three drift cases are handled end-to-end:
 *
 *   A. Auth created / Frontfiles row missing:
 *      `signUpOrAdoptAuthUser` adopts the existing auth user,
 *      `getUserById` returns null, we fall through to the
 *      fresh-insert branch and fill the hole. Result: a single
 *      `users` row keyed on the auth id.
 *
 *   B. Auth + Frontfiles row created / grant missing:
 *      `signUpOrAdoptAuthUser` adopts, `getUserById` returns
 *      the existing row, `grantUserType` re-applies (idempotent).
 *      Result: grant present, no duplicate row.
 *
 *   C. Everything created, submit failed between writes and
 *      the reducer's `SET_CREATED_USER_ID` dispatch:
 *      Same as (B). The wizard state in localStorage lost the
 *      user id, but the auth provider still knows the email,
 *      so the re-submit finds the auth user, the existing
 *      Frontfiles row, and the existing grant — the whole call
 *      is effectively a no-op that returns the row. `reused`
 *      is set to `true` so the wizard can distinguish this
 *      from a fresh signup if it wants to (it doesn't today).
 *
 * The wizard treats `reused` and `reused === false` the same:
 * both outcomes end in `SET_CREATED_USER_ID` + step advance.
 * The flag is surfaced for analytics and so integration tests
 * can assert on the retry path.
 *
 * VERIFICATION BEHAVIOR
 *
 * `needsEmailVerification` comes directly from the auth
 * provider (mock or Supabase). When it's true, the Phase 0
 * component holds the user on a "verify your email" checkpoint
 * instead of advancing to the role-specific step. See
 * `Phase0CreateAccount.tsx` and the `awaitingEmailVerification`
 * branch in the reducer / `useOnboardingFlow`.
 *
 * 'use server' export rules: this file is tagged
 * `'use server'`, which means every export is a Server Action
 * callable over RPC. Non-async-function exports are forbidden,
 * so the input / result types live in
 * `./account-creation-types.ts`.
 */

import { signUpOrAdoptAuthUser } from '@/lib/auth/provider'
import {
  createUser,
  getUserById,
  grantUserType,
} from '@/lib/identity/store'
import type { CreateUserInput } from '@/lib/identity/types'
import type {
  CreateOnboardingAccountInput,
  CreateOnboardingAccountResult,
} from './account-creation-types'

/**
 * Create an onboarding account, or adopt an existing one on a
 * retry of the same signup.
 *
 * ── Idempotency contract ──────────────────────────────────
 *
 * Safe to call more than once with the same `(email, password,
 * username, role)` tuple. The function delegates uniqueness to
 * the auth provider (email) and to the Frontfiles store
 * (username). The narrow retry path it exists to support is
 * the one where Phase 0 submitted once, one or more of the
 * downstream writes failed, and the user resubmitted the form.
 *
 * Because the auth provider rejects a password mismatch with a
 * hard error, retrying with the wrong password raises the auth
 * error verbatim and never touches the Frontfiles store. This
 * is the only reason the function takes a password: to prove
 * the caller owns the auth row it's about to adopt.
 *
 * Errors from both layers are re-thrown as-is so the caller
 * can surface the underlying message (typically "already
 * registered", "username already taken", or a network failure).
 * The caller is responsible for displaying the error to the
 * user.
 */
export async function createOnboardingAccount(
  input: CreateOnboardingAccountInput,
): Promise<CreateOnboardingAccountResult> {
  // ── Step 1 — auth provider ──────────────────────────────
  //
  // Mint or adopt the auth user first. After this call we
  // know the canonical auth user id and whether the provider
  // has confirmed the email. Every downstream write keys on
  // `authOutcome.authUser.id`.
  const authOutcome = await signUpOrAdoptAuthUser({
    email: input.email,
    password: input.password,
  })
  const authUserId = authOutcome.authUser.id
  const needsEmailVerification = authOutcome.needsEmailVerification

  // ── Step 2 — adopt-or-create Frontfiles row ─────────────
  //
  // If the row already exists at the auth id, this is either
  // case (B) (grant missing) or case (C) (wizard lost track
  // of the id in localStorage). Either way, we re-grant and
  // return the existing row.
  const existing = await getUserById(authUserId)
  if (existing) {
    await grantUserType(existing.id, input.role)
    return {
      user: existing,
      role: input.role,
      reused: true,
      needsEmailVerification,
    }
  }

  // ── Step 3 — fresh insert path ──────────────────────────
  //
  // `id: authUserId` is the seam that makes `users.id ===
  // auth.users.id` on the Supabase path. The mock store honors
  // the same rule.
  const createInput: CreateUserInput = {
    id: authUserId,
    username: input.username,
    // Phase 0 does not collect a separate display name — the
    // username is used as the initial display name and the
    // `/account/profile` editor lets the user change it later.
    display_name: input.username,
    email: input.email,
    avatar_url: null,
    founding_member: false,
  }

  const user = await createUser(createInput)
  await grantUserType(user.id, input.role)

  return {
    user,
    role: input.role,
    reused: false,
    needsEmailVerification,
  }
}
