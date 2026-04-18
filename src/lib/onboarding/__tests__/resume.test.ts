import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileOnboardingState } from '../resume'
import { initialState } from '../reducer'
import { createOnboardingAccount } from '../account-creation'
import {
  _resetStore,
  getUserWithFacets,
  upsertCreatorProfile,
  upsertBuyerAccount,
  revokeUserType,
} from '@/lib/identity/store'
import {
  _resetAuthStore,
  _setMockVerificationRequired,
  _markMockAuthVerified,
} from '@/lib/auth/provider'
import type { OnboardingFlowState } from '../types'
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
 * Resume reconciliation tests.
 *
 * `reconcileOnboardingState` is a pure async function that
 * compares a persisted wizard state against the live identity
 * store and the auth provider, and returns a corrective
 * action. These tests freeze the contract documented in
 * `resume.ts`:
 *
 *   - No createdUserId → noop (nothing to reconcile).
 *   - createdUserId → user missing → reset.
 *   - createdUserId → user present, grant missing → re-grants
 *     (side effect) and returns noop.
 *   - On creator-profile step with creator_profiles row
 *     already written → advance-to-launch.
 *   - On buyer-details step with buyer_accounts row
 *     already written → advance-to-launch.
 *   - (PR 3) awaitingEmailVerification + auth confirmed →
 *     clear-email-verification.
 *   - (PR 3) awaitingEmailVerification + auth pending → noop
 *     (or fall through to other checks if they apply).
 *   - (PR 3) awaitingEmailVerification + auth user unknown →
 *     reset (same outcome as store ghost).
 *   - Otherwise → noop.
 */
