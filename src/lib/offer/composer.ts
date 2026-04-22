/**
 * Frontfiles — Offer pack composition + payload builders (P4 concern
 * 4A.2 Part A)
 *
 * Pure functions that:
 *   (1) validate pack composition (item count, targetType-shape
 *       match) against spec §F9 (1-20 items) and §7;
 *   (2) build the §8.1 `offer.created` and `offer.countered`
 *       payloads from a hydrated offer-row view.
 *
 * No fetch, no DB access, no React. The ledger schemas at
 * `@/lib/ledger/schemas` own the runtime Zod contract for the
 * payload shapes; the builders below produce TS values that
 * round-trip through those schemas.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md §DELIVERABLES
 *     composer.ts block.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §7 (offer shape), §8.1
 *     (`offer.created` / `offer.countered` payloads), §8.5
 *     (transition atomicity — the composition diff produced by
 *     `buildOfferCounteredPayload` is the TS-side equivalent of
 *     the Postgres-side child-table mutation), §F9 (pack size 1-20).
 */

import * as z from 'zod'

import type { EventPayload } from '@/lib/ledger/types'

import type {
  OfferBriefSpec,
  OfferTargetType,
  PlatformFeeBps,
  Rights,
} from './types'

// ─── Brief-spec runtime shape ─────────────────────────────────────
//
// Mirrors the §7 `offer_briefs.spec` jsonb contract. Validated at
// composition time because the composition payload is user-driven
// (buyer input in the v1 composer UI) and the DB trigger will
// raise on a mis-shaped row at INSERT time — better to reject
// upstream with a clean message.
const BriefSpecSchema = z
  .object({
    title: z.string().min(1),
    deadline_offset_days: z.number().int().positive(),
    deliverable_format: z.string().min(1),
    revision_cap: z.number().int().nonnegative(),
    notes: z.string().optional(),
  })
  .strict()

// ─── Pack composition validators ──────────────────────────────────

/** Narrow check that a value is a string UUID (v4 shape). */
const AssetIdSchema = z.string().uuid()

export type AssetItem = string
export type BriefItem = OfferBriefSpec

export type PackComposition =
  | { targetType: 'single_asset' | 'asset_pack'; items: AssetItem[] }
  | { targetType: 'single_brief' | 'brief_pack'; items: BriefItem[] }

export type PackErrCode =
  | 'invalid_target_type'
  | 'item_count_out_of_range'
  | 'item_shape_mismatch'

export type ValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: PackErrCode; message: string }

/**
 * Validate a pack composition.
 *
 *   - targetType ∈ the four enum values.
 *   - items length ∈ [1, 20] per §F9.
 *   - items are string UUIDs (asset packs) or brief specs (brief
 *     packs). Mis-shape → `item_shape_mismatch`.
 *
 * Same-creator checks against the asset table are NOT run here —
 * those live in the Postgres-side DDL trigger T1 (migration
 * 20260421000004 L265-298). This composer's job is pure shape
 * validation on caller input.
 */
export function validatePackComposition(args: {
  targetType: OfferTargetType
  items: unknown[]
}): ValidateResult<PackComposition> {
  const { targetType, items } = args

  const validTypes: readonly OfferTargetType[] = [
    'single_asset',
    'asset_pack',
    'single_brief',
    'brief_pack',
  ]
  if (!validTypes.includes(targetType)) {
    return {
      ok: false,
      code: 'invalid_target_type',
      message: `unknown target_type: ${String(targetType)}`,
    }
  }

  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    return {
      ok: false,
      code: 'item_count_out_of_range',
      message: `items length must be 1-20 per §F9; got ${
        Array.isArray(items) ? items.length : 'non-array'
      }`,
    }
  }

  if (targetType === 'single_asset' || targetType === 'asset_pack') {
    for (let i = 0; i < items.length; i++) {
      const parsed = AssetIdSchema.safeParse(items[i])
      if (!parsed.success) {
        return {
          ok: false,
          code: 'item_shape_mismatch',
          message: `items[${i}]: expected UUID string, got ${typeof items[i]}`,
        }
      }
    }
    return {
      ok: true,
      value: { targetType, items: items as AssetItem[] },
    }
  }

  // brief-pack paths
  const briefs: BriefItem[] = []
  for (let i = 0; i < items.length; i++) {
    const parsed = BriefSpecSchema.safeParse(items[i])
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((x) => `${x.path.join('.')}: ${x.message}`)
        .join('; ')
      return {
        ok: false,
        code: 'item_shape_mismatch',
        message: `items[${i}] brief-spec: ${detail}`,
      }
    }
    briefs.push(parsed.data)
  }
  return { ok: true, value: { targetType, items: briefs } }
}

