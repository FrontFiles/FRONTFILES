/**
 * Direct Offer Engine — Types
 *
 * State machine types for server-authoritative price negotiation.
 * Authority: Canonical Specification §10.4
 *
 * One active thread per buyer × asset × licence context.
 * One live offer amount at a time. One clear turn at a time.
 */

import type {
  DirectOfferThread,
  DirectOfferEvent,
  DirectOfferStatus,
  DirectOfferEventType,
  DirectOfferAutoCancelReason,
  LicenceType,
  VaultAsset,
} from '@/lib/types'

// ══════════════════════════════════════════════
// ENGINE STATE
// ══════════════════════════════════════════════

export interface SpecialOfferEngineState {
  thread: DirectOfferThread | null
  events: DirectOfferEvent[]
}

// ══════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════

export type SpecialOfferAction =
  | { type: 'LOAD_THREAD'; thread: DirectOfferThread; events: DirectOfferEvent[] }
  | { type: 'BUYER_SUBMIT_OFFER'; amount: number; buyerId: string }
  | { type: 'CREATOR_COUNTER'; amount: number; creatorId: string }
  | { type: 'BUYER_COUNTER'; amount: number; buyerId: string }
  | { type: 'CREATOR_ACCEPT'; creatorId: string }
  | { type: 'BUYER_ACCEPT'; buyerId: string }
  | { type: 'CREATOR_DECLINE'; creatorId: string }
  | { type: 'EXPIRE' }
  | { type: 'AUTO_CANCEL'; reason: DirectOfferAutoCancelReason }
  | { type: 'CHECKOUT_STARTED'; checkoutIntentId: string }
  | { type: 'COMPLETE' }

// ══════════════════════════════════════════════
// VALID TRANSITIONS
// ══════════════════════════════════════════════

export const VALID_OFFER_TRANSITIONS: Record<DirectOfferStatus, DirectOfferStatus[]> = {
  buyer_offer_pending_creator: [
    'creator_counter_pending_buyer',
    'accepted_pending_checkout',
    'declined',
    'expired',
    'auto_cancelled',
  ],
  creator_counter_pending_buyer: [
    'buyer_counter_pending_creator',
    'accepted_pending_checkout',
    'expired',
    'auto_cancelled',
  ],
  buyer_counter_pending_creator: [
    'creator_counter_pending_buyer',
    'accepted_pending_checkout',
    'declined',
    'expired',
    'auto_cancelled',
  ],
  accepted_pending_checkout: [
    'completed',
    'auto_cancelled',
  ],
  declined: [],
  expired: [],
  auto_cancelled: [],
  completed: [],
}

// ══════════════════════════════════════════════
// OFFER CREATION INPUT
// ══════════════════════════════════════════════

export interface CreateOfferInput {
  assetId: string
  buyerId: string
  creatorId: string
  licenceType: LicenceType
  offerAmount: number // EUR cents
  listedPrice: number // EUR cents
  message?: string | null // negotiation note
  responseWindowMinutes?: number // default 240 (4h)
}

export interface CounterOfferInput {
  threadId: string
  actorId: string
  amount: number // EUR cents
  message?: string | null // counter-offer note
}

export interface AcceptOfferInput {
  threadId: string
  actorId: string
}

export interface DeclineOfferInput {
  threadId: string
  actorId: string
  message?: string | null // optional decline reason
}

// ══════════════════════════════════════════════
// ELIGIBILITY CHECK RESULT
// ══════════════════════════════════════════════

export interface EligibilityResult {
  eligible: boolean
  reason?: string
}

// ══════════════════════════════════════════════
// CHECKOUT HANDOFF
// ══════════════════════════════════════════════

export interface OfferCheckoutIntent {
  id: string
  threadId: string
  assetId: string
  buyerId: string
  creatorId: string
  licenceType: LicenceType
  negotiatedAmount: number // EUR cents — locked from accepted offer
  createdAt: string
}
