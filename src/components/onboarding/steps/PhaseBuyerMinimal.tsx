'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { upsertBuyerAccount } from '@/lib/identity/store'
import type { OnboardingAction } from '@/lib/onboarding/reducer'
import type {
  OnboardingFlowState,
  OnboardingBuyerType,
} from '@/lib/onboarding/types'

interface PhaseBuyerMinimalProps {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

/**
 * Phase B — Minimal buyer step.
 *
 * Collects:
 *   - buyer_type: individual | company
 *   - company_name: required only when buyer_type === 'company'
 *
 * On submit, upserts a `buyer_accounts` row via the identity
 * store. VAT number, tax id, billing address, and the broader
 * legal party identity are NOT collected here — they are
 * deferred to `/account/buyer` (Phase C) and to Phase D's
 * IdentityDrawer (for signing/payout).
 */
export function PhaseBuyerMinimal({ state, dispatch, onComplete }: PhaseBuyerMinimalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function handleTypeSelect(type: OnboardingBuyerType) {
    dispatch({ type: 'SET_BUYER_TYPE', payload: type })
  }

  function handleCompanyNameChange(value: string) {
    dispatch({ type: 'SET_COMPANY_NAME', payload: value })
  }

  const { buyerType, companyName } = state.buyerMinimal
  const companyNameOk =
    buyerType !== 'company' || companyName.trim().length > 0
  const ready = buyerType !== null && companyNameOk && !submitting

  async function handleSubmit() {
    if (!ready || !state.createdUserId || !buyerType) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await upsertBuyerAccount({
        user_id: state.createdUserId,
        buyer_type: buyerType,
        company_name: buyerType === 'company' ? companyName.trim() : null,
      })
      onComplete()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save your buyer account'
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
          Are you buying as yourself or on behalf of a company?
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-xl">
          You can change this later. Billing details, VAT number, and legal
          identity are only collected at checkout or when signing a licence.
        </p>
      </div>

      {/* Buyer type selection */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Buyer type</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TypeCard
            label="Individual"
            description="You license assets under your own name."
            selected={buyerType === 'individual'}
            onSelect={() => handleTypeSelect('individual')}
          />
          <TypeCard
            label="Company"
            description="You license assets on behalf of a company or editorial team."
            selected={buyerType === 'company'}
            onSelect={() => handleTypeSelect('company')}
          />
        </div>
      </section>

      {/* Company name (conditional) */}
      {buyerType === 'company' && (
        <section className="border-2 border-black px-5 py-5 flex flex-col gap-3">
          <SectionLabel>Company details</SectionLabel>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
              Company name
            </span>
            <input
              type="text"
              value={companyName}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
              placeholder="e.g. Reuters News Desk"
              maxLength={120}
              className="h-10 px-3 text-sm border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
            />
            <span className="text-[11px] text-slate-400">
              Only the display name is required now. VAT number, tax id, and billing address are
              collected later from your account or at first checkout.
            </span>
          </label>
        </section>
      )}

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
          disabled={!ready}
          className={cn(
            'h-12 px-8 font-bold text-[13px] rounded-none uppercase tracking-[0.12em]',
            ready
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
            'Continue'
          )}
        </Button>
      </div>
    </div>
  )
}

function TypeCard({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'text-left border-2 px-4 py-4 transition-colors',
        selected
          ? 'border-[#0000ff] bg-[#f0f0ff]'
          : 'border-black bg-white hover:bg-slate-50',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={cn(
            'w-4 h-4 border-2 flex items-center justify-center shrink-0',
            selected ? 'border-[#0000ff] bg-[#0000ff]' : 'border-black',
          )}
        >
          {selected && (
            <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
              <path
                d="M1.5 5L4 7.5L8.5 2.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <span
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.14em]',
            selected ? 'text-[#0000ff]' : 'text-black',
          )}
        >
          {label}
        </span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">
      {children}
    </span>
  )
}
