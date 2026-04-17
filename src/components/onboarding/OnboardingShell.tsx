'use client'

import Link from 'next/link'
import { PhaseStrip } from './PhaseStrip'
import { PhaseRolePicker } from './steps/PhaseRolePicker'
import { Phase0CreateAccount } from './steps/Phase0CreateAccount'
import { PhaseCreatorMinimal } from './steps/PhaseCreatorMinimal'
import { PhaseBuyerMinimal } from './steps/PhaseBuyerMinimal'
import { PhaseReaderMinimal } from './steps/PhaseReaderMinimal'
import { PhaseLaunch } from './steps/PhaseLaunch'
import type { OnboardingFlowState } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'
import { getStepSequence } from '@/lib/onboarding/constants'

interface OnboardingShellProps {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  goNext: () => void
  goBack: () => void
  /**
   * Clears the persisted onboarding draft from localStorage.
   * Threaded through to `PhaseLaunch` so the final CTA can
   * reset the wizard before routing into the app, ensuring
   * a fresh flow next time `/onboarding` is visited.
   */
  clearPersistedState: () => void
}

/**
 * Role-aware onboarding shell — single canonical path.
 *
 * This is the ONLY onboarding entry point. The legacy three-phase
 * creator flow (Phase1Verify / Phase2Build / Phase3Launch) has
 * been removed; there is no fallback path and nothing to
 * quarantine.
 *
 * ── Flow model ────────────────────────────────────────────────
 *
 * Routing is a switch on `state.currentStep` (a string key from
 * `OnboardingStepKey`). The ordered sequence of valid steps for
 * the current session comes from `getStepSequence(state.role)`:
 *
 *   creator : role-picker → account → creator-profile → launch
 *   buyer   : role-picker → account → buyer-details   → launch
 *   reader  : role-picker → account → reader-welcome  → launch
 *
 * `role-picker` is the single top-level entry into onboarding.
 * Before a role is chosen, `state.role` is null and the sequence
 * is `['role-picker', 'account', 'launch']`. The picker dispatches
 * `SET_ROLE` and then calls `goNext`, which re-resolves the
 * sequence on every call so the shell follows whichever path
 * the user picked.
 *
 * ── Activation semantics ──────────────────────────────────────
 *
 * A user is considered "activated" for a given role when:
 *
 *   creator : has `creator` grant AND a `creator_profiles` row
 *             (written by `PhaseCreatorMinimal` via
 *             `upsertCreatorProfile`).
 *   buyer   : has `buyer` grant AND a `buyer_accounts` row
 *             (written by `PhaseBuyerMinimal` via
 *             `upsertBuyerAccount`).
 *   reader  : has `reader` grant. Readers have no additional
 *             facet row — the reader-welcome step is a
 *             confirmation surface only.
 *
 * The `useOnboardingCompletion` hook computes these flags from
 * canonical user-context state (not wizard state) so they keep
 * working after the user closes the wizard and refreshes.
 *
 * ── Guarded transitions ───────────────────────────────────────
 *
 * Every step after `role-picker` and `account` renders
 * `ErrorPanel` when `state.createdUserId` is missing or the role
 * does not match the step. This catches deep-links and stale
 * persisted state without silently routing the user past a
 * required step. The picker itself has no guard because it is
 * the first step and is meant to be visited with `role === null`.
 */
export function OnboardingShell({
  state,
  dispatch,
  goNext,
  clearPersistedState,
}: OnboardingShellProps) {
  function renderStep() {
    switch (state.currentStep) {
      case 'role-picker':
        // No createdUserId / role guards here — the picker is
        // the first step, so reaching it with a null role is the
        // expected state. A user who somehow lands here with a
        // role already set (e.g. changing their mind before
        // account creation) is allowed to re-pick; `SET_ROLE` is
        // idempotent and nothing has been written to the DB yet.
        return (
          <PhaseRolePicker
            state={state}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 'account':
        return (
          <Phase0CreateAccount
            state={state}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 'creator-profile':
        if (!state.createdUserId || state.role !== 'creator') {
          return (
            <ErrorPanel message="Account context missing. Please restart onboarding." />
          )
        }
        return (
          <PhaseCreatorMinimal
            state={state}
            dispatch={dispatch}
            onComplete={() => goNext()}
          />
        )

      case 'buyer-details':
        if (!state.createdUserId || state.role !== 'buyer') {
          return (
            <ErrorPanel message="Account context missing. Please restart onboarding." />
          )
        }
        return (
          <PhaseBuyerMinimal
            state={state}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 'reader-welcome':
        if (!state.createdUserId || state.role !== 'reader') {
          return (
            <ErrorPanel message="Account context missing. Please restart onboarding." />
          )
        }
        return (
          <PhaseReaderMinimal
            state={state}
            dispatch={dispatch}
            onComplete={goNext}
          />
        )

      case 'launch':
        if (!state.createdUserId) {
          return (
            <ErrorPanel message="Account context missing. Please restart onboarding." />
          )
        }
        return (
          <PhaseLaunch state={state} onExit={clearPersistedState} />
        )

      default:
        return <ErrorPanel message="Unknown onboarding step." />
    }
  }

  // The strip shows steps relevant to the current role. Before a
  // role is picked, the default sequence is
  // `['role-picker', 'account', 'launch']` — the strip always has
  // at least three chips to render, and the `role-picker` chip is
  // the current one.
  const stepSequence = getStepSequence(state.role)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="h-14 flex items-center px-8 border-b-2 border-black shrink-0">
        <Link href="/" className="text-lg font-extrabold tracking-[0.04em] uppercase leading-none">
          <span className="text-black">Front</span>
          <span className="text-[#0000ff]">files</span>
        </Link>
      </header>

      {/* Role-aware step strip */}
      <PhaseStrip
        stepSequence={stepSequence}
        currentStep={state.currentStep}
        completedSteps={state.completedSteps}
      />

      {/* Main content — full width, centered */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-12">{renderStep()}</div>
      </main>
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="border-2 border-black px-6 py-5">
      <div className="text-black font-bold text-[11px] mb-1 uppercase tracking-[0.14em]">
        Error
      </div>
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  )
}
