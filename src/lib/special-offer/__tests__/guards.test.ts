import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkAssetEligibility,
  validateOfferAmount,
  validateCounterAmount,
  validateResponseWindow,
  isCreatorTurn,
  isBuyerTurn,
  canCreatorAccept,
  canBuyerAccept,
  canCreatorCounter,
  canBuyerCounter,
  canCreatorDecline,
  isOfferExpired,
  isMaxRoundsReached,
  isValidTransition,
  isTerminal,
  hasActiveThread,
  shouldAutoCancel,
  isSelfOffer,
} from '../guards'
import { makeAsset, makeThread, resetSequences } from './helpers'

beforeEach(() => resetSequences())

// ══════════════════════════════════════════════
// ASSET ELIGIBILITY
// ══════════════════════════════════════════════

describe('checkAssetEligibility', () => {
  it('accepts a PUBLIC, transactable, priced asset without exclusive lock', () => {
    const asset = makeAsset()
    expect(checkAssetEligibility(asset)).toEqual({ eligible: true })
  })

  it('rejects PRIVATE assets', () => {
    const asset = makeAsset({ privacy: 'PRIVATE' })
    const result = checkAssetEligibility(asset)
    expect(result.eligible).toBe(false)
    expect(result.reason).toMatch(/PUBLIC/)
  })

  it('rejects RESTRICTED assets', () => {
    const asset = makeAsset({ privacy: 'RESTRICTED' })
    expect(checkAssetEligibility(asset).eligible).toBe(false)
  })

  it('rejects non-transactable declaration states', () => {
    for (const state of ['manifest_invalid', 'disputed', 'invalidated'] as const) {
      const asset = makeAsset({ declarationState: state })
      expect(checkAssetEligibility(asset).eligible).toBe(false)
    }
  })

  it('accepts all transactable declaration states', () => {
    for (const state of ['fully_validated', 'provenance_pending', 'corroborated', 'under_review'] as const) {
      const asset = makeAsset({ declarationState: state })
      expect(checkAssetEligibility(asset).eligible).toBe(true)
    }
  })

  it('rejects assets with exclusive lock', () => {
    const asset = makeAsset({
      exclusiveLock: {
        tier: '30_day',
        buyerId: 'someone',
        activatedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-02-01T00:00:00Z',
      },
    })
    expect(checkAssetEligibility(asset).eligible).toBe(false)
  })

  it('rejects assets without a price', () => {
    const asset = makeAsset({ creatorPrice: null })
    expect(checkAssetEligibility(asset).eligible).toBe(false)
  })

  it('rejects assets with zero price', () => {
    const asset = makeAsset({ creatorPrice: 0 })
    expect(checkAssetEligibility(asset).eligible).toBe(false)
  })

  it('rejects assets with no enabled licences', () => {
    const asset = makeAsset({ enabledLicences: [] })
    expect(checkAssetEligibility(asset).eligible).toBe(false)
  })
})

// ══════════════════════════════════════════════
// AMOUNT VALIDATION
// ══════════════════════════════════════════════

describe('validateOfferAmount', () => {
  it('accepts amount below listed price', () => {
    expect(validateOfferAmount(10000, 15000)).toEqual({ eligible: true })
  })

  it('rejects amount equal to listed price', () => {
    expect(validateOfferAmount(15000, 15000).eligible).toBe(false)
  })

  it('rejects amount above listed price', () => {
    expect(validateOfferAmount(20000, 15000).eligible).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(validateOfferAmount(0, 15000).eligible).toBe(false)
  })

  it('rejects negative amount', () => {
    expect(validateOfferAmount(-100, 15000).eligible).toBe(false)
  })

  it('rejects non-integer amounts', () => {
    expect(validateOfferAmount(100.5, 15000).eligible).toBe(false)
  })
})

describe('validateCounterAmount', () => {
  it('accepts valid counter amount', () => {
    const thread = makeThread({ currentOfferAmount: 10000, listedPriceAtOpen: 15000 })
    expect(validateCounterAmount(12000, thread)).toEqual({ eligible: true })
  })

  it('rejects counter equal to listed price', () => {
    const thread = makeThread({ listedPriceAtOpen: 15000 })
    expect(validateCounterAmount(15000, thread).eligible).toBe(false)
  })

  it('rejects counter equal to current offer', () => {
    const thread = makeThread({ currentOfferAmount: 11000 })
    expect(validateCounterAmount(11000, thread).eligible).toBe(false)
  })
})

