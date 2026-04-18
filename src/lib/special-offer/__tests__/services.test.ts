import { describe, it, expect, beforeEach } from 'vitest'
import {
  createOffer,
  creatorCounter,
  buyerCounter,
  creatorAccept,
  buyerAccept,
  creatorDecline,
  expireOffer,
  autoCancelOffer,
  autoCancelAllForAsset,
  completeOffer,
  SpecialOfferError,
} from '../services'
import { makeAsset, makeThread, makeEvent, resetSequences } from './helpers'
import type { SpecialOfferThread, SpecialOfferEvent } from '@/lib/types'

beforeEach(() => resetSequences())

// ══════════════════════════════════════════════
// CREATE OFFER
// ══════════════════════════════════════════════

describe('createOffer', () => {
  it('creates a thread with buyer_offer_pending_creator status', () => {
    const asset = makeAsset()
    const { thread, events } = createOffer(
      {
        assetId: 'test-asset-001',
        buyerId: 'buyer-001',
        creatorId: 'creator-001',
        licenceType: 'editorial',
        offerAmount: 11000,
        listedPrice: 15000,
      },
      asset,
      [],
    )

    expect(thread.status).toBe('buyer_offer_pending_creator')
    expect(thread.currentOfferAmount).toBe(11000)
    expect(thread.currentOfferBy).toBe('buyer')
    expect(thread.roundCount).toBe(1)
    expect(thread.listedPriceAtOpen).toBe(15000)
    expect(thread.licenceType).toBe('editorial')
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('buyer_offer')
    expect(events[0].amount).toBe(11000)
  })

  it('uses default 4h response window', () => {
    const asset = makeAsset()
    const { thread } = createOffer(
      {
        assetId: 'test-asset-001',
        buyerId: 'buyer-001',
        creatorId: 'creator-001',
        licenceType: 'editorial',
        offerAmount: 11000,
        listedPrice: 15000,
      },
      asset,
      [],
    )
    expect(thread.creatorResponseWindowMinutes).toBe(240)
  })

  it('rejects self-offer', () => {
    const asset = makeAsset()
    expect(() =>
      createOffer(
        {
          assetId: 'test-asset-001',
          buyerId: 'creator-001',
          creatorId: 'creator-001',
          licenceType: 'editorial',
          offerAmount: 11000,
          listedPrice: 15000,
        },
        asset,
        [],
      ),
    ).toThrow(SpecialOfferError)
  })

  it('rejects offer on PRIVATE asset', () => {
    const asset = makeAsset({ privacy: 'PRIVATE' })
    expect(() =>
      createOffer(
        {
          assetId: 'test-asset-001',
          buyerId: 'buyer-001',
          creatorId: 'creator-001',
          licenceType: 'editorial',
          offerAmount: 11000,
          listedPrice: 15000,
        },
        asset,
        [],
      ),
    ).toThrow(SpecialOfferError)
  })

  it('rejects offer at listed price', () => {
    const asset = makeAsset()
    expect(() =>
      createOffer(
        {
          assetId: 'test-asset-001',
          buyerId: 'buyer-001',
          creatorId: 'creator-001',
          licenceType: 'editorial',
          offerAmount: 15000,
          listedPrice: 15000,
        },
        asset,
        [],
      ),
    ).toThrow(SpecialOfferError)
  })

  it('rejects duplicate active thread', () => {
    const asset = makeAsset()
    const existingThread = makeThread({
      buyerId: 'buyer-001',
      assetId: 'test-asset-001',
      licenceType: 'editorial',
      status: 'buyer_offer_pending_creator',
    })
    expect(() =>
      createOffer(
        {
          assetId: 'test-asset-001',
          buyerId: 'buyer-001',
          creatorId: 'creator-001',
          licenceType: 'editorial',
          offerAmount: 11000,
          listedPrice: 15000,
        },
        asset,
        [existingThread],
      ),
    ).toThrow(SpecialOfferError)
  })

  it('allows same buyer different licence type', () => {
    const asset = makeAsset()
    const existingThread = makeThread({
      buyerId: 'buyer-001',
      assetId: 'test-asset-001',
      licenceType: 'editorial',
      status: 'buyer_offer_pending_creator',
    })
    const { thread } = createOffer(
      {
        assetId: 'test-asset-001',
        buyerId: 'buyer-001',
        creatorId: 'creator-001',
        licenceType: 'commercial',
        offerAmount: 11000,
        listedPrice: 15000,
      },
      asset,
      [existingThread],
    )
    expect(thread.licenceType).toBe('commercial')
  })

  it('rejects disabled licence type', () => {
    const asset = makeAsset({ enabledLicences: ['editorial'] })
    expect(() =>
      createOffer(
        {
          assetId: 'test-asset-001',
          buyerId: 'buyer-001',
          creatorId: 'creator-001',
          licenceType: 'broadcast',
          offerAmount: 11000,
          listedPrice: 15000,
        },
        asset,
        [],
      ),
    ).toThrow(SpecialOfferError)
  })

  it('rejects exclusive-locked asset', () => {
    const asset = makeAsset({
      exclusiveLock: { tier: '30_day', buyerId: 'x', activatedAt: '2026-01-01T00:00:00Z', expiresAt: '2026-02-01T00:00:00Z' },
    })
    expect(() =>
      createOffer(
        {
          assetId: 'test-asset-001',
          buyerId: 'buyer-001',
          creatorId: 'creator-001',
          licenceType: 'editorial',
          offerAmount: 11000,
          listedPrice: 15000,
        },
        asset,
        [],
      ),
    ).toThrow(SpecialOfferError)
  })
})

