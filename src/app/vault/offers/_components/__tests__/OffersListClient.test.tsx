// ═══════════════════════════════════════════════════════════════
// OffersListClient — pure-helper smoke tests (§R6 / §F7)
//
// Runs under Vitest's existing Node environment; no RTL, no
// jsdom (see directive §R6 for why). Two-layer strategy:
//
//   • Cases 2 + 3 exercise the named export
//     `renderOffersListBody` directly by feeding it hand-built
//     view states and asserting on react-dom/server's
//     renderToString output.
//   • Case 1 exercises the default-export component with a
//     mocked useSession (status: 'loading'). renderToString
//     does not run useEffect, which makes the "loading branch
//     does not fire fetch" assertion clean.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    session: null,
    accessToken: null,
    status: 'loading',
  }),
}))

import OffersListClient, {
  renderOffersListBody,
  type OffersListView,
} from '../OffersListClient'
import type { OfferRow } from '@/lib/offer'

// ─── Fixtures ───────────────────────────────────────────────────

const SELF_ID = '11111111-1111-4111-8111-111111111111'
const COUNTERPARTY_ID = '22222222-2222-4222-8222-222222222222'

function makeOffer(overrides: Partial<OfferRow> = {}): OfferRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    buyer_id: SELF_ID,
    creator_id: COUNTERPARTY_ID,
    target_type: 'asset_pack',
    gross_fee: 1000,
    platform_fee_bps: 1000,
    currency: 'EUR',
    rights: { template: 'editorial_one_time', params: {}, is_transfer: false },
    current_note: null,
    expires_at: '2026-05-01T00:00:00.000Z',
    state: 'sent',
    cancelled_by: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('OffersListClient — loading branch (component)', () => {
  it('renders the loading copy without firing a fetch', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => {
        throw new Error('fetch should not be called during the loading branch')
      })
    const html = renderToString(<OffersListClient />)
    expect(html).toContain('Loading offers…')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('renderOffersListBody — loaded with rows', () => {
  it('renders one row per offer with grid cells, Link hrefs, and the §D5 handle fallback', () => {
    // r1: caller is the buyer → counterparty is creator_id.
    const r1 = makeOffer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      buyer_id: SELF_ID,
      creator_id: COUNTERPARTY_ID,
      target_type: 'asset_pack',
      gross_fee: 1000,
      currency: 'EUR',
      state: 'sent',
      expires_at: '2026-05-01T00:00:00.000Z',
    })
    // r2: caller is the creator → counterparty is buyer_id.
    const r2 = makeOffer({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      buyer_id: COUNTERPARTY_ID,
      creator_id: SELF_ID,
      target_type: 'brief_pack',
      gross_fee: 2500,
      currency: 'USD',
      state: 'accepted',
      expires_at: '2026-06-15T00:00:00.000Z',
    })
    const view: OffersListView = {
      kind: 'loaded',
      offers: [r1, r2],
      truncated: false,
    }
    const html = renderToString(renderOffersListBody(view, SELF_ID))

    // Link hrefs for both rows
    expect(html).toContain(`href="/vault/offers/${r1.id}"`)
    expect(html).toContain(`href="/vault/offers/${r2.id}"`)

    // §D5 counterparty handle — first 8 chars of the *other* party's id
    expect(html).toContain(COUNTERPARTY_ID.slice(0, 8))

    // target_type, money, state cells
    expect(html).toContain('asset_pack')
    expect(html).toContain('brief_pack')
    expect(html).toContain('1000 EUR')
    expect(html).toContain('2500 USD')
    expect(html).toContain('sent')
    expect(html).toContain('accepted')

    // YYYY-MM-DD formatted expiry
    expect(html).toContain('2026-05-01')
    expect(html).toContain('2026-06-15')

    // Truncation banner absent when truncated === false
    expect(html).not.toContain('Showing first 100 offers.')
  })
})

describe('renderOffersListBody — empty loaded', () => {
  it('renders the empty-state copy when offers.length === 0', () => {
    const view: OffersListView = { kind: 'loaded', offers: [], truncated: false }
    const html = renderToString(renderOffersListBody(view, SELF_ID))
    expect(html).toContain('No offers yet.')
  })
})
