import { describe, expect, it } from 'vitest'

import {
  AssignmentAcceptedByBuyerPayloadSchema,
  DisputeResolvedPayloadSchema,
  EventPayloadSchemas,
  OfferCreatedPayloadSchema,
  OfferRejectedPayloadSchema,
} from '@/lib/ledger/schemas'
import type { EventType } from '@/lib/ledger/types'

// ─── Fixtures ─────────────────────────────────────────────────────

const FIXED_UUID = '11111111-1111-4111-8111-111111111111'
const OTHER_UUID = '22222222-2222-4222-8222-222222222222'

function validOfferCreated() {
  return {
    v: 1 as const,
    target_type: 'brief_pack' as const,
    items: ['slot-a', 'slot-b'],
    gross_fee: 10000,
    platform_fee_bps: 1500,
    currency: 'EUR',
    rights: { scope: 'editorial', duration: 'perpetual' },
    expires_at: '2026-05-01T00:00:00.000Z',
    note: 'seed offer',
  }
}

// ─── Dispatch map coverage ────────────────────────────────────────

describe('EventPayloadSchemas dispatch map', () => {
  const allEventTypes: readonly EventType[] = [
    'offer.created',
    'offer.countered',
    'offer.accepted',
    'offer.rejected',
    'offer.expired',
    'offer.cancelled',
    'assignment.created',
    'assignment.piece_delivered',
    'assignment.delivered',
    'assignment.revision_requested',
    'assignment.accepted_by_buyer',
    'assignment.cashed_out',
    'assignment.disputed',
    'assignment.refunded',
    'assignment.split',
    'dispute.opened',
    'dispute.evidence_submitted',
    'dispute.resolved',
    'dispute.appealed',
    'dispute.appeal_resolved',
  ]

  it('covers all 20 event types', () => {
    expect(allEventTypes).toHaveLength(20)
    for (const t of allEventTypes) {
      expect(EventPayloadSchemas).toHaveProperty(t)
    }
  })
})

// ─── Per-schema parse cases ───────────────────────────────────────

describe('OfferCreatedPayloadSchema', () => {
  it('parses a valid payload', () => {
    const result = OfferCreatedPayloadSchema.safeParse(validOfferCreated())
    expect(result.success).toBe(true)
  })

  it('rejects v: 2 — literal v=1 is enforced', () => {
    const result = OfferCreatedPayloadSchema.safeParse({
      ...validOfferCreated(),
      v: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown keys — .strict() is enforced', () => {
    // `safeParse` takes `unknown`, so an object literal with an
    // extra key is not a TS type error at this call site — the
    // probe is purely runtime, via Zod's .strict() mode.
    const result = OfferCreatedPayloadSchema.safeParse({
      ...validOfferCreated(),
      extra_field: 'should not be allowed',
    })
    expect(result.success).toBe(false)
  })
})

describe('DisputeResolvedPayloadSchema', () => {
  it('parses a valid split resolution with both amount optional fields populated', () => {
    const result = DisputeResolvedPayloadSchema.safeParse({
      v: 1,
      by_actor_id: FIXED_UUID,
      outcome: 'split',
      amount_to_buyer: 5000,
      amount_to_creator: 5000,
      rationale: 'half each',
    })
    expect(result.success).toBe(true)
  })

  it("rejects outcome='nonsense' — z.enum enforcement", () => {
    const result = DisputeResolvedPayloadSchema.safeParse({
      v: 1,
      by_actor_id: FIXED_UUID,
      outcome: 'nonsense',
      rationale: 'bogus',
    })
    expect(result.success).toBe(false)
  })
})

describe('AssignmentAcceptedByBuyerPayloadSchema', () => {
  it('parses with auto: false', () => {
    const result = AssignmentAcceptedByBuyerPayloadSchema.safeParse({
      v: 1,
      by_actor_id: FIXED_UUID,
      auto: false,
    })
    expect(result.success).toBe(true)
  })

  it("rejects auto: 'false' (string instead of boolean)", () => {
    const result = AssignmentAcceptedByBuyerPayloadSchema.safeParse({
      v: 1,
      by_actor_id: FIXED_UUID,
      auto: 'false',
    })
    expect(result.success).toBe(false)
  })
})

describe('OfferRejectedPayloadSchema', () => {
  it('parses when optional by_actor_id is omitted (force-termination case per §8.1)', () => {
    const result = OfferRejectedPayloadSchema.safeParse({
      v: 1,
      reason: 'asset became unavailable',
    })
    expect(result.success).toBe(true)
  })

  it('parses when by_actor_id and affected_item_ids are present', () => {
    const result = OfferRejectedPayloadSchema.safeParse({
      v: 1,
      by_actor_id: FIXED_UUID,
      reason: 'buyer declined',
      affected_item_ids: [OTHER_UUID],
    })
    expect(result.success).toBe(true)
  })
})
