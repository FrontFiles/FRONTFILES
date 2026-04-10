'use client'

import Link from 'next/link'
import { PhaseStrip } from './PhaseStrip'
import { Phase1Verify } from './steps/Phase1Verify'
import { Phase2Build } from './steps/Phase2Build'
import { Phase3Launch } from './steps/Phase3Launch'
import type { OnboardingFlowState } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface OnboardingShellProps {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  goNext: () => void
  goBack: () => void
}

export function OnboardingShell({ state, dispatch, goNext }: OnboardingShellProps) {
  function renderPhase() {
    switch (state.currentStep) {
      case 1:
        return (
          <Phase1Verify
            identityVerification={state.identityVerification}
            identityAnchor={state.identityAnchor}
            profileDraft={state.profileDraft}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 2:
        if (!state.profileDraft || !state.identityAnchor) {
          return <ErrorPanel message="Profile data not found. Please complete verification first." />
        }
        return (
          <Phase2Build
            profileDraft={state.profileDraft}
            identityAnchor={state.identityAnchor}
            validationOutcome={state.validationOutcome}
            username={state.username}
            usernameAvailable={state.usernameAvailable}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 3:
        if (!state.vaultId || !state.profileDraft || !state.identityAnchor) {
          return <ErrorPanel message="Vault data missing. Please restart." />
        }
        return (
          <Phase3Launch
            vaultId={state.vaultId}
            profileDraft={state.profileDraft}
            identityAnchor={state.identityAnchor}
            username={state.username}
          />
        )

      default:
        return <ErrorPanel message="Unknown phase." />
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="h-14 flex items-center px-8 border-b-2 border-black shrink-0">
        <Link href="/" className="text-lg font-extrabold tracking-[0.04em] uppercase leading-none">
          <span className="text-black">Front</span><span className="text-[#0000ff]">files</span>
        </Link>
      </header>

      {/* Phase strip */}
      <PhaseStrip
        currentPhase={state.currentStep}
        completedPhases={state.completedSteps}
      />

      {/* Main content — full width, centered */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-12">
          {renderPhase()}
        </div>
      </main>
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="border-2 border-black px-6 py-5">
      <div className="text-black font-bold text-[11px] mb-1 uppercase tracking-[0.14em]">Error</div>
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  )
}
