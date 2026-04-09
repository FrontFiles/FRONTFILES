'use client'

import { StepIndicator } from './StepIndicator'
import { Step1IdVerification } from './steps/Step1IdVerification'
import { Step2CrossCheck } from './steps/Step2CrossCheck'
import { Step3ValidateData } from './steps/Step3ValidateData'
import { Step4PreFill } from './steps/Step4PreFill'
import { Step5ValidateUser } from './steps/Step5ValidateUser'
import { Step6VaultCreation } from './steps/Step6VaultCreation'
import type { OnboardingFlowState } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface OnboardingShellProps {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  goNext: () => void
  goBack: () => void
}

export function OnboardingShell({ state, dispatch, goNext }: OnboardingShellProps) {
  function renderStep() {
    switch (state.currentStep) {
      case 1:
        return (
          <Step1IdVerification
            identityVerification={state.identityVerification}
            identityAnchor={state.identityAnchor}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 2:
        if (!state.identityAnchor) {
          return <ErrorPanel message="Identity anchor not found. Please complete Step 1." />
        }
        return (
          <Step2CrossCheck
            identityAnchor={state.identityAnchor}
            crossCheckComplete={state.crossCheckComplete}
            crossCheckSignals={state.crossCheckSignals}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 3:
        if (!state.identityAnchor) {
          return <ErrorPanel message="Identity anchor not found. Please complete Step 1." />
        }
        return (
          <Step3ValidateData
            crossCheckSignals={state.crossCheckSignals}
            identityAnchor={state.identityAnchor}
            validationOutcome={state.validationOutcome}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 4:
        if (!state.profileDraft) {
          return <ErrorPanel message="Profile draft not found. Please complete Step 3." />
        }
        return (
          <Step4PreFill
            profileDraft={state.profileDraft}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 5:
        if (!state.profileDraft || !state.identityAnchor) {
          return <ErrorPanel message="Profile or identity data missing. Please restart." />
        }
        return (
          <Step5ValidateUser
            profileDraft={state.profileDraft}
            identityAnchor={state.identityAnchor}
            finalValidationOutcome={state.finalValidationOutcome}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 6:
        if (!state.vaultId || !state.profileDraft || !state.identityAnchor) {
          return <ErrorPanel message="Vault data missing. Please restart." />
        }
        return (
          <Step6VaultCreation
            vaultId={state.vaultId}
            profileDraft={state.profileDraft}
            identityAnchor={state.identityAnchor}
          />
        )

      default:
        return <ErrorPanel message="Unknown step." />
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-white">
      {/* Logo header */}
      <header className="h-14 flex items-center px-8 border-b-2 border-black shrink-0">
        <a href="/" className="text-lg font-black tracking-tight leading-none">
          <span className="text-black">FRONT</span><span className="text-blue-600">FILES</span>
        </a>
      </header>

      <div className="flex flex-1">
        {/* Left sidebar */}
        <div className="hidden lg:flex shrink-0 w-64 overflow-y-auto bg-white border-r border-slate-200">
          <StepIndicator
            currentStep={state.currentStep}
            completedSteps={state.completedSteps}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-2xl mx-auto px-12 py-14">
            {renderStep()}
          </div>
        </main>
      </div>
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="border-2 border-black px-6 py-5">
      <div className="text-black font-bold text-sm mb-1 uppercase tracking-wide">Error</div>
      <p className="text-slate-600 text-sm">{message}</p>
    </div>
  )
}
