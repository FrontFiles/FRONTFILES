/**
 * Frontfiles — Ledger event payload schemas (P4 concern 4A.1)
 *
 * Zod runtime validators, one per event type. Pair-partner of
 * `./types.ts`. Consumed by `./writer.ts`'s `emitEvent()` before
 * the payload is handed to the `rpc_append_ledger_event` RPC.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §2.3 / §6.1 / §9.1.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8 (event catalogue preamble
 *     — payload discipline: transactional facts only, no PII).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.1 / §8.2 / §8.2a (payload
 *     tables — the single authoritative source for every field).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.3 (storage shape — the DB
 *     column `payload_version` is a separate surface from the
 *     in-payload `v` literal; schemas here only validate the
 *     `v` literal).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.6 (payload versioning —
 *     every event at v=1 today; pre-consumer exception allows
 *     in-place breaking changes at v=1 until P5).
 *   - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
 *     — `offer_target_type` enum (L61-66) and trigger shape.
 *
 * Namespace import: bundler- and runtime-safe across Next.js,
 * Vitest 4 / rolldown, and Bun. See `src/lib/env.ts` L31-36 for
 * the detailed rationale on why `import { z }` is unsafe here.
 */

import * as z from 'zod'

import type { EventType } from './types'

// ─── target_type enum — DDL-aligned ───────────────────────────────
//
// Mirrors `public.offer_target_type` ENUM in migration
// 20260421000004 L61-66 exactly. The DDL ships 4 values; the 4A.1
// directive speculated ['brief_pack', 'asset_pack'] but explicitly
// required verification against the DDL before finalising. Spec
// §8.1 / §8.2 do not enumerate the values inside the payload rows
// (they reference the column by name only), so the DDL is the
// authoritative source. Spec §9 naming locks corroborate all 4
// values ("Existing-work offer = asset-pack / single_asset.
// New-commission offer = brief-pack / single_brief.").
const TargetTypeSchema = z.enum([
  'single_asset',
  'asset_pack',
  'single_brief',
  'brief_pack',
])

// ─── piece_ref — loose pending 4A.3 tightening ────────────────────
//
// TODO(P4_CONCERN_4A_3): spec §8.2 does not pin piece_ref as a
// UUID — it may be an opaque reference (submission slot id, file
// hash, or composite key) depending on how 4A.3's assignment
// delivery state machine chooses to mint piece identifiers. Keep
// the Zod constraint loose here; 4A.3 directive will tighten to
// the final shape (UUID, prefixed ref, or otherwise) as its first
// task. `assignment_deliverables.piece_ref` is declared `text` in
// migration 20260421000004 L165, consistent with the loose shape.
const PieceRefSchema = z.string().min(1)

// ─── Per-event schemas (20 total) ─────────────────────────────────

/** spec §8.1 — `offer.created`. */
export const OfferCreatedPayloadSchema = z
  .object({
    v: z.literal(1),
    target_type: TargetTypeSchema,
    items: z.array(z.string()),
    gross_fee: z.number(),
    // basis points: 10000 = 100%. The DDL at L104 stores int with
    // no CHECK bound today; capping here catches obvious drift at
    // the app boundary without relying on the DB.
    platform_fee_bps: z.number().int().min(0).max(10000),
    currency: z.string().length(3),
    rights: z.unknown(),
    expires_at: z.string().datetime(),
    note: z.string(),
  })
  .strict()

/** spec §8.1 — `offer.countered`. */
export const OfferCounteredPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
    fee_before: z.number(),
    fee_after: z.number(),
    added_items: z.array(z.string()),
    removed_items: z.array(z.string()),
    rights_diff: z.unknown(),
    note_before: z.string(),
    note_after: z.string(),
    expires_at: z.string().datetime(),
  })
  .strict()

/** spec §8.1 — `offer.accepted`. */
export const OfferAcceptedPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
  })
  .strict()

/** spec §8.1 — `offer.rejected`. */
export const OfferRejectedPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid().optional(),
    reason: z.string(),
    affected_item_ids: z.array(z.string()).optional(),
  })
  .strict()

/** spec §8.1 — `offer.expired`. */
export const OfferExpiredPayloadSchema = z
  .object({
    v: z.literal(1),
    last_active_actor_id: z.string().uuid(),
  })
  .strict()

/** spec §8.1 — `offer.cancelled`. */
export const OfferCancelledPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
  })
  .strict()

/** spec §8.2 — `assignment.created`. */
export const AssignmentCreatedPayloadSchema = z
  .object({
    v: z.literal(1),
    offer_id: z.string().uuid(),
    target_type: TargetTypeSchema,
    expected_piece_count: z.number().int().nonnegative(),
  })
  .strict()

/** spec §8.2 — `assignment.piece_delivered`. */
export const AssignmentPieceDeliveredPayloadSchema = z
  .object({
    v: z.literal(1),
    piece_ref: PieceRefSchema,
    submitted_at: z.string().datetime(),
  })
  .strict()

/** spec §8.2 — `assignment.delivered`. */
export const AssignmentDeliveredPayloadSchema = z
  .object({
    v: z.literal(1),
    at: z.string().datetime(),
  })
  .strict()

/** spec §8.2 — `assignment.revision_requested`. */
export const AssignmentRevisionRequestedPayloadSchema = z
  .object({
    v: z.literal(1),
    piece_ref: PieceRefSchema,
    note: z.string(),
    rounds_used: z.number().int().nonnegative(),
    rounds_remaining: z.number().int().nonnegative(),
  })
  .strict()

