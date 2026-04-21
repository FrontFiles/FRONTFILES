/**
 * Frontfiles — Offer-surface pricing helpers (P4 concern 4A.2 Part A)
 *
 * Pure functions for fee decomposition and display formatting.
 * No DB access. No I/O. No React.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md §DELIVERABLES —
 *     pricing.ts shape.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §7 — gross_fee /
 *     platform_fee_bps columns; §F16 — platform-fee rate-lock
 *     snapshotted at offer.created. This file assumes the snapshot
 *     value is already loaded.
 *
 * Banker's rounding (round-half-even) avoids systemic bias toward
 * buyer or creator over time compared with round-half-up. Revenue
 * asymmetry at the ½-cent boundary rounds to the nearest even cent.
 */

import type { PlatformFeeBps } from './types'

// ─── Primitive rounding ───────────────────────────────────────────
//
// Banker's rounding on a value expressed in minor currency units
// (e.g. cents). Math.round uses round-half-up in JS, which drifts
// revenue asymmetrically under high volume; round-half-even is the
// finance-standard alternative.
function roundHalfEven(value: number): number {
  const floor = Math.floor(value)
  const diff = value - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  // Exactly 0.5: round toward the even integer.
  return floor % 2 === 0 ? floor : floor + 1
}

// ─── Fee decomposition ────────────────────────────────────────────

/**
 * Net paid to the creator, computed at 2-decimal precision with
 * banker's rounding.
 *
 *   net = grossFee * (10000 - platformFeeBps) / 10000
 *
 * `platformFeeBps` is expressed in basis points (1 bp = 1/100 of a
 * percent). Domain: 0 ≤ bps ≤ 10000.
 */
export function netToCreator(
  grossFee: number,
  platformFeeBps: PlatformFeeBps,
): number {
  const netInCents = (grossFee * 100 * (10000 - platformFeeBps)) / 10000
  return roundHalfEven(netInCents) / 100
}

/**
 * Platform fee amount. Derived as `grossFee − netToCreator` rather
 * than independently computed so the two values always sum to
 * grossFee exactly (no off-by-one cent). Returned at 2-decimal
 * precision via banker's rounding applied to netToCreator; the
 * subtraction preserves the invariant.
 */
export function platformFeeAmount(
  grossFee: number,
  platformFeeBps: PlatformFeeBps,
): number {
  const net = netToCreator(grossFee, platformFeeBps)
  // Subtraction in cents to avoid float error, then convert back.
  const grossCents = Math.round(grossFee * 100)
  const netCents = Math.round(net * 100)
  return (grossCents - netCents) / 100
}

// ─── Display formatting ───────────────────────────────────────────

/**
 * Currency-formatted string via Intl.NumberFormat. Currency is
 * length-checked (3 letters) as a minimal validation; full ISO
 * 4217 validation (curated allowlist) is deferred to Part C1 where
 * the display surface lives.
 */
export function formatCurrency(amount: number, currency: string): string {
  if (currency.length !== 3) {
    throw new Error(
      `formatCurrency: expected a 3-letter currency code, got "${currency}"`,
    )
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount)
}

// ─── Combined breakdown ───────────────────────────────────────────

export type FeeBreakdown = {
  gross: number
  platformFee: number
  netToCreator: number
  currency: string
  displayGross: string
  displayPlatformFee: string
  displayNetToCreator: string
}

/**
 * Returns every value the FeeTransparencyPanel in Part C1 will need,
 * in one pass. Numeric fields are exact (2-decimal with banker's
 * rounding); display fields are locale-formatted.
 */
export function feeBreakdown(
  grossFee: number,
  platformFeeBps: PlatformFeeBps,
  currency: string,
): FeeBreakdown {
  const net = netToCreator(grossFee, platformFeeBps)
  const fee = platformFeeAmount(grossFee, platformFeeBps)
  return {
    gross: grossFee,
    platformFee: fee,
    netToCreator: net,
    currency,
    displayGross: formatCurrency(grossFee, currency),
    displayPlatformFee: formatCurrency(fee, currency),
    displayNetToCreator: formatCurrency(net, currency),
  }
}
