/**
 * Frontfiles — Offer-surface domain types (P4 concern 4A.2 Part A)
 *
 * Pure TS shapes for the offer state machine. No runtime exports.
 * Runtime validators live in `./composer.ts` (pack composition +
 * payload builders) and `./rights.ts` (rights template registry +
 * schema).
 *
 * References:
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §2.3 — library
 *     decomposition (flat `src/lib/offer/`).
 *   - docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md — deliverables §A.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §4 — offer state machine.
 *     §7 — offer table shape + pack size (F9) + max-3-pending
 *     (§7 L152) + rights template identifier set (F15) +
 *     platform-fee rate-lock (F16).
 *   - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
 *     L61-66 (`offer_target_type` enum), L97-113 (`offers` table),
 *     L126-142 (`offer_assets` / `offer_briefs`), L163-170
 *     (`assignment_deliverables`).
 *
 * OfferTargetType is imported from the ledger schemas surface so
 * the offer lib stays in lockstep with the spec-bound enum. See
 * directive Step 2 — "DO NOT redeclare the union."
 */

import * as z from 'zod'

import { OfferCreatedPayloadSchema } from '@/lib/ledger/schemas'

// ─── Target type ──────────────────────────────────────────────────
//
// Derived from `OfferCreatedPayloadSchema.shape.target_type` to stay
// byte-exact with the ledger schemas' `TargetTypeSchema`, which in
// turn mirrors the `offer_target_type` Postgres ENUM. Any drift
// between the offer lib's union and the DDL will surface at the
// ledger-schemas boundary first — this indirection makes that
// explicit.
export type OfferTargetType = z.infer<
  typeof OfferCreatedPayloadSchema.shape.target_type
>

// ─── Offer state ──────────────────────────────────────────────────
//
// Six persisted values per spec §4. The `draft` state from §4 is
// explicitly client-only (never written to the `offers` table) and
// is NOT represented here — the offer surface loads rows from the
// DB, so every OfferState instance is one of the six.
export type OfferState =
  | 'sent'
  | 'countered'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled'

// ─── Platform fee basis points ────────────────────────────────────
//
// 0-10000 range (10000 = 100%). Runtime-validated via Zod in
// composer.ts. No branded type here — adds friction without
// catching more bugs at the current call-site density. Revisit in
// 4A.3+ if the fee-computation surface grows.
export type PlatformFeeBps = number

// ─── Rights template id (§F15) ────────────────────────────────────
//
// Three counsel-reviewed templates + `custom`. Part A ships the
// identifier + label + transfer-flag ONLY; counsel-final template
// bodies (clause copy + default params + jurisdictional carve-outs)
// land in Part C2 per directive §D dispatch gate.
export type RightsTemplateId =
  | 'editorial_one_time'
  | 'editorial_with_archive_12mo'
  | 'commercial_restricted'
  | 'custom'

// ─── Rights payload shape ─────────────────────────────────────────
//
// Part A admits `params` as an open record (spec-level opaqueness).
// Part C2 tightens `params` once counsel-final template bodies ship.
export type Rights = {
  template: RightsTemplateId
  params: Record<string, unknown>
  is_transfer: boolean
}

// ─── DB-row mirrors ───────────────────────────────────────────────
//
// Each type mirrors the column set of the corresponding Postgres
// table exactly. Used by `src/lib/offer/state.ts` guards (operate
// on already-loaded rows) and by Parts B1/B2 route handlers when
// they marshal Supabase responses. Dates are ISO-8601 strings at
// this layer — conversion happens in route handlers.

export type OfferRow = {
  id: string
  buyer_id: string
  creator_id: string
  target_type: OfferTargetType
  gross_fee: number
  platform_fee_bps: PlatformFeeBps
  currency: string
  rights: unknown
  current_note: string | null
  expires_at: string
  state: OfferState
  cancelled_by: string | null
  created_at: string
  updated_at: string
}

export type OfferAssetRow = {
  offer_id: string
  asset_id: string
  position: number
}

/** Matches the spec §7 `offer_briefs.spec` payload shape. */
export type OfferBriefSpec = {
  title: string
  deadline_offset_days: number
  deliverable_format: string
  revision_cap: number
  notes?: string
}

export type OfferBriefRow = {
  offer_id: string
  position: number
  spec: OfferBriefSpec
}

export type AssignmentDeliverableRow = {
  assignment_id: string
  piece_ref: string
  revision_cap: number
  revisions_used: number
  delivered_at: string | null
}

// ─── Party-profile view (consumed by /vault/offers/[id] UI) ──────
//
// Shape returned by `GET /api/offers/party-profiles` (P4 concern
// 4A.2.C1 §F1). Sourced from `public.users`, NOT from the
// ledger-pseudonym `actor_handles` table — the distinction lives at
// C1 directive §CONTEXT.
//
// `account_state` is widened to `string` per FLAG-38 (no speculative
// type-literal inference at cast boundary — the server controls the
// enum universe; the client accepts whatever ships today and any
// post-erasure scrub sentinels per `ECONOMIC_FLOW_v1.md §8.7.1`).
export type PartyProfile = {
  id: string
  username: string
  display_name: string
  account_state: string
}

// Keyed by `auth.users.id`. Lookups in `OfferDetailClient` pass the
// offer's `buyer_id` / `creator_id`; missing keys surface as a
// `string | undefined` at the consumer — party-scope fallback UI
// handles the `undefined` branch.
export type PartyProfileMap = Record<string, PartyProfile>

// ─── Event-trail view row (served by GET /api/offers/[id]) ───────
//
// UI-facing shape of a `ledger_events` row, with `actor_ref` (a
// `actor_handles.handle` uuid) resolved server-side to a role label.
// Role resolution is required because `actor_handles` RLS restricts
// a user-JWT client to reading only their OWN handle row, so the
// client cannot dereference counterparty `actor_ref` values on its
// own. The server — which knows `offer.buyer_id` + `offer.creator_id`
// + `actor.handle` — resolves per-event role at query time.
//
// `payload` is preserved verbatim (jsonb) for UI-side best-effort
// note extraction per directive §UI_DESIGN_GATE criterion 6
// (round-history event trail). Unknown shape at this layer; consumers
// inspect by `event_type`.
export type OfferEventActorRole = 'buyer' | 'creator' | 'system'

export type OfferEventViewRow = {
  id: string
  event_type: string
  actor_role: OfferEventActorRole
  created_at: string
  payload: unknown
}
