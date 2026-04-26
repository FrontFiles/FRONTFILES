// ═══════════════════════════════════════════════════════════════
// OfferDetailClient — pure-helper + mutation-flow tests
// (Prompt 6 §F1 + Prompt 9 §F10 extension — 4 mutation cases).
//
// Runs under vitest's Node environment; no RTL, no jsdom. View
// branches exercised via `renderToString`; mutation branches
// exercised via `buildMutationHandlers` with a mocked fetch impl.
// ═══════════════════════════════════════════════════════════════

import { createRef, type RefObject } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'

import {
  buildMutationHandlers,
  renderOfferDetailBody,
  type DialogRefs,
  type MutationState,
  type OfferDetailView,
} from '../OfferDetailClient'
import type { CounterComposerDialogHandle } from '../CounterComposerDialog'
import type { RejectConfirmDialogHandle } from '../RejectConfirmDialog'
import type {
  OfferAssetRow,
  OfferBriefRow,
  OfferBriefSpec,
  OfferEventViewRow,
  OfferRow,
  PartyProfileMap,
} from '@/lib/offer'

// ─── Fixtures ───────────────────────────────────────────────────

const SELF_ID = '11111111-1111-4111-8111-111111111111'
const COUNTERPARTY_ID = '22222222-2222-4222-8222-222222222222'
const OFFER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ASSET_ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

// Deterministic `now` for expiry-line rendering. Keeps all existing
// offer `expires_at` dates far enough in the future that they fall
// under the `YYYY-MM-DD` fallback branch (delta > 30 days) — so
// assertions don't depend on wall-clock time.
const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z')