// ══════════════════════════════════════════════
// RESPONSE WINDOW
// ══════════════════════════════════════════════

describe('validateResponseWindow', () => {
  it('accepts 240 minutes (4h default)', () => {
    expect(validateResponseWindow(240)).toEqual({ eligible: true })
  })

  it('accepts 30 minutes (minimum)', () => {
    expect(validateResponseWindow(30)).toEqual({ eligible: true })
  })

  it('accepts 1440 minutes (24h maximum)', () => {
    expect(validateResponseWindow(1440)).toEqual({ eligible: true })
  })

  it('rejects below minimum', () => {
    expect(validateResponseWindow(29).eligible).toBe(false)
  })

  it('rejects above maximum', () => {
    expect(validateResponseWindow(1441).eligible).toBe(false)
  })
})

// ══════════════════════════════════════════════
// TURN VALIDATION
// ══════════════════════════════════════════════

describe('turn validation', () => {
  it('isCreatorTurn for buyer_offer_pending_creator', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator' })
    expect(isCreatorTurn(thread)).toBe(true)
    expect(isBuyerTurn(thread)).toBe(false)
  })

  it('isCreatorTurn for buyer_counter_pending_creator', () => {
    const thread = makeThread({ status: 'buyer_counter_pending_creator' })
    expect(isCreatorTurn(thread)).toBe(true)
    expect(isBuyerTurn(thread)).toBe(false)
  })

  it('isBuyerTurn for creator_counter_pending_buyer', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer' })
    expect(isBuyerTurn(thread)).toBe(true)
    expect(isCreatorTurn(thread)).toBe(false)
  })

  it('no one\'s turn for terminal states', () => {
    for (const status of ['declined', 'expired', 'auto_cancelled', 'completed'] as const) {
      const thread = makeThread({ status })
      expect(isCreatorTurn(thread)).toBe(false)
      expect(isBuyerTurn(thread)).toBe(false)
    }
  })
})

describe('canCreatorAccept', () => {
  it('true when creator turn and buyer made the offer', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', currentOfferBy: 'buyer' })
    expect(canCreatorAccept(thread)).toBe(true)
  })

  it('false when it is buyer turn', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer', currentOfferBy: 'creator' })
    expect(canCreatorAccept(thread)).toBe(false)
  })
})

describe('canBuyerAccept', () => {
  it('true when buyer turn and creator made the counter', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer', currentOfferBy: 'creator' })
    expect(canBuyerAccept(thread)).toBe(true)
  })

  it('false when it is creator turn', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', currentOfferBy: 'buyer' })
    expect(canBuyerAccept(thread)).toBe(false)
  })
})

describe('canCreatorCounter', () => {
  it('true when creator turn and rounds available', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', roundCount: 1 })
    expect(canCreatorCounter(thread)).toBe(true)
  })

  it('false when max rounds reached', () => {
    const thread = makeThread({ status: 'buyer_offer_pending_creator', roundCount: 3 })
    expect(canCreatorCounter(thread)).toBe(false)
  })

  it('false when not creator turn', () => {
    const thread = makeThread({ status: 'creator_counter_pending_buyer', roundCount: 1 })
    expect(canCreatorCounter(thread)).toBe(false)
  })
})

// ══════════════════════════════════════════════
// EXPIRY
// ══════════════════════════════════════════════

