import { describe, it, expect, beforeEach } from 'vitest'
import { createOnboardingAccount } from '../account-creation'
import { reconcileOnboardingState } from '../resume'
import { initialState } from '../reducer'
import {
  _resetStore,
  upsertCreatorProfile,
  upsertBuyerAccount,
  getCreatorPortfolioShellByHandle,
  getCreatorPortfolioShellById,
  getUserById,
} from '@/lib/identity/store'
import {
  _resetAuthStore,
  _setMockVerificationRequired,
  _markMockAuthVerified,
  getAuthUserEmailConfirmed,
} from '@/lib/auth/provider'
import { buildCreatorProfileFromShell } from '@/data/profiles'

/**
 * End-to-end integration tests that exercise the full
 * Frontfiles onboarding-to-visible-creator pipeline for
 * both creator and buyer paths.
 *
 * These tests are the regression guard for the original PR 1
 * bug: a newly-onboarded creator was invisible to the public
 * handle lookup because the legacy path read from a
 * module-load snapshot. The integration here verifies that
 * the live-read path (`getCreatorPortfolioShellByHandle` /
 * `buildCreatorProfileFromShell`) resolves a creator who was
 * created entirely through the onboarding seam.
 *
 * They also verify the resume-reconciliation end-to-end: a
 * wizard state that's been persisted through the role-specific
 * step gets advanced to launch on the next mount.
 */
