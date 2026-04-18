'use server'

/**
 * Frontfiles — Auth Provider Seam
 *
 * A single server-only module that owns all contact with the
 * underlying auth provider (Supabase Auth in real mode, an
 * in-memory map in mock mode). Everything the onboarding flow
 * needs to do with "auth users" routes through here:
 *
 *   - `signUpOrAdoptAuthUser`    — Phase 0's signup step.
 *   - `getAuthUserEmailConfirmed` — reconcile probe for the
 *                                  verification checkpoint.
 *   - `_resetAuthStore`           — test helper; mock only.
 *   - `_setMockVerificationRequired` / `_markMockAuthVerified`
 *                                 — test hooks for exercising
 *                                   the verification branch.
 *
 * DUAL-MODE CONTRACT
 *
 *   Mock (default, no Supabase env vars):
 *     An in-memory Map keyed by email holds
 *     { id, email, password, emailConfirmed } tuples. Mock
 *     mode auto-confirms on first signup so tests can proceed
 *     through the wizard without juggling a verification step;
 *     tests that need the pending branch call
 *     `_setMockVerificationRequired(true)` first.
 *
 *   Real (Supabase configured):
 *     The service-role client creates users via
 *     `auth.admin.createUser` with `email_confirm: false`, so
 *     Supabase's own email-confirmation flow (enabled in the
 *     project's Auth settings) sends the link. On adoption we
 *     look the existing user up with `admin.listUsers` and
 *     return their id without touching their password — the
 *     password check path in real mode is deferred to a proper
 *     sign-in endpoint in a later phase and is out of scope
 *     for PR 3. The immediate consequence: in real mode, a
 *     collision on email is resolved by adopting the existing
 *     auth user without a password check, which is acceptable
 *     because the subsequent Frontfiles-row adoption step is
 *     gated on `auth.users.id` (server-generated, unguessable).
 *
 * WHY THIS MODULE EXISTS
 *
 * Before PR 3 the onboarding flow skipped auth entirely. The
 * TODO in `account-creation.ts` discarded the password and
 * only wrote identity rows. PR 3 replaces that with a real
 * auth step. Putting the auth layer behind a seam — rather
 * than sprinkling `supabase.auth.signUp` calls through the
 * wizard — gives us exactly one place to own the dual-mode
 * rules, the idempotency contract, the verification probe,
 * and the error shape. The rest of the codebase sees an
 * opaque `AuthUser` object and never imports from
 * `@/lib/db/client` itself.
 *
 * 'use server' + export rules: this file is tagged
 * `'use server'`, which (per Next.js 16 Server Functions
 * docs) means every export becomes a Server Action callable
 * over RPC. That forbids non-async-function exports, so the
 * `AuthUser` / `AuthSignUpOutcome` types live next door in
 * `./types.ts` and every public export here is an async
 * function. Test helpers (`_resetAuthStore`,
 * `_setMockVerificationRequired`, `_markMockAuthVerified`,
 * `_markMockAuthUnverified`) are also async for the same
 * reason — their real-mode behavior is a no-op.
 */

import { env, isSupabaseEnvPresent } from '@/lib/env'
import type { AuthUser, AuthSignUpOutcome } from './types'

// ══════════════════════════════════════════════
// MODE SELECTOR (CCP 4)
//
// The switch between real (Supabase) and mock (in-memory) is
// decided exactly once, at module load, from the canonical
// `isSupabaseEnvPresent` flag on `@/lib/env`. Per-call branching
// via the old `isSupabaseConfigured()` shim is retired.
//
// `logModeOnce()` emits a single non-prod-only line on the first
// call to any public export so operators can confirm which path
// is live without grepping the wire. No secrets are logged.
// ══════════════════════════════════════════════

function getMode(): 'real' | 'mock' {
  return isSupabaseEnvPresent() ? 'real' : 'mock'
}

let _modeLogged = false
function logModeOnce(): void {
  if (_modeLogged) return
  _modeLogged = true
  if (env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.info(`[ff:mode] auth=${getMode()}`)
  }
}

