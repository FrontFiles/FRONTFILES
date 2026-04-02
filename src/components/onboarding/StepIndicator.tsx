'use client'

import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS } from '@/lib/onboarding/constants'
import type { OnboardingStepId } from '@/lib/onboarding/types'

interface StepIndicatorProps {
  currentStep: OnboardingStepId
  completedSteps: OnboardingStepId[]
}

export function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <aside className="w-64 shrink-0 flex flex-col gap-0 py-10 px-6">
      <div className="mb-10">
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400 select-none">
          Creator Onboarding
        </span>
      </div>

      <nav className="flex flex-col gap-0">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id)
          const isCurrent = step.id === currentStep
          const isFuture = !isCompleted && !isCurrent
          const isLast = index === ONBOARDING_STEPS.length - 1

          return (
            <div key={step.id} className="flex gap-4">
              {/* Circle + connector column */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-7 h-7 shrink-0 text-xs font-bold transition-all duration-300',
                    isCompleted && 'bg-black text-white',
                    isCurrent && 'bg-blue-600 text-white',
                    isFuture && 'bg-white text-slate-400 border border-slate-300'
                  )}
                >
                  {isCompleted ? <CheckIcon className="w-3.5 h-3.5" /> : <span>{step.id}</span>}
                </div>

                {!isLast && (
                  <div
                    className={cn(
                      'w-px flex-1 my-2 min-h-8',
                      isCompleted ? 'bg-black' : isCurrent ? 'bg-blue-600' : 'bg-slate-200'
                    )}
                  />
                )}
              </div>

              {/* Step text */}
              <div
                className={cn(
                  'pb-8 pt-0.5 flex flex-col gap-0.5 transition-all duration-300 min-w-0',
                  isLast && 'pb-0',
                  isCurrent && 'pl-3 border-l-2 border-blue-600 -ml-[3px]'
                )}
              >
                <span
                  className={cn(
                    'text-sm leading-tight truncate',
                    isCurrent && 'text-black font-bold',
                    isCompleted && 'text-black font-medium',
                    isFuture && 'text-slate-400 font-medium'
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    'text-xs leading-snug',
                    isCurrent && 'text-slate-600',
                    isCompleted && 'text-slate-400',
                    isFuture && 'text-slate-300'
                  )}
                >
                  {step.description}
                </span>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="mt-auto pt-8 border-t border-slate-200">
        <p className="text-xs text-slate-400 leading-relaxed">
          Frontfiles holds only your verification result and identity anchor. Raw biometric data never leaves the KYC provider.
        </p>
      </div>
    </aside>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none">
      <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
