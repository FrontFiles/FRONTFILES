/**
 * Frontfiles Upload V4 — ✓ AI dispatch sequencer (D2.5 §6.4 + E6.B updates)
 *
 * Pure helper. Given the current state and the multi-selection, returns the
 * ordered list of dispatches that the ContextualActionBar's ✓ AI button
 * needs to execute.
 *
 * E6.B updates per E6-DIRECTIVE.md §6.5 + §9:
 *   - Per-field threshold: each field's confidence is checked individually
 *     (description_confidence / tags_confidence) against the auto-accept
 *     threshold; falls back to the deprecated overall `confidence` when the
 *     per-field is undefined (pre-E3 fixtures + simulation parity).
 *   - 'keywords' added to the BULK_ACCEPT telemetry (audit-trail only;
 *     keywords has no canonical column on AssetEditableFields in v1).
 *   - 'geography' REMOVED — geography comes from EXIF GPS extraction, not
 *     the AI pipeline (per E6 §6.5 reconciliation).
 *
 * Sequence per spec UX-SPEC-V4 §9.4 + D2.5-DIRECTIVE §6.4 + E6.B:
 *   1. ONE BULK_ACCEPT_PROPOSALS_FOR_SELECTION for telemetry — fields list
 *      ['caption', 'keywords', 'tags'] (geography removed).
 *   2. PER selected asset with a non-null proposal, sequenced
 *      UPDATE_ASSET_FIELD writes for description (caption) and tags only
 *      when (a) per-field confidence ≥ threshold AND (b) proposal value
 *      is non-null AND (c) differs from the current editable value.
 *
 * NEVER price (founder lock L6: AI auto-accept never touches price).
 *
 * Pure / deterministic / no React — hostable in Node test env.
 */

import type { V3State, V3Action } from '@/lib/upload/v3-types'

/**
 * Narrowed dispatch types this helper emits.
 *
 * Subtype of V3Action so the consumer can spread the result directly into
 * dispatch() without casting.
 */
export type AutoAcceptDispatch =
  | Extract<V3Action, { type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION' }>
  | Extract<V3Action, { type: 'UPDATE_ASSET_FIELD' }>

/** Per UX-SPEC-V4 IPV4-5 + ai_pipeline_settings.auto_accept_threshold. */
export const DEFAULT_AUTO_ACCEPT_THRESHOLD = 0.85

/**
 * Computes the ✓ AI dispatch sequence.
 *
 * Returns an empty array when no selected asset has a proposal — the caller
 * should disable the ✓ AI button in that case so the empty-array path is
 * defensive only.
 *
 * @param threshold — per-field auto-accept threshold (default 0.85). Real-mode
 *                    callers should read `ai_pipeline_settings.auto_accept_threshold`
 *                    via the bootstrap hydration; mock-mode uses the default.
 */
export function computeAcceptAIDispatches(
  state: V3State,
  selectedAssetIds: string[],
  threshold: number = DEFAULT_AUTO_ACCEPT_THRESHOLD,
): AutoAcceptDispatch[] {
  const dispatches: AutoAcceptDispatch[] = []

  // Subset of selection that actually has a proposal.
  const idsWithProposal: string[] = []
  for (const id of selectedAssetIds) {
    const asset = state.assetsById[id]
    if (asset && asset.proposal) idsWithProposal.push(id)
  }
  if (idsWithProposal.length === 0) return dispatches

  // (1) Telemetry no-op — fields list per E6 §6.5: caption + keywords + tags
  //     (geography removed; not from AI pipeline).
  dispatches.push({
    type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
    assetIds: idsWithProposal,
    fields: ['caption', 'keywords', 'tags'],
  })

  // (2) Sequenced writes per asset. Per-field threshold check using
  //     per-field confidence (fallback to overall `confidence` when the
  //     per-field is undefined — pre-E3 simulation fixtures).
  for (const id of idsWithProposal) {
    const asset = state.assetsById[id]
    if (!asset || !asset.proposal) continue
    const p = asset.proposal
    const e = asset.editable

    // Caption (proposal.description → editable.description)
    const captionConfidence = p.description_confidence ?? p.confidence
    if (
      captionConfidence >= threshold &&
      p.description != null &&
      p.description !== e.description
    ) {
      dispatches.push({
        type: 'UPDATE_ASSET_FIELD',
        assetId: id,
        field: 'description',
        value: p.description,
      })
    }

    // Tags — array; compare by JSON shape (length + ordered values).
    const tagsConfidence = p.tags_confidence ?? p.confidence
    if (
      tagsConfidence >= threshold &&
      p.tags != null &&
      !arraysEqual(p.tags, e.tags)
    ) {
      dispatches.push({
        type: 'UPDATE_ASSET_FIELD',
        assetId: id,
        field: 'tags',
        value: p.tags,
      })
    }

    // Keywords: NOT dispatched as UPDATE_ASSET_FIELD because
    // AssetEditableFields has no 'keywords' field in v1. The accept event
    // is captured in the BULK_ACCEPT telemetry above for audit-trail
    // completeness; no canonical metadata write per E6 §7.2.

    // Geography: REMOVED per E6 §6.5 — geography comes from EXIF GPS,
    // not the AI pipeline. Not dispatched here.
  }

  return dispatches
}

/** Shallow equality for primitive-element arrays (strings, numbers). */
function arraysEqual<T extends string | number>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
