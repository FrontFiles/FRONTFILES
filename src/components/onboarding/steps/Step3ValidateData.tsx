'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ShieldCheck, Shield } from 'lucide-react'
import { validateCreatorPersonalData, buildProfileDraft } from '@/lib/onboarding/mock-services'
import type { CrossCheckSignal, IdentityAnchor, ValidationOutcome, ValidationFlag } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface Step3Props {
  crossCheckSignals: CrossCheckSignal[]
  identityAnchor: IdentityAnchor
  validationOutcome: ValidationOutcome | null
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

export function Step3ValidateData({ crossCheckSignals, identityAnchor, validationOutcome, dispatch, onComplete }: Step3Props) {
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleValidate() {
    setValidating(true)
    setError(null)
    try {
      const outcome = await validateCreatorPersonalData(crossCheckSignals, identityAnchor)
      dispatch({ type: 'SET_VALIDATION_OUTCOME', payload: outcome })

      if (outcome.canContinue) {
        const draft = await buildProfileDraft(crossCheckSignals, identityAnchor)
        dispatch({ type: 'SET_PROFILE_DRAFT', payload: draft })
      }
    } catch {
      setError('An error occurred during validation. Please try again.')
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase border-2 border-black text-black">
            Step 03
          </span>
        </div>
        <h1 className="text-4xl font-bold text-black tracking-tight mb-3">
          Data Validation
        </h1>
        <p className="text-slate-600 text-base leading-relaxed max-w-xl">
          The cross-check results are now being assessed against your verified identity. Review the outcome below.
        </p>
      </div>

      {/* Signals summary */}
      {crossCheckSignals.length > 0 && (
        <div className="flex flex-col gap-0">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Discovered signals</h2>
          <div className="border-2 border-black divide-y divide-slate-200">
            {crossCheckSignals.map(signal => (
              <SignalRow key={signal.field} signal={signal} />
            ))}
          </div>
        </div>
      )}

      {/* Validation trigger */}
      {!validationOutcome && (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="border-2 border-black px-4 py-3">
              <p className="text-black text-sm">{error}</p>
            </div>
          )}
          <div>
            <Button
              onClick={handleValidate}
              disabled={validating}
              className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
            >
              {validating ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-transparent animate-spin" />
                  Validating…
                </span>
              ) : (
                'Run validation'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Outcome panels */}
      {validationOutcome && (
        <ValidationOutcomePanel
          outcome={validationOutcome}
          onContinue={onComplete}
        />
      )}
    </div>
  )
}

function SignalRow({ signal }: { signal: CrossCheckSignal }) {
  const hasFlag = signal.flagReason !== null
  const confidencePct = Math.round(signal.confidence * 100)

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3',
        hasFlag && 'border-l-4 border-l-blue-600'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{signal.field}</span>
          <span className="text-[10px] font-bold text-slate-400">
            {confidencePct}%
          </span>
          {hasFlag && (
            <span className="h-4 px-1.5 text-[10px] border border-black text-black font-bold inline-flex items-center uppercase tracking-wider">
              Flagged
            </span>
          )}
        </div>
        <div className="text-sm text-black leading-snug mb-1">{signal.proposedValue}</div>
        {hasFlag && (
          <div className="text-xs text-slate-500 mt-1">{signal.flagReason}</div>
        )}
        <div className="flex gap-2 mt-1 flex-wrap">
          {signal.sources.map((src, i) => (
            <span key={i} className="text-[10px] text-slate-400 font-mono">{src.platform}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ValidationOutcomePanel({ outcome, onContinue }: { outcome: ValidationOutcome; onContinue: () => void }) {
  if (outcome.status === 'VALIDATED') {
    return (
      <div className="flex flex-col gap-4">
        <div className="border-2 border-blue-600 px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
            <div>
              <div className="text-black font-bold text-base uppercase tracking-wide">Validated</div>
              <div className="text-slate-500 text-xs">All signals reconciled successfully</div>
            </div>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            Your cross-check data has been validated against your verified identity with no discrepancies. You may proceed to set up your profile.
          </p>
        </div>
        <Button
          onClick={onContinue}
          className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none w-fit uppercase tracking-wide"
        >
          Set up profile
        </Button>
      </div>
    )
  }

  if (outcome.status === 'FLAGGED') {
    return (
      <div className="flex flex-col gap-4">
        <div className="border-2 border-dashed border-black px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase border-2 border-black text-black">
              Flagged for review
            </span>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            {outcome.reviewMessage}
          </p>
          {outcome.flags.length > 0 && (
            <div className="flex flex-col gap-2">
              {outcome.flags.map((flag, i) => (
                <FlagRow key={i} flag={flag} />
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-4">
            You may proceed. Your profile will be reviewed before going live.
          </p>
        </div>
        <Button
          onClick={onContinue}
          className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none w-fit uppercase tracking-wide"
        >
          Continue with caveats
        </Button>
      </div>
    )
  }

  if (outcome.status === 'STANDARD_BLOCK') {
    return (
      <div className="border-2 border-black px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-black text-white">
            Application paused
          </span>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          {outcome.reviewMessage}
        </p>
        {outcome.flags.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {outcome.flags.map((flag, i) => (
              <FlagRow key={i} flag={flag} />
            ))}
          </div>
        )}
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            Manual review required. For support:{' '}
            <span className="text-black font-bold">support@frontfiles.com</span>
          </p>
        </div>
      </div>
    )
  }

  if (outcome.status === 'HARD_BLOCK') {
    return (
      <div className="bg-black text-white px-6 py-8 flex flex-col items-center text-center gap-4">
        <div className="w-10 h-10 border border-white/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white/50" />
        </div>
        <div>
          <div className="text-white font-bold text-base mb-1 uppercase tracking-wide">Application closed</div>
          <div className="text-white/40 text-xs mb-3">This decision is final and not subject to appeal</div>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
            {outcome.reviewMessage}
          </p>
        </div>
      </div>
    )
  }

  return null
}

function FlagRow({ flag }: { flag: ValidationFlag }) {
  return (
    <div className="flex gap-3 border border-slate-200 px-3 py-2.5">
      <span className="text-[10px] font-bold px-1.5 py-0.5 border border-black text-black shrink-0 self-start mt-0.5 uppercase tracking-wider">
        {flag.severity}
      </span>
      <div>
        <div className="text-xs font-mono text-slate-400 mb-0.5">{flag.field}</div>
        <div className="text-xs text-slate-600 leading-relaxed">{flag.description}</div>
      </div>
    </div>
  )
}