describe('isOfferExpired', () => {
  it('true when past expiry', () => {
    const thread = makeThread({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    expect(isOfferExpired(thread)).toBe(true)
  })

  it('false when before expiry', () => {
    const thread = makeThread({ expiresAt: new Date(Date.now() + 60_000).toISOString() })
    expect(isOfferExpired(thread)).toBe(false)
  })

  it('false for terminal states', () => {
    const thread = makeThread({
      status: 'completed',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(isOfferExpired(thread)).toBe(false)
  })
})

// ══════════════════════════════════════════════
// STATE TRANSITIONS
// ══════════════════════════════════════════════

describe('isValidTransition', () => {
  it('allows buyer_offer → creator_counter', () => {
    expect(isValidTransition('buyer_offer_pending_creator', 'creator_counter_pending_buyer')).toBe(true)
  })

  it('allows buyer_offer → accepted', () => {
    expect(isValidTransition('buyer_offer_pending_creator', 'accepted_pending_checkout')).toBe(true)
  })

  it('allows buyer_offer → declined', () => {
    expect(isValidTransition('buyer_offer_pending_creator', 'declined')).toBe(true)
  })

  it('blocks completed → anything', () => {
    expect(isValidTransition('completed', 'buyer_offer_pending_creator')).toBe(false)
  })

  it('blocks declined → anything', () => {
    expect(isValidTransition('declined', 'accepted_pending_checkout')).toBe(false)
  })
})

describe('isTerminal', () => {
  it('returns true for terminal states', () => {
    expect(isTerminal('declined')).toBe(true)
    expect(isTerminal('expired')).toBe(true)
    expect(isTerminal('auto_cancelled')).toBe(true)
    expect(isTerminal('completed')).toBe(true)
  })

  it('returns false for active states', () => {
    expect(isTerminal('buyer_offer_pending_creator')).toBe(false)
    expect(isTerminal('creator_counter_pending_buyer')).toBe(false)
    expect(isTerminal('accepted_pending_checkout')).toBe(false)
  })
})

// ══════════════════════════════════════════════
// DUPLICATE THREAD CHECK
// ══════════════════════════════════════════════

describe('hasActiveThread', () => {
  it('returns true when active thread exists for same context', () => {
    const threads = [makeThread({ buyerId: 'b1', assetId: 'a1', licenceType: 'editorial', status: 'buyer_offer_pending_creator' })]
    expect(hasActiveThread(threads, 'b1', 'a1', 'editorial')).toBe(true)
  })

  it('returns false when thread is terminal', () => {
    const threads = [makeThread({ buyerId: 'b1', assetId: 'a1', licenceType: 'editorial', status: 'completed' })]
    expect(hasActiveThread(threads, 'b1', 'a1', 'editorial')).toBe(false)
  })

  it('returns false for different licence type', () => {
    const threads = [makeThread({ buyerId: 'b1', assetId: 'a1', licenceType: 'editorial', status: 'buyer_offer_pending_creator' })]
    expect(hasActiveThread(threads, 'b1', 'a1', 'commercial')).toBe(false)
  })
})

// ══════════════════════════════════════════════
// AUTO-CANCEL
// ══════════════════════════════════════════════

describe('shouldAutoCancel', () => {
  it('cancels when asset becomes PRIVATE', () => {
    const thread = makeThread()
    const asset = makeAsset({ privacy: 'PRIVATE' })
    const result = shouldAutoCancel(thread, asset)
    expect(result.cancel).toBe(true)
    expect(result.reason).toBe('privacy_changed')
  })

  it('cancels when declaration becomes non-transactable', () => {
    const thread = makeThread()
    const asset = makeAsset({ declarationState: 'invalidated' })
    const result = shouldAutoCancel(thread, asset)
    expect(result.cancel).toBe(true)
    expect(result.reason).toBe('declaration_non_transactable')
  })

  it('cancels when exclusive lock activates', () => {
    const thread = makeThread()
    const asset = makeAsset({
      exclusiveLock: { tier: '30_day', buyerId: 'x', activatedAt: '2026-01-01T00:00:00Z', expiresAt: '2026-02-01T00:00:00Z' },
    })
    const result = shouldAutoCancel(thread, asset)
    expect(result.cancel).toBe(true)
    expect(result.reason).toBe('exclusive_activated')
  })

  it('cancels when price is removed', () => {
    const thread = makeThread()
    const asset = makeAsset({ creatorPrice: null })
    const result = shouldAutoCancel(thread, asset)
    expect(result.cancel).toBe(true)
    expect(result.reason).toBe('asset_delisted')
  })

  it('does not cancel for eligible asset', () => {
    const thread = makeThread()
    const asset = makeAsset()
    expect(shouldAutoCancel(thread, asset).cancel).toBe(false)
  })

  it('does not cancel terminal threads', () => {
    const thread = makeThread({ status: 'completed' })
    const asset = makeAsset({ privacy: 'PRIVATE' })
    expect(shouldAutoCancel(thread, asset).cancel).toBe(false)
  })
})

// ══════════════════════════════════════════════
// SELF-OFFER
// ══════════════════════════════════════════════

describe('isSelfOffer', () => {
  it('true when buyer and creator are the same', () => {
    expect(isSelfOffer('user-001', 'user-001')).toBe(true)
  })

  it('false when different users', () => {
    expect(isSelfOffer('buyer-001', 'creator-001')).toBe(false)
  })
})
