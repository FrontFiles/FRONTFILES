import { describe, it, expect, beforeEach } from 'vitest'
import {
  signUpOrAdoptAuthUser,
  getAuthUserEmailConfirmed,
  _resetAuthStore,
  _setMockVerificationRequired,
  _markMockAuthVerified,
  _markMockAuthUnverified,
} from '../provider'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseEnvPresent() returns false. The auth provider
// then routes signUpOrAdoptAuthUser / getAuthUserEmailConfirmed through
// its mock branches, and the _markMockAuth* helpers take effect instead
// of short-circuiting as real-mode no-ops. See KD-9-audit.md §Phase 4.A
// §KD-9.2.aux — this file consumes the shared helper landed at
// src/lib/test/env-scope.ts in KD-9.2.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

/**
 * Auth provider — mock-mode contract tests.
 *
 * The provider is the single seam between Frontfiles and the
 * auth backend. In tests we exercise the mock path only — real
 * Supabase mode requires the @supabase/supabase-js client plus
 * env vars, neither of which run under vitest. The mock path
 * is designed to match the shape of the Supabase path, so
 * these tests also lock in the behavior that the real path
 * must match when it ships.
 *
 * Frozen contract:
 *
 *   signUpOrAdoptAuthUser
 *     - email validation (must contain '@')
 *     - password validation (>= 8 chars)
 *     - fresh email → { kind: 'created', needsEmailVerification: false }
 *       by default
 *     - same email + password → { kind: 'adopted', ... }
 *     - same email + wrong password → throws
 *     - when verification is required: created rows are
 *       written with emailConfirmed: false and
 *       needsEmailVerification: true
 *
 *   getAuthUserEmailConfirmed
 *     - returns true/false/null for known/unknown ids
 *     - reflects confirmation flips on existing rows
 *
 *   Test helpers are no-ops in real mode; in mock mode they
 *   let tests exercise the verification branch.
 */
