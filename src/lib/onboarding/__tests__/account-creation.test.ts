import { describe, it, expect, beforeEach } from 'vitest'
import { createOnboardingAccount } from '../account-creation'
import type { CreateOnboardingAccountInput } from '../account-creation-types'
import {
  _resetStore,
  getUserByUsername,
  getUserWithFacets,
} from '@/lib/identity/store'
import { _resetAuthStore } from '@/lib/auth/provider'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseEnvPresent() returns false. Identity store and
// auth provider route through their mock branches, honouring
// _setMockVerificationRequired() / _markMockAuthVerified() helpers
// that the suite seeds with.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

/**
 * Provisioning + idempotency tests for `createOnboardingAccount`.
 *
 * The identity store and the auth provider both run in mock
 * mode here (vitest config sets `environment: 'node'` and no
 * Supabase env vars are present), so every call routes through
 * the `isSupabaseConfigured() === false` path on both modules.
 * We reset both stores between tests so state does not leak
 * across cases.
 *
 * These tests freeze the Phase 0 PR 3 contract:
 *
 *   1. Happy path: one call mints an auth user, writes a
 *      `users` row whose id equals the auth user id, grants
 *      the chosen role, and returns `reused: false` +
 *      `needsEmailVerification: false` (mock default).
 *   2. Retry with same (email, password, role): adopts the
 *      existing auth user, finds the existing Frontfiles row
 *      via `getUserById`, re-applies the grant, and returns
 *      `reused: true`. No duplicate row is inserted.
 *   3. Retry with same email but different username: the
 *      auth row is the canonical identity — we silently adopt
 *      the existing Frontfiles row and ignore the new username.
 *      This is the partial-failure recovery path for users
 *      whose wizard state drifted from the auth store.
 *   4. Different email, same username: the auth user is fresh
 *      but `createUser` throws on the username uniqueness
 *      check. The error bubbles up verbatim.
 *   5. Every role (creator, buyer, reader) writes the right
 *      grant.
 *
 * Separate files cover:
 *   - email verification checkpoint behavior
 *     (`account-creation-verification.test.ts`)
 *   - fine-grained auth provider behavior
 *     (`src/lib/auth/__tests__/provider.test.ts`)
 */
