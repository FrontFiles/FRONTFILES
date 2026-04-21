/**
 * Frontfiles — Ledger event types (P4 concern 4A.1)
 *
 * TypeScript-side shape for the 20 ledger event types defined by the
 * economic flow spec. Pure types; no runtime exports. Zod schemas
 * for runtime validation live beside this file in `./schemas.ts`,
 * and the writer that uses both lives in `./writer.ts`.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §2.3 (library path
 *     choice: flat `src/lib/ledger/`, not `src/lib/economic-flow/`).
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1 (writer / types
 *     division of labour — hash chain is Postgres-side).
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §9.1 (4A.1 scope).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8 (event catalogue overview).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.1 / §8.2 / §8.2a (payload
 *     tables sourced verbatim for the 6 offer / 9 assignment / 5
 *     dispute event types).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.3 (storage shape — the TS
 *     side here mirrors only the `payload` jsonb contents).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.6 (payload versioning —
 *     every event starts at `v: 1`; the pre-consumer exception
 *     explicitly allows in-place breaking changes at v=1 until the
 *     first production consumer ships at P5).
 *
 * Note on `rights` / `rights_diff`: typed as `unknown` (not `any`)
 * pending the rights template registry work deferred to 4A.2 per
 * design lock §2.3 / decision D7 in the 4A.1 directive. Tightening
 * these shapes in 4A.1 would force a schema migration at 4A.2; the
 * §8.6 pre-consumer exception makes the later tightening safe.
 */

export type ThreadType = 'offer' | 'assignment' | 'dispute'

export type EventType =
  | 'offer.created'
  | 'offer.countered'
  | 'offer.accepted'
  | 'offer.rejected'
  | 'offer.expired'
  | 'offer.cancelled'
  | 'assignment.created'
  | 'assignment.piece_delivered'
  | 'assignment.delivered'
  | 'assignment.revision_requested'
  | 'assignment.accepted_by_buyer'
  | 'assignment.cashed_out'
  | 'assignment.disputed'
  | 'assignment.refunded'
  | 'assignment.split'
  | 'dispute.opened'
  | 'dispute.evidence_submitted'
  | 'dispute.resolved'
  | 'dispute.appealed'
  | 'dispute.appeal_resolved'

// ─── Payload shapes — mirror spec §8.1 / §8.2 / §8.2a rows ────────
//
// Every payload carries an embedded `v: 1` literal. The DB column
// `payload_version` (text, default 'v1') is a separate surface owned
// by the writer; do NOT conflate the two. See writer.ts for the
// hard-coded 'v1' row-level value the writer passes at this stage.

/** spec §8.1 — `offer.created`. */
export type OfferCreatedPayload = {
  v: 1
  target_type: 'single_asset' | 'asset_pack' | 'single_brief' | 'brief_pack'
  items: readonly string[]
  gross_fee: number
  platform_fee_bps: number
  currency: string
  rights: unknown
  expires_at: string
  note: string
}

/** spec §8.1 — `offer.countered`. */
export type OfferCounteredPayload = {
  v: 1
  by_actor_id: string
  fee_before: number
  fee_after: number
  added_items: readonly string[]
  removed_items: readonly string[]
  rights_diff: unknown
  note_before: string
  note_after: string
  expires_at: string
}

/** spec §8.1 — `offer.accepted`. */
export type OfferAcceptedPayload = {
  v: 1
  by_actor_id: string
}

/** spec §8.1 — `offer.rejected`. */
export type OfferRejectedPayload = {
  v: 1
  by_actor_id?: string
  reason: string
  affected_item_ids?: readonly string[]
}

/** spec §8.1 — `offer.expired`. */
export type OfferExpiredPayload = {
  v: 1
  last_active_actor_id: string
}

/** spec §8.1 — `offer.cancelled`. */
export type OfferCancelledPayload = {
  v: 1
  by_actor_id: string
}

/** spec §8.2 — `assignment.created`. */
export type AssignmentCreatedPayload = {
  v: 1
  offer_id: string
  target_type: 'single_asset' | 'asset_pack' | 'single_brief' | 'brief_pack'
  expected_piece_count: number
}

/** spec §8.2 — `assignment.piece_delivered`. */
export type AssignmentPieceDeliveredPayload = {
  v: 1
  piece_ref: string
  submitted_at: string
}

