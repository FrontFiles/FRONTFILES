/**
 * Direct Offer Engine — Services
 *
 * Server-authoritative business logic for Direct Offer negotiation.
 * All state mutations flow through these functions.
 *
 * Authority: Canonical Specification §10.4
 * Refs: FF-1100, FF-1101, FF-1102
 */

import type {
  SpecialOfferThread,
  SpecialOfferEvent,
  SpecialOfferAutoCancelReason,
  VaultAsset,
  LicenceType,
} from '@/lib/types'
import {
  SPECIAL_OFFER_MAX_ROUNDS,
  SPECIAL_OFFER_DEFAULT_RESPONSE_MINUTES,
} from '@/lib/types'
import type {
  CreateOfferInput,
  CounterOfferInput,
  AcceptOfferInput,
  DeclineOfferInput,
  OfferCheckoutIntent,
} from './types'
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
  isTerminal,
  hasActiveThread,
  shouldAutoCancel,
  isThreadBuyer,
  isThreadCreator,
  isSelfOffer,
} from './guards'

// ══════════════════════════════════════════════
// ID GENERATION
// ══════════════════════════════════════════════

let threadSeq = 0
let eventSeq = 0
let intentSeq = 0

function nextThreadId(): string {
  return `offer-thread-${String(++threadSeq).padStart(4, '0')}`
}
function nextEventId(): string {
  return `offer-event-${String(++eventSeq).padStart(6, '0')}`
}
function nextIntentId(): string {
  return `offer-intent-${String(++intentSeq).padStart(4, '0')}`
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function computeExpiresAt(responseWindowMinutes: number, from: Date = new Date()): string {
  return new Date(from.getTime() + responseWindowMinutes * 60_000).toISOString()
}

function appendEvent(
  events: SpecialOfferEvent[],
  threadId: string,
  type: SpecialOfferEvent['type'],
  actorId: string,
  amount: number | null = null,
  message: string | null = null,
  metadata: Record<string, unknown> | null = null,
): SpecialOfferEvent[] {
  const event: SpecialOfferEvent = {
    id: nextEventId(),
    threadId,
    type,
    actorId,
    amount,
    message: message?.trim() || null,
    metadata,
    createdAt: new Date().toISOString(),
  }
  return [...events, event]
}

// ══════════════════════════════════════════════
// DOMAIN ERROR
// ══════════════════════════════════════════════

export class SpecialOfferError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'SpecialOfferError'
  }
}

// ══════════════════════════════════════════════
// CREATE OFFER
// ══════════════════════════════════════════════

