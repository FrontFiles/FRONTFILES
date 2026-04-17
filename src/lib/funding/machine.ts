/**
 * Funding Engine — Reducer (State Machine)
 *
 * Deterministic state machine for Funding lifecycle.
 * All mutations through dispatched actions.
 * System boundary: Funding Engine owns case + UI state.
 * Stripe is authoritative for payment; this mirrors.
 */

import type {
  FundingEngineState,
  FundingAction,
  FundingUIState,
  FundingPaymentState,
  FundingCase,
} from './types'

// ══════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════

export const initialFundingUIState: FundingUIState = {
  selectedTierId: null,
  selectedCadence: 'one_time',
  customAmountCents: null,
  resolvedAmountCents: 0,
  step: 'select',
  error: null,
  successMessage: null,
}

export const initialFundingPaymentState: FundingPaymentState = {
  stripeClientSecret: null,
  stripePaymentIntentId: null,
  cardComplete: false,
  processing: false,
  lastError: null,
}

export const initialFundingEngineState: FundingEngineState = {
  fundingCase: null,
  ui: initialFundingUIState,
  payment: initialFundingPaymentState,
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function resolveAmount(
  fundingCase: FundingCase,
  tierId: string | null,
  customAmountCents: number | null,
): number {
  if (fundingCase.paymentRule.type === 'fixed' && fundingCase.paymentRule.fixedAmountCents) {
    return fundingCase.paymentRule.fixedAmountCents
  }
  if (tierId) {
    const tier = fundingCase.tiers.find(t => t.id === tierId)
    if (tier) return tier.amountCents
  }
  if (customAmountCents !== null) {
    return Math.max(customAmountCents, fundingCase.paymentRule.minimumCents)
  }
  return 0
}

// ══════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════

export function fundingReducer(
  state: FundingEngineState,
  action: FundingAction,
): FundingEngineState {
  switch (action.type) {
    // ── Load ──

    case 'LOAD_CASE': {
      const fc = action.fundingCase
      const defaultCadence = fc.paymentRule.allowedCadences[0] ?? 'one_time'
      const resolvedAmountCents = fc.paymentRule.type === 'fixed' && fc.paymentRule.fixedAmountCents
        ? fc.paymentRule.fixedAmountCents
        : 0
      return {
        ...state,
        fundingCase: fc,
        ui: {
          ...initialFundingUIState,
          selectedCadence: defaultCadence,
          resolvedAmountCents,
        },
        payment: initialFundingPaymentState,
      }
    }

    // ── Amount selection ──

    case 'SELECT_TIER': {
      if (!state.fundingCase) return state
      const amount = resolveAmount(state.fundingCase, action.tierId, null)
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedTierId: action.tierId,
          customAmountCents: null,
          resolvedAmountCents: amount,
          error: null,
        },
      }
    }

    case 'SET_CUSTOM_AMOUNT': {
      if (!state.fundingCase) return state
      const amount = resolveAmount(state.fundingCase, null, action.amountCents)
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedTierId: null,
          customAmountCents: action.amountCents,
          resolvedAmountCents: amount,
          error: null,
        },
      }
    }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedTierId: null,
          customAmountCents: null,
          resolvedAmountCents: state.fundingCase?.paymentRule.type === 'fixed' && state.fundingCase.paymentRule.fixedAmountCents
            ? state.fundingCase.paymentRule.fixedAmountCents
            : 0,
          error: null,
        },
      }

    // ── Cadence ──

    case 'SET_CADENCE':
      return {
        ...state,
        ui: { ...state.ui, selectedCadence: action.cadence },
      }

    // ── Step navigation ──

    case 'GO_TO_PAYMENT': {
      if (state.ui.resolvedAmountCents <= 0) {
        return {
          ...state,
          ui: { ...state.ui, error: 'Please select an amount to continue.' },
        }
      }
      return {
        ...state,
        ui: { ...state.ui, step: 'payment', error: null },
      }
    }

    case 'GO_BACK_TO_SELECT':
      return {
        ...state,
        ui: { ...state.ui, step: 'select', error: null },
        payment: { ...state.payment, lastError: null },
      }

    case 'GO_TO_CONFIRM':
      if (!state.payment.cardComplete) {
        return {
          ...state,
          ui: { ...state.ui, error: 'Please complete your card details.' },
        }
      }
      return {
        ...state,
        ui: { ...state.ui, step: 'confirm', error: null },
      }

    // ── Payment ──

    case 'CARD_COMPLETE':
      return {
        ...state,
        payment: { ...state.payment, cardComplete: action.complete },
      }

    case 'SET_CLIENT_SECRET':
      return {
        ...state,
        payment: { ...state.payment, stripeClientSecret: action.clientSecret },
      }

    case 'SUBMIT_PAYMENT':
      return {
        ...state,
        ui: { ...state.ui, step: 'processing', error: null },
        payment: { ...state.payment, processing: true, lastError: null },
      }

    case 'PAYMENT_SUCCESS':
      return {
        ...state,
        fundingCase: state.fundingCase ? {
          ...state.fundingCase,
          raisedCents: state.fundingCase.raisedCents + state.ui.resolvedAmountCents,
          totalContributors: state.fundingCase.totalContributors + 1,
        } : null,
        ui: {
          ...state.ui,
          step: 'success',
          successMessage: 'Payment successful! Thank you for your contribution.',
          error: null,
        },
        payment: {
          ...state.payment,
          stripePaymentIntentId: action.paymentIntentId,
          processing: false,
        },
      }

    case 'PAYMENT_ERROR':
      return {
        ...state,
        ui: { ...state.ui, step: 'error', error: action.error },
        payment: { ...state.payment, processing: false, lastError: action.error },
      }

    // ── UI ──

    case 'DISMISS_ERROR':
      return {
        ...state,
        ui: { ...state.ui, error: null, step: state.ui.step === 'error' ? 'payment' : state.ui.step },
        payment: { ...state.payment, lastError: null },
      }

    case 'RESET':
      if (!state.fundingCase) return initialFundingEngineState
      return {
        ...state,
        ui: {
          ...initialFundingUIState,
          selectedCadence: state.fundingCase.paymentRule.allowedCadences[0] ?? 'one_time',
          resolvedAmountCents: state.fundingCase.paymentRule.type === 'fixed' && state.fundingCase.paymentRule.fixedAmountCents
            ? state.fundingCase.paymentRule.fixedAmountCents
            : 0,
        },
        payment: initialFundingPaymentState,
      }

    default:
      return state
  }
}