describe('onboarding integration', () => {
  beforeEach(async () => {
    _resetStore()
    await _resetAuthStore()
  })

  describe('creator path', () => {
    it('writes a user+grant+profile and resolves via the live shell reader', async () => {
      // Phase 0 — account
      const { user } = await createOnboardingAccount({
        email: 'newbie@example.com',
        username: 'newbie-shooter',
        password: 'hunter22hunter',
        role: 'creator',
      })

      // Phase 1 — creator minimal profile
      await upsertCreatorProfile({
        user_id: user.id,
        professional_title: 'Photojournalist',
        biography: 'Long-form features out of Berlin.',
      })

      // Public page load — the frontfolio page calls this
      // function to resolve a handle to a live portfolio shell.
      const shell = await getCreatorPortfolioShellByHandle('newbie-shooter')
      expect(shell).not.toBeNull()
      expect(shell!.user.id).toBe(user.id)
      expect(shell!.user.username).toBe('newbie-shooter')
      expect(shell!.grantedTypes).toContain('creator')
      expect(shell!.creatorProfile).not.toBeNull()
      expect(shell!.creatorProfile!.professional_title).toBe('Photojournalist')

      // By-id variant resolves the same shell for callers that
      // already hold the canonical user id (avatar menu, session
      // consumers).
      const byId = await getCreatorPortfolioShellById(user.id)
      expect(byId).not.toBeNull()
      expect(byId!.user.id).toBe(user.id)

      // Adapter — `buildCreatorProfileFromShell` is what the
      // frontfolio page actually renders. It must return a
      // non-null CreatorProfile for a fully-onboarded creator.
      const profile = buildCreatorProfileFromShell(shell!)
      expect(profile).not.toBeNull()
      expect(profile!.username).toBe('newbie-shooter')
      expect(profile!.professionalTitle).toBe('Photojournalist')
      expect(profile!.biography).toBe('Long-form features out of Berlin.')
    })

    it('returns null from the shell reader when the user has the grant but no profile row', async () => {
      // Phase 0 only. No creator_profiles row yet. The public
      // handle lookup must return null — they're not a visible
      // creator until they write the profile.
      await createOnboardingAccount({
        email: 'incomplete@example.com',
        username: 'incomplete',
        password: 'hunter22hunter',
        role: 'creator',
      })

      const shell = await getCreatorPortfolioShellByHandle('incomplete')
      expect(shell).toBeNull()
    })

    it('returns null for a non-creator with the reader grant', async () => {
      await createOnboardingAccount({
        email: 'reader@example.com',
        username: 'just-a-reader',
        password: 'hunter22hunter',
        role: 'reader',
      })

      const shell = await getCreatorPortfolioShellByHandle('just-a-reader')
      // Reader grants don't make a user a visible creator even
      // if they somehow have a shell — the guard in the shell
      // reader filters by `grantedTypes.includes('creator')`.
      expect(shell).toBeNull()
    })
  })

  describe('buyer path', () => {
    it('writes a user+grant+buyer account end-to-end', async () => {
      const { user } = await createOnboardingAccount({
        email: 'buyer@example.com',
        username: 'wire-buyer',
        password: 'hunter22hunter',
        role: 'buyer',
      })

      await upsertBuyerAccount({
        user_id: user.id,
        buyer_type: 'company',
        company_name: 'Example Wire',
      })

      // Buyers are NOT visible creators — the shell reader
      // returns null for them. This is the correct contract:
      // the shell is a creator-only aggregate.
      const shell = await getCreatorPortfolioShellByHandle('wire-buyer')
      expect(shell).toBeNull()
    })
  })

  describe('resume reconciliation end-to-end', () => {
    it('advances a wizard stuck on creator-profile after the row has been written', async () => {
      // Simulate: user made it through Phase 0 and the facet
      // write, but the wizard crashed before advancing past
      // `creator-profile`. On resume, the reconcile should
      // return advance-to-launch because the row exists.
      const { user } = await createOnboardingAccount({
        email: 'stuck@example.com',
        username: 'stuck-creator',
        password: 'hunter22hunter',
        role: 'creator',
      })
      await upsertCreatorProfile({
        user_id: user.id,
        professional_title: 'Reporter',
      })

      const persistedState = {
        ...initialState,
        createdUserId: user.id,
        role: 'creator' as const,
        currentStep: 'creator-profile' as const,
        creatorMinimal: {
          professionalTitle: 'Reporter',
          biography: '',
        },
      }

      const result = await reconcileOnboardingState(persistedState)
      expect(result).toEqual({
        action: 'advance-to-launch',
        completedStep: 'creator-profile',
      })
    })

    it('resets a wizard whose persisted user id no longer exists', async () => {
      // Dev reset / cross-env leak case.
      const persistedState = {
        ...initialState,
        createdUserId: 'user-ghost-id',
        role: 'creator' as const,
        currentStep: 'creator-profile' as const,
      }

      const result = await reconcileOnboardingState(persistedState)
      expect(result).toEqual({
        action: 'reset',
        reason: 'user-missing',
      })
    })
  })

  describe('idempotent retry end-to-end', () => {
    it('lets a user re-submit Phase 0 after a partial failure and still reach a visible creator state', async () => {
      // First submit — succeeds fully.
      const first = await createOnboardingAccount({
        email: 'retry@example.com',
        username: 'retry-user',
        password: 'hunter22hunter',
        role: 'creator',
      })
      expect(first.reused).toBe(false)

      // Simulate a lost wizard state (e.g. the user refreshed
      // before `SET_CREATED_USER_ID` dispatched, localStorage
      // wasn't written). Second submit — same inputs.
      const second = await createOnboardingAccount({
        email: 'retry@example.com',
        username: 'retry-user',
        password: 'hunter22hunter',
        role: 'creator',
      })
      expect(second.reused).toBe(true)
      expect(second.user.id).toBe(first.user.id)

      // Finish the flow — write the creator profile.
      await upsertCreatorProfile({
        user_id: second.user.id,
        professional_title: 'Photographer',
      })

      // The public handle now resolves to this creator — the
      // retry did not leave a stale or ghost row.
      const shell = await getCreatorPortfolioShellByHandle('retry-user')
      expect(shell).not.toBeNull()
      expect(shell!.user.id).toBe(first.user.id)
    })
  })

  describe('auth wiring (PR 3)', () => {
    it('keeps users.id in sync with the auth user id end-to-end', async () => {
      // PR 3 linking contract. The Frontfiles row and the auth
      // row share a primary key. We verify the invariant by
      // (a) reading the row back by id from the store and (b)
      // asking the auth provider about the same id.
      const { user } = await createOnboardingAccount({
        email: 'linked@example.com',
        username: 'linked-user',
        password: 'hunter22hunter',
        role: 'creator',
      })

      const storeRow = await getUserById(user.id)
      expect(storeRow).not.toBeNull()
      expect(storeRow!.id).toBe(user.id)

      // Auth provider knows the same id — email confirmed
      // (mock default) so the probe returns `true`.
      const confirmed = await getAuthUserEmailConfirmed(user.id)
      expect(confirmed).toBe(true)
    })

    it('holds the wizard at the verification checkpoint when the email is unconfirmed', async () => {
      // Mock mode opts into the verification-required branch.
      await _setMockVerificationRequired(true)

      const result = await createOnboardingAccount({
        email: 'pending@example.com',
        username: 'pending-user',
        password: 'hunter22hunter',
        role: 'buyer',
      })

      expect(result.needsEmailVerification).toBe(true)
      // The Frontfiles row is still written — the checkpoint
      // is a UI-level gate, not a write-level gate. The user
      // is blocked from advancing but their account exists.
      const storeRow = await getUserById(result.user.id)
      expect(storeRow).not.toBeNull()

      // Auth provider agrees the email is still pending.
      const confirmed = await getAuthUserEmailConfirmed(result.user.id)
      expect(confirmed).toBe(false)
    })

    it('clears the checkpoint on resume once the user confirms out of band', async () => {
      // Full end-to-end: submit, held on checkpoint, user
      // clicks confirmation link in their email, wizard
      // resumes, reconcile clears the flag.
      await _setMockVerificationRequired(true)
      const email = 'resume-confirm@example.com'
      const { user, needsEmailVerification } =
        await createOnboardingAccount({
          email,
          username: 'resume-confirm',
          password: 'hunter22hunter',
          role: 'creator',
        })
      expect(needsEmailVerification).toBe(true)

      // Out-of-band email click — mock flip.
      await _markMockAuthVerified(email)

      const persisted = {
        ...initialState,
        createdUserId: user.id,
        role: 'creator' as const,
        currentStep: 'account' as const,
        awaitingEmailVerification: true,
      }
      const result = await reconcileOnboardingState(persisted)
      expect(result).toEqual({ action: 'clear-email-verification' })
    })

    it('recovers when auth succeeded but the users row was never written (partial failure A)', async () => {
      // Drift case A from account-creation.ts: auth user
      // exists, Frontfiles row does not. The retry must find
      // the auth user (adoption path) and fall through to the
      // fresh-insert branch to fill the hole.
      //
      // We simulate the drift by calling the seam twice:
      // once to create auth+row+grant, then resetting ONLY
      // the identity store (leaving the auth store intact).
      // The second call adopts the auth user and inserts a
      // new row at the same auth id.
      const first = await createOnboardingAccount({
        email: 'drift-a@example.com',
        username: 'drift-a',
        password: 'hunter22hunter',
        role: 'reader',
      })

      // Wipe the identity store but keep the auth store.
      _resetStore()

      const second = await createOnboardingAccount({
        email: 'drift-a@example.com',
        username: 'drift-a',
        password: 'hunter22hunter',
        role: 'reader',
      })

      // Adoption of the auth row → same auth id, but a fresh
      // row in the identity store (reused: false because the
      // store lookup returned null).
      expect(second.user.id).toBe(first.user.id)
      expect(second.reused).toBe(false)

      const rehydrated = await getUserById(second.user.id)
      expect(rehydrated).not.toBeNull()
      expect(rehydrated!.email).toBe('drift-a@example.com')
    })
  })
})