describe('reconcileOnboardingState', () => {
  beforeEach(async () => {
    _resetStore()
    await _resetAuthStore()
  })

  function withCreatedUser(
    userId: string,
    overrides: Partial<OnboardingFlowState> = {},
  ): OnboardingFlowState {
    return {
      ...initialState,
      createdUserId: userId,
      ...overrides,
    }
  }

  describe('noop', () => {
    it('returns noop when state has no createdUserId', async () => {
      const result = await reconcileOnboardingState(initialState)
      expect(result).toEqual({ action: 'noop' })
    })

    it('returns noop on a fresh signup with nothing else to do', async () => {
      const { user } = await createOnboardingAccount({
        email: 'fresh@example.com',
        username: 'fresh',
        password: 'hunter22hunter',
        role: 'creator',
      })
      const state = withCreatedUser(user.id, {
        role: 'creator',
        currentStep: 'creator-profile',
      })
      const result = await reconcileOnboardingState(state)
      // No creator_profiles row written yet → stay on
      // creator-profile. Nothing to reconcile.
      expect(result).toEqual({ action: 'noop' })
    })
  })

  describe('reset on missing user', () => {
    it('returns reset when the persisted createdUserId is a ghost', async () => {
      const state = withCreatedUser('user-does-not-exist', {
        role: 'creator',
        currentStep: 'creator-profile',
      })
      const result = await reconcileOnboardingState(state)
      expect(result).toEqual({
        action: 'reset',
        reason: 'user-missing',
      })
    })
  })

  describe('grant recovery (side effect)', () => {
    it('re-applies a missing role grant and returns noop when no facet row exists', async () => {
      const { user } = await createOnboardingAccount({
        email: 'grant@example.com',
        username: 'grant-user',
        password: 'hunter22hunter',
        role: 'creator',
      })
      // Simulate the partial-failure case: the grant was
      // applied but later revoked out of band.
      await revokeUserType(user.id, 'creator')
      const before = await getUserWithFacets(user.id)
      expect(before!.grantedTypes).not.toContain('creator')

      const state = withCreatedUser(user.id, {
        role: 'creator',
        currentStep: 'creator-profile',
      })
      const result = await reconcileOnboardingState(state)

      const after = await getUserWithFacets(user.id)
      expect(after!.grantedTypes).toContain('creator')
      // No facet row, so the result is still noop. The grant
      // recovery is a side effect, not a dispatch signal.
      expect(result).toEqual({ action: 'noop' })
    })
  })

  describe('advance-to-launch', () => {
    it('advances past creator-profile when creator_profiles row exists', async () => {
      const { user } = await createOnboardingAccount({
        email: 'creator@example.com',
        username: 'creator-done',
        password: 'hunter22hunter',
        role: 'creator',
      })
      await upsertCreatorProfile({
        user_id: user.id,
        professional_title: 'Photojournalist',
        biography: 'Covering Europe.',
      })
      const state = withCreatedUser(user.id, {
        role: 'creator',
        currentStep: 'creator-profile',
        creatorMinimal: {
          professionalTitle: 'Photojournalist',
          biography: 'Covering Europe.',
        },
      })
      const result = await reconcileOnboardingState(state)
      expect(result).toEqual({
        action: 'advance-to-launch',
        completedStep: 'creator-profile',
      })
    })

    it('advances past buyer-details when buyer_accounts row exists', async () => {
      const { user } = await createOnboardingAccount({
        email: 'buyer@example.com',
        username: 'buyer-done',
        password: 'hunter22hunter',
        role: 'buyer',
      })
      await upsertBuyerAccount({
        user_id: user.id,
        buyer_type: 'company',
      })
      const state = withCreatedUser(user.id, {
        role: 'buyer',
        currentStep: 'buyer-details',
        buyerMinimal: { buyerType: 'company', companyName: 'Acme Wire' },
      })
      const result = await reconcileOnboardingState(state)
      expect(result).toEqual({
        action: 'advance-to-launch',
        completedStep: 'buyer-details',
      })
    })

    it('does NOT advance past creator-profile when row is missing', async () => {
      const { user } = await createOnboardingAccount({
        email: 'creator2@example.com',
        username: 'creator-not-done',
        password: 'hunter22hunter',
        role: 'creator',
      })
      const state = withCreatedUser(user.id, {
        role: 'creator',
        currentStep: 'creator-profile',
      })
      const result = await reconcileOnboardingState(state)
      expect(result).toEqual({ action: 'noop' })
    })

    it('does NOT advance if the current step is not the role-specific step', async () => {
      const { user } = await createOnboardingAccount({
        email: 'creator3@example.com',
        username: 'creator-launched',
        password: 'hunter22hunter',
        role: 'creator',
      })
      await upsertCreatorProfile({
        user_id: user.id,
        professional_title: 'Reporter',
      })
      // User is ALREADY on launch — reconcile should leave
      // them alone. advance-to-launch should not fire because
      // we only advance from the role-specific step itself.
      const state = withCreatedUser(user.id, {
        role: 'creator',
        currentStep: 'launch',
      })
      const result = await reconcileOnboardingState(state)
      expect(result).toEqual({ action: 'noop' })
    })
  })

  describe('reader role', () => {
    it('returns noop on reader-welcome — readers have no facet row', async () => {
      const { user } = await createOnboardingAccount({
        email: 'reader@example.com',
        username: 'reader-done',
        password: 'hunter22hunter',
        role: 'reader',
      })
      const state = withCreatedUser(user.id, {
        role: 'reader',
        currentStep: 'reader-welcome',
      })
      const result = await reconcileOnboardingState(state)
      // Reader has no creator_profiles or buyer_accounts row,
      // so we can't auto-advance — the confirmation tap is
      // still required.
      expect(result).toEqual({ action: 'noop' })
    })
  })

  describe('email verification branch (PR 3)', () => {
    it('clears the checkpoint when the auth provider now reports the email confirmed', async () => {
      // Arrange: mock mode requires verification, user
      // completes Phase 0 and is held on the checkpoint.
      await _setMockVerificationRequired(true)
      const email = 'pending@example.com'
      const { user, needsEmailVerification } =
        await createOnboardingAccount({
          email,
          username: 'pending-user',
          password: 'hunter22hunter',
          role: 'creator',
        })
      expect(needsEmailVerification).toBe(true)

      // Act: the user clicks the confirmation link out of band,
      // then the wizard resumes on mount.
      await _markMockAuthVerified(email)
      const state = withCreatedUser(user.id, {
        role: 'creator',
        currentStep: 'account',
        awaitingEmailVerification: true,
      })
      const result = await reconcileOnboardingState(state)

      expect(result).toEqual({ action: 'clear-email-verification' })
    })

    it('returns noop when the auth provider still reports the email pending', async () => {
      await _setMockVerificationRequired(true)
      const { user, needsEmailVerification } =
        await createOnboardingAccount({
          email: 'still-pending@example.com',
          username: 'still-pending',
          password: 'hunter22hunter',
          role: 'buyer',
        })
      expect(needsEmailVerification).toBe(true)

      const state = withCreatedUser(user.id, {
        role: 'buyer',
        currentStep: 'account',
        awaitingEmailVerification: true,
      })
      const result = await reconcileOnboardingState(state)

      // Pending auth + no facet row to advance → noop.
      expect(result).toEqual({ action: 'noop' })
    })

    it('returns reset when the auth user id is unknown to the provider', async () => {
      // Simulate a wizard state that points at an auth id
      // the provider has never heard of (local dev reset,
      // cross-env leak, stale localStorage). The checkpoint
      // path falls through to the same "ghost id" outcome as
      // the store-level check.
      const state = withCreatedUser('auth_ghostid', {
        role: 'creator',
        currentStep: 'account',
        awaitingEmailVerification: true,
      })
      const result = await reconcileOnboardingState(state)
      expect(result).toEqual({
        action: 'reset',
        reason: 'user-missing',
      })
    })

    it('does not trigger the verification branch when awaitingEmailVerification is false', async () => {
      // Even if mock mode is in "require verification" mode,
      // a state where the checkpoint flag is cleared should
      // NOT re-probe the auth provider — the wizard has
      // already moved past that gate.
      await _setMockVerificationRequired(true)
      const { user } = await createOnboardingAccount({
        email: 'bypassed@example.com',
        username: 'bypassed',
        password: 'hunter22hunter',
        role: 'reader',
      })
      // Flip the auth row to confirmed behind the scenes and
      // clear the persisted flag to mimic a prior clear.
      await _markMockAuthVerified('bypassed@example.com')
      const state = withCreatedUser(user.id, {
        role: 'reader',
        currentStep: 'reader-welcome',
        awaitingEmailVerification: false,
      })
      const result = await reconcileOnboardingState(state)
      expect(result).toEqual({ action: 'noop' })
    })
  })
})
