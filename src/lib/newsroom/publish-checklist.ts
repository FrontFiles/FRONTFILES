/**
 * Frontfiles — Publish-precondition derivation (NR-D9b, F8)
 *
 * Pure server-side derivation: takes the publish-side substrate
 * (pack + warranty + embargo + asset aggregate + scan aggregate +
 * signing-key state) and returns the 7-row checklist + CTA state
 * + missing-items list per PRD §5.1 P10 verbatim.
 *
 * The derivation conceptually duplicates a subset of NR-D9a's
 * `newsroom_pack_transition` RPC's precondition checks. The two
 * MUST stay agreed — UI-disabled-state vs. RPC-rejection should
 * never disagree, or admins see "Publish now" then get a
 * preconditions-not-met error. Hand-synced in v1; v1.1 backlog
 * item "Transition matrix codegen" tracks the duplication.
 *
 * Boundary posture:
 *   - Server-only — no client component imports types or values
 *     from this file. F1 (shell) calls `derivePublishChecklist`
 *     server-side and passes ONLY the result shape (already plain
 *     JSON) to client children.
 *   - Zod schemas (`createWarrantySchema`, `transitionRequestSchema`)
 *     live here too — F6/F7 API routes import them. Clients
 *     send raw JSON; we parse on the server.
 *
 * PRD verbatim authority:
 *   - Item labels (lines 945–951): exact strings, ordered.
 *   - State strings (lines 948–951): "{n} scanning", "{n} flagged",
 *     "Missing on {n}", "Not confirmed", "N/A".
 *   - CTA label states (line 953): "Publish" (disabled) /
 *     "Publish now" / "Schedule".
 *
 * Spec cross-references:
 *   - directives/NR-D9b-publish-flow.md §F8
 *   - PRD.md §5.1 P10 (line 939) — checklist + CTA states
 *   - PRD.md §5.1 P9 (line 919) — warranty (3 booleans + narrative)
 *   - src/lib/newsroom/pack-transition.ts — RPC wrapper (NR-D9a)
 */

import 'server-only'

import { z } from 'zod'

import type {
  NewsroomEmbargoRow,
  NewsroomPackRow,
  NewsroomRightsWarrantyRow,
} from '@/lib/db/schema'

// ── Types ──────────────────────────────────────────────────────

/**
 * Discriminated render-state for a single checklist row.
 *
 *   ok      — "✓" renders
 *   missing — "✗" renders (publish-blocking)
 *   partial — `detail` renders (publish-blocking; non-binary state)
 *   na      — "N/A" renders (not-applicable; not blocking)
 */
export type ChecklistItemState = 'ok' | 'missing' | 'partial' | 'na'

export interface ChecklistItem {
  /** PRD §5.1 P10 verbatim label. */
  label: string
  state: ChecklistItemState
  /** Required when `state === 'partial'`; PRD-verbatim short string. */
  detail?: string
}

/**
 * Derivation input shape. The caller (F1 shell) is responsible for
 * fetching all of these in parallel and passing them in.
 *
 * `embargo` may include a recipient count; if not, recipientCount=0
 * is treated as "embargo missing recipient(s)".
 */
export interface DeriveChecklistInput {
  pack: NewsroomPackRow
  warranty: NewsroomRightsWarrantyRow | null
  embargo:
    | (Pick<NewsroomEmbargoRow, 'id' | 'lift_at' | 'policy_text'> & {
        recipientCount: number
      })
    | null
  assetCount: number
  imagesMissingAltCount: number
  /**
   * Aggregate by `newsroom_asset_scan_results.result`. Orphan rows
   * (asset present without a scan_result row) are not counted here;
   * the derivation infers them as `assetCount − (clean+pending+
   * flagged+error)` and treats them as "scanning" (PRD-aligned —
   * the asset hasn't yet had its scan_result row attached).
   */
  scanCounts: {
    pending: number
    clean: number
    flagged: number
    error: number
  }
  hasActiveSigningKey: boolean
}

export type CtaLabel = 'Publish' | 'Publish now' | 'Schedule'

export interface ChecklistResult {
  /** 7 rows in PRD-§5.1-P10 verbatim order. */
  items: ChecklistItem[]
  /**
   * CTA label per PRD line 953:
   *   any non-ok item OR no active signing key → 'Publish' (disabled)
   *   all ok, no embargo + no publish_at        → 'Publish now'
   *   all ok, embargo or publish_at present     → 'Schedule'
   */
  ctaLabel: CtaLabel
  ctaDisabled: boolean
  /**
   * Tooltip-list source. Includes labels of non-ok items PLUS
   * "Active signing key" when missing. Stable order:
   *   - non-ok items in checklist order
   *   - then "Active signing key" if missing
   */
  missing: ReadonlyArray<string>
}

