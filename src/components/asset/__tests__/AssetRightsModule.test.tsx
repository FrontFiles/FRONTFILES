// ═══════════════════════════════════════════════════════════════
// AssetRightsModule — Prompt 7 REWRITE tests (§R6-pure / §F10)
//
// 1 test case per §F10 / AC11: compose from /asset/[id] modal
// hits POST /api/offers with a body assembled from modal form
// state. Tested via the exported pure helper `buildCreateOfferBody`
// — the modal's `handleSubmit` delegates body construction to it,
// so asserting on the helper's output is equivalent to asserting
// on the request body at the fetch boundary (per §R6-pure pattern).
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import { buildCreateOfferBody } from '../AssetRightsModule'

describe('buildCreateOfferBody — §F7 / AC11 POST /api/offers body', () => {
  it('assembles creatorId, targetType, gross_fee, currency, rights, expires_at, note, and items=[assetId] (bundled per IP-3)', () => {
    const NOW = new Date('2026-04-23T12:00:00.000Z')
    const ASSET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const CREATOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

    const body = buildCreateOfferBody({
      assetId: ASSET_ID,
      creatorId: CREATOR_ID,
      grossFee: 150.5,
      note: 'Intended use: Q3 editorial feature.',
      now: NOW,
    })

    // Required schema fields from src/app/api/offers/route.ts:57-69.
    expect(body.creatorId).toBe(CREATOR_ID)
    expect(body.targetType).toBe('single_asset')
    expect(body.grossFee).toBe(150.5)
    expect(body.currency).toBe('EUR')
    expect(body.note).toBe('Intended use: Q3 editorial feature.')

    // platform_fee_bps default — Direct channel 20% per
    // PLATFORM_BUILD.md Transaction Economics row 1.
    expect(body.platformFeeBps).toBe(2000)

    // items[] carries the single asset ID for target_type=single_asset.
    expect(body.items).toEqual([ASSET_ID])

    // expires_at is 4 hours after now per SPECIAL_OFFER_SPEC.md §C.5
    // default (240 minutes = 4 hours).
    const expectedExpires = new Date(
      NOW.getTime() + 4 * 60 * 60 * 1000,
    ).toISOString()
    expect(body.expiresAt).toBe(expectedExpires)

    // rights: default editorial_one_time template, placeholder params
    // per C2 §EXIT CRITERIA E5 carry-forward.
    expect(body.rights.template).toBe('editorial_one_time')
    expect(body.rights.is_transfer).toBe(false)
    expect(body.rights.params).toEqual({
      publication_name: 'Frontfiles Standard',
      territory: 'worldwide',
    })
  })
})
