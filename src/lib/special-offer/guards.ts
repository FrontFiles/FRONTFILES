/**
 * Direct Offer Engine — Guards
 *
 * Server-authoritative eligibility and transition validation.
 * All offer domain logic gates through these guards.
 */

import type { SpecialOfferThread, VaultAsset, SpecialOfferStatus } from '@/lib/types'
import {
  TRANSACTABLE_DECLARATION_STATES,
  SPECIAL_OFFER_MAX_ROUNDS,
  SPECIAL_OFFER_MIN_RESPONSE_MINUTES,
  SPECIAL_OFFER_MAX_RESPONSE_MINUTES,
  TERMINAL_OFFER_STATUSES,
} from '@/lib/types'
import { VALID_OFFER_TRANSITIONS, type EligibilityResult } from './types'

// ══════════════════════════════════════════════
// ASSET ELIGIBILITY
// ══════════════════════════════════════════════

/**
 * Can a Direct Offer be created for this asset?
 * Checks: PUBLIC, transactable declaration, no exclusive lock, has price, has licences.
 */
export function checkAssetEligibility(asset: VaultAsset): EligibilityResult {
  if (asset.privacy !== 'PUBLIC') {
    return { eligible: false, reason: 'Special Offers are only available for PUBLIC assets.' }
  }

  if (!asset.declarationState || !TRANSACTABLE_DECLARATION_STATES.includes(asset.declarationState)) {
    return { eligible: false, reason: 'Asset declaration state does not permit transactions.' }
  }

  if (asset.exclusiveLock) {
    return { eligible: false, reason: 'Asset is under an active exclusive licence.' }
  }

  if (asset.creatorPrice == null || asset.creatorPrice <= 0) {
    return { eligible: false, reason: 'Asset does not have a listed price.' }
  }

  if (asset.enabledLicences.length === 0) {
    return { eligible: false, reason: 'Asset has no enabled licence types.' }
  }

  return { eligible: true }
}

// ══════════════════════════════════════════════
// OFFER AMOUNT VALIDATION
// ══════════════════════════════════════════════

/**
 * Offer must be below listed price and above zero.
 */
export function validateOfferAmount(amount: number, listedPrice: number): EligibilityResult {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { eligible: false, reason: 'Offer amount must be a positive integer (EUR cents).' }
  }

  if (amount >= listedPrice) {
    return { eligible: false, reason: 'Offer must be below the listed price. Use standard checkout for full-price purchases.' }
  }

  return { eligible: true }
}

/**
 * Counter-offer amount validation.
 * Creator counters must be above current buyer offer but below listed price.
 * Buyer counters must be above previous buyer offer but below creator counter.
 */
export function validateCounterAmount(
  amount: number,
  thread: SpecialOfferThread,
): EligibilityResult {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { eligible: false, reason: 'Counter amount must be a positive integer (EUR cents).' }
  }

  if (amount >= thread.listedPriceAtOpen) {
    return { eligible: false, reason: 'Counter must be below the listed price.' }
  }

  if (amount === thread.currentOfferAmount) {
    return { eligible: false, reason: 'Counter must differ from the current offer.' }
  }

  return { eligible: true }
}

// ══════════════════════════════════════════════
// RESPONSE WINDOW VALIDATION
// ══════════════════════════════════════════════

export function validateResponseWindow(minutes: number): EligibilityResult {
  if (minutes < SPECIAL_OFFER_MIN_RESPONSE_MINUTES) {
    return { eligible: false, reason: `Response window cannot be less than ${SPECIAL_OFFER_MIN_RESPONSE_MINUTES} minutes.` }
  }
  if (minutes > SPECIAL_OFFER_MAX_RESPONSE_MINUTES) {
    return { eligible: false, reason: `Response window cannot exceed ${SPECIAL_OFFER_MAX_RESPONSE_MINUTES} minutes (24 hours).` }
  }
  return { eligible: true }
}

// ══════════════════════════════════════════════
// TURN VALIDATION
// ══════════════════════════════════════════════

/** Is it the creator's turn to respond? */
export function isCreatorTurn(thread: SpecialOfferThread): boolean {
  return (
    thread.status === 'buyer_offer_pending_creator' ||
    thread.status === 'buyer_counter_pending_creator'
  )
}

/** Is it the buyer's turn to respond? */
export function isBuyerTurn(thread: SpecialOfferThread): boolean {
  return thread.status === 'creator_counter_pending_buyer'
}

