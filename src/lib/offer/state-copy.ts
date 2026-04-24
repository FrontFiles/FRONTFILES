// ═══════════════════════════════════════════════════════════════
// Frontfiles — Offer-state chip copy SSOT (P4 concern 4A.2.C1 / §F4)
//
// Single source of truth for user-facing offer-state chip copy.
// Every badge renderer that displays offer state imports from this
// file. No other file constructs chip copy from enum strings by
// concatenation, switch statement, or conditional (§F4 L131 import
// rule; §F6 AC2 grep gate enforces it).
//
// ─── Exhaustiveness ─────────────────────────────────────────────
//
// `satisfies Record<OfferState, string>` is a compile-time gate:
// if a new OfferState literal lands without a matching entry, tsc
// fails. Runtime exhaustiveness is asserted in the paired test
// via `Object.keys(OFFER_STATE_COPY).sort()` against the known
// enum key set.
//
// References:
//   - docs/audits/P4_CONCERN_4A_2_C1_DIRECTIVE.md §F4.
//   - docs/specs/ECONOMIC_FLOW_v1.md §12.1 L427 licenses the
//     translated chip copy vocabulary ("Offer pending", "Rights
//     grant complete", "Pack delivered").
//   - src/lib/offer/types.ts §L49-56 — canonical OfferState union.
// ═══════════════════════════════════════════════════════════════

import type { OfferState } from './types'

export const OFFER_STATE_COPY = {
  sent: 'Offer pending',
  countered: 'Counter pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
} as const satisfies Record<OfferState, string>

export function offerStateChip(state: OfferState): string {
  return OFFER_STATE_COPY[state]
}
