// ═══════════════════════════════════════════════════════════════
// OfferDetailClient — pure-helper smoke tests (§R6 / §F7)
//
// Runs under Vitest's existing Node environment; no RTL, no
// jsdom (see directive §R6 for why). Exercises the named export
// `renderOfferDetailBody` directly by feeding it hand-built view
// states and asserting on react-dom/server's renderToString
// output. Component-level loading-branch coverage already shipped
// at P3 (commit 7ee350c); not duplicated here.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'

import {
  renderOfferDetailBody,
  type OfferDetailView,
} from '../OfferDetailClient'
import type {
  OfferAssetRow,
  OfferBriefRow,
  OfferBriefSpec,
  OfferRow,
} from '@/lib/offer'

// ─── Fixtures ───────────────────────────────────────────────────

const SELF_ID = '11111111-1111-4111-8111-111111111111'
const COUNTERPARTY_ID = '22222222-2222-4222-8222-222222222222'
const ASSET_ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function makeOffer(overrides: Partial<OfferRow> = {}): OfferRow {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    buyer_id: SELF_ID,
    creator_id: COUNTERPARTY_ID,
    target_type: 'asset_pack',
    gross_fee: 1500,
    platform_fee_bps: 1000,
    currency: 'EUR',
    rights: { template: 'editorial_one_time', params: {}, is_transfer: false },
    current_note: 'initial note',
    expires_at: '2026-05-01T00:00:00.000Z',
    state: 'sent',
    cancelled_by: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
    ...overrides,
  }
}

function makeAsset(position: number, assetId: string): OfferAssetRow {
  return { offer_id: 'unused', asset_id: assetId, position }
}

function makeBrief(position: number, spec: OfferBriefSpec): OfferBriefRow {
  return { offer_id: 'unused', position, spec }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('renderOfferDetailBody — asset_pack loaded (buyer role)', () => {
  it('renders header, role, state, money, expires, note, assets, rights — no briefs heading', () => {
    const offer = makeOffer({
      target_type: 'asset_pack',
      buyer_id: SELF_ID,
      creator_id: COUNTERPARTY_ID,
      gross_fee: 1500,
      platform_fee_bps: 1000,
      currency: 'EUR',
      state: 'sent',
      expires_at: '2026-05-01T00:00:00.000Z',
      current_note: 'initial note',
    })
    const view: OfferDetailView = {
      kind: 'loaded',
      offer,
      assets: [makeAsset(1, ASSET_ID_A), makeAsset(2, ASSET_ID_B)],
      briefs: null,
    }
    const html = renderToString(renderOfferDetailBody(view, SELF_ID))

    // Header — 8-char id prefix
    expect(html).toContain(`Offer ${offer.id.slice(0, 8)}`)

    // Role line — buyer
    expect(html).toContain('You are the buyer.')
    expect(html).not.toContain('You are the creator.')

    // State, money, expires
    expect(html).toContain('State: sent')
    // 1000 bps / 100 → 10; moneyLine collapsed into a single template
    // literal so renderToString does not split it with comment markers.
    expect(html).toContain('1500 EUR · platform fee 10%')
    expect(html).toContain('Expires: 2026-05-01')

    // Note block
    expect(html).toContain('Note:')
    expect(html).toContain('initial note')

    // Items: asset branch
    expect(html).toContain('Assets:')
    expect(html).toContain(`1. ${ASSET_ID_A.slice(0, 8)}`)
    expect(html).toContain(`2. ${ASSET_ID_B.slice(0, 8)}`)
    expect(html).not.toContain('Briefs:')

    // Rights section (scaffold-grade JSON stringify)
    expect(html).toContain('Rights:')
    expect(html).toContain('editorial_one_time')
  })
})

describe('renderOfferDetailBody — brief_pack loaded (creator role)', () => {
  it('renders role line "creator", Briefs heading, formatted brief rows — no assets heading', () => {
    const offer = makeOffer({
      target_type: 'brief_pack',
      // Flip: caller is the creator on this offer.
      buyer_id: COUNTERPARTY_ID,
      creator_id: SELF_ID,
      gross_fee: 2500,
      platform_fee_bps: 1500,
      currency: 'USD',
      state: 'accepted',
      expires_at: '2026-06-15T00:00:00.000Z',
      current_note: null,
    })
    const view: OfferDetailView = {
      kind: 'loaded',
      offer,
      assets: null,
      briefs: [
        makeBrief(1, {
          title: 'Front-page illo',
          deadline_offset_days: 7,
          deliverable_format: 'illustration_vector',
          revision_cap: 2,
        }),
        makeBrief(2, {
          title: 'Secondary spot',
          deadline_offset_days: 14,
          deliverable_format: 'illustration_raster',
          revision_cap: 1,
        }),
      ],
    }
    const html = renderToString(renderOfferDetailBody(view, SELF_ID))

    // Role line — creator
    expect(html).toContain('You are the creator.')
    expect(html).not.toContain('You are the buyer.')

    // Money line with 1500 bps → 15%
    expect(html).toContain('2500 USD · platform fee 15%')

    // Note missing → em dash
    expect(html).toContain('Note:')
    expect(html).toContain('—')

    // Items: brief branch
    expect(html).toContain('Briefs:')
    expect(html).toContain('1. Front-page illo — illustration_vector, 7d')
    expect(html).toContain('2. Secondary spot — illustration_raster, 14d')
    expect(html).not.toContain('Assets:')
  })
})

describe('renderOfferDetailBody — not_found branch', () => {
  it('renders the not-found copy', () => {
    const view: OfferDetailView = { kind: 'not_found' }
    const html = renderToString(renderOfferDetailBody(view, SELF_ID))
    expect(html).toContain('Offer not found.')
  })
})
