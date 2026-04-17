'use client'

import { useReducer, useCallback } from 'react'
import type { FundingCase, FundingCadence, FundingAction } from '@/lib/funding/types'
import { fundingReducer, initialFundingEngineState } from '@/lib/funding/machine'
import { createPaymentIntent, confirmPayment } from '@/lib/funding/stripe-adapter'

export function useFundingEngine(fundingCase: FundingCase) {
  const [state, dispatch] = useReducer(fundingReducer, initialFundingEngineState, (init) => {
    return fundingReducer(init, { type: 'LOAD_CASE', fundingCase })
  })

  const selectTier = useCallback((tierId: string) => {
    dispatch({ type: 'SELECT_TIER', tierId })
  }, [])

  const setCustomAmount = useCallback((amountCents: number) => {
    dispatch({ type: 'SET_CUSTOM_AMOUNT', amountCents })
  }, [])

  const setCadence = useCallback((cadence: FundingCadence) => {
    dispatch({ type: 'SET_CADENCE', cadence })
  }, [])

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [])

  const goToPayment = useCallback(() => {
    dispatch({ type: 'GO_TO_PAYMENT' })
  }, [])

  const goBackToSelect = useCallback(() => {
    dispatch({ type: 'GO_BACK_TO_SELECT' })
  }, [])

  const submitPayment = useCallback(async () => {
    dispatch({ type: 'SUBMIT_PAYMENT' })

    try {
      const intent = await createPaymentIntent({
        amountCents: state.ui.resolvedAmountCents,
        currency: state.fundingCase?.currency ?? 'EUR',
        fundingCaseId: state.fundingCase?.id ?? '',
      })

      dispatch({ type: 'SET_CLIENT_SECRET', clientSecret: intent.clientSecret })

      const result = await confirmPayment({ clientSecret: intent.clientSecret })

      if (result.success) {
        dispatch({ type: 'PAYMENT_SUCCESS', paymentIntentId: result.paymentIntentId })
      } else {
        dispatch({ type: 'PAYMENT_ERROR', error: result.error ?? 'Payment failed.' })
      }
    } catch (err) {
      dispatch({ type: 'PAYMENT_ERROR', error: 'An unexpected error occurred. Please try again.' })
    }
  }, [state.ui.resolvedAmountCents, state.fundingCase?.currency, state.fundingCase?.id])

  const dismissError = useCallback(() => {
    dispatch({ type: 'DISMISS_ERROR' })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const setCardComplete = useCallback((complete: boolean) => {
    dispatch({ type: 'CARD_COMPLETE', complete })
  }, [])

  return {
    state,
    dispatch,
    // Convenience methods
    selectTier,
    setCustomAmount,
    setCadence,
    clearSelection,
    goToPayment,
    goBackToSelect,
    submitPayment,
    dismissError,
    reset,
    setCardComplete,
  }
}
