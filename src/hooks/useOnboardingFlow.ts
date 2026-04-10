'use client'

import { useReducer, useCallback } from 'react'
import { onboardingReducer, initialState, type OnboardingAction } from '@/lib/onboarding/reducer'
import type { OnboardingFlowState, OnboardingPhaseId } from '@/lib/onboarding/types'

const PHASE_ORDER: OnboardingPhaseId[] = [1, 2, 3]

export interface OnboardingFlowHook {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  goToPhase: (phase: OnboardingPhaseId) => void
  goNext: () => void
  goBack: () => void
  canGoNext: boolean
  canGoBack: boolean
  markPhaseComplete: (phase: OnboardingPhaseId) => void
}

export function useOnboardingFlow(): OnboardingFlowHook {
  const [state, dispatch] = useReducer(onboardingReducer, initialState)

  const goToPhase = useCallback((phase: OnboardingPhaseId) => {
    dispatch({ type: 'SET_STEP', payload: phase })
  }, [])

  const goNext = useCallback(() => {
    const currentIndex = PHASE_ORDER.indexOf(state.currentStep)
    if (currentIndex < PHASE_ORDER.length - 1) {
      const nextPhase = PHASE_ORDER[currentIndex + 1]
      dispatch({ type: 'MARK_STEP_COMPLETE', payload: state.currentStep })
      dispatch({ type: 'SET_STEP', payload: nextPhase })
    }
  }, [state.currentStep])

  const goBack = useCallback(() => {
    const currentIndex = PHASE_ORDER.indexOf(state.currentStep)
    if (currentIndex > 0) {
      const prevPhase = PHASE_ORDER[currentIndex - 1]
      dispatch({ type: 'SET_STEP', payload: prevPhase })
    }
  }, [state.currentStep])

  const markPhaseComplete = useCallback((phase: OnboardingPhaseId) => {
    dispatch({ type: 'MARK_STEP_COMPLETE', payload: phase })
  }, [])

  const currentIndex = PHASE_ORDER.indexOf(state.currentStep)
  const canGoNext = currentIndex < PHASE_ORDER.length - 1
  const canGoBack = currentIndex > 0

  return {
    state,
    dispatch,
    goToPhase,
    goNext,
    goBack,
    canGoNext,
    canGoBack,
    markPhaseComplete,
  }
}