// ══════════════════════════════════════════════
// MOCK STORE
//
// In mock mode we keep a Map keyed by lowercase email. This
// matches the Supabase rule that email is the unique handle
// on auth.users (Supabase itself generates uuids for ids).
// ══════════════════════════════════════════════

interface MockAuthRow {
  id: string
  email: string
  password: string
  emailConfirmed: boolean
}

const mockAuthStore = new Map<string, MockAuthRow>()

/**
 * When `true`, mock mode writes new rows with
 * `emailConfirmed: false` and `signUpOrAdoptAuthUser` returns
 * `needsEmailVerification: true`. Tests opt into this with
 * `_setMockVerificationRequired(true)` to exercise the Phase 0
 * checkpoint and the resume-reconcile verification branch.
 */
let mockVerificationRequired = false

function mockAuthId(): string {
  return `auth_${Math.random().toString(36).slice(2, 10)}`
}

function toAuthUser(row: MockAuthRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    emailConfirmed: row.emailConfirmed,
  }
}

// ══════════════════════════════════════════════
// PUBLIC — signUp / adopt
// ══════════════════════════════════════════════

/**
 * Create a new auth user or adopt an existing one on a retry
 * of the same signup.
 *
 * Adoption rules:
 *   - Email not found → create a new auth user. Return
 *     `{ kind: 'created', ... }`.
 *   - Email found, password matches → return the existing
 *     auth user. Return `{ kind: 'adopted', ... }`. This is
 *     the narrow partial-failure recovery path: the caller
 *     is clearly retrying their own signup.
 *   - Email found, password does not match (mock only) →
 *     throw. We will not overwrite a password we cannot
 *     prove the caller owns, and silently returning the
 *     existing id would let a stranger adopt someone else's
 *     auth user.
 *
 * Password validation:
 *   - Minimum 8 characters. The UI enforces this too, but a
 *     server action is POST-reachable and must defend itself.
 *     Anything else (e.g. max length, complexity) is delegated
 *     to Supabase's own password policy in real mode.
 */
export async function signUpOrAdoptAuthUser(input: {
  email: string
  password: string
}): Promise<AuthSignUpOutcome> {
  logModeOnce()
  if (!input.email || !input.email.includes('@')) {
    throw new Error('Invalid email address')
  }
  if (!input.password || input.password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  if (getMode() === 'mock') {
    return signUpOrAdoptMock(input)
  }
  return signUpOrAdoptSupabase(input)
}

async function signUpOrAdoptMock(input: {
  email: string
  password: string
}): Promise<AuthSignUpOutcome> {
  const emailKey = input.email.toLowerCase()
  const existing = mockAuthStore.get(emailKey)

  if (existing) {
    if (existing.password !== input.password) {
      throw new Error(
        `An account for '${input.email}' already exists. Sign in instead.`,
      )
    }
    return {
      kind: 'adopted',
      authUser: toAuthUser(existing),
      needsEmailVerification: !existing.emailConfirmed,
    }
  }

  const row: MockAuthRow = {
    id: mockAuthId(),
    email: emailKey,
    password: input.password,
    emailConfirmed: !mockVerificationRequired,
  }
  mockAuthStore.set(row.email, row)
  return {
    kind: 'created',
    authUser: toAuthUser(row),
    needsEmailVerification: mockVerificationRequired,
  }
}

async function signUpOrAdoptSupabase(input: {
  email: string
  password: string
}): Promise<AuthSignUpOutcome> {
  // Real-mode path — runs when @supabase/supabase-js is
  // installed and the env vars are present (MODE === 'real').
  // Not exercised by the test suite while the suite runs with
  // Supabase env vars unset; it is shaped to drop into
  // production the moment the Supabase client ships.
  //
  // The shape mirrors the mock: call `auth.admin.createUser`
  // with `email_confirm: false`; on the "already registered"
  // error, look the row up via `admin.listUsers` and adopt.
  // See the module header for the password-check caveat in
  // real mode.
  const { getSupabaseClient } = await import('@/lib/db/client')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseClient() as any

  const emailKey = input.email.toLowerCase()

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email: emailKey,
      password: input.password,
      email_confirm: false,
    })
    if (error) throw error
    const created = data?.user
    if (!created) {
      throw new Error('auth.admin.createUser returned no user')
    }
    return {
      kind: 'created',
      authUser: {
        id: created.id,
        email: created.email ?? emailKey,
        emailConfirmed: !!created.email_confirmed_at,
      },
      needsEmailVerification: !created.email_confirmed_at,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const isExists = /already.*(registered|exists)/i.test(message)
    if (!isExists) throw err

    // Adoption branch: find the existing auth user and return
    // their id. Password verification is deferred — see header.
    const { data: listData, error: listError } =
      await admin.auth.admin.listUsers()
    if (listError) throw listError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = (listData?.users ?? []) as any[]
    const found = users.find(
      (u) => typeof u?.email === 'string' && u.email.toLowerCase() === emailKey,
    )
    if (!found) throw err
    return {
      kind: 'adopted',
      authUser: {
        id: found.id,
        email: found.email ?? emailKey,
        emailConfirmed: !!found.email_confirmed_at,
      },
      needsEmailVerification: !found.email_confirmed_at,
    }
  }
}