// ══════════════════════════════════════════════
// CREATOR COUNTER
// ══════════════════════════════════════════════

describe('creatorCounter', () => {
  it('transitions to creator_counter_pending_buyer', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', roundCount: 1 })
    const events = [makeEvent()]
    const result = creatorCounter(
      { threadId: thread.id, actorId: 'creator-001', amount: 13000 },
      thread,
      events,
    )
    expect(result.thread.status).toBe('creator_counter_pending_buyer')
    expect(result.thread.currentOfferAmount).toBe(13000)
    expect(result.thread.currentOfferBy).toBe('creator')
    expect(result.thread.roundCount).toBe(2)
  })

  it('rejects non-creator actor', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    expect(() =>
      creatorCounter({ threadId: thread.id, actorId: 'buyer-001', amount: 13000 }, thread, []),
    ).toThrow(SpecialOfferError)
  })

  it('rejects when not creator turn', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer' })
    expect(() =>
      creatorCounter({ threadId: thread.id, actorId: 'creator-001', amount: 13000 }, thread, []),
    ).toThrow(SpecialOfferError)
  })

  it('rejects when max rounds reached', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', roundCount: 3 })
    expect(() =>
      creatorCounter({ threadId: thread.id, actorId: 'creator-001', amount: 13000 }, thread, []),
    ).toThrow(SpecialOfferError)
  })

  it('rejects expired offer', () => {
    const thread = makeThread({
      status: 'buyer_offer_pending_creator',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(() =>
      creatorCounter({ threadId: thread.id, actorId: 'creator-001', amount: 13000 }, thread, []),
    ).toThrow(SpecialOfferError)
  })
})

// ══════════════════════════════════════════════
// BUYER COUNTER
// ══════════════════════════════════════════════

describe('buyerCounter', () => {
  it('transitions to buyer_counter_pending_creator', () => {
    const thread = makeThread({
      status: 'creator_counter_pending_buyer',
      currentOfferBy: 'creator',
      roundCount: 2,
    })
    const result = buyerCounter(
      { threadId: thread.id, actorId: 'buyer-001', amount: 12000 },
      thread,
      [],
    )
    expect(result.thread.status).toBe('buyer_counter_pending_creator')
    expect(result.thread.currentOfferAmount).toBe(12000)
    expect(result.thread.currentOfferBy).toBe('buyer')
    expect(result.thread.roundCount).toBe(3)
  })

  it('rejects non-buyer actor', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer' })
    expect(() =>
      buyerCounter({ threadId: thread.id, actorId: 'creator-001', amount: 12000 }, thread, []),
    ).toThrow(SpecialOfferError)
  })
})

// ══════════════════════════════════════════════
// CREATOR ACCEPT
// ══════════════════════════════════════════════

