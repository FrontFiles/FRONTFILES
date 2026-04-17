/**
 * Onboarding — account creation result types.
 *
 * Imported by `src/lib/onboarding/account-creation.ts` (which
 * carries a `'use server'` directive and therefore cannot
 * export types of its own) and by the Phase 0 client component
 * and tests that call the server action.
 *
 * PR 3 note: this file was introduced when `account-creation.ts`
 * was upgraded to a real Server Action. Before PR 3 the types
 * lived next to the implementation; Next.js 16 Server Function
 * rules (see `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`)
 * forbid non-async-function exports from a `'use server'` module,
 * so the types live next door in this plain module.
 */

import type { UserRow } from '@/lib/identity/types'
import type { OnboardingRole } from './types'

export interface CreateOnboardingAccountInput {
  email: string
  username: string
  /**
   * Minimum 8 characters. The UI enforces this; the server
   * action defends itself with the same rule (see
   * `@/lib/auth/provider`) because a Server Action is
   * POST-reachable outside the React form.
   */
  password: string
  role: OnboardingRole
}

/**
 * The outcome of `createOnboardingAccount`.
 *
 *   - `user` — the Frontfiles `users` row. For a fresh signup
 *     this is a new row whose `id` is the auth user id. For a
 *     retry / resume this is the existing row that was adopted.
 *   - `role` — echoed back so the caller doesn't have to hold
 *     onto the dispatched value separately.
 *   - `reused` — `true` iff the call found a `users` row that
 *     already existed for the auth user id. Lets the wizard
 *     tell the difference between a fresh submit and a partial-
 *     failure retry for analytics / telemetry.
 *   - `needsEmailVerification` — `true` iff the auth provider
 *     has not yet confirmed the user's email. The wizard uses
 *     this to stop at the Phase 0 verification checkpoint
 *     instead of advancing to the role-specific step. In mock
 *     mode this is `false` by default; tests that exercise the
 *     checkpoint opt in via `_setMockVerificationRequired(true)`
 *     on the auth provider.
 */
export interface CreateOnboardingAccountResult {
  user: UserRow
  role: OnboardingRole
  reused: boolean
  needsEmailVerification: boolean
}
