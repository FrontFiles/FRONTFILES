// ═══════════════════════════════════════════════════════════════
// Frontfiles — OfferActions (P4 concern 4A.2.C2 Prompt 4 / §F4)
//
// Button strip for the offer-detail surface. Renders accept /
// counter / reject / cancel buttons per the §SCOPE item 5
// visibility matrix, composing the state-transition guards from
// `@/lib/offer/state` (`canAccept`, `canCounter`, `canReject`,
// `canCancel`) with an "awaiting party" derivation driven by the
// `lastEventActorRef` prop.
//
// ─── Architecture (§R6-pure) ────────────────────────────────────
//
// Pure component: no hooks, no fetch, no effects. Parent
// (`OfferDetailClient`, Prompt 6) owns state and passes four
// mutation handlers + the mutation state.
//
// ─── Visibility matrix (§SCOPE item 5) ──────────────────────────
//
// Accept / Counter / Reject — visible when:
//   1. The corresponding guard returns `allowed: true`, AND
//   2. The viewer is the "awaiting party" (last non-system event
//      actor was the OTHER party).
//
// Cancel — visible when `canCancel` returns `allowed: true`
// (buyer-only, buyer-last-actor, state ∈ {sent,countered}). The
// "viewer is last proposer" condition from the directive is
// subsumed by `canCancel`'s `lastEventActorRef === buyer_id`
// clause.
//
// Buyer-only rules (accept, cancel) are enforced at the guard
// layer per B2 D12 — the RPC is the authoritative boundary and
// the UI mirrors it so no button appears that would always error.
//
// ─── Styling (§F9 / Design Canon §4.1–§4.3) ─────────────────────
//
// Plain `<button>` elements with `border border-black` baseline.
// No rounded corners. Three colors only (black / blue / white);
// destructive maps to black, not red.
// ═══════════════════════════════════════════════════════════════

'use client'

import { type ReactElement } from 'react'

import type { OfferRow } from '@/lib/offer'
import { canAccept, canCancel, canCounter, canReject } from '@/lib/offer/state'

export type OfferActionsMutationState = 'idle' | 'submitting' | 'error'

export interface OfferActionsProps {
  offer: OfferRow
  /** `auth.users.id` of the caller. */
  selfUserId: string
  /**
   * UUID of the last non-system event actor on the thread. Parent
   * (`OfferDetailClient`) is responsible for deriving this from
   * the events list with the system-sentinel filter per state.ts
   * D15 contract. Pass `null` if no non-system events exist yet
   * (edge case that shouldn't happen post `offers.created`).
   */
  lastEventActorRef: string | null
  mutationState: OfferActionsMutationState
  onAccept: () => void
  onCounter: () => void
  onReject: () => void
  onCancel: () => void
}

const BUTTON_CLASS = [
  'border border-black px-4 py-2',
  'text-[10px] font-bold uppercase tracking-widest text-black',
  'hover:bg-black hover:text-white transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black',
].join(' ')

export function OfferActions(props: OfferActionsProps): ReactElement {
  const {
    offer,
    selfUserId,
    lastEventActorRef,
    mutationState,
    onAccept,
    onCounter,
    onReject,
    onCancel,
  } = props

  const disabled = mutationState === 'submitting'

  // Awaiting party = viewer is NOT the last actor. When there is
  // no `lastEventActorRef` (edge case), nobody is awaiting, which
  // collapses the visibility of accept/counter/reject to zero —
  // safe fallback. Cancel visibility uses its own guard directly
  // so it is unaffected.
  const viewerIsAwaiting =
    lastEventActorRef !== null && lastEventActorRef !== selfUserId

  const showAccept =
    canAccept({ offer, actorUserId: selfUserId }).allowed && viewerIsAwaiting
  const showCounter =
    canCounter({ offer, actorUserId: selfUserId }).allowed && viewerIsAwaiting
  const showReject =
    canReject({ offer, actorUserId: selfUserId }).allowed && viewerIsAwaiting
  const showCancel = canCancel({
    offer,
    actorUserId: selfUserId,
    lastEventActorRef: lastEventActorRef ?? undefined,
  }).allowed

  return (
    <div className="flex gap-2 flex-wrap">
      {showAccept && (
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled}
          className={BUTTON_CLASS}
        >
          Accept
        </button>
      )}
      {showCounter && (
        <button
          type="button"
          onClick={onCounter}
          disabled={disabled}
          className={BUTTON_CLASS}
        >
          Counter
        </button>
      )}
      {showReject && (
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          className={BUTTON_CLASS}
        >
          Reject
        </button>
      )}
      {showCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className={BUTTON_CLASS}
        >
          Cancel
        </button>
      )}
    </div>
  )
}