describe('creatorAccept', () => {
  it('transitions to accepted_pending_checkout with checkout intent', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', currentOfferBy: 'buyer', currentOfferAmount: 11000 })
    const result = creatorAccept({ threadId: thread.id, actorId: 'creator-001' }, thread, [])

    expect(result.thread.status).toBe('accepted_pending_checkout')
    expect(result.thread.acceptedAmount).toBe(11000)
    expect(result.thread.checkoutIntentId).toBeTruthy()
    expect(result.checkoutIntent.negotiatedAmount).toBe(11000)
    expect(result.checkoutIntent.threadId).toBe(thread.id)
  })

  it('rejects when not creator turn', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer' })
    expect(() =>
      creatorAccept({ threadId: thread.id, actorId: 'creator-001' }, thread, []),
    ).toThrow(SpecialOfferError)
  })

  it('rejects non-creator actor', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    expect(() =>
      creatorAccept({ threadId: thread.id, actorId: 'buyer-001' }, thread, []),
    ).toThrow(SpecialOfferError)
  })

  it('rejects on expired offer', () => {
    const thread = makeThread({
      status: 'buyer_offer_pending_creator',
      currentOfferBy: 'buyer',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(() =>
      creatorAccept({ threadId: thread.id, actorId: 'creator-001' }, thread, []),
    ).toThrow(SpecialOfferError)
  })
})

// ══════════════════════════════════════════════
// BUYER ACCEPT
// ══════════════════════════════════════════════

describe('buyerAccept', () => {
  it('transitions to accepted_pending_checkout', () => {
    const thread = makeThread({
      status: 'creator_counter_pending_buyer',
      currentOfferBy: 'creator',
      currentOfferAmount: 13000,
    })
    const result = buyerAccept({ threadId: thread.id, actorId: 'buyer-001' }, thread, [])

    expect(result.thread.status).toBe('accepted_pending_checkout')
    expect(result.thread.acceptedAmount).toBe(13000)
    expect(result.checkoutIntent.negotiatedAmount).toBe(13000)
  })
})

// ══════════════════════════════════════════════
// CREATOR DECLINE
// ══════════════════════════════════════════════

describe('creatorDecline', () => {
  it('transitions to declined', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    const result = creatorDecline({ threadId: thread.id, actorId: 'creator-001' }, thread, [])
    expect(result.thread.status).toBe('declined')
    expect(result.thread.resolvedAt).toBeTruthy()
  })

  it('rejects non-creator', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    expect(() =>
      creatorDecline({ threadId: thread.id, actorId: 'buyer-001' }, thread, []),
    ).toThrow(SpecialOfferError)
  })

  it('rejects on already terminal', () => {
    const thread = makeThread({ status: 'completed' })
    expect(() =>
      creatorDecline({ threadId: thread.id, actorId: 'creator-001' }, thread, []),
    ).toThrow(SpecialOfferError)
  })
})

// ══════════════════════════════════════════════
// EXPIRE
// ══════════════════════════════════════════════

