'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLegalIdentityStatus } from '@/lib/user-context'
import { IdentityStatusBadge } from './IdentityStatusBadge'
import { IdentityDrawer } from './IdentityDrawer'
import {
  resolveIdentityCopy,
  type IdentityScenario,
} from './identity-copy'

/**
 * Legacy variant aliases kept for back-compat with any
 * launch points that still use the old prop. Prefer the
 * new `scenario` prop in new code.
 */
type LegacyVariant = 'creator-payout' | 'buyer-trust' | 'account' | 'inline'

interface LegalIdentityPromptProps {
  /**
   * Primary API — selects the scenario copy matrix used
   * for the prompt card and (when opened) the drawer.
   * Defaults to `account_setup`.
   */
  scenario?: IdentityScenario
  /**
   * @deprecated Use `scenario`. Retained so no existing
   * call site breaks during the refactor.
   */
  variant?: LegacyVariant
  className?: string
  /**
   * When set, overrides the automatic heading/subheading for
   * unusual launch points (e.g. inside a modal the CTA text
   * already explains the context).
   */
  heading?: string
  subheading?: string
  /**
   * Hide the prompt entirely once the user is verified. Most
   * launch points should leave this on — a verified badge on
   * an unrelated page is noise.
   */
  hideWhenVerified?: boolean
}

const VARIANT_TO_SCENARIO: Record<LegacyVariant, IdentityScenario> = {
  'creator-payout': 'creator_payouts',
  'buyer-trust': 'buyer_trust',
  account: 'account_setup',
  inline: 'account_setup',
}

/**
 * Phase D refinement — Scenario-aware legal identity prompt.
 *
 * Drops into any page that needs a truthful JIT launch for
 * legal identity verification. The prompt card surfaces
 * scenario-specific copy + the user's current status, and
 * the drawer it opens inherits the same scenario so the
 * two surfaces stay visually + verbally consistent.
 *
 * Used by:
 *   - `/account` overview (`account_setup`)
 *   - creator-side payout-adjacent surfaces (`creator_payouts`)
 *   - buyer-side trust-sensitive surfaces (`buyer_trust`)
 */
export function LegalIdentityPrompt({
  scenario: scenarioProp,
  variant,
  className,
  heading,
  subheading,
  hideWhenVerified = false,
}: LegalIdentityPromptProps) {
  const status = useLegalIdentityStatus()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Resolve the scenario from the new prop, falling back
  // to the legacy variant alias for any caller still
  // passing the old API.
  const scenario: IdentityScenario = useMemo(
    () => scenarioProp ?? (variant ? VARIANT_TO_SCENARIO[variant] : 'account_setup'),
    [scenarioProp, variant],
  )

  const copy = useMemo(
    () =>
      resolveIdentityCopy(
        scenario,
        status.status,
        status.subjectType ?? 'person',
      ),
    [scenario, status.status, status.subjectType],
  )

  if (hideWhenVerified && status.isVerified) return null

  const promptTitle = heading ?? copy.promptTitle
  const promptBody = subheading ?? copy.promptBody

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-3 border-2 border-black bg-white px-5 py-4',
          status.requiresAttention && 'border-amber-500 bg-amber-50',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {copy.promptEyebrow}
              </span>
              <IdentityStatusBadge status={status.status} />
            </div>
            <h3 className="text-sm font-bold text-black tracking-tight">
              {promptTitle}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              {promptBody}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'h-9 px-4 font-bold text-[11px] rounded-none uppercase tracking-[0.12em] transition-colors',
              'bg-[#0000ff] text-white hover:bg-[#0000cc]',
            )}
          >
            {resolveCtaLabel(status.status, status.nextActionLabel, copy.promptCtaFallback)}
          </button>
          {status.hasStripeConnection && (
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Stripe connected
            </span>
          )}
        </div>
      </div>

      <IdentityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        scenario={scenario}
      />
    </>
  )
}

/**
 * Pick the most honest CTA label for the prompt card.
 * The account-shell copy already computes a generic
 * `nextActionLabel` from the canonical status; we prefer
 * that if it exists, otherwise fall back to the scenario
 * default.
 */
function resolveCtaLabel(
  status: string,
  nextActionLabel: string,
  fallback: string,
): string {
  if (nextActionLabel && status !== 'not_started') return nextActionLabel
  return fallback
}