/** spec §8.2 — `assignment.accepted_by_buyer`. */
export const AssignmentAcceptedByBuyerPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
    auto: z.boolean(),
  })
  .strict()

/** spec §8.2 — `assignment.cashed_out`. */
export const AssignmentCashedOutPayloadSchema = z
  .object({
    v: z.literal(1),
    amount: z.number(),
    net_to_creator: z.number(),
    payment_ref: z.string(),
  })
  .strict()

/** spec §8.2 — `assignment.disputed`. */
export const AssignmentDisputedPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
    reason: z.string(),
    evidence_refs: z.array(z.string()),
  })
  .strict()

/** spec §8.2 — `assignment.refunded`. */
export const AssignmentRefundedPayloadSchema = z
  .object({
    v: z.literal(1),
    amount_to_buyer: z.number(),
    rationale: z.string(),
  })
  .strict()

/** spec §8.2 — `assignment.split`. */
export const AssignmentSplitPayloadSchema = z
  .object({
    v: z.literal(1),
    amount_to_creator: z.number(),
    amount_to_buyer: z.number(),
    rationale: z.string(),
  })
  .strict()

/** spec §8.2a — `dispute.opened`. */
export const DisputeOpenedPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
    assignment_id: z.string().uuid(),
    reason: z.string(),
    evidence_refs: z.array(z.string()),
  })
  .strict()

/** spec §8.2a — `dispute.evidence_submitted`. */
export const DisputeEvidenceSubmittedPayloadSchema = z
  .object({
    v: z.literal(1),
    submitter_actor_handle: z.string().uuid(),
    evidence_ref: z.string(),
    evidence_type: z.enum([
      'asset_file',
      'text_statement',
      'external_link',
      'other',
    ]),
    submitted_at: z.string().datetime(),
  })
  .strict()

/** spec §8.2a — `dispute.resolved`. */
export const DisputeResolvedPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
    outcome: z.enum(['accepted_by_buyer', 'refunded', 'split']),
    amount_to_buyer: z.number().optional(),
    amount_to_creator: z.number().optional(),
    rationale: z.string(),
  })
  .strict()

/** spec §8.2a — `dispute.appealed`. */
export const DisputeAppealedPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
    grounds: z.string(),
  })
  .strict()

/** spec §8.2a — `dispute.appeal_resolved`. */
export const DisputeAppealResolvedPayloadSchema = z
  .object({
    v: z.literal(1),
    by_actor_id: z.string().uuid(),
    outcome: z.enum(['accepted_by_buyer', 'refunded', 'split']),
    rationale: z.string(),
  })
  .strict()

// ─── Dispatch map — every `EventType` literal maps to its schema ──

export const EventPayloadSchemas = {
  'offer.created': OfferCreatedPayloadSchema,
  'offer.countered': OfferCounteredPayloadSchema,
  'offer.accepted': OfferAcceptedPayloadSchema,
  'offer.rejected': OfferRejectedPayloadSchema,
  'offer.expired': OfferExpiredPayloadSchema,
  'offer.cancelled': OfferCancelledPayloadSchema,
  'assignment.created': AssignmentCreatedPayloadSchema,
  'assignment.piece_delivered': AssignmentPieceDeliveredPayloadSchema,
  'assignment.delivered': AssignmentDeliveredPayloadSchema,
  'assignment.revision_requested': AssignmentRevisionRequestedPayloadSchema,
  'assignment.accepted_by_buyer': AssignmentAcceptedByBuyerPayloadSchema,
  'assignment.cashed_out': AssignmentCashedOutPayloadSchema,
  'assignment.disputed': AssignmentDisputedPayloadSchema,
  'assignment.refunded': AssignmentRefundedPayloadSchema,
  'assignment.split': AssignmentSplitPayloadSchema,
  'dispute.opened': DisputeOpenedPayloadSchema,
  'dispute.evidence_submitted': DisputeEvidenceSubmittedPayloadSchema,
  'dispute.resolved': DisputeResolvedPayloadSchema,
  'dispute.appealed': DisputeAppealedPayloadSchema,
  'dispute.appeal_resolved': DisputeAppealResolvedPayloadSchema,
} as const satisfies Record<EventType, z.ZodTypeAny>

// Compile-time + runtime belt-and-braces: the `satisfies` check
// above is compile-time; this is the runtime counterpart so a
// missing key surfaces at module load, not at first emission.
const _allEventTypes: ReadonlyArray<EventType> = [
  'offer.created',
  'offer.countered',
  'offer.accepted',
  'offer.rejected',
  'offer.expired',
  'offer.cancelled',
  'assignment.created',
  'assignment.piece_delivered',
  'assignment.delivered',
  'assignment.revision_requested',
  'assignment.accepted_by_buyer',
  'assignment.cashed_out',
  'assignment.disputed',
  'assignment.refunded',
  'assignment.split',
  'dispute.opened',
  'dispute.evidence_submitted',
  'dispute.resolved',
  'dispute.appealed',
  'dispute.appeal_resolved',
]
for (const t of _allEventTypes) {
  if (!(t in EventPayloadSchemas)) {
    throw new Error(`EventPayloadSchemas missing key: ${t}`)
  }
}
