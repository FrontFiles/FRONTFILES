// ═══════════════════════════════════════════════════════════════
// OfferActions — pure-component tests (§R6-pure / §F10)
//
// 6 test cases per §F10: state × role × last-actor combinations
// covering the full visibility matrix from §SCOPE item 5 plus a
// terminal-state "no buttons" sweep. `renderToString` is the
// §R6-pure substitute for RTL / jsdom — OfferActions has no
// hooks / effects / fetch, so string-rendering is sufficient.
//
// Bundled sub-assertions (IP-3 discipline): Test 1 asserts both
// visibility AND mutationState='submitting' disabled behaviour
// on the single rendered button. Other tests assert visibility
// only.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'

import { OfferActions } from '../OfferActions'
import type { OfferRow } from '@/lib/offer'

// ─── Fixtures ───────────────────────────────────────────────────

const BUYER_ID = '00000000-0000-0000-0000-00000000b001'
const CREATOR_ID = '00000000-0000-0000-0000-00000000c001'

function makeOffer(state: OfferRow['state']): OfferRow {
  return {
    id: '00000000-0000-0000-0000-00000000f001',
    buyer_id: BUYER_ID,
    creator_id: CREATOR_ID,
    target_type: 'single_asset',
    gross_fee: 1000,
    platform_fee_bps: 2000,
    currency: 'EUR',
    rights: {
      template: 'editorial_one_time',
      params: { publication_name: 'Test', territory: 'worldwide' },
      is_transfer: false,
    },
    current_note: null,
    expires_at: '2099-01-01T00:00:00.000Z',
    state,
    cancelled_by: null,
    created_at: '2026-04-23T00:00:00.000Z',
    updated_at: '2026-04-23T00:00:00.000Z',
  }
}

const noop = (): void => {}

function commonHandlers(): {
  onAccept: () => void
  onCounter: () => void
  onReject: () => void
  onCancel: () => void
} {
  return { onAccept: noop, onCounter: noop, onReject: noop, onCancel: noop }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('OfferActions — state=sent, buyer just created (buyer last actor, buyer viewing)', () => {
  it('renders only Cancel, and disables when mutationState=submitting (bundled)', () => {
    const offer = makeOffer('sent')

    // Sub-assertion (a) — default (idle): only Cancel visible.
    const htmlIdle = renderToString(
      <OfferActions
        offer={offer}
        selfUserId={BUYER_ID}
        lastEventActorRef={BUYER_ID}
        mutationState="idle"
        {...commonHandlers()}
      />,
    )
    expect(htmlIdle).not.toContain('>Accept<')
    expect(htmlIdle).not.toContain('>Counter<')
    expect(htmlIdle).not.toContain('>Reject<')
    expect(htmlIdle).toContain('>Cancel<')
    // Button should not carry the disabled HTML attribute when idle.
    // React 19 renders boolean disabled as the token `disabled=""`;
    // the Tailwind class `disabled:opacity-50` appears inside `class="…"`
    // and never as `disabled=""`, so this assertion isolates the attribute.
    expect(htmlIdle).not.toContain('disabled=""')

    // Sub-assertion (b) — mutationState=submitting: disabled.
    const htmlSubmitting = renderToString(
      <OfferActions
        offer={offer}
        selfUserId={BUYER_ID}
        lastEventActorRef={BUYER_ID}
        mutationState="submitting"
        {...commonHandlers()}
      />,
    )
    expect(htmlSubmitting).toContain('>Cancel<')
    expect(htmlSubmitting).toContain('disabled=""')
  })
})

describe('OfferActions — state=sent, creator responding to buyer offer', () => {
  it('renders Counter + Reject only; Accept/Cancel hidden (buyer-only)', () => {
    const html = renderToString(
      <OfferActions
        offer={makeOffer('sent')}
        selfUserId={CREATOR_ID}
        lastEventActorRef={BUYER_ID}
        mutationState="idle"
        {...commonHandlers()}
      />,
    )
    // Accept is buyer-only per canAccept → hidden for creator viewer.
    expect(html).not.toContain('>Accept<')
    expect(html).toContain('>Counter<')
    expect(html).toContain('>Reject<')
    // Cancel is buyer-only per canCancel → hidden for creator viewer.
    expect(html).not.toContain('>Cancel<')
  })
})

describe('OfferActions — state=countered, buyer responding to creator counter (awaiting buyer)', () => {
  it('renders Accept + Counter + Reject; Cancel hidden (buyer not last actor)', () => {
    const html = renderToString(
      <OfferActions
        offer={makeOffer('countered')}
        selfUserId={BUYER_ID}
        lastEventActorRef={CREATOR_ID}
        mutationState="idle"
        {...commonHandlers()}
      />,
    )
    expect(html).toContain('>Accept<')
    expect(html).toContain('>Counter<')
    expect(html).toContain('>Reject<')
    // Cancel requires buyer === last actor per canCancel. Creator
    // was the last actor here → Cancel hidden.
    expect(html).not.toContain('>Cancel<')
  })
})

describe('OfferActions — state=countered, creator responding to buyer counter (awaiting creator)', () => {
  it('renders Counter + Reject only; Accept hidden (buyer-only), Cancel hidden (buyer-only)', () => {
    const html = renderToString(
      <OfferActions
        offer={makeOffer('countered')}
        selfUserId={CREATOR_ID}
        lastEventActorRef={BUYER_ID}
        mutationState="idle"
        {...commonHandlers()}
      />,
    )
    expect(html).not.toContain('>Accept<')
    expect(html).toContain('>Counter<')
    expect(html).toContain('>Reject<')
    expect(html).not.toContain('>Cancel<')
  })
})

describe('OfferActions — state=countered, buyer just countered, viewing own counter', () => {
  it('renders only Cancel; Accept/Counter/Reject hidden (buyer not awaiting)', () => {
    const html = renderToString(
      <OfferActions
        offer={makeOffer('countered')}
        selfUserId={BUYER_ID}
        lastEventActorRef={BUYER_ID}
        mutationState="idle"
        {...commonHandlers()}
      />,
    )
    // Buyer just moved; viewerIsAwaiting = false → accept/counter/reject hidden.
    expect(html).not.toContain('>Accept<')
    expect(html).not.toContain('>Counter<')
    expect(html).not.toContain('>Reject<')
    // Cancel: buyer is last actor, state transitionable → visible.
    expect(html).toContain('>Cancel<')
  })
})

describe('OfferActions — terminal state (accepted)', () => {
  it('renders no buttons — all guards require state ∈ {sent, countered}', () => {
    const html = renderToString(
      <OfferActions
        offer={makeOffer('accepted')}
        selfUserId={BUYER_ID}
        lastEventActorRef={CREATOR_ID}
        mutationState="idle"
        {...commonHandlers()}
      />,
    )
    expect(html).not.toContain('>Accept<')
    expect(html).not.toContain('>Counter<')
    expect(html).not.toContain('>Reject<')
    expect(html).not.toContain('>Cancel<')
    // The wrapper div still renders, but contains no button elements.
    expect(html).not.toContain('<button')
  })
})