function makeOffer(overrides: Partial<OfferRow> = {}): OfferRow {
  return {
    id: OFFER_ID,
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

function makeEvent(overrides: Partial<OfferEventViewRow>): OfferEventViewRow {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    event_type: 'offer.created',
    actor_role: 'buyer',
    created_at: '2026-04-21T00:00:00.000Z',
    payload: { v: 1 },
    ...overrides,
  }
}

function makeRefs(): DialogRefs {
  return {
    counterRef: createRef<CounterComposerDialogHandle | null>() as RefObject<
      CounterComposerDialogHandle | null
    >,
    rejectRef: createRef<RejectConfirmDialogHandle | null>() as RefObject<
      RejectConfirmDialogHandle | null
    >,
  }
}

function idleState(): MutationState {
  return { status: 'idle' }
}

// Builds the args bundle for `renderOfferDetailBody` with sensible
// defaults that keep every test's surface area narrow.
function renderArgs(overrides: {
  view: OfferDetailView
  selfUserId?: string | null
  profiles?: PartyProfileMap
  mutationState?: MutationState
}): Parameters<typeof renderOfferDetailBody>[0] {
  return {
    view: overrides.view,
    selfUserId: overrides.selfUserId ?? SELF_ID,
    profiles: overrides.profiles ?? {},
    mutationState: overrides.mutationState ?? idleState(),
    refs: makeRefs(),
    onAccept: () => {},
    onCounterOpen: () => {},
    onCounterSubmit: () => {},
    onRejectOpen: () => {},
    onRejectConfirm: () => {},
    onCancel: () => {},
    now: FIXED_NOW,
  }
}

// ─── Render-branch tests (§R6-pure) ─────────────────────────────

describe('renderOfferDetailBody — asset_pack loaded (buyer role)', () => {
  it('renders header, counterparty, state chip SSOT, money, expiry, note, assets, rights, round history', () => {
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
    const profiles: PartyProfileMap = {
      [COUNTERPARTY_ID]: {
        id: COUNTERPARTY_ID,
        username: 'clio',
        display_name: 'Clio Creator',
        account_state: 'active',
      },
    }
    const view: OfferDetailView = {
      kind: 'loaded',
      offer,
      assets: [makeAsset(1, ASSET_ID_A), makeAsset(2, ASSET_ID_B)],
      briefs: null,
      events: [makeEvent({ event_type: 'offer.created', actor_role: 'buyer' })],
    }
    const html = renderToString(
      renderOfferDetailBody(renderArgs({ view, profiles })),
    )

    // Header
    expect(html).toContain(`Offer ${offer.id.slice(0, 8)}`)
    expect(html).toContain('You are the buyer.')

    // Counterparty from profile map (not ID prefix fallback)
    expect(html).toContain('Counterparty: Clio Creator (@clio)')

    // State chip via SSOT (offerStateChip('sent') = 'Offer pending')
    expect(html).toContain('Status: Offer pending')

    // Money line via formatGrossFee — buyer view, EUR, 10% bps
    expect(html).toContain('1,500.00 EUR · platform fee 10% · you pay 1,500.00 EUR')

    // Expiry line via formatExpiry — delta > 30d falls to YYYY-MM-DD
    expect(html).toContain('Expiry: 2026-05-01')

    // Note block
    expect(html).toContain('Note')
    expect(html).toContain('initial note')

    // Assets branch — no Briefs heading
    expect(html).toContain('Assets')
    expect(html).toContain(`1. ${ASSET_ID_A.slice(0, 8)}`)
    expect(html).toContain(`2. ${ASSET_ID_B.slice(0, 8)}`)
    expect(html).not.toContain('Briefs')

    // Rights via structured renderer (editorial_one_time) — NOT JSON
    expect(html).toContain('Editorial, one-time use')
    expect(html).not.toContain('JSON.stringify')

    // Round history
    expect(html).toContain('Round history')
    expect(html).toContain('2026-04-21 · Buyer · opened the offer')

    // Action strip for buyer on `sent` — buyer cannot accept own
    // offer (buyer-only accept check); Counter + Reject + Cancel
    // visibility depend on lastEventActorRef vs selfUserId. Here
    // lastEventActorRef = buyer_id = SELF_ID, so viewerIsAwaiting
    // collapses to false → no Accept/Counter/Reject shown, but
    // Cancel shows (buyer last actor + buyer caller + state=sent).
    expect(html).toContain('Cancel')
  })
})

describe('renderOfferDetailBody — brief_pack loaded (creator role, counterparty fallback)', () => {
  it('renders creator role, briefs heading, ID-prefix counterparty when profile missing', () => {
    const offer = makeOffer({
      target_type: 'brief_pack',
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
      events: [],
    }
    // Profile map intentionally empty — tests the fallback branch.
    const html = renderToString(renderOfferDetailBody(renderArgs({ view })))

    // Role + state chip
    expect(html).toContain('You are the creator.')
    expect(html).toContain('Status: Accepted')

    // Counterparty fallback: ID prefix + ellipsis
    expect(html).toContain(`Counterparty: ${COUNTERPARTY_ID.slice(0, 8)}…`)

    // Money line — creator view
    expect(html).toContain(
      '2,500.00 USD · platform fee 15% · you receive 2,125.00 USD',
    )

    // Briefs branch — no Assets heading
    expect(html).toContain('Briefs')
    expect(html).toContain('1. Front-page illo — illustration_vector, 7d')
    expect(html).toContain('2. Secondary spot — illustration_raster, 14d')
    expect(html).not.toContain('Assets')

    // Empty events → placeholder copy
    expect(html).toContain('No events yet.')
  })
})

describe('renderOfferDetailBody — not_found branch', () => {
  it('renders the not-found copy without any chrome', () => {
    const view: OfferDetailView = { kind: 'not_found' }
    const html = renderToString(renderOfferDetailBody(renderArgs({ view })))
    expect(html).toContain('Offer not found.')
    expect(html).not.toContain('Round history')
  })
})

// ─── Mutation-flow integration tests (Prompt 9 / §F10 extension) ─

const ACCESS_TOKEN = 'tok_fixture'

function makeFetchMock(
  response: Partial<Response> & { json?: () => Promise<unknown> },
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: response.json ?? (async () => ({ data: {} })),
    } as Response
  })
  return fn
}

