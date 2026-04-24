// ═══════════════════════════════════════════════════════════════
// state-copy — exhaustiveness + per-enum chip-copy tests (§F5)
//
// Runtime exhaustiveness pairs with the compile-time `satisfies`
// gate in state-copy.ts. Per-enum tests lock the chip-copy string
// per §F4 table. One describe per test case per §F5.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import {
  OFFER_STATE_COPY,
  offerStateChip,
} from '@/lib/offer/state-copy'
import type { OfferState } from '@/lib/offer/types'

const ALL_STATES: readonly OfferState[] = [
  'sent',
  'countered',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
] as const

describe('OFFER_STATE_COPY — exhaustiveness (§F4 + §F5)', () => {
  it('covers all six OfferState enum values, no extras', () => {
    // Runtime key-set equality — complements the compile-time
    // `satisfies Record<OfferState, string>` guard in state-copy.ts.
    expect(Object.keys(OFFER_STATE_COPY).sort()).toEqual(
      [...ALL_STATES].sort(),
    )
  })
})

describe('offerStateChip — per-enum chip copy (§F4 table)', () => {
  it('returns the exact chip copy for every OfferState value', () => {
    expect(offerStateChip('sent')).toBe('Offer pending')
    expect(offerStateChip('countered')).toBe('Counter pending')
    expect(offerStateChip('accepted')).toBe('Accepted')
    expect(offerStateChip('rejected')).toBe('Rejected')
    expect(offerStateChip('expired')).toBe('Expired')
    expect(offerStateChip('cancelled')).toBe('Cancelled')
  })
})
