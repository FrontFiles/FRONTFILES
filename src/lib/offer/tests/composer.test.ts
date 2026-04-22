/**
 * Frontfiles — composer.ts unit tests (P4 concern 4A.2 Part A)
 *
 * Pack composition bounds, targetType-shape matching, and payload
 * round-trip against the ledger schemas surface.
 */

import { describe, expect, it } from 'vitest'

import { OfferCreatedPayloadSchema } from '@/lib/ledger/schemas'
import {
  buildOfferCounteredPayload,
  buildOfferCreatedPayload,
  validatePackComposition,
} from '@/lib/offer/composer'
import type { Rights } from '@/lib/offer/types'

// ─── Fixtures ─────────────────────────────────────────────────────

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ASSET_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ASSET_C = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function genAssetIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const hex = (i + 1).toString(16).padStart(12, '0')
    return `11111111-1111-4111-8111-${hex}`
  })
}

const editorialRights: Rights = {
  template: 'editorial_one_time',
  params: {},
  is_transfer: false,
}
const commercialRights: Rights = {
  template: 'commercial_restricted',
  params: {},
  is_transfer: false,
}

// ─── validatePackComposition ──────────────────────────────────────

describe('validatePackComposition — length bounds (§F9)', () => {
  it('rejects 0 items', () => {
    const r = validatePackComposition({ targetType: 'asset_pack', items: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('item_count_out_of_range')
  })

  it('accepts 1 item', () => {
    const r = validatePackComposition({
      targetType: 'asset_pack',
      items: [ASSET_A],
    })
    expect(r.ok).toBe(true)
  })

  it('accepts 20 items', () => {
    const r = validatePackComposition({
      targetType: 'asset_pack',
      items: genAssetIds(20),
    })
    expect(r.ok).toBe(true)
  })

  it('rejects 21 items', () => {
    const r = validatePackComposition({
      targetType: 'asset_pack',
      items: genAssetIds(21),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('item_count_out_of_range')
  })
})

describe('validatePackComposition — targetType-shape match', () => {
  it('rejects an asset-pack with brief-spec items', () => {
    const r = validatePackComposition({
      targetType: 'asset_pack',
      items: [
        {
          title: 'stray brief',
          deadline_offset_days: 7,
          deliverable_format: 'article',
          revision_cap: 1,
        },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('item_shape_mismatch')
  })

  it('rejects a brief-pack with UUID-string items', () => {
    const r = validatePackComposition({
      targetType: 'brief_pack',
      items: [ASSET_A],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('item_shape_mismatch')
  })

  it('accepts a well-formed brief-pack', () => {
    const r = validatePackComposition({
      targetType: 'brief_pack',
      items: [
        {
          title: 'brief 1',
          deadline_offset_days: 7,
          deliverable_format: 'article',
          revision_cap: 2,
        },
        {
          title: 'brief 2',
          deadline_offset_days: 14,
          deliverable_format: 'photo',
          revision_cap: 1,
          notes: 'landscape orientation',
        },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.targetType).toBe('brief_pack')
      if (r.value.targetType === 'brief_pack') {
        expect(r.value.items).toHaveLength(2)
      }
    }
  })

  it('rejects an unknown target_type', () => {
    const r = validatePackComposition({
      // Cast so we can pass the invalid value through the runtime
      // check without a TS compile error.
      targetType: 'nonsense_pack' as unknown as 'asset_pack',
      items: [ASSET_A],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_target_type')
  })
})

// ─── buildOfferCreatedPayload round-trip ──────────────────────────

describe('buildOfferCreatedPayload', () => {
  it('produces a payload that round-trips through OfferCreatedPayloadSchema', () => {
    const payload = buildOfferCreatedPayload({
      targetType: 'brief_pack',
      items: [ASSET_A, ASSET_B],
      grossFee: 10000,
      platformFeeBps: 1500,
      currency: 'EUR',
      rights: editorialRights,
      expiresAt: '2026-05-01T00:00:00.000Z',
      note: 'seed',
    })
    const result = OfferCreatedPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('carries v: 1 verbatim (spec §8.6 pre-consumer)', () => {
    const payload = buildOfferCreatedPayload({
      targetType: 'asset_pack',
      items: [ASSET_A],
      grossFee: 500,
      platformFeeBps: 2500,
      currency: 'USD',
      rights: commercialRights,
      expiresAt: '2026-05-01T00:00:00.000Z',
      note: '',
    })
    expect(payload.v).toBe(1)
  })
})

// ─── buildOfferCounteredPayload diff ──────────────────────────────

describe('buildOfferCounteredPayload', () => {
  it('computes added_items / removed_items by set subtraction', () => {
    const payload = buildOfferCounteredPayload({
      byActorId: ACTOR,
      before: {
        gross_fee: 10000,
        items: [ASSET_A, ASSET_B],
        rights: editorialRights,
        current_note: 'before',
      },
      after: {
        grossFee: 11000,
        items: [ASSET_B, ASSET_C],
        rights: editorialRights,
        note: 'after',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    })
    expect(payload.added_items).toEqual([ASSET_C])
    expect(payload.removed_items).toEqual([ASSET_A])
    expect(payload.fee_before).toBe(10000)
    expect(payload.fee_after).toBe(11000)
  })

  it('produces empty rights_diff when before/after rights match', () => {
    const payload = buildOfferCounteredPayload({
      byActorId: ACTOR,
      before: {
        gross_fee: 10000,
        items: [ASSET_A],
        rights: editorialRights,
        current_note: 'x',
      },
      after: {
        grossFee: 10000,
        items: [ASSET_A],
        rights: editorialRights,
        note: 'y',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    })
    expect(payload.rights_diff).toEqual({})
  })

  it('produces a non-empty rights_diff when rights differ', () => {
    const payload = buildOfferCounteredPayload({
      byActorId: ACTOR,
      before: {
        gross_fee: 10000,
        items: [ASSET_A],
        rights: editorialRights,
        current_note: 'x',
      },
      after: {
        grossFee: 10000,
        items: [ASSET_A],
        rights: commercialRights,
        note: 'y',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    })
    expect(payload.rights_diff).not.toEqual({})
  })
})
