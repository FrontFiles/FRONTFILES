'use client'

import { OnboardingShell } from '@/components/onboarding/OnboardingShell'
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow'

export default function OnboardingPage() {
  const { state, dispatch, goNext, goBack, clearPersistedState } =
    useOnboardingFlow()

  return (
    <OnboardingShell
      state={state}
      dispatch={dispatch}
      goNext={goNext}
      goBack={goBack}
      clearPersistedState={clearPersistedState}
    />
  )
}
