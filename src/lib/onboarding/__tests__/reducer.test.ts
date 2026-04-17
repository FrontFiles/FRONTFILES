import { describe, it, expect } from 'vitest'
import {
  onboardingReducer,
  initialState,
  type OnboardingAction,
} from '../reducer'
import type { OnboardingFlowState } from '../types'

/**
 * Reducer unit tests.
 *
 * Covers the action union the live UI dispatches. The reducer
 * is pure so these tests are a direct input/output contract —
 * no store, no async, no React. They exist to freeze the
 * shape of every action and catch accidental drift when the
 * wizard evolves.
 */
describe('onboardingReducer', () => {
  describe('initial state', () => {
    it('starts at role-picker with no role, no created user, no completed steps', () => {
      expect(initialState.currentStep).toBe('role-picker')
      expect(initialState.role).toBeNull()
      expect(initialState.createdUserId).toBeNull()
      expect(initialState.completedSteps).toEqual([])
      expect(initialState.email).toBe('')
      expect(initialState.username).toBe('')
      expect(initialState.password).toBe('')
      expect(initialState.usernameAvailable).toBeNull()
      expect(initialState.vaultId).toBeNull()
      expect(initialState.awaitingEmailVerification).toBe(false)
    })
  })

  describe('SET_STEP', () => {
    it('updates currentStep to the payload', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_STEP',
        payload: 'account',
      })
      expect(next.currentStep).toBe('account')
    })

    it('does not touch completedSteps or role', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_STEP',
        payload: 'launch',
      })
      expect(next.completedSteps).toEqual([])
      expect(next.role).toBeNull()
    })
  })

  describe('MARK_STEP_COMPLETE', () => {
    it('appends a step to completedSteps', () => {
      const next = onboardingReducer(initialState, {
        type: 'MARK_STEP_COMPLETE',
        payload: 'role-picker',
      })
      expect(next.completedSteps).toEqual(['role-picker'])
    })

    it('dedupes: marking the same step twice leaves the array unchanged', () => {
      const once = onboardingReducer(initialState, {
        type: 'MARK_STEP_COMPLETE',
        payload: 'account',
      })
      const twice = onboardingReducer(once, {
        type: 'MARK_STEP_COMPLETE',
        payload: 'account',
      })
      // Reducer returns the SAME reference when the step is
      // already present — this is the guard that prevents the
      // phase strip from animating on every re-render.
      expect(twice).toBe(once)
      expect(twice.completedSteps).toEqual(['account'])
    })

    it('preserves completion order across multiple steps', () => {
      let s: OnboardingFlowState = initialState
      s = onboardingReducer(s, { type: 'MARK_STEP_COMPLETE', payload: 'role-picker' })
      s = onboardingReducer(s, { type: 'MARK_STEP_COMPLETE', payload: 'account' })
      s = onboardingReducer(s, { type: 'MARK_STEP_COMPLETE', payload: 'creator-profile' })
      expect(s.completedSteps).toEqual([
        'role-picker',
        'account',
        'creator-profile',
      ])
    })
  })

  describe('SET_ROLE', () => {
    it('sets the role field', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_ROLE',
        payload: 'creator',
      })
      expect(next.role).toBe('creator')
    })

    it('is idempotent — picking the same role twice is stable', () => {
      const first = onboardingReducer(initialState, {
        type: 'SET_ROLE',
        payload: 'buyer',
      })
      const second = onboardingReducer(first, {
        type: 'SET_ROLE',
        payload: 'buyer',
      })
      expect(second.role).toBe('buyer')
    })

    it('allows switching between roles', () => {
      let s: OnboardingFlowState = initialState
      s = onboardingReducer(s, { type: 'SET_ROLE', payload: 'creator' })
      s = onboardingReducer(s, { type: 'SET_ROLE', payload: 'reader' })
      expect(s.role).toBe('reader')
    })
  })

  describe('SET_EMAIL / SET_USERNAME / SET_PASSWORD', () => {
    it('sets email on dispatch', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_EMAIL',
        payload: 'new@example.com',
      })
      expect(next.email).toBe('new@example.com')
    })

    it('sets username and usernameAvailable together', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_USERNAME',
        payload: { username: 'alice', available: true },
      })
      expect(next.username).toBe('alice')
      expect(next.usernameAvailable).toBe(true)
    })

    it('sets usernameAvailable to null for in-flight checks', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_USERNAME',
        payload: { username: 'alice', available: null },
      })
      expect(next.usernameAvailable).toBeNull()
    })

    it('sets password on dispatch', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_PASSWORD',
        payload: 'hunter22',
      })
      expect(next.password).toBe('hunter22')
    })
  })

  describe('SET_CREATED_USER_ID', () => {
    it('sets the createdUserId field', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_CREATED_USER_ID',
        payload: 'user-42',
      })
      expect(next.createdUserId).toBe('user-42')
    })
  })

  describe('SET_AWAITING_EMAIL_VERIFICATION', () => {
    it('flips the checkpoint flag on', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_AWAITING_EMAIL_VERIFICATION',
        payload: true,
      })
      expect(next.awaitingEmailVerification).toBe(true)
    })

    it('flips the checkpoint flag off', () => {
      const pending = onboardingReducer(initialState, {
        type: 'SET_AWAITING_EMAIL_VERIFICATION',
        payload: true,
      })
      const cleared = onboardingReducer(pending, {
        type: 'SET_AWAITING_EMAIL_VERIFICATION',
        payload: false,
      })
      expect(cleared.awaitingEmailVerification).toBe(false)
    })

    it('does not touch other fields', () => {
      const pre = onboardingReducer(initialState, {
        type: 'SET_CREATED_USER_ID',
        payload: 'user-99',
      })
      const next = onboardingReducer(pre, {
        type: 'SET_AWAITING_EMAIL_VERIFICATION',
        payload: true,
      })
      expect(next.createdUserId).toBe('user-99')
      expect(next.currentStep).toBe('role-picker')
      expect(next.role).toBeNull()
    })
  })

  describe('UPDATE_CREATOR_MINIMAL', () => {
    it('merges partial updates into creatorMinimal', () => {
      const next = onboardingReducer(initialState, {
        type: 'UPDATE_CREATOR_MINIMAL',
        payload: { professionalTitle: 'Photojournalist' },
      })
      expect(next.creatorMinimal.professionalTitle).toBe('Photojournalist')
      // Biography untouched — merge, not replace.
      expect(next.creatorMinimal.biography).toBe('')
    })

    it('preserves existing fields when updating one at a time', () => {
      let s: OnboardingFlowState = initialState
      s = onboardingReducer(s, {
        type: 'UPDATE_CREATOR_MINIMAL',
        payload: { professionalTitle: 'Reporter' },
      })
      s = onboardingReducer(s, {
        type: 'UPDATE_CREATOR_MINIMAL',
        payload: { biography: 'Covering Europe.' },
      })
      expect(s.creatorMinimal).toEqual({
        professionalTitle: 'Reporter',
        biography: 'Covering Europe.',
      })
    })
  })

  describe('SET_BUYER_TYPE / SET_COMPANY_NAME', () => {
    it('sets buyerType', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_BUYER_TYPE',
        payload: 'company',
      })
      expect(next.buyerMinimal.buyerType).toBe('company')
      expect(next.buyerMinimal.companyName).toBe('')
    })

    it('sets companyName independently of buyerType', () => {
      let s: OnboardingFlowState = initialState
      s = onboardingReducer(s, { type: 'SET_BUYER_TYPE', payload: 'company' })
      s = onboardingReducer(s, {
        type: 'SET_COMPANY_NAME',
        payload: 'Example Studios',
      })
      expect(s.buyerMinimal).toEqual({
        buyerType: 'company',
        companyName: 'Example Studios',
      })
    })
  })

  describe('SET_VAULT_CREATED', () => {
    it('stores the vaultId returned from launch', () => {
      const next = onboardingReducer(initialState, {
        type: 'SET_VAULT_CREATED',
        payload: { vaultId: 'vault-abc' },
      })
      expect(next.vaultId).toBe('vault-abc')
    })
  })

  describe('RESET', () => {
    it('returns the initial state regardless of prior state', () => {
      let s: OnboardingFlowState = initialState
      s = onboardingReducer(s, { type: 'SET_ROLE', payload: 'creator' })
      s = onboardingReducer(s, { type: 'SET_EMAIL', payload: 'x@y.z' })
      s = onboardingReducer(s, {
        type: 'SET_CREATED_USER_ID',
        payload: 'user-99',
      })
      s = onboardingReducer(s, {
        type: 'SET_AWAITING_EMAIL_VERIFICATION',
        payload: true,
      })
      s = onboardingReducer(s, { type: 'SET_STEP', payload: 'launch' })
      const after = onboardingReducer(s, { type: 'RESET' })
      expect(after).toEqual(initialState)
      // Explicit re-check on the new PR 3 field so a future
      // regression can't slip through by being tolerated on
      // `.toEqual(initialState)`.
      expect(after.awaitingEmailVerification).toBe(false)
    })

    it('clears completedSteps on reset', () => {
      let s: OnboardingFlowState = initialState
      s = onboardingReducer(s, {
        type: 'MARK_STEP_COMPLETE',
        payload: 'account',
      })
      const after = onboardingReducer(s, { type: 'RESET' })
      expect(after.completedSteps).toEqual([])
    })
  })

  describe('unknown action', () => {
    it('returns state unchanged for unhandled action types', () => {
      // Cast through unknown so the test can simulate a bad
      // action without weakening the live action type union.
      const bogus = { type: 'NOT_A_REAL_ACTION' } as unknown as OnboardingAction
      const next = onboardingReducer(initialState, bogus)
      expect(next).toBe(initialState)
    })
  })
})
