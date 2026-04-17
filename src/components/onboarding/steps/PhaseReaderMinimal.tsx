'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OnboardingAction } from '@/lib/onboarding/reducer'
import type { OnboardingFlowState } from '@/lib/onboarding/types'

interface PhaseReaderMinimalProps {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

/**
 * Phase B — Minimal reader step.
 *
 * Readers have no additional identity rows to write after
 * Phase 0 (no creator profile, no buyer account). This step
 * is a short confirmation surface that lets the shell mark
 * `reader-welcome` complete and transition to `launch`.
 */
export function PhaseReaderMinimal({ onComplete }: PhaseReaderMinimalProps) {
  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
          Welcome to Frontfiles
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-xl">
          Your reader account is ready. You can explore certified stories,
          follow creators, and save searches — no additional setup required.
        </p>
      </div>

      <section className="border-2 border-black px-5 py-5 flex flex-col gap-3">
        <SectionLabel>What you can do</SectionLabel>
        <ul className="flex flex-col gap-2 text-sm text-slate-600 leading-relaxed">
          <li className="flex gap-2.5">
            <Bullet />
            <span>Browse the certified catalogue of stories, assets, and articles.</span>
          </li>
          <li className="flex gap-2.5">
            <Bullet />
            <span>Follow creators you trust.</span>
          </li>
          <li className="flex gap-2.5">
            <Bullet />
            <span>Save searches and receive alerts when new matching work is published.</span>
          </li>
        </ul>
        <p className="text-[11px] text-slate-400 leading-relaxed pt-3 border-t border-slate-200">
          Need to license work or commission assignments? You can add a
          buyer account later from your profile.
        </p>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        <Button
          onClick={onComplete}
          className={cn(
            'h-12 px-8 font-bold text-[13px] rounded-none uppercase tracking-[0.12em]',
            'bg-[#0000ff] text-white hover:bg-[#0000cc]',
          )}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">
      {children}
    </span>
  )
}

function Bullet() {
  return (
    <span className="mt-1.5 w-1.5 h-1.5 bg-black shrink-0" aria-hidden />
  )
}
