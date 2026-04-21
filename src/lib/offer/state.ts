/**
 * Frontfiles — Offer-surface state-transition guards (P4 concern
 * 4A.2 Part A)
 *
 * Pure identity / state-derivation predicates. No DB access. No
 * I/O. No React. The guards mirror the Postgres-side RPC guards in
 * `supabase/migrations/20260421000011_rpc_offer_business.sql` so
 * route handlers (Parts B1/B2) can return a clean 409/422 before
 * paying the RPC round-trip cost. The RPC is the authoritative
 * boundary; these are preflight only.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md §DELIVERABLES
 *     state.ts block — the IDENTITY CONTRACT (UUID-native) pinned
 *     in Draft 4. `actorUserId` is the `auth.users.id` /
 *     `session.user.id` UUID, NOT an actor_handles.handle. All
 *     identity comparisons are UUID-to-UUID against
 *     `OfferRow.buyer_id` / `OfferRow.creator_id`. Handles are a
 *     display concern and do NOT belong here.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §4 — offer state machine.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §7.1 — `ledger_events.actor_ref`
 *     is UUID.
 *   - D15 (system-actor filter on `rpc_cancel_offer` last-turn
 *     guard) — mirrored here as a CALLER contract: the Part B1
 *     route handler MUST filter the system-sentinel actor UUID
 *     `00000000-0000-0000-0000-000000000001` out of the "most
 *     recent non-system event" lookup before passing
 *     `lastEventActorRef` in. `canCancel` treats the value as
 *     already-filtered.
 */

import type { OfferRow } from './types'

// ─── Result shape ─────────────────────────────────────────────────

export type TransitionGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string }

// ─── Common state predicate ───────────────────────────────────────
//
// The four party-driven transitions (counter / accept / reject /
// cancel) all require the offer to be in 'sent' or 'countered'.
// Centralised so a future edit (e.g. adding 'under_review') touches
// one place.
const TRANSITIONABLE_STATES: ReadonlySet<OfferRow['state']> = new Set([
  'sent',
  'countered',
])

// ─── Guards ───────────────────────────────────────────────────────

/**
 * Is the actor allowed to counter this offer?
 *
 * Allowed iff:
 *   - offer.state ∈ {'sent','countered'}; AND
 *   - actorUserId ∈ {offer.buyer_id, offer.creator_id}.
 */
export function canCounter(args: {
  offer: OfferRow
  actorUserId: string
}): TransitionGuardResult {
  const { offer, actorUserId } = args
  if (!TRANSITIONABLE_STATES.has(offer.state)) {
    return { allowed: false, reason: `invalid_state: offer is ${offer.state}` }
  }
  if (actorUserId !== offer.buyer_id && actorUserId !== offer.creator_id) {
    return { allowed: false, reason: 'not_party' }
  }
  return { allowed: true }
}

/**
 * Is the actor allowed to accept this offer?
 *
 * Same state + party predicates as counter. The `rpc_accept_offer`
 * RPC is the authoritative boundary for any additional Stripe-
 * straddle concerns handled in Part B2.
 */
export function canAccept(args: {
  offer: OfferRow
  actorUserId: string
}): TransitionGuardResult {
  const { offer, actorUserId } = args
  if (!TRANSITIONABLE_STATES.has(offer.state)) {
    return { allowed: false, reason: `invalid_state: offer is ${offer.state}` }
  }
  if (actorUserId !== offer.buyer_id && actorUserId !== offer.creator_id) {
    return { allowed: false, reason: 'not_party' }
  }
  return { allowed: true }
}

/**
 * Is the actor allowed to reject this offer?
 *
 * Same state + party predicates as counter.
 */
export function canReject(args: {
  offer: OfferRow
  actorUserId: string
}): TransitionGuardResult {
  const { offer, actorUserId } = args
  if (!TRANSITIONABLE_STATES.has(offer.state)) {
    return { allowed: false, reason: `invalid_state: offer is ${offer.state}` }
  }
  if (actorUserId !== offer.buyer_id && actorUserId !== offer.creator_id) {
    return { allowed: false, reason: 'not_party' }
  }
  return { allowed: true }
}

/**
 * Is the buyer allowed to cancel this offer?
 *
 * Buyer-only per spec §4 ("Cancellation via dispute after accepted,
 * not offer cancellation"). Allowed iff:
 *   - offer.state ∈ {'sent','countered'};
 *   - actorUserId === offer.buyer_id;
 *   - lastEventActorRef is undefined OR equals offer.buyer_id
 *     (i.e. the last party action on the thread was the buyer's).
 *
 * CONTRACT on `lastEventActorRef` — per D15. The caller (Part B1
 * route handler) MUST apply the system-actor filter when loading
 * this value: look up the most-recent-non-system event on the
 * offer thread (filter out `actor_ref =
 * '00000000-0000-0000-0000-000000000001'`), and pass the surviving
 * `actor_ref` UUID. If no non-system events exist on the thread
 * (edge case that shouldn't happen post offer.created but defined
 * for safety), pass `undefined`. This mirrors the Postgres-side
 * filter in `rpc_cancel_offer`.
 */
export function canCancel(args: {
  offer: OfferRow
  actorUserId: string
  lastEventActorRef?: string
}): TransitionGuardResult {
  const { offer, actorUserId, lastEventActorRef } = args
  if (!TRANSITIONABLE_STATES.has(offer.state)) {
    return { allowed: false, reason: `invalid_state: offer is ${offer.state}` }
  }
  if (actorUserId !== offer.buyer_id) {
    return { allowed: false, reason: 'not_party: cancel is buyer-only' }
  }
  if (
    lastEventActorRef !== undefined &&
    lastEventActorRef !== offer.buyer_id
  ) {
    return { allowed: false, reason: 'not_last_turn' }
  }
  return { allowed: true }
}

/**
 * Is this offer expirable right now?
 *
 * No actor parameter — `rpc_expire_offer` is system-only and its
 * actor check is a literal sentinel match. This guard is a pure
 * time/state predicate useful for rendering (e.g. a banner that
 * reads "this offer will expire automatically" once the deadline
 * passes) and for the Part D cron preflight.
 *
 * `now` defaults to a `Date` on the current instant; callers pass
 * it explicitly for deterministic tests. Accepts `Date | number`;
 * numbers are treated as unix-ms timestamps.
 */
export function canExpire(args: {
  offer: OfferRow
  now?: Date | number
}): TransitionGuardResult {
  const { offer } = args
  const nowMs =
    args.now === undefined
      ? Date.now()
      : args.now instanceof Date
        ? args.now.getTime()
        : args.now
  if (!TRANSITIONABLE_STATES.has(offer.state)) {
    return { allowed: false, reason: `invalid_state: offer is ${offer.state}` }
  }
  if (Date.parse(offer.expires_at) >= nowMs) {
    return { allowed: false, reason: 'not_yet_expired' }
  }
  return { allowed: true }
}