describe('buildMutationHandlers — accept flow fires POST and refetches on 200 (AC6)', () => {
  it('sends empty JSON body to /accept and invokes refetch exactly once on success', async () => {
    const offer = makeOffer({ state: 'sent' })
    const fetchMock = makeFetchMock({ ok: true, status: 200 })
    const refetch = vi.fn(async () => {})
    const stateChanges: MutationState[] = []

    const handlers = buildMutationHandlers({
      accessToken: ACCESS_TOKEN,
      offerId: offer.id,
      offer,
      refetchDetail: refetch,
      setMutationState: (s) => stateChanges.push(s),
      closeCounter: () => {},
      closeReject: () => {},
      fetchImpl: fetchMock as unknown as typeof fetch,
    })

    await handlers.onAccept()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/offers/${offer.id}/accept`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{}')
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${ACCESS_TOKEN}`)

    expect(refetch).toHaveBeenCalledTimes(1)
    expect(stateChanges).toEqual([
      { status: 'submitting', kind: 'accept' },
      { status: 'idle' },
    ])
  })
})

describe('buildMutationHandlers — counter flow composes full B2 body (AC8)', () => {
  it('posts newGrossFee + newNote + newExpiresAt + newRights, closes dialog, refetches', async () => {
    const offer = makeOffer({
      state: 'sent',
      expires_at: '2026-07-01T00:00:00.000Z',
      rights: {
        template: 'editorial_one_time',
        params: { publication_name: 'Test' },
        is_transfer: false,
      },
    })
    const fetchMock = makeFetchMock({ ok: true, status: 200 })
    const refetch = vi.fn(async () => {})
    const closeCounter = vi.fn()
    const stateChanges: MutationState[] = []

    const handlers = buildMutationHandlers({
      accessToken: ACCESS_TOKEN,
      offerId: offer.id,
      offer,
      refetchDetail: refetch,
      setMutationState: (s) => stateChanges.push(s),
      closeCounter,
      closeReject: () => {},
      fetchImpl: fetchMock as unknown as typeof fetch,
    })

    await handlers.onCounter(1750, 'meet me halfway')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/offers/${offer.id}/counter`)
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.newGrossFee).toBe(1750)
    expect(body.newNote).toBe('meet me halfway')
    expect(body.newExpiresAt).toBe('2026-07-01T00:00:00.000Z')
    expect(body.newRights).toEqual(offer.rights)

    expect(closeCounter).toHaveBeenCalledTimes(1)
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(stateChanges).toEqual([
      { status: 'submitting', kind: 'counter' },
      { status: 'idle' },
    ])
  })
})

describe('buildMutationHandlers — reject flow defaults reasonCode=other + closes dialog', () => {
  it('posts { reasonCode: "other" } to /reject and closes the reject dialog', async () => {
    const offer = makeOffer({ state: 'countered' })
    const fetchMock = makeFetchMock({ ok: true, status: 200 })
    const refetch = vi.fn(async () => {})
    const closeReject = vi.fn()

    const handlers = buildMutationHandlers({
      accessToken: ACCESS_TOKEN,
      offerId: offer.id,
      offer,
      refetchDetail: refetch,
      setMutationState: () => {},
      closeCounter: () => {},
      closeReject,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })

    await handlers.onReject()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/offers/${offer.id}/reject`)
    expect(JSON.parse(init.body as string)).toEqual({ reasonCode: 'other' })
    expect(closeReject).toHaveBeenCalledTimes(1)
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})

describe('buildMutationHandlers — cancel flow surfaces server error on non-2xx', () => {
  it('transitions to error state with server code + message, does NOT refetch', async () => {
    const offer = makeOffer({ state: 'sent' })
    const fetchMock = makeFetchMock({
      ok: false,
      status: 409,
      json: async () => ({
        error: { code: 'INVALID_STATE', message: 'offer is accepted' },
      }),
    })
    const refetch = vi.fn(async () => {})
    const stateChanges: MutationState[] = []

    const handlers = buildMutationHandlers({
      accessToken: ACCESS_TOKEN,
      offerId: offer.id,
      offer,
      refetchDetail: refetch,
      setMutationState: (s) => stateChanges.push(s),
      closeCounter: () => {},
      closeReject: () => {},
      fetchImpl: fetchMock as unknown as typeof fetch,
    })

    await handlers.onCancel()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/offers/${offer.id}/cancel`)
    expect(refetch).not.toHaveBeenCalled()
    expect(stateChanges).toEqual([
      { status: 'submitting', kind: 'cancel' },
      {
        status: 'error',
        kind: 'cancel',
        code: 'INVALID_STATE',
        message: 'offer is accepted',
      },
    ])
  })
})