describe('auth/provider', () => {
  beforeEach(async () => {
    await _resetAuthStore()
  })

  describe('signUpOrAdoptAuthUser — validation', () => {
    it('throws on an email without "@"', async () => {
      await expect(
        signUpOrAdoptAuthUser({ email: 'no-at-sign', password: 'hunter22' }),
      ).rejects.toThrow(/invalid email/i)
    })

    it('throws on an empty email', async () => {
      await expect(
        signUpOrAdoptAuthUser({ email: '', password: 'hunter22' }),
      ).rejects.toThrow(/invalid email/i)
    })

    it('throws on a password shorter than 8 characters', async () => {
      await expect(
        signUpOrAdoptAuthUser({ email: 'ok@example.com', password: 'short' }),
      ).rejects.toThrow(/at least 8/i)
    })
  })

  describe('signUpOrAdoptAuthUser — happy path', () => {
    it('creates a new auth user on first call with a fresh email', async () => {
      const outcome = await signUpOrAdoptAuthUser({
        email: 'fresh@example.com',
        password: 'hunter22hunter',
      })

      expect(outcome.kind).toBe('created')
      expect(outcome.authUser.email).toBe('fresh@example.com')
      expect(outcome.authUser.id.startsWith('auth_')).toBe(true)
      // Mock mode auto-confirms by default.
      expect(outcome.authUser.emailConfirmed).toBe(true)
      expect(outcome.needsEmailVerification).toBe(false)
    })

    it('lowercases the email on store', async () => {
      const outcome = await signUpOrAdoptAuthUser({
        email: 'MixedCase@Example.com',
        password: 'hunter22hunter',
      })
      expect(outcome.authUser.email).toBe('mixedcase@example.com')
    })

    it('returns the same id across multiple calls with the same email + password', async () => {
      const first = await signUpOrAdoptAuthUser({
        email: 'stable@example.com',
        password: 'hunter22hunter',
      })
      const second = await signUpOrAdoptAuthUser({
        email: 'stable@example.com',
        password: 'hunter22hunter',
      })

      expect(second.kind).toBe('adopted')
      expect(second.authUser.id).toBe(first.authUser.id)
    })
  })

  describe('signUpOrAdoptAuthUser — password mismatch', () => {
    it('throws when the retry password does not match the existing row', async () => {
      await signUpOrAdoptAuthUser({
        email: 'locked@example.com',
        password: 'hunter22hunter',
      })

      await expect(
        signUpOrAdoptAuthUser({
          email: 'locked@example.com',
          password: 'totally-different-password',
        }),
      ).rejects.toThrow(/already exists/i)
    })
  })

  describe('signUpOrAdoptAuthUser — verification required', () => {
    it('writes new rows as unconfirmed when verification is required', async () => {
      await _setMockVerificationRequired(true)

      const outcome = await signUpOrAdoptAuthUser({
        email: 'pending@example.com',
        password: 'hunter22hunter',
      })

      expect(outcome.kind).toBe('created')
      expect(outcome.authUser.emailConfirmed).toBe(false)
      expect(outcome.needsEmailVerification).toBe(true)
    })

    it('returns needsEmailVerification: true when adopting an unconfirmed row', async () => {
      await _setMockVerificationRequired(true)
      const first = await signUpOrAdoptAuthUser({
        email: 'adopted-pending@example.com',
        password: 'hunter22hunter',
      })

      // Second call with the same credentials — adoption path,
      // row is still unconfirmed, so needsEmailVerification
      // must stay true.
      const second = await signUpOrAdoptAuthUser({
        email: 'adopted-pending@example.com',
        password: 'hunter22hunter',
      })

      expect(second.kind).toBe('adopted')
      expect(second.authUser.id).toBe(first.authUser.id)
      expect(second.authUser.emailConfirmed).toBe(false)
      expect(second.needsEmailVerification).toBe(true)
    })

    it('does not re-apply the verification-required flag after a reset', async () => {
      await _setMockVerificationRequired(true)
      await signUpOrAdoptAuthUser({
        email: 'reset-check@example.com',
        password: 'hunter22hunter',
      })
      // _resetAuthStore should also clear the verification
      // flag so unrelated tests start from a clean baseline.
      await _resetAuthStore()

      const outcome = await signUpOrAdoptAuthUser({
        email: 'post-reset@example.com',
        password: 'hunter22hunter',
      })
      expect(outcome.needsEmailVerification).toBe(false)
    })
  })

  describe('getAuthUserEmailConfirmed', () => {
    it('returns true for a confirmed auth user', async () => {
      const { authUser } = await signUpOrAdoptAuthUser({
        email: 'confirmed@example.com',
        password: 'hunter22hunter',
      })
      const result = await getAuthUserEmailConfirmed(authUser.id)
      expect(result).toBe(true)
    })

    it('returns false for an unconfirmed auth user', async () => {
      await _setMockVerificationRequired(true)
      const { authUser } = await signUpOrAdoptAuthUser({
        email: 'unconfirmed@example.com',
        password: 'hunter22hunter',
      })
      const result = await getAuthUserEmailConfirmed(authUser.id)
      expect(result).toBe(false)
    })

    it('returns null for an unknown id', async () => {
      const result = await getAuthUserEmailConfirmed('auth_ghostid')
      expect(result).toBeNull()
    })

    it('returns null for an empty string id', async () => {
      const result = await getAuthUserEmailConfirmed('')
      expect(result).toBeNull()
    })

    it('reflects a confirmation flip via _markMockAuthVerified', async () => {
      await _setMockVerificationRequired(true)
      const { authUser } = await signUpOrAdoptAuthUser({
        email: 'flip@example.com',
        password: 'hunter22hunter',
      })
      expect(await getAuthUserEmailConfirmed(authUser.id)).toBe(false)

      await _markMockAuthVerified('flip@example.com')
      expect(await getAuthUserEmailConfirmed(authUser.id)).toBe(true)
    })

    it('reflects an unverification flip via _markMockAuthUnverified', async () => {
      const { authUser } = await signUpOrAdoptAuthUser({
        email: 'unflip@example.com',
        password: 'hunter22hunter',
      })
      expect(await getAuthUserEmailConfirmed(authUser.id)).toBe(true)

      await _markMockAuthUnverified('unflip@example.com')
      expect(await getAuthUserEmailConfirmed(authUser.id)).toBe(false)
    })
  })
})