export function createOffer(
  input: CreateOfferInput,
  asset: VaultAsset,
  existingThreads: SpecialOfferThread[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[] } {
  // Self-offer check
  if (isSelfOffer(input.buyerId, input.creatorId)) {
    throw new SpecialOfferError('SELF_OFFER', 'Cannot make an offer on your own asset.')
  }

  // Asset eligibility
  const eligibility = checkAssetEligibility(asset)
  if (!eligibility.eligible) {
    throw new SpecialOfferError('ASSET_INELIGIBLE', eligibility.reason!)
  }

  // Licence must be enabled
  if (!asset.enabledLicences.includes(input.licenceType)) {
    throw new SpecialOfferError('LICENCE_NOT_ENABLED', `Licence type "${input.licenceType}" is not enabled for this asset.`)
  }

  // Duplicate thread check
  if (hasActiveThread(existingThreads, input.buyerId, input.assetId, input.licenceType)) {
    throw new SpecialOfferError('DUPLICATE_THREAD', 'An active offer already exists for this buyer, asset, and licence type.')
  }

  // Amount validation
  const amountCheck = validateOfferAmount(input.offerAmount, input.listedPrice)
  if (!amountCheck.eligible) {
    throw new SpecialOfferError('INVALID_AMOUNT', amountCheck.reason!)
  }

  // Response window
  const responseMinutes = input.responseWindowMinutes ?? SPECIAL_OFFER_DEFAULT_RESPONSE_MINUTES
  const windowCheck = validateResponseWindow(responseMinutes)
  if (!windowCheck.eligible) {
    throw new SpecialOfferError('INVALID_WINDOW', windowCheck.reason!)
  }

  const now = new Date()
  const threadId = nextThreadId()

  const thread: SpecialOfferThread = {
    id: threadId,
    assetId: input.assetId,
    buyerId: input.buyerId,
    creatorId: input.creatorId,
    licenceType: input.licenceType,
    listedPriceAtOpen: input.listedPrice,
    currentOfferAmount: input.offerAmount,
    currentOfferBy: 'buyer',
    roundCount: 1,
    creatorResponseWindowMinutes: responseMinutes,
    expiresAt: computeExpiresAt(responseMinutes, now),
    status: 'buyer_offer_pending_creator',
    acceptedAmount: null,
    checkoutIntentId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    resolvedAt: null,
    autoCancelReason: null,
  }

  const events = appendEvent([], threadId, 'buyer_offer', input.buyerId, input.offerAmount, input.message ?? null)

  return { thread, events }
}

// ══════════════════════════════════════════════
// CREATOR COUNTER
// ══════════════════════════════════════════════

export function creatorCounter(
  input: CounterOfferInput,
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[] } {
  if (!isThreadCreator(thread, input.actorId)) {
    throw new SpecialOfferError('NOT_CREATOR', 'Only the asset creator can counter.')
  }

  if (!canCreatorCounter(thread)) {
    if (isTerminal(thread.status)) {
      throw new SpecialOfferError('THREAD_RESOLVED', 'This offer thread is already resolved.')
    }
    if (!isCreatorTurn(thread)) {
      throw new SpecialOfferError('NOT_YOUR_TURN', 'It is not the creator\'s turn to respond.')
    }
    throw new SpecialOfferError('MAX_ROUNDS', `Maximum ${SPECIAL_OFFER_MAX_ROUNDS} counter rounds reached.`)
  }

  if (isOfferExpired(thread)) {
    throw new SpecialOfferError('OFFER_EXPIRED', 'The current offer has expired.')
  }

  const amountCheck = validateCounterAmount(input.amount, thread)
  if (!amountCheck.eligible) {
    throw new SpecialOfferError('INVALID_AMOUNT', amountCheck.reason!)
  }

  const now = new Date()
  const updatedThread: SpecialOfferThread = {
    ...thread,
    currentOfferAmount: input.amount,
    currentOfferBy: 'creator',
    roundCount: thread.roundCount + 1,
    expiresAt: computeExpiresAt(thread.creatorResponseWindowMinutes, now),
    status: 'creator_counter_pending_buyer',
    updatedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(events, thread.id, 'creator_counter', input.actorId, input.amount, input.message ?? null)

  return { thread: updatedThread, events: updatedEvents }
}

// ══════════════════════════════════════════════
// BUYER COUNTER
// ══════════════════════════════════════════════

export function buyerCounter(
  input: CounterOfferInput,
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[] } {
  if (!isThreadBuyer(thread, input.actorId)) {
    throw new SpecialOfferError('NOT_BUYER', 'Only the buyer can counter.')
  }

  if (!canBuyerCounter(thread)) {
    if (isTerminal(thread.status)) {
      throw new SpecialOfferError('THREAD_RESOLVED', 'This offer thread is already resolved.')
    }
    if (!isBuyerTurn(thread)) {
      throw new SpecialOfferError('NOT_YOUR_TURN', 'It is not the buyer\'s turn to respond.')
    }
    throw new SpecialOfferError('MAX_ROUNDS', `Maximum ${SPECIAL_OFFER_MAX_ROUNDS} counter rounds reached.`)
  }

  if (isOfferExpired(thread)) {
    throw new SpecialOfferError('OFFER_EXPIRED', 'The current offer has expired.')
  }

  const amountCheck = validateCounterAmount(input.amount, thread)
  if (!amountCheck.eligible) {
    throw new SpecialOfferError('INVALID_AMOUNT', amountCheck.reason!)
  }

  const now = new Date()
  const updatedThread: SpecialOfferThread = {
    ...thread,
    currentOfferAmount: input.amount,
    currentOfferBy: 'buyer',
    roundCount: thread.roundCount + 1,
    expiresAt: computeExpiresAt(thread.creatorResponseWindowMinutes, now),
    status: 'buyer_counter_pending_creator',
    updatedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(events, thread.id, 'buyer_counter', input.actorId, input.amount, input.message ?? null)

  return { thread: updatedThread, events: updatedEvents }
}

// ══════════════════════════════════════════════
// CREATOR ACCEPT
// ══════════════════════════════════════════════

export function creatorAccept(
  input: AcceptOfferInput,
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[]; checkoutIntent: OfferCheckoutIntent } {
  if (!isThreadCreator(thread, input.actorId)) {
    throw new SpecialOfferError('NOT_CREATOR', 'Only the asset creator can accept.')
  }

  if (!canCreatorAccept(thread)) {
    if (isTerminal(thread.status)) {
      throw new SpecialOfferError('THREAD_RESOLVED', 'This offer thread is already resolved.')
    }
    throw new SpecialOfferError('NOT_YOUR_TURN', 'It is not the creator\'s turn to respond.')
  }

  if (isOfferExpired(thread)) {
    throw new SpecialOfferError('OFFER_EXPIRED', 'The current offer has expired.')
  }

  const now = new Date()
  const intentId = nextIntentId()

  const checkoutIntent: OfferCheckoutIntent = {
    id: intentId,
    threadId: thread.id,
    assetId: thread.assetId,
    buyerId: thread.buyerId,
    creatorId: thread.creatorId,
    licenceType: thread.licenceType,
    negotiatedAmount: thread.currentOfferAmount,
    createdAt: now.toISOString(),
  }

  const updatedThread: SpecialOfferThread = {
    ...thread,
    status: 'accepted_pending_checkout',
    acceptedAmount: thread.currentOfferAmount,
    checkoutIntentId: intentId,
    updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(
    events,
    thread.id,
    'creator_accept',
    input.actorId,
    thread.currentOfferAmount,
    null,
    { checkoutIntentId: intentId },
  )

  return { thread: updatedThread, events: updatedEvents, checkoutIntent }
}

// ══════════════════════════════════════════════
// BUYER ACCEPT (accepts creator's counter)
// ══════════════════════════════════════════════

export function buyerAccept(
  input: AcceptOfferInput,
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[]; checkoutIntent: OfferCheckoutIntent } {
  if (!isThreadBuyer(thread, input.actorId)) {
    throw new SpecialOfferError('NOT_BUYER', 'Only the buyer can accept.')
  }

  if (!canBuyerAccept(thread)) {
    if (isTerminal(thread.status)) {
      throw new SpecialOfferError('THREAD_RESOLVED', 'This offer thread is already resolved.')
    }
    throw new SpecialOfferError('NOT_YOUR_TURN', 'It is not the buyer\'s turn to respond.')
  }

  if (isOfferExpired(thread)) {
    throw new SpecialOfferError('OFFER_EXPIRED', 'The current offer has expired.')
  }

  const now = new Date()
  const intentId = nextIntentId()

  const checkoutIntent: OfferCheckoutIntent = {
    id: intentId,
    threadId: thread.id,
    assetId: thread.assetId,
    buyerId: thread.buyerId,
    creatorId: thread.creatorId,
    licenceType: thread.licenceType,
    negotiatedAmount: thread.currentOfferAmount,
    createdAt: now.toISOString(),
  }

  const updatedThread: SpecialOfferThread = {
    ...thread,
    status: 'accepted_pending_checkout',
    acceptedAmount: thread.currentOfferAmount,
    checkoutIntentId: intentId,
    updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(
    events,
    thread.id,
    'buyer_accept',
    input.actorId,
    thread.currentOfferAmount,
    null,
    { checkoutIntentId: intentId },
  )

  return { thread: updatedThread, events: updatedEvents, checkoutIntent }
}

// ══════════════════════════════════════════════
// CREATOR DECLINE
// ══════════════════════════════════════════════

export function creatorDecline(
  input: DeclineOfferInput,
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[] } {
  if (!isThreadCreator(thread, input.actorId)) {
    throw new SpecialOfferError('NOT_CREATOR', 'Only the asset creator can decline.')
  }

  if (!canCreatorDecline(thread)) {
    if (isTerminal(thread.status)) {
      throw new SpecialOfferError('THREAD_RESOLVED', 'This offer thread is already resolved.')
    }
    throw new SpecialOfferError('NOT_YOUR_TURN', 'It is not the creator\'s turn to respond.')
  }

  const now = new Date()
  const updatedThread: SpecialOfferThread = {
    ...thread,
    status: 'declined',
    updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(events, thread.id, 'creator_decline', input.actorId, null, input.message ?? null)

  return { thread: updatedThread, events: updatedEvents }
}

// ══════════════════════════════════════════════
// EXPIRE
// ══════════════════════════════════════════════

export function expireOffer(
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[] } {
  if (isTerminal(thread.status)) {
    throw new SpecialOfferError('THREAD_RESOLVED', 'This offer thread is already resolved.')
  }

  if (!isOfferExpired(thread)) {
    throw new SpecialOfferError('NOT_EXPIRED', 'The current offer has not expired yet.')
  }

  const now = new Date()
  const updatedThread: SpecialOfferThread = {
    ...thread,
    status: 'expired',
    updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(events, thread.id, 'expired', 'system')

  return { thread: updatedThread, events: updatedEvents }
}

// ══════════════════════════════════════════════
// AUTO-CANCEL
// ══════════════════════════════════════════════

/**
 * Auto-cancel a thread due to asset state change.
 * Called centrally when asset state changes.
 */
export function autoCancelOffer(
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
  reason: SpecialOfferAutoCancelReason,
): { thread: SpecialOfferThread; events: SpecialOfferEvent[] } {
  if (isTerminal(thread.status)) {
    return { thread, events } // Already terminal — no-op
  }

  const now = new Date()
  const updatedThread: SpecialOfferThread = {
    ...thread,
    status: 'auto_cancelled',
    autoCancelReason: reason,
    updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(
    events,
    thread.id,
    'auto_cancelled',
    'system',
    null,
    null,
    { reason },
  )

  return { thread: updatedThread, events: updatedEvents }
}

// ══════════════════════════════════════════════
// AUTO-CANCEL ALL ACTIVE FOR ASSET
// ══════════════════════════════════════════════

/**
 * Cancel all active offer threads for an asset.
 * Called when asset state changes make it non-transactable.
 */
export function autoCancelAllForAsset(
  threads: SpecialOfferThread[],
  eventsMap: Map<string, SpecialOfferEvent[]>,
  asset: VaultAsset,
): { threads: SpecialOfferThread[]; eventsMap: Map<string, SpecialOfferEvent[]> } {
  const updatedThreads: SpecialOfferThread[] = []
  const updatedEventsMap = new Map(eventsMap)

  for (const thread of threads) {
    if (thread.assetId !== asset.id) {
      updatedThreads.push(thread)
      continue
    }

    const check = shouldAutoCancel(thread, asset)
    if (check.cancel && check.reason) {
      const result = autoCancelOffer(thread, eventsMap.get(thread.id) ?? [], check.reason)
      updatedThreads.push(result.thread)
      updatedEventsMap.set(thread.id, result.events)
    } else {
      updatedThreads.push(thread)
    }
  }

  return { threads: updatedThreads, eventsMap: updatedEventsMap }
}

// ══════════════════════════════════════════════
// COMPLETE (post-checkout)
// ══════════════════════════════════════════════

export function completeOffer(
  thread: SpecialOfferThread,
  events: SpecialOfferEvent[],
): { thread: SpecialOfferThread; events: SpecialOfferEvent[] } {
  if (thread.status !== 'accepted_pending_checkout') {
    throw new SpecialOfferError('INVALID_STATE', 'Can only complete an accepted offer pending checkout.')
  }

  const now = new Date()
  const updatedThread: SpecialOfferThread = {
    ...thread,
    status: 'completed',
    updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(),
  }

  const updatedEvents = appendEvent(events, thread.id, 'completed', 'system')

  return { thread: updatedThread, events: updatedEvents }
}