describe('createOnboardingAccount', () => {
  beforeEach(async () => {
    _resetStore()
    await _resetAuthStore()
  })

  const baseInput: CreateOnboardingAccountInput = {
    email: 'test@example.com',
    username: 'test-user',
    password: 'hunter2-hunter2',
    role: 'creator',
  }

  describe('happy path', () => {
    it('creates a users row and grants the selected role', async () => {
      const result = await createOnboardingAccount(baseInput)

      expect(result.user.username).toBe('test-user')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.display_name).toBe('test-user')
      expect(result.role).toBe('creator')
      expect(result.reused).toBe(false)
      // Mock mode auto-confirms by default. The verification
      // checkpoint is covered in a separate test file.
      expect(result.needsEmailVerification).toBe(false)

      // Verify the row actually landed in the store.
      const fetched = await getUserByUsername('test-user')
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(result.user.id)

      // Verify the grant landed.
      const facets = await getUserWithFacets(result.user.id)
      expect(facets).not.toBeNull()
      expect(facets!.grantedTypes).toContain('creator')
    })

    it('adopts the auth user id as the users row id', async () => {
      // PR 3 linking contract: `users.id === auth.users.id`.
      // We verify the invariant end-to-end by asking both the
      // auth provider and the identity store for the row and
      // confirming they agree on the id.
      const result = await createOnboardingAccount(baseInput)

      // The auth provider's id shape in mock mode is
      // `auth_xxxxxxxx`; the important thing is that the store
      // row carries exactly the same value, not that it matches
      // a specific format.
      const fromStore = await getUserByUsername('test-user')
      expect(fromStore!.id).toBe(result.user.id)
      expect(result.user.id.startsWith('auth_')).toBe(true)
    })

    it('grants buyer role when role=buyer', async () => {
      const result = await createOnboardingAccount({
        ...baseInput,
        username: 'buyer-one',
        email: 'buyer@example.com',
        role: 'buyer',
      })
      const facets = await getUserWithFacets(result.user.id)
      expect(facets!.grantedTypes).toContain('buyer')
      expect(facets!.grantedTypes).not.toContain('creator')
    })

    it('grants reader role when role=reader', async () => {
      const result = await createOnboardingAccount({
        ...baseInput,
        username: 'reader-one',
        email: 'reader@example.com',
        role: 'reader',
      })
      const facets = await getUserWithFacets(result.user.id)
      expect(facets!.grantedTypes).toContain('reader')
    })

    it('lowercases the username on write', async () => {
      const result = await createOnboardingAccount({
        ...baseInput,
        username: 'MixedCase',
      })
      expect(result.user.username).toBe('mixedcase')
    })
  })

  describe('idempotency', () => {
    it('adopts the existing row on same-email retry and returns reused=true', async () => {
      const first = await createOnboardingAccount(baseInput)
      const second = await createOnboardingAccount(baseInput)

      // Same user id — no duplicate row inserted.
      expect(second.user.id).toBe(first.user.id)
      expect(second.reused).toBe(true)
      expect(first.reused).toBe(false)
    })

    it('does not duplicate the grant on retry', async () => {
      await createOnboardingAccount(baseInput)
      const second = await createOnboardingAccount(baseInput)

      const facets = await getUserWithFacets(second.user.id)
      // Exactly one creator grant — grantUserType is idempotent
      // against UNIQUE(user_id, user_type).
      expect(facets!.grantedTypes.filter((t) => t === 'creator')).toHaveLength(1)
    })

    it('re-applies a missing grant on retry (recovers from partial failure B)', async () => {
      // Partial-failure case B: auth + users row both created,
      // grant never landed. We simulate the drift by calling
      // the full seam, then revoking the grant to leave the
      // store in the partial state, then calling the seam
      // again. The retry must find the auth user, find the
      // existing Frontfiles row by id, and re-apply the grant.
      const { revokeUserType } = await import('@/lib/identity/store')
      const first = await createOnboardingAccount(baseInput)
      await revokeUserType(first.user.id, 'creator')

      const facetsBefore = await getUserWithFacets(first.user.id)
      expect(facetsBefore!.grantedTypes).not.toContain('creator')

      const second = await createOnboardingAccount(baseInput)
      expect(second.user.id).toBe(first.user.id)
      expect(second.reused).toBe(true)

      const facetsAfter = await getUserWithFacets(first.user.id)
      expect(facetsAfter!.grantedTypes).toContain('creator')
    })

    it('adopts existing row on retry with same email but different username', async () => {
      // The auth row is the canonical identity, so a retry
      // that supplies a different username silently adopts
      // the existing Frontfiles row. The username field in the
      // input is ignored on the retry path — the user can
      // change it later from /account if they want.
      const first = await createOnboardingAccount(baseInput)
      const second = await createOnboardingAccount({
        ...baseInput,
        username: 'different-handle',
      })

      expect(second.user.id).toBe(first.user.id)
      expect(second.user.username).toBe('test-user')
      expect(second.reused).toBe(true)
    })

    it('throws "taken" when a different email claims the same username', async () => {
      // Fresh signup with the same username → a new auth user
      // is minted, then `createUser` rejects the insert on the
      // username uniqueness check. The error bubbles up
      // verbatim so the UI can surface it.
      await createOnboardingAccount(baseInput)

      await expect(
        createOnboardingAccount({
          ...baseInput,
          email: 'intruder@example.com',
        }),
      ).rejects.toThrow(/already taken/i)
    })

    it('throws when the retry password does not match the auth row', async () => {
      // The auth provider guards against a stranger adopting
      // someone else's auth user via a wrong password. The
      // error is raised before we reach the identity store.
      await createOnboardingAccount(baseInput)

      await expect(
        createOnboardingAccount({
          ...baseInput,
          password: 'totally-different-password',
        }),
      ).rejects.toThrow(/already exists/i)
    })
  })
})