/** spec §8.2 — `assignment.delivered`. */
export type AssignmentDeliveredPayload = {
  v: 1
  at: string
}

/** spec §8.2 — `assignment.revision_requested`. */
export type AssignmentRevisionRequestedPayload = {
  v: 1
  piece_ref: string
  note: string
  rounds_used: number
  rounds_remaining: number
}

/** spec §8.2 — `assignment.accepted_by_buyer`. */
export type AssignmentAcceptedByBuyerPayload = {
  v: 1
  by_actor_id: string
  auto: boolean
}

/** spec §8.2 — `assignment.cashed_out`. */
export type AssignmentCashedOutPayload = {
  v: 1
  amount: number
  net_to_creator: number
  payment_ref: string
}

/** spec §8.2 — `assignment.disputed`. */
export type AssignmentDisputedPayload = {
  v: 1
  by_actor_id: string
  reason: string
  evidence_refs: readonly string[]
}

/** spec §8.2 — `assignment.refunded`. */
export type AssignmentRefundedPayload = {
  v: 1
  amount_to_buyer: number
  rationale: string
}

/** spec §8.2 — `assignment.split`. */
export type AssignmentSplitPayload = {
  v: 1
  amount_to_creator: number
  amount_to_buyer: number
  rationale: string
}

/** spec §8.2a — `dispute.opened`. */
export type DisputeOpenedPayload = {
  v: 1
  by_actor_id: string
  assignment_id: string
  reason: string
  evidence_refs: readonly string[]
}

/** spec §8.2a — `dispute.evidence_submitted`. */
export type DisputeEvidenceSubmittedPayload = {
  v: 1
  submitter_actor_handle: string
  evidence_ref: string
  evidence_type: 'asset_file' | 'text_statement' | 'external_link' | 'other'
  submitted_at: string
}

/** spec §8.2a — `dispute.resolved`. */
export type DisputeResolvedPayload = {
  v: 1
  by_actor_id: string
  outcome: 'accepted_by_buyer' | 'refunded' | 'split'
  amount_to_buyer?: number
  amount_to_creator?: number
  rationale: string
}

/** spec §8.2a — `dispute.appealed`. */
export type DisputeAppealedPayload = {
  v: 1
  by_actor_id: string
  grounds: string
}

/** spec §8.2a — `dispute.appeal_resolved`. */
export type DisputeAppealResolvedPayload = {
  v: 1
  by_actor_id: string
  outcome: 'accepted_by_buyer' | 'refunded' | 'split'
  rationale: string
}

/**
 * Conditional map from each `EventType` literal to its payload shape.
 * Keeps writer.ts's `EmitEventArgs<T>` fully type-narrowed at the
 * call site.
 */
export type EventPayload<T extends EventType> =
  T extends 'offer.created' ? OfferCreatedPayload :
  T extends 'offer.countered' ? OfferCounteredPayload :
  T extends 'offer.accepted' ? OfferAcceptedPayload :
  T extends 'offer.rejected' ? OfferRejectedPayload :
  T extends 'offer.expired' ? OfferExpiredPayload :
  T extends 'offer.cancelled' ? OfferCancelledPayload :
  T extends 'assignment.created' ? AssignmentCreatedPayload :
  T extends 'assignment.piece_delivered' ? AssignmentPieceDeliveredPayload :
  T extends 'assignment.delivered' ? AssignmentDeliveredPayload :
  T extends 'assignment.revision_requested' ? AssignmentRevisionRequestedPayload :
  T extends 'assignment.accepted_by_buyer' ? AssignmentAcceptedByBuyerPayload :
  T extends 'assignment.cashed_out' ? AssignmentCashedOutPayload :
  T extends 'assignment.disputed' ? AssignmentDisputedPayload :
  T extends 'assignment.refunded' ? AssignmentRefundedPayload :
  T extends 'assignment.split' ? AssignmentSplitPayload :
  T extends 'dispute.opened' ? DisputeOpenedPayload :
  T extends 'dispute.evidence_submitted' ? DisputeEvidenceSubmittedPayload :
  T extends 'dispute.resolved' ? DisputeResolvedPayload :
  T extends 'dispute.appealed' ? DisputeAppealedPayload :
  T extends 'dispute.appeal_resolved' ? DisputeAppealResolvedPayload :
  never