// ── PRD-verbatim labels ────────────────────────────────────────

/**
 * PRD §5.1 P10 lines 945–951, in display order. Frozen so test
 * assertions can compare by reference and any silent edit fails
 * loudly.
 */
const CHECKLIST_LABELS = Object.freeze({
  TITLE_AND_CREDIT: 'Title and credit line',
  LICENCE_CLASS: 'Licence class',
  AT_LEAST_ONE_ASSET: 'At least one asset',
  ALL_ASSETS_SCANNED: 'All assets scanned clean',
  ALT_TEXT: 'Alt text on all images',
  WARRANTY: 'Rights warranty confirmed',
  EMBARGO: 'Embargo configured (if set)',
})

/**
 * Tooltip-only label, not rendered as a checklist row. Surfaces in
 * `missing[]` when no `newsroom_signing_keys` row has
 * `status='active'`. Mirrors the RPC's `no_active_signing_key`
 * precondition tag.
 */
const ACTIVE_SIGNING_KEY_LABEL = 'Active signing key'

// ── Derivation ─────────────────────────────────────────────────

/**
 * Compute the publish-checklist render state.
 *
 * Pure: same input → same output. Caller (F1) is responsible for
 * the I/O (fetching pack/warranty/embargo/asset aggregate/signing
 * keys); this function is a deterministic transform.
 *
 * Edge cases:
 *   - `assetCount === 0` — row 3 ("At least one asset") is missing;
 *     row 4 ("All assets scanned clean") is also missing (no assets
 *     to be clean), but reported as missing-not-partial since the
 *     PRD's partial states ("{n} scanning"/"{n} flagged") imply at
 *     least one asset.
 *   - Orphan asset (asset row exists, scan_result row missing) —
 *     counted as "scanning" for display; this matches the LEFT JOIN
 *     IS NULL semantics in NR-D9a's RPC precondition.
 *   - `error` scan result — conflated into the "{n} flagged" detail
 *     since both block publish and PRD has no "{n} error" state.
 *   - Embargo `lift_at` parse failure — extremely unlikely (DB
 *     stores ISO timestamptz); falls back to "missing list".
 */