/** Can the creator accept the current offer? */
export function canCreatorAccept(thread: SpecialOfferThread): boolean {
  return isCreatorTurn(thread) && thread.currentOfferBy === 'buyer'
}

/** Can the buyer accept the current counter-offer? */
export function canBuyerAccept(thread: SpecialOfferThread): boolean {
  return isBuyerTurn(thread) && thread.currentOfferBy === 'creator'
}

/** Can the creator counter? Checks turn + round limit. */
export function canCreatorCounter(thread: SpecialOfferThread): boolean {
  return isCreatorTurn(thread) && thread.roundCount < SPECIAL_OFFER_MAX_ROUNDS
}

/** Can the buyer counter? Checks turn + round limit. */
export function canBuyerCounter(thread: SpecialOfferThread): boolean {
  return isBuyerTurn(thread) && thread.roundCount < SPECIAL_OFFER_MAX_ROUNDS
}

/** Can the creator decline? Only on their turn. */
export function canCreatorDecline(thread: SpecialOfferThread): boolean {
  return isCreatorTurn(thread)
}

// ══════════════════════════════════════════════
// ROUND LIMIT
// ══════════════════════════════════════════════

export function isMaxRoundsReached(thread: SpecialOfferThread): boolean {
  return thread.roundCount >= SPECIAL_OFFER_MAX_ROUNDS
}

// ══════════════════════════════════════════════
// EXPIRY
// ══════════════════════════════════════════════

export function isOfferExpired(thread: SpecialOfferThread, now: Date = new Date()): boolean {
  if (TERMINAL_OFFER_STATUSES.includes(thread.status)) return false
  return new Date(thread.expiresAt) <= now
}

// ══════════════════════════════════════════════
// STATE TRANSITION VALIDATION
// ══════════════════════════════════════════════

export function isValidTransition(from: SpecialOfferStatus, to: SpecialOfferStatus): boolean {
  return VALID_OFFER_TRANSITIONS[from].includes(to)
}

export function isTerminal(status: SpecialOfferStatus): boolean {
  return TERMINAL_OFFER_STATUSES.includes(status)
}

// ══════════════════════════════════════════════
// DUPLICATE THREAD CHECK
// ══════════════════════════════════════════════

/**
 * Check if an active thread already exists for this buyer × asset × licence.
 * Only one active thread per context allowed.
 */
export function hasActiveThread(
  existingThreads: SpecialOfferThread[],
  buyerId: string,
  assetId: string,
  licenceType: string,
): boolean {
  return existingThreads.some(
    t =>
      t.buyerId === buyerId &&
      t.assetId === assetId &&
      t.licenceType === licenceType &&
      !TERMINAL_OFFER_STATUSES.includes(t.status),
  )
}

// ══════════════════════════════════════════════
// AUTO-CANCEL ELIGIBILITY
// ══════════════════════════════════════════════

/**
 * Should this thread be auto-cancelled based on current asset state?
 * Called when asset state changes (privacy, declaration, exclusive).
 */
export function shouldAutoCancel(
  thread: SpecialOfferThread,
  asset: VaultAsset,
): { cancel: boolean; reason?: SpecialOfferThread['autoCancelReason'] } {
  if (isTerminal(thread.status)) {
    return { cancel: false }
  }

  if (asset.privacy !== 'PUBLIC') {
    return { cancel: true, reason: 'privacy_changed' }
  }

  if (!asset.declarationState || !TRANSACTABLE_DECLARATION_STATES.includes(asset.declarationState)) {
    return { cancel: true, reason: 'declaration_non_transactable' }
  }

  if (asset.exclusiveLock) {
    return { cancel: true, reason: 'exclusive_activated' }
  }

  if (asset.creatorPrice == null || asset.creatorPrice <= 0) {
    return { cancel: true, reason: 'asset_delisted' }
  }

  return { cancel: false }
}

// ══════════════════════════════════════════════
// ACTOR VALIDATION
// ══════════════════════════════════════════════

export function isThreadBuyer(thread: SpecialOfferThread, actorId: string): boolean {
  return thread.buyerId === actorId
}

export function isThreadCreator(thread: SpecialOfferThread, actorId: string): boolean {
  return thread.creatorId === actorId
}

/** Prevent buyer from making an offer on their own asset */
export function isSelfOffer(buyerId: string, creatorId: string): boolean {
  return buyerId === creatorId
}