describe('expireOffer', () => {
  it('transitions to expired when past expiry', () => {
    const thread = makeThread({
      status: 'buyer_offer_pending_creator',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    const result = expireOffer(thread, [])
    expect(result.thread.status).toBe('expired')
  })

  it('rejects when not expired', () => {
    const thread = makeThread({
      status: 'buyer_offer_pending_creator',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(() => expireOffer(thread, [])).toThrow(SpecialOfferError)
  })

  it('rejects when already terminal', () => {
    const thread = makeThread({ status: 'completed' })
    expect(() => expireOffer(thread, [])).toThrow(SpecialOfferError)
  })
})

// ══════════════════════════════════════════════
// AUTO-CANCEL
// ══════════════════════════════════════════════

describe('autoCancelOffer', () => {
  it('transitions to auto_cancelled with reason', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    const result = autoCancelOffer(thread, [], 'privacy_changed')
    expect(result.thread.status).toBe('auto_cancelled')
    expect(result.thread.autoCancelReason).toBe('privacy_changed')
  })

  it('no-ops on terminal thread', () => {
    const thread = makeThread({ status: 'completed' })
    const result = autoCancelOffer(thread, [], 'privacy_changed')
    expect(result.thread.status).toBe('completed')
  })
})

describe('autoCancelAllForAsset', () => {
  it('cancels all active threads for asset', () => {
    const t1 = makeThread({ assetId: 'a1', status: 'buyer_offer_pending_creator' })
    const t2 = makeThread({ assetId: 'a1', status: 'creator_counter_pending_buyer' })
    const t3 = makeThread({ assetId: 'a2', status: 'buyer_offer_pending_creator' }) // different asset

    const eventsMap = new Map<string, SpecialOfferEvent[]>()
    const asset = makeAsset({ id: 'a1', privacy: 'PRIVATE' })

    const result = autoCancelAllForAsset([t1, t2, t3], eventsMap, asset)

    expect(result.threads[0].status).toBe('auto_cancelled')
    expect(result.threads[1].status).toBe('auto_cancelled')
    expect(result.threads[2].status).toBe('buyer_offer_pending_creator') // untouched
  })
})

// ══════════════════════════════════════════════
// COMPLETE
// ══════════════════════════════════════════════

describe('completeOffer', () => {
  it('transitions accepted → completed', () => {
    const thread = makeThread({ status: 'accepted_pending_checkout', acceptedAmount: 11000 })
    const result = completeOffer(thread, [])
    expect(result.thread.status).toBe('completed')
  })

  it('rejects non-accepted threads', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    expect(() => completeOffer(thread, [])).toThrow(SpecialOfferError)
  })
})

// ══════════════════════════════════════════════
// FULL NEGOTIATION FLOW
// ══════════════════════════════════════════════

describe('full negotiation flow', () => {
  it('buyer offer → creator counter → buyer counter → creator accept → complete', () => {
    const asset = makeAsset()

    // Step 1: Buyer submits offer
    const step1 = createOffer(
      {
        assetId: 'test-asset-001',
        buyerId: 'buyer-001',
        creatorId: 'creator-001',
        licenceType: 'editorial',
        offerAmount: 10000,
        listedPrice: 15000,
      },
      asset,
      [],
    )
    expect(step1.thread.status).toBe('buyer_offer_pending_creator')
    expect(step1.thread.roundCount).toBe(1)

    // Step 2: Creator counters
    const step2 = creatorCounter(
      { threadId: step1.thread.id, actorId: 'creator-001', amount: 13000 },
      step1.thread,
      step1.events,
    )
    expect(step2.thread.status).toBe('creator_counter_pending_buyer')
    expect(step2.thread.roundCount).toBe(2)

    // Step 3: Buyer counters
    const step3 = buyerCounter(
      { threadId: step2.thread.id, actorId: 'buyer-001', amount: 12000 },
      step2.thread,
      step2.events,
    )
    expect(step3.thread.status).toBe('buyer_counter_pending_creator')
    expect(step3.thread.roundCount).toBe(3) // Max rounds!

    // Step 4: Creator accepts (can't counter — max rounds)
    const step4 = creatorAccept(
      { threadId: step3.thread.id, actorId: 'creator-001' },
      step3.thread,
      step3.events,
    )
    expect(step4.thread.status).toBe('accepted_pending_checkout')
    expect(step4.thread.acceptedAmount).toBe(12000)

    // Step 5: Complete after checkout
    const step5 = completeOffer(step4.thread, step4.events)
    expect(step5.thread.status).toBe('completed')
    expect(step5.events).toHaveLength(5) // buyer_offer + creator_counter + buyer_counter + creator_accept + completed
  })

  it('enforces max 3 counter rounds exactly', () => {
    const asset = makeAsset()

    const step1 = createOffer(
      { assetId: 'test-asset-001', buyerId: 'buyer-001', creatorId: 'creator-001', licenceType: 'editorial', offerAmount: 10000, listedPrice: 15000 },
      asset,
      [],
    )
    // round 1: buyer offer

    const step2 = creatorCounter(
      { threadId: step1.thread.id, actorId: 'creator-001', amount: 14000 },
      step1.thread,
      step1.events,
    )
    // round 2

    const step3 = buyerCounter(
      { threadId: step2.thread.id, actorId: 'buyer-001', amount: 12000 },
      step2.thread,
      step2.events,
    )
    // round 3 — max reached

    // Creator cannot counter again
    expect(() =>
      creatorCounter(
        { threadId: step3.thread.id, actorId: 'creator-001', amount: 13000 },
        step3.thread,
        step3.events,
      ),
    ).toThrow(SpecialOfferError)

    // But can still accept or decline
    expect(() =>
      creatorAccept({ threadId: step3.thread.id, actorId: 'creator-001' }, step3.thread, step3.events),
    ).not.toThrow()
  })
})

// ══════════════════════════════════════════════
// MESSAGE FIELD
// ══════════════════════════════════════════════

describe('negotiation messages', () => {
  it('createOffer carries buyer message in event', () => {
    const asset = makeAsset()
    const { events } = createOffer(
      {
        assetId: 'test-asset-001',
        buyerId: 'buyer-001',
        creatorId: 'creator-001',
        licenceType: 'editorial',
        offerAmount: 11000,
        listedPrice: 15000,
        message: 'For a feature on climate policy. Single print run.',
      },
      asset,
      [],
    )
    expect(events[0].message).toBe('For a feature on climate policy. Single print run.')
  })

  it('createOffer with no message stores null', () => {
    const asset = makeAsset()
    const { events } = createOffer(
      {
        assetId: 'test-asset-001',
        buyerId: 'buyer-001',
        creatorId: 'creator-001',
        licenceType: 'editorial',
        offerAmount: 11000,
        listedPrice: 15000,
      },
      asset,
      [],
    )
    expect(events[0].message).toBeNull()
  })

  it('createOffer trims whitespace-only message to null', () => {
    const asset = makeAsset()
    const { events } = createOffer(
      {
        assetId: 'test-asset-001',
        buyerId: 'buyer-001',
        creatorId: 'creator-001',
        licenceType: 'editorial',
        offerAmount: 11000,
        listedPrice: 15000,
        message: '   ',
      },
      asset,
      [],
    )
    expect(events[0].message).toBeNull()
  })

  it('creatorCounter carries message in event', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', roundCount: 1 })
    const result = creatorCounter(
      { threadId: thread.id, actorId: 'creator-001', amount: 13000, message: 'Can do €130 for editorial single-use.' },
      thread,
      [makeEvent()],
    )
    const counterEvent = result.events.find(e => e.type === 'creator_counter')
    expect(counterEvent?.message).toBe('Can do €130 for editorial single-use.')
  })

  it('buyerCounter carries message in event', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer', currentOfferBy: 'creator', roundCount: 2 })
    const result = buyerCounter(
      { threadId: thread.id, actorId: 'buyer-001', amount: 12000, message: 'Meet in the middle at €120?' },
      thread,
      [],
    )
    const counterEvent = result.events.find(e => e.type === 'buyer_counter')
    expect(counterEvent?.message).toBe('Meet in the middle at €120?')
  })

  it('creatorDecline carries optional message', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    const result = creatorDecline(
      { threadId: thread.id, actorId: 'creator-001', message: 'Below my minimum for this asset.' },
      thread,
      [],
    )
    const declineEvent = result.events.find(e => e.type === 'creator_decline')
    expect(declineEvent?.message).toBe('Below my minimum for this asset.')
  })

  it('creatorDecline with no message stores null', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    const result = creatorDecline(
      { threadId: thread.id, actorId: 'creator-001' },
      thread,
      [],
    )
    const declineEvent = result.events.find(e => e.type === 'creator_decline')
    expect(declineEvent?.message).toBeNull()
  })

  it('full flow preserves messages across all rounds', () => {
    const asset = makeAsset()

    const step1 = createOffer(
      { assetId: 'test-asset-001', buyerId: 'buyer-001', creatorId: 'creator-001', licenceType: 'editorial', offerAmount: 10000, listedPrice: 15000, message: 'Editorial use, online feature.' },
      asset,
      [],
    )
    expect(step1.events[0].message).toBe('Editorial use, online feature.')

    const step2 = creatorCounter(
      { threadId: step1.thread.id, actorId: 'creator-001', amount: 13000, message: 'This image has significant provenance value.' },
      step1.thread,
      step1.events,
    )
    expect(step2.events[1].message).toBe('This image has significant provenance value.')

    const step3 = buyerCounter(
      { threadId: step2.thread.id, actorId: 'buyer-001', amount: 12000, message: 'Budget is tight. Can we close at €120?' },
      step2.thread,
      step2.events,
    )
    expect(step3.events[2].message).toBe('Budget is tight. Can we close at €120?')

    // All 3 messages preserved in event history
    expect(step3.events.filter(e => e.message != null)).toHaveLength(3)
  })
})
