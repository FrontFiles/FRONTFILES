/**
 * Frontfiles — state.ts unit tests (P4 concern 4A.2 Part A)
 *
 * Table-driven coverage of every guard. Identity comparisons are
 * UUID-to-UUID per Draft 4's IDENTITY CONTRACT in the state.ts
 * deliverable — no handles appear in this suite.
 */

import { describe, expect, it } from 'vitest'

import {
  canAccept,
  canCancel,
  canCounter,
  canExpire,
  canReject,
} from '@/lib/offer/state'
import type { OfferRow, OfferState } from '@/lib/offer/types'

// ─── Fixtures ─────────────────────────────────────────────────────

const BUYER_ID   = '11111111-1111-4111-8111-111111111111'
const CREATOR_ID = '22222222-2222-4222-8222-222222222222'
const THIRD_ID   = '33333333-3333-4333-8333-333333333333'
const SYSTEM_ACTOR_REF = '00000000-0000-0000-0000-000000000001'

function baseOffer(overrides: Partial<OfferRow> = {}): OfferRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    buyer_id: BUYER_ID,
    creator_id: CREATOR_ID,
    target_type: 'brief_pack',
    gross_fee: 10000,
    platform_fee_bps: 1500,
    currency: 'EUR',
    rights: { template: 'editorial_one_time', params: {}, is_transfer: false },
    current_note: 'seed',
    expires_at: '2099-12-31T23:59:59.000Z',
    state: 'sent',
    cancelled_by: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
    ...overrides,
  }
}

// ─── canCounter ───────────────────────────────────────────────────

describe('canCounter', () => {
  it('allows the buyer on a sent offer', () => {
    const result = canCounter({
      offer: baseOffer({ state: 'sent' }),
      actorUserId: BUYER_ID,
    })
    expect(result).toEqual({ allowed: true })
  })

  it('allows the creator on a countered offer', () => {
    const result = canCounter({
      offer: baseOffer({ state: 'countered' }),
      actorUserId: CREATOR_ID,
    })
    expect(result).toEqual({ allowed: true })
  })

  it('rejects a non-party actor', () => {
    const result = canCounter({
      offer: baseOffer(),
      actorUserId: THIRD_ID,
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toBe('not_party')
  })

  const terminalStates: OfferState[] = [
    'accepted',
    'rejected',
    'expired',
    'cancelled',
  ]
  for (const s of terminalStates) {
    it(`rejects on terminal state '${s}'`, () => {
      const result = canCounter({
        offer: baseOffer({ state: s }),
        actorUserId: BUYER_ID,
      })
      expect(result.allowed).toBe(false)
      if (!result.allowed)
        expect(result.reason).toMatch(/^invalid_state: offer is/)
    })
  }
})

// ─── canAccept ────────────────────────────────────────────────────

describe('canAccept', () => {
  it('allows the buyer', () => {
    const r = canAccept({ offer: baseOffer(), actorUserId: BUYER_ID })
    expect(r).toEqual({ allowed: true })
  })

  it('allows the creator', () => {
    const r = canAccept({ offer: baseOffer(), actorUserId: CREATOR_ID })
    expect(r).toEqual({ allowed: true })
  })

  it('rejects a non-party', () => {
    const r = canAccept({ offer: baseOffer(), actorUserId: THIRD_ID })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('not_party')
  })

  it("rejects on state 'accepted'", () => {
    const r = canAccept({
      offer: baseOffer({ state: 'accepted' }),
      actorUserId: BUYER_ID,
    })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toMatch(/^invalid_state/)
  })
})

// ─── canReject ────────────────────────────────────────────────────

describe('canReject', () => {
  it('allows the buyer', () => {
    const r = canReject({ offer: baseOffer(), actorUserId: BUYER_ID })
    expect(r).toEqual({ allowed: true })
  })

  it('allows the creator', () => {
    const r = canReject({ offer: baseOffer(), actorUserId: CREATOR_ID })
    expect(r).toEqual({ allowed: true })
  })

  it('rejects a non-party', () => {
    const r = canReject({ offer: baseOffer(), actorUserId: THIRD_ID })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('not_party')
  })
})

// ─── canCancel ────────────────────────────────────────────────────
//
// Buyer-only guard. `lastEventActorRef` is the UUID of the most
// recent NON-SYSTEM event's actor_ref — the Part B1 caller MUST
// apply the system-sentinel filter (§D15) before passing it in.
// The suite below exercises both shape (undefined vs UUID) and the
// D15 scenario explicitly.

describe('canCancel', () => {
  it('allows the buyer when lastEventActorRef is undefined', () => {
    const r = canCancel({
      offer: baseOffer(),
      actorUserId: BUYER_ID,
      lastEventActorRef: undefined,
    })
    expect(r).toEqual({ allowed: true })
  })

  it('allows the buyer when last event actor was the buyer', () => {
    const r = canCancel({
      offer: baseOffer(),
      actorUserId: BUYER_ID,
      lastEventActorRef: BUYER_ID,
    })
    expect(r).toEqual({ allowed: true })
  })

  it('rejects when the actor is the creator (buyer-only)', () => {
    const r = canCancel({
      offer: baseOffer(),
      actorUserId: CREATOR_ID,
      lastEventActorRef: CREATOR_ID,
    })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toMatch(/^not_party/)
  })

  it('rejects when the last non-system event actor was the creator', () => {
    const r = canCancel({
      offer: baseOffer(),
      actorUserId: BUYER_ID,
      lastEventActorRef: CREATOR_ID,
    })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('not_last_turn')
  })

  // D15 caller contract. The Part B1 route handler filters system-
  // sentinel events out of the "last non-system event" lookup BEFORE
  // passing `lastEventActorRef`. When the literal last event on the
  // thread was the system actor but the last PARTY action was the
  // buyer, the filter yields the buyer's UUID, and this guard
  // allows the cancel. SYSTEM_ACTOR_REF is intentionally referenced
  // here only to document the scenario — the guard never receives
  // it because the caller has already filtered it out.
  it('D15: allows buyer cancel when a system event is literal last but buyer is last party actor', () => {
    void SYSTEM_ACTOR_REF // scenario documentation only
    const r = canCancel({
      offer: baseOffer(),
      actorUserId: BUYER_ID,
      lastEventActorRef: BUYER_ID, // what the caller passes after filter
    })
    expect(r).toEqual({ allowed: true })
  })
})

// ─── canExpire ────────────────────────────────────────────────────

describe('canExpire', () => {
  it('allows when expires_at is in the past', () => {
    const r = canExpire({
      offer: baseOffer({ expires_at: '2020-01-01T00:00:00.000Z' }),
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(r).toEqual({ allowed: true })
  })

  it('rejects when expires_at is in the future', () => {
    const r = canExpire({
      offer: baseOffer({ expires_at: '2099-12-31T23:59:59.000Z' }),
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('not_yet_expired')
  })

  it('rejects on a terminal state even when expires_at is in the past', () => {
    const r = canExpire({
      offer: baseOffer({
        state: 'accepted',
        expires_at: '2020-01-01T00:00:00.000Z',
      }),
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toMatch(/^invalid_state/)
  })

  it('accepts unix-ms timestamps for now', () => {
    const r = canExpire({
      offer: baseOffer({ expires_at: '2020-01-01T00:00:00.000Z' }),
      now: Date.parse('2026-01-01T00:00:00.000Z'),
    })
    expect(r).toEqual({ allowed: true })
  })
})
