'use client'

import { useReducer, useCallback } from 'react'
import { onboardingReducer, initialState, type OnboardingAction } from '@/lib/onboarding/reducer'
import type { OnboardingFlowState, OnboardingStepId } from '@/lib/onboarding/types'

const STEP_ORDER: OnboardingStepId[] = [1, 2, 3, 4, 5, 6]

export interface OnboardingFlowHook {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  goToStep: (step: OnboardingStepId) => void
  goNext: () => void
  goBack: () => void
  canGoNext: boolean
  canGoBack: boolean
  markStepComplete: (step: OnboardingStepId) => void
}

export function useOnboardingFlow(): OnboardingFlowHook {
  const [state, dispatch] = useReducer(onboardingReducer, initialState)

  const goToStep = useCallback((step: OnboardingStepId) => {
    dispatch({ type: 'SET_STEP', payload: step })
  }, [])

  const goNext = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep)
    if (currentIndex < STEP_ORDER.length - 1) {
      const nextStep = STEP_ORDER[currentIndex + 1]
      dispatch({ type: 'MARK_STEP_COMPLETE', payload: state.currentStep })
      dispatch({ type: 'SET_STEP', payload: nextStep })
    }
  }, [state.currentStep])

  const goBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep)
    if (currentIndex > 0) {
      const prevStep = STEP_ORDER[currentIndex - 1]
      dispatch({ type: 'SET_STEP', payload: prevStep })
    }
  }, [state.currentStep])

  const markStepComplete = useCallback((step: OnboardingStepId) => {
    dispatch({ type: 'MARK_STEP_COMPLETE', payload: step })
  }, [])

  const currentIndex = STEP_ORDER.indexOf(state.currentStep)
  const canGoNext = currentIndex < STEP_ORDER.length - 1
  const canGoBack = currentIndex > 0

  return {
    state,
    dispatch,
    goToStep,
    goNext,
    goBack,
    canGoNext,
    canGoBack,
    markStepComplete,
  }
}