// ─── Payload builders ─────────────────────────────────────────────

/**
 * Build an `offer.created` payload (§8.1). The returned value
 * round-trips through `OfferCreatedPayloadSchema` from
 * `@/lib/ledger/schemas`.
 *
 * `items` here is a string[]: for asset packs it's a list of
 * asset UUIDs, for brief packs it's a list of slot identifiers
 * (the composer's chosen brief refs — §8.2a piece_ref compatible).
 * The `offer_briefs.spec` jsonb DB rows are written directly by
 * the RPC from the original rich items, not from this payload —
 * the payload carries the abstracted `items` shape §8.1 pins.
 */
export function buildOfferCreatedPayload(args: {
  targetType: OfferTargetType
  items: readonly string[]
  grossFee: number
  platformFeeBps: PlatformFeeBps
  currency: string
  rights: Rights
  expiresAt: string
  note: string
}): EventPayload<'offer.created'> {
  return {
    v: 1,
    target_type: args.targetType,
    items: [...args.items],
    gross_fee: args.grossFee,
    platform_fee_bps: args.platformFeeBps,
    currency: args.currency,
    rights: args.rights,
    expires_at: args.expiresAt,
    note: args.note,
  }
}

/**
 * Build an `offer.countered` payload (§8.1) from a before/after
 * offer view.
 *
 * Computes the composition diff by set subtraction:
 *   added_items   = after.items ∖ before.items
 *   removed_items = before.items ∖ after.items
 *
 * Item identifiers are string-equality-compared. Caller is
 * responsible for ensuring the before/after item lists use the
 * same identifier space (both asset UUIDs or both brief slot
 * refs).
 */
export function buildOfferCounteredPayload(args: {
  byActorId: string
  before: {
    gross_fee: number
    items: readonly string[]
    rights: Rights
    current_note: string
  }
  after: {
    grossFee: number
    items: readonly string[]
    rights: Rights
    note: string
    expiresAt: string
  }
}): EventPayload<'offer.countered'> {
  const beforeSet = new Set(args.before.items)
  const afterSet = new Set(args.after.items)
  const added: string[] = []
  for (const id of args.after.items) {
    if (!beforeSet.has(id)) added.push(id)
  }
  const removed: string[] = []
  for (const id of args.before.items) {
    if (!afterSet.has(id)) removed.push(id)
  }

  // `rights_diff` stays open-shaped (spec §8.1 leaves it as jsonb).
  // The offer-domain RightsSchema tightens the `rights` field
  // itself; the *diff* across rights templates is a separate
  // structural concern deferred to 4A.3 per directive D9 / Part A
  // scope.
  const rightsDiff =
    JSON.stringify(args.before.rights) === JSON.stringify(args.after.rights)
      ? {}
      : { before: args.before.rights, after: args.after.rights }

  return {
    v: 1,
    by_actor_id: args.byActorId,
    fee_before: args.before.gross_fee,
    fee_after: args.after.grossFee,
    added_items: added,
    removed_items: removed,
    rights_diff: rightsDiff,
    note_before: args.before.current_note,
    note_after: args.after.note,
    expires_at: args.after.expiresAt,
  }
}

