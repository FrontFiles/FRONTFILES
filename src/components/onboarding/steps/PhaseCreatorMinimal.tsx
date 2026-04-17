'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { upsertCreatorProfile } from '@/lib/identity/store'
import type { OnboardingAction } from '@/lib/onboarding/reducer'
import type { OnboardingFlowState } from '@/lib/onboarding/types'

interface PhaseCreatorMinimalProps {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: (vaultId: string) => void
}

/**
 * Minimal creator profile step.
 *
 * Collects two optional fields (professional title, biography)
 * and writes a `creator_profiles` row via `upsertCreatorProfile`.
 * Even when the user skips both inputs we still write a stub
 * row so the canonical 1:1 invariant (user with `creator` grant
 * => creator_profiles row) holds.
 *
 * Everything deeper — affiliations, press accreditations,
 * coverage areas, skills, also-me links — is deferred to the
 * `/account/profile` editor. KYC and payout legal identity are
 * handled by the IdentityDrawer (JIT, triggered at signing or
 * first-payout time) and are intentionally kept out of this step.
 *
 * Creator is considered "activated" once this step completes.
 */
export function PhaseCreatorMinimal({ state, dispatch, onComplete }: PhaseCreatorMinimalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function handleTitleChange(value: string) {
    dispatch({
      type: 'UPDATE_CREATOR_MINIMAL',
      payload: { professionalTitle: value },
    })
  }

  function handleBioChange(value: string) {
    dispatch({
      type: 'UPDATE_CREATOR_MINIMAL',
      payload: { biography: value },
    })
  }

  async function handleSubmit() {
    if (!state.createdUserId) {
      setSubmitError('Missing user context. Please restart onboarding.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await upsertCreatorProfile({
        user_id: state.createdUserId,
        professional_title: state.creatorMinimal.professionalTitle.trim() || null,
        biography: state.creatorMinimal.biography.trim() || null,
      })
      const vaultId = 'VAULT-' + state.createdUserId.slice(-8).toUpperCase()
      dispatch({ type: 'SET_VAULT_CREATED', payload: { vaultId } })
      onComplete(vaultId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save your profile'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    if (!state.createdUserId) {
      setSubmitError('Missing user context. Please restart onboarding.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Still create a stub creator_profiles row so the
      // canonical schema (1:1 user → creator_profiles for
      // creator-grant users) holds.
      await upsertCreatorProfile({
        user_id: state.createdUserId,
        professional_title: null,
        biography: null,
      })
      const vaultId = 'VAULT-' + state.createdUserId.slice(-8).toUpperCase()
      dispatch({ type: 'SET_VAULT_CREATED', payload: { vaultId } })
      onComplete(vaultId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not initialise your profile'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
          Tell us what you do
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-xl">
          Two optional fields. You can skip this step and fill everything in later from your account.
        </p>
      </div>

      <section className="border-2 border-black px-5 py-6 flex flex-col gap-6">
        {/* Professional title */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
            Professional title
          </span>
          <span className="text-[11px] text-slate-400">
            Optional. One short line describing what you do.
          </span>
          <input
            type="text"
            value={state.creatorMinimal.professionalTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. Photojournalist, Southern Brazil"
            maxLength={120}
            className="h-10 px-3 text-sm border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
          />
        </label>

        {/* Biography */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
            Biography
          </span>
          <span className="text-[11px] text-slate-400">
            Optional. A paragraph about your practice and coverage.
          </span>
          <textarea
            value={state.creatorMinimal.biography}
            onChange={(e) => handleBioChange(e.target.value)}
            rows={5}
            maxLength={1200}
            placeholder="I cover… My recent work has appeared in…"
            className="px-3 py-2 text-sm border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff] resize-none"
          />
        </label>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Affiliations, press accreditations, publications, coverage areas,
          and skills can be added later from your account profile.
        </p>
      </section>

      {/* Submit error */}
      {submitError && (
        <div className="border-2 border-dashed border-black px-5 py-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black mb-1 block">
            Something went wrong
          </span>
          <p className="text-sm text-slate-500 leading-relaxed">{submitError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            'h-12 px-8 font-bold text-[13px] rounded-none uppercase tracking-[0.12em]',
            !submitting
              ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed',
          )}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-transparent animate-spin" />
              Saving…
            </span>
          ) : (
            'Save and continue'
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={handleSkip}
          disabled={submitting}
          className="h-12 px-5 text-slate-500 hover:text-black hover:bg-slate-50 text-sm rounded-none font-bold"
        >
          Skip for now
        </Button>
      </div>
    </div>
  )
}
