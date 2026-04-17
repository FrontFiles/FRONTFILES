import { describe, it, expect } from 'vitest'
import { fundingReducer, initialFundingEngineState } from './machine'
import { creatorSupportCase, specialCommissionCase } from './fixtures'
import type { FundingEngineState } from './types'

function loadCase(fundingCase = creatorSupportCase): FundingEngineState {
  return fundingReducer(initialFundingEngineState, { type: 'LOAD_CASE', fundingCase })
}

describe('fundingReducer', () => {
  describe('LOAD_CASE', () => {
    it('loads a funding case and sets default cadence', () => {
      const state = loadCase()
      expect(state.fundingCase?.id).toBe('funding-001')
      expect(state.ui.selectedCadence).toBe('monthly')
      expect(state.ui.step).toBe('select')
      expect(state.ui.resolvedAmountCents).toBe(0)
    })

    it('resolves fixed amount on load', () => {
      const state = loadCase(specialCommissionCase)
      expect(state.ui.resolvedAmountCents).toBe(3_500_00)
    })
  })

  describe('SELECT_TIER', () => {
    it('selects a tier and resolves amount', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-002' })
      expect(state.ui.selectedTierId).toBe('tier-002')
      expect(state.ui.resolvedAmountCents).toBe(15_00)
      expect(state.ui.customAmountCents).toBeNull()
    })
  })

  describe('SET_CUSTOM_AMOUNT', () => {
    it('sets custom amount and clears tier selection', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-001' })
      state = fundingReducer(state, { type: 'SET_CUSTOM_AMOUNT', amountCents: 20_00 })
      expect(state.ui.selectedTierId).toBeNull()
      expect(state.ui.customAmountCents).toBe(20_00)
      expect(state.ui.resolvedAmountCents).toBe(20_00)
    })

    it('enforces minimum amount', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SET_CUSTOM_AMOUNT', amountCents: 1_00 })
      // minimum is 5_00 for creator support
      expect(state.ui.resolvedAmountCents).toBe(5_00)
    })
  })

  describe('SET_CADENCE', () => {
    it('changes cadence', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SET_CADENCE', cadence: 'annual' })
      expect(state.ui.selectedCadence).toBe('annual')
    })
  })

  describe('CLEAR_SELECTION', () => {
    it('clears tier and custom amount', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-003' })
      state = fundingReducer(state, { type: 'CLEAR_SELECTION' })
      expect(state.ui.selectedTierId).toBeNull()
      expect(state.ui.customAmountCents).toBeNull()
      expect(state.ui.resolvedAmountCents).toBe(0)
    })
  })

  describe('step navigation', () => {
    it('GO_TO_PAYMENT fails without amount', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      expect(state.ui.step).toBe('select')
      expect(state.ui.error).toBeTruthy()
    })

    it('GO_TO_PAYMENT succeeds with amount', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-001' })
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      expect(state.ui.step).toBe('payment')
      expect(state.ui.error).toBeNull()
    })

    it('GO_BACK_TO_SELECT returns to select', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-001' })
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      state = fundingReducer(state, { type: 'GO_BACK_TO_SELECT' })
      expect(state.ui.step).toBe('select')
    })
  })

  describe('payment flow', () => {
    it('SUBMIT_PAYMENT sets processing', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-001' })
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      state = fundingReducer(state, { type: 'SUBMIT_PAYMENT' })
      expect(state.ui.step).toBe('processing')
      expect(state.payment.processing).toBe(true)
    })

    it('PAYMENT_SUCCESS updates raised amount', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-001' })
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      state = fundingReducer(state, { type: 'SUBMIT_PAYMENT' })
      state = fundingReducer(state, { type: 'PAYMENT_SUCCESS', paymentIntentId: 'pi_test' })
      expect(state.ui.step).toBe('success')
      expect(state.fundingCase!.raisedCents).toBe(creatorSupportCase.raisedCents + 5_00)
      expect(state.fundingCase!.totalContributors).toBe(creatorSupportCase.totalContributors + 1)
    })

    it('PAYMENT_ERROR sets error state', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-001' })
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      state = fundingReducer(state, { type: 'SUBMIT_PAYMENT' })
      state = fundingReducer(state, { type: 'PAYMENT_ERROR', error: 'Card declined' })
      expect(state.ui.step).toBe('error')
      expect(state.ui.error).toBe('Card declined')
      expect(state.payment.processing).toBe(false)
    })
  })

  describe('DISMISS_ERROR', () => {
    it('returns to payment step from error', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-001' })
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      state = fundingReducer(state, { type: 'SUBMIT_PAYMENT' })
      state = fundingReducer(state, { type: 'PAYMENT_ERROR', error: 'failed' })
      state = fundingReducer(state, { type: 'DISMISS_ERROR' })
      expect(state.ui.step).toBe('payment')
      expect(state.ui.error).toBeNull()
    })
  })

  describe('RESET', () => {
    it('resets to initial selection state', () => {
      let state = loadCase()
      state = fundingReducer(state, { type: 'SELECT_TIER', tierId: 'tier-003' })
      state = fundingReducer(state, { type: 'GO_TO_PAYMENT' })
      state = fundingReducer(state, { type: 'RESET' })
      expect(state.ui.step).toBe('select')
      expect(state.ui.selectedTierId).toBeNull()
      expect(state.ui.resolvedAmountCents).toBe(0)
      expect(state.fundingCase?.id).toBe('funding-001')
    })
  })
})
