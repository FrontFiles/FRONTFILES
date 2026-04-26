/**
 * Frontfiles — Money-display pure renderer (P4 concern 4A.2.C2).
 *
 * Pure function `formatGrossFee(gross_fee, currency, platform_fee_bps,
 * viewer_role)` returns the one-line money block per directive
 * §SCOPE item 2. Consumed by `OfferDetailClient` (Prompt 6) in
 * place of a to-be-composed money paragraph.
 *
 * Format (viewer_role-keyed, per C2 Prompt 3 IP-D (D-1b) ratification):
 *
 *   creator →
 *     "${gross_fee_display} · platform fee ${bps_pct} · you receive ${net_display}"
 *   buyer →
 *     "${gross_fee_display} · platform fee ${bps_pct} · you pay ${gross_fee_display}"
 *
 * Spec anchors:
 *   - docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md §SCOPE item 2
 *     (money line shape). The directive's pre-micropatch token
 *     `${gross_with_buyer_markup}` is superseded by Prompt 3
 *     ratification — use `gross_fee` / the locally-formatted
 *     `gross_fee_display` string directly for the buyer-view
 *     suffix (directive micropatch #7 queued).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §7 L91 — `gross_fee` is the
 *     "total paid by buyer" (single-rate v1; no separate
 *     `buyer_markup_bps` field exists).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §7 L535-536 —
 *     net_to_creator = gross_fee × (10000 − platform_fee_bps) / 10000.
 *
 * Locale: 'en-US' hard-coded per IP-B ratification. i18n is a
 * future concern.
 *
 * Currency ordering (IP-J): manual composition yields the
 * "1,000.00 USD" shape. `Intl.NumberFormat`'s `{ style: 'currency' }`
 * emits "$1,000.00" — wrong ordering for this spec; do NOT reuse
 * `formatCurrency` from `./pricing.ts`.
 *
 * DRY: creator-net formula imported from `./pricing.ts` (existing
 * `netToCreator`). Do not re-implement.
 *
 * `gross_fee` unit: main currency unit (dollars / euros), 2-decimal
 * float per DDL `numeric(12,2)`. NOT cents.
 */

import { netToCreator } from './pricing'

// ─── Public entry ─────────────────────────────────────────────────

export function formatGrossFee(
  gross_fee: number,
  currency: string,
  platform_fee_bps: number,
  viewer_role: 'buyer' | 'creator',
): string {
  const gross_fee_display = formatMoney(gross_fee, currency)
  // IP-C — variable precision. Integer bps/100 yields "20"; fractional
  // yields "20.5" etc. JS number-to-string drops trailing zeros.
  const bps_pct = (platform_fee_bps / 100).toString() + '%'
  const prefix = `${gross_fee_display} · platform fee ${bps_pct} · `

  if (viewer_role === 'creator') {
    const net = netToCreator(gross_fee, platform_fee_bps)
    const net_display = formatMoney(net, currency)
    return `${prefix}you receive ${net_display}`
  }

  // Buyer view — IP-D (D-1b) single-rate v1. `gross_fee` is the
  // buyer-paid total per ECONOMIC_FLOW_v1 L91; right side repeats
  // the same value verbatim.
  return `${prefix}you pay ${gross_fee_display}`
}

// ─── Internal helpers ─────────────────────────────────────────────

function formatMoney(amount: number, currency: string): string {
  // IP-J — manual composition for "NUMBER CURRENCY_CODE" ordering.
  const number_only = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(amount)
  return `${number_only} ${currency}`
}