export function derivePublishChecklist(
  input: DeriveChecklistInput,
): ChecklistResult {
  const {
    pack,
    warranty,
    embargo,
    assetCount,
    imagesMissingAltCount,
    scanCounts,
    hasActiveSigningKey,
  } = input

  const items: ChecklistItem[] = []

  // Row 1 — Title and credit line
  const titleSet = pack.title.trim().length > 0
  const creditSet = pack.credit_line.trim().length > 0
  items.push({
    label: CHECKLIST_LABELS.TITLE_AND_CREDIT,
    state: titleSet && creditSet ? 'ok' : 'missing',
  })

  // Row 2 — Licence class (NOT NULL in DB; defensive only)
  items.push({
    label: CHECKLIST_LABELS.LICENCE_CLASS,
    state: pack.licence_class ? 'ok' : 'missing',
  })

  // Row 3 — At least one asset
  items.push({
    label: CHECKLIST_LABELS.AT_LEAST_ONE_ASSET,
    state: assetCount >= 1 ? 'ok' : 'missing',
  })

  // Row 4 — All assets scanned clean
  // Rules:
  //   assetCount === 0          → 'missing' (no row 4 partial state
  //                                applies when there are no assets)
  //   clean === assetCount      → 'ok'
  //   any not-clean              → 'partial' with PRD-verbatim detail
  // Orphan rows = assetCount − (clean + pending + flagged + error).
  // Treated as "scanning" for display.
  if (assetCount === 0) {
    items.push({
      label: CHECKLIST_LABELS.ALL_ASSETS_SCANNED,
      state: 'missing',
    })
  } else if (scanCounts.clean === assetCount) {
    items.push({
      label: CHECKLIST_LABELS.ALL_ASSETS_SCANNED,
      state: 'ok',
    })
  } else {
    const orphanCount =
      assetCount -
      (scanCounts.clean +
        scanCounts.pending +
        scanCounts.flagged +
        scanCounts.error)
    const scanningCount = scanCounts.pending + Math.max(0, orphanCount)
    const flaggedCount = scanCounts.flagged + scanCounts.error
    let detail: string
    if (flaggedCount > 0) {
      detail = `${flaggedCount} flagged`
    } else {
      detail = `${scanningCount} scanning`
    }
    items.push({
      label: CHECKLIST_LABELS.ALL_ASSETS_SCANNED,
      state: 'partial',
      detail,
    })
  }

  // Row 5 — Alt text on all images
  if (imagesMissingAltCount === 0) {
    items.push({
      label: CHECKLIST_LABELS.ALT_TEXT,
      state: 'ok',
    })
  } else {
    items.push({
      label: CHECKLIST_LABELS.ALT_TEXT,
      state: 'partial',
      detail: `Missing on ${imagesMissingAltCount}`,
    })
  }

  // Row 6 — Rights warranty confirmed
  // Schema-level CHECK enforces all 3 booleans = true at INSERT, so
  // warranty existence ⇒ warranty fully confirmed. Null ⇒ "Not
  // confirmed" partial state.
  if (warranty !== null) {
    items.push({
      label: CHECKLIST_LABELS.WARRANTY,
      state: 'ok',
    })
  } else {
    items.push({
      label: CHECKLIST_LABELS.WARRANTY,
      state: 'partial',
      detail: 'Not confirmed',
    })
  }

  // Row 7 — Embargo configured (if set)
  // PRD line 951: "lift_at future, ≥ 1 recipient, policy_text
  // non-empty". State = ok | na | partial(missing list).
  if (embargo === null) {
    items.push({
      label: CHECKLIST_LABELS.EMBARGO,
      state: 'na',
    })
  } else {
    const issues: string[] = []
    const liftAtMs = Date.parse(embargo.lift_at)
    if (Number.isNaN(liftAtMs) || liftAtMs <= Date.now()) {
      issues.push('lift in past')
    }
    if (embargo.policy_text.trim().length === 0) {
      issues.push('no policy text')
    }
    if (embargo.recipientCount < 1) {
      issues.push('no recipients')
    }
    if (issues.length === 0) {
      items.push({
        label: CHECKLIST_LABELS.EMBARGO,
        state: 'ok',
      })
    } else {
      items.push({
        label: CHECKLIST_LABELS.EMBARGO,
        state: 'partial',
        detail: issues.join(', '),
      })
    }
  }

  // ── CTA derivation ────────────────────────────────────────────

  // An item is "blocking" if its state is anything other than 'ok'
  // or 'na' (na is for the embargo row when no embargo is set —
  // the absence of an embargo is not a publish blocker).
  const isBlocking = (item: ChecklistItem): boolean =>
    item.state !== 'ok' && item.state !== 'na'

  const blockingItems = items.filter(isBlocking)
  const blockingFromItems = blockingItems.length > 0
  const blocked = blockingFromItems || !hasActiveSigningKey

  // Tooltip list: non-ok item labels in checklist order, then
  // "Active signing key" if missing.
  const missingList: string[] = blockingItems.map((i) => i.label)
  if (!hasActiveSigningKey) {
    missingList.push(ACTIVE_SIGNING_KEY_LABEL)
  }

  let ctaLabel: CtaLabel
  if (blocked) {
    ctaLabel = 'Publish'
  } else if (embargo !== null || pack.publish_at !== null) {
    ctaLabel = 'Schedule'
  } else {
    ctaLabel = 'Publish now'
  }

  return {
    items,
    ctaLabel,
    ctaDisabled: blocked,
    missing: missingList,
  }
}

// ── Zod schemas (request bodies for F6 + F7) ───────────────────

/**
 * Request body for POST `/api/newsroom/orgs/[orgSlug]/packs/
 * [packSlug]/rights-warranty` (F6).
 *
 * All three booleans MUST be `true` — schema-level CHECK enforces
 * the same invariant at INSERT time, but the API layer rejects
 * earlier with a friendlier error than a 23514 leak.
 *
 * `narrative_text` is optional, ≤ 2000 chars (PRD §5.1 P9 has no
 * length cap; 2000 is a defensive bound to prevent abuse — well
 * above any plausible legitimate use).
 *
 * Note: `confirmed_by_user_id` is NOT in the request body; the
 * route handler sets it from the authenticated session. Mirrors
 * the RLS policy (`confirmed_by_user_id = auth.uid()`).
 */
export const createWarrantySchema = z.object({
  subject_releases_confirmed: z.literal(true),
  third_party_content_cleared: z.literal(true),
  music_cleared: z.literal(true),
  narrative_text: z.string().max(2000).nullable().optional(),
})

export type CreateWarrantyInput = z.infer<typeof createWarrantySchema>

/**
 * Request body for POST `/api/newsroom/orgs/[orgSlug]/packs/
 * [packSlug]/transition` (F7).
 *
 * Mirrors `TransitionInput` from `pack-transition.ts` minus the
 * `packId` (URL-derived) and `callerUserId` (session-derived).
 *
 * `targetStatus` enum is the *user-driven* subset — `takedown`
 * is admin-side and never arrives via this route. The RPC will
 * reject illegal transitions per its matrix; this schema only
 * narrows the surface to the legal client-driven targets.
 */
export const transitionRequestSchema = z.object({
  targetStatus: z.enum(['scheduled', 'published', 'draft', 'archived']),
  overrideEmbargoCancel: z.boolean().optional(),
})

export type TransitionRequestInput = z.infer<typeof transitionRequestSchema>
