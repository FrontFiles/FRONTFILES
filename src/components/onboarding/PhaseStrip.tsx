'use client'

import { cn } from '@/lib/utils'
import { ONBOARDING_STEP_META } from '@/lib/onboarding/constants'
import type { OnboardingStepKey } from '@/lib/onboarding/types'

interface PhaseStripProps {
  /** The ordered step keys for the active role sequence. */
  stepSequence: OnboardingStepKey[]
  currentStep: OnboardingStepKey
  completedSteps: OnboardingStepKey[]
}

/**
 * Phase B — role-aware step strip.
 *
 * Shows the steps for the current role sequence. Before a role
 * is chosen, the sequence is `['account', 'launch']` so the
 * strip always has at least two chips to render.
 */
export function PhaseStrip({
  stepSequence,
  currentStep,
  completedSteps,
}: PhaseStripProps) {
  return (
    <div className="flex items-stretch border-b-2 border-black">
      {stepSequence.map((key, index) => {
        const meta = ONBOARDING_STEP_META[key]
        const isCompleted = completedSteps.includes(key)
        const isCurrent = key === currentStep
        const isFuture = !isCompleted && !isCurrent
        const isLast = index === stepSequence.length - 1

        return (
          <div key={key} className="flex-1 flex items-center">
            <div
              className={cn(
                'flex-1 flex items-center justify-center gap-2.5 py-4 text-[11px] font-bold uppercase tracking-[0.18em] transition-all duration-300 border-b-2 -mb-[2px]',
                isCurrent && 'text-[#0000ff] border-[#0000ff]',
                isCompleted && 'text-black border-black',
                isFuture && 'text-slate-300 border-transparent',
              )}
            >
              {isCompleted ? (
                <div className="w-4 h-4 bg-black flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
                    <path
                      d="M1.5 5L4 7.5L8.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ) : (
                <span
                  className={cn(
                    'w-4 h-4 flex items-center justify-center text-[10px] font-mono shrink-0',
                    isCurrent && 'text-[#0000ff]',
                    isFuture && 'text-slate-300',
                  )}
                >
                  {index + 1}
                </span>
              )}
              {meta.label}
            </div>
            {!isLast && (
              <div
                className={cn(
                  'w-px h-3 shrink-0',
                  isCompleted ? 'bg-black' : 'bg-slate-200',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