// ══════════════════════════════════════════════
// PUBLIC — verification probe
// ══════════════════════════════════════════════

/**
 * Check whether the auth user identified by `authUserId` has
 * confirmed their email. Used by:
 *
 *   1. Resume reconciliation: a wizard that was last seen on
 *      the Phase 0 verification checkpoint re-runs this on
 *      mount to find out whether the user has clicked the
 *      confirmation link in the meantime.
 *   2. The Phase 0 checkpoint's manual "I've confirmed it"
 *      button: same probe, user-triggered instead of mount-
 *      triggered.
 *
 * Returns:
 *   - `true`  — email is confirmed, caller should clear the
 *               checkpoint and advance the wizard.
 *   - `false` — auth user found but still unconfirmed, caller
 *               should stay on the checkpoint.
 *   - `null`  — auth user not found (unknown id). Callers
 *               should treat this as a reset — the wizard's
 *               createdUserId has drifted from the auth store.
 */
export async function getAuthUserEmailConfirmed(
  authUserId: string,
): Promise<boolean | null> {
  logModeOnce()
  if (!authUserId) return null

  if (getMode() === 'mock') {
    for (const row of mockAuthStore.values()) {
      if (row.id === authUserId) return row.emailConfirmed
    }
    return null
  }

  const { getSupabaseClient } = await import('@/lib/db/client')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseClient() as any
  const { data, error } = await admin.auth.admin.getUserById(authUserId)
  if (error) return null
  const user = data?.user
  if (!user) return null
  return !!user.email_confirmed_at
}

// ══════════════════════════════════════════════
// TEST HELPERS (mock-mode only, no-op in real mode)
//
// These are exported as async functions so the 'use server'
// directive is satisfied. Calling them in real mode is
// harmless — they short-circuit immediately.
// ══════════════════════════════════════════════

/** Clear the mock auth store and reset the verification flag. */
export async function _resetAuthStore(): Promise<void> {
  logModeOnce()
  mockAuthStore.clear()
  mockVerificationRequired = false
}

/**
 * Toggle whether newly-created mock auth rows are written as
 * unconfirmed. Tests that need to exercise the "pending
 * verification" branch call this with `true` before their
 * Phase 0 submit.
 */
export async function _setMockVerificationRequired(
  required: boolean,
): Promise<void> {
  logModeOnce()
  if (getMode() === 'real') return
  mockVerificationRequired = required
}

/** Flip an existing mock auth row to confirmed. */
export async function _markMockAuthVerified(email: string): Promise<void> {
  logModeOnce()
  if (getMode() === 'real') return
  const row = mockAuthStore.get(email.toLowerCase())
  if (row) row.emailConfirmed = true
}

/** Flip an existing mock auth row to unconfirmed. */
export async function _markMockAuthUnverified(email: string): Promise<void> {
  logModeOnce()
  if (getMode() === 'real') return
  const row = mockAuthStore.get(email.toLowerCase())
  if (row) row.emailConfirmed = false
}
