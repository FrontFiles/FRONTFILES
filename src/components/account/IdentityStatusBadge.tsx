'use client'

import { cn } from '@/lib/utils'
import type {
  IdentityVerificationStatus,
  LegalIdentityStatusSummary,
  StripeVerificationState,
} from '@/lib/identity/types'

interface IdentityStatusBadgeProps {
  status: IdentityVerificationStatus
  label?: string
  className?: string
}

/**
 * Phase D — Legal identity status badge.
 *
 * Restrained presentation mapping:
 *   not_started / draft                    → muted
 *   submitted / in_review                  → neutral / warning tint
 *   requirements_due / needs_resubmission  → warning
 *   rejected                               → error
 *   verified                               → success
 */
export function IdentityStatusBadge({
  status,
  label,
  className,
}: IdentityStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] border',
        STATUS_STYLE[status],
        className,
      )}
    >
      <span
        className={cn('w-1.5 h-1.5 shrink-0', DOT_STYLE[status])}
        aria-hidden
      />
      {label ?? STATUS_FALLBACK_LABEL[status]}
    </span>
  )
}

const STATUS_STYLE: Record<IdentityVerificationStatus, string> = {
  not_started: 'border-slate-300 text-slate-400 bg-white',
  draft: 'border-slate-300 text-slate-500 bg-white',
  submitted: 'border-[#0000ff] text-[#0000ff] bg-[#f0f0ff]',
  in_review: 'border-[#0000ff] text-[#0000ff] bg-[#f0f0ff]',
  requirements_due: 'border-amber-500 text-amber-700 bg-amber-50',
  needs_resubmission: 'border-amber-500 text-amber-700 bg-amber-50',
  rejected: 'border-red-600 text-red-700 bg-red-50',
  verified: 'border-emerald-600 text-emerald-700 bg-emerald-50',
}

const DOT_STYLE: Record<IdentityVerificationStatus, string> = {
  not_started: 'bg-slate-300',
  draft: 'bg-slate-400',
  submitted: 'bg-[#0000ff]',
  in_review: 'bg-[#0000ff]',
  requirements_due: 'bg-amber-500',
  needs_resubmission: 'bg-amber-500',
  rejected: 'bg-red-600',
  verified: 'bg-emerald-600',
}

const STATUS_FALLBACK_LABEL: Record<IdentityVerificationStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft saved',
  submitted: 'Submitted',
  in_review: 'Under review',
  requirements_due: 'Action required',
  needs_resubmission: 'Action required',
  rejected: 'Rejected',
  verified: 'Verified',
}

// ══════════════════════════════════════════════
// STRIPE REQUIREMENTS DETAIL HELPER
// ══════════════════════════════════════════════

interface StripeRequirementsDetailProps {
  status: LegalIdentityStatusSummary
  stripe: StripeVerificationState | null
  compact?: boolean
}

/**
 * Render a compact, truthful summary of the Stripe nested
 * state — connected-account id, requirements buckets, and
 * charges/payouts flags.
 *
 * Phase D.1: renders only when a Stripe connection exists.
 * The full payouts drawer in a later phase will extend this
 * with remediation links and receipts.
 */
export function StripeRequirementsDetail({
  status,
  stripe,
  compact = false,
}: StripeRequirementsDetailProps) {
  if (!stripe || !status.hasStripeConnection) return null

  const hasAny =
    stripe.requirements_currently_due.length > 0 ||
    stripe.requirements_past_due.length > 0 ||
    stripe.requirements_pending_verification.length > 0 ||
    stripe.requirements_eventually_due.length > 0 ||
    !!stripe.disabled_reason

  return (
    <div
      className={cn(
        'border border-slate-200 bg-white',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Stripe connection
        </span>
        <span className="font-mono text-[9px] text-slate-400 truncate max-w-[60%] text-right">
          {stripe.connected_account_id}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-1.5">
        <FlagChip label="Charges" on={stripe.charges_enabled === true} />
        <FlagChip label="Payouts" on={stripe.payouts_enabled === true} />
        <FlagChip
          label="Details submitted"
          on={stripe.details_submitted === true}
        />
      </div>

      {hasAny && (
        <div className="mt-2.5 border-t border-slate-100 pt-2 flex flex-col gap-1">
          {stripe.disabled_reason && (
            <RequirementsLine
              label="Disabled reason"
              items={[stripe.disabled_reason]}
              tone="error"
            />
          )}
          {stripe.requirements_past_due.length > 0 && (
            <RequirementsLine
              label="Past due"
              items={stripe.requirements_past_due}
              tone="error"
            />
          )}
          {stripe.requirements_currently_due.length > 0 && (
            <RequirementsLine
              label="Currently due"
              items={stripe.requirements_currently_due}
              tone="warning"
            />
          )}
          {stripe.requirements_pending_verification.length > 0 && (
            <RequirementsLine
              label="Pending verification"
              items={stripe.requirements_pending_verification}
              tone="neutral"
            />
          )}
          {stripe.requirements_eventually_due.length > 0 && (
            <RequirementsLine
              label="Eventually due"
              items={stripe.requirements_eventually_due}
              tone="muted"
            />
          )}
        </div>
      )}
    </div>
  )
}

function FlagChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em]">
      <span
        className={cn(
          'w-1.5 h-1.5',
          on ? 'bg-emerald-600' : 'bg-slate-300',
        )}
        aria-hidden
      />
      <span className={on ? 'text-emerald-700' : 'text-slate-400'}>{label}</span>
    </span>
  )
}

function RequirementsLine({
  label,
  items,
  tone,
}: {
  label: string
  items: string[]
  tone: 'error' | 'warning' | 'neutral' | 'muted'
}) {
  const toneClass = {
    error: 'text-red-700',
    warning: 'text-amber-700',
    neutral: 'text-[#0000ff]',
    muted: 'text-slate-500',
  }[tone]
  return (
    <div className="flex items-start gap-2 text-[10px] leading-snug">
      <span className={cn('font-bold uppercase tracking-widest', toneClass)}>
        {label}
      </span>
      <span className="text-slate-600 font-mono">{items.join(', ')}</span>
    </div>
  )
}
