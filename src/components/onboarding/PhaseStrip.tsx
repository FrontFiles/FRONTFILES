'use client'

import { cn } from '@/lib/utils'
import { ONBOARDING_PHASES } from '@/lib/onboarding/constants'
import type { OnboardingPhaseId } from '@/lib/onboarding/types'

interface PhaseStripProps {
  currentPhase: OnboardingPhaseId
  completedPhases: OnboardingPhaseId[]
}

export function PhaseStrip({ currentPhase, completedPhases }: PhaseStripProps) {
  return (
    <div className="flex items-stretch border-b-2 border-black">
      {ONBOARDING_PHASES.map((phase, index) => {
        const isCompleted = completedPhases.includes(phase.id)
        const isCurrent = phase.id === currentPhase
        const isFuture = !isCompleted && !isCurrent
        const isLast = index === ONBOARDING_PHASES.length - 1

        return (
          <div key={phase.id} className="flex-1 flex items-center">
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
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ) : (
                <span className={cn(
                  'w-4 h-4 flex items-center justify-center text-[10px] font-mono shrink-0',
                  isCurrent && 'text-[#0000ff]',
                  isFuture && 'text-slate-300',
                )}>
                  {phase.id}
                </span>
              )}
              {phase.label}
            </div>
            {!isLast && (
              <div className={cn(
                'w-px h-3 shrink-0',
                isCompleted ? 'bg-black' : 'bg-slate-200',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
