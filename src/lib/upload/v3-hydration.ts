/**
 * Frontfiles Upload V3 — Hydration
 *
 * Initial-state population for the V3 reducer. Two paths:
 *
 *   1. hydrateV3FromBatchId — fresh empty batch (used by the page-surface
 *      shell at app/vault/upload/page.tsx).
 *
 *   2. hydrateV3FromV2State — the bridge used by the parity test
 *      (v3-state-parity.test.ts). Takes an existing V2State produced by
 *      the legacy hydration path and rebuilds an equivalent V3State,
 *      preserving the V2Asset shape per UX-BRIEF v3 §4.7. Stage-era
 *      fields (currentStage, expressEligible, reviewEnteredEarly) drop
 *      out cleanly because they don't exist in V3State; selectors that
 *      depended on them (getExpressEligibility) are not extracted (per
 *      C2.1-DIRECTIVE §3.0) so the parity test doesn't compare them.
 */

import type { V3State } from './v3-types'
import { v3InitialState } from './v3-state'
// V2State is imported only by hydrateV3FromV2State (parity bridge).
// This is the single intentional cross-version coupling and is bounded
// to the hydration path.
import type { V2State, V2Asset, V2StoryGroup } from './v2-types'
import { densityForCount } from './v3-types'

/**
 * D2.1 — AI auto-accept threshold (per UX-SPEC-V4 §11.1 + IPV4-5 + IPD1-2).
 *
 * At hydration time, for each asset whose proposal carries confidence ≥ this
 * threshold, the proposal's caption + tags + geography are auto-accepted into
 * editable fields. Per IPD1-3: NEVER price (spec §9.2 ban carries from bulk-
 * accept), NEVER title (creators author titles personally).
 *
 * The constant lives here (not env-var-configurable) per IPD1-2 = (a). When
 * the AI pipeline lands at E2 and produces real confidence values, this
 * threshold may need calibration; until then, fixtures define their own
 * confidence values.
 */
export const AI_AUTO_ACCEPT_THRESHOLD = 0.85

/**
 * D2.1 — Auto-accept sweep applied after the V2→V3 hydration bridge.
 *
 * Mutates a copy of assetsById; returns the modified map. Pure: returns
 * a NEW object; does not mutate inputs.
 */
function applyAIAutoAcceptSweep(
  assetsById: Record<string, V2Asset>,
): Record<string, V2Asset> {
  const out: Record<string, V2Asset> = {}
  for (const [id, asset] of Object.entries(assetsById)) {
    if (!asset.proposal || asset.proposal.confidence < AI_AUTO_ACCEPT_THRESHOLD) {
      out[id] = asset
      continue
    }
    // Per IPD1-3 = (a): caption (description) + tags + geography only.
    // NEVER price (spec §9.2 + L5). NEVER title.
    //
    // D2.9 Move 8: each auto-accepted field flips metadataSource[field] to
    // 'ai' so FieldProvenanceTag renders "AI generated" until the creator
    // edits or clicks ✓ (which dispatches UPDATE_ASSET_FIELD and flips
    // source to 'creator').
    const editable = { ...asset.editable }
    const metadataSource = { ...editable.metadataSource }
    if (!editable.description && asset.proposal.description) {
      editable.description = asset.proposal.description
      metadataSource.description = 'ai'
    }
    if (editable.tags.length === 0 && asset.proposal.tags?.length) {
      editable.tags = [...asset.proposal.tags]
      metadataSource.tags = 'ai'
    }
    if (editable.geography.length === 0 && asset.proposal.geography?.length) {
      editable.geography = [...asset.proposal.geography]
      metadataSource.geography = 'ai'
    }
    editable.metadataSource = metadataSource
    out[id] = { ...asset, editable }
  }
  return out
}

/**
 * D2.1 — Cover + sequence defaults applied to each story at hydration.
 *
 * Cover defaults to null (render falls back to first in sequence via
 * getStoryCover selector). Sequence defaults to a copy of proposedAssetIds.
 */
function applyStoryDefaults(
  storyGroupsById: Record<string, V2StoryGroup>,
): Record<string, V2StoryGroup> {
  const out: Record<string, V2StoryGroup> = {}
  for (const [id, g] of Object.entries(storyGroupsById)) {
    out[id] = {
      ...g,
      coverAssetId: g.coverAssetId ?? null,
      sequence: g.sequence ?? [...g.proposedAssetIds],
    }
  }
  return out
}

export function hydrateV3FromBatchId(batchId: string): V3State {
  return v3InitialState(batchId)
}

/**
 * Bridge: V2State → V3State for the parity test.
 *
 * Preserves: batch.id, batch.createdAt, assetsById (V2Asset shape unchanged),
 * assetOrder, storyGroupsById, storyGroupOrder, defaults.
 *
 * Drops: batch.currentStage, batch.newsroomMode, ui.* (entire V2UIState
 * superseded), express-eligibility flags, MobileTab, TableColumns.
 *
 * Reinitializes: V3UIState, V3CommitState, aiClusterProposals (empty).
 *
 * The storyGroupOverlayOn default depends on density (off in Linear/Compact;
 * on in Batch/Archive) per UX-SPEC-V3 §8.1.
 */
export function hydrateV3FromV2State(v2State: V2State): V3State {
  const count = v2State.assetOrder.length
  const density = densityForCount(count)
  const storyGroupOverlayOn = density === 'batch' || density === 'archive'

  const base = v3InitialState(v2State.batch.id)
  // Per IPII-3: first cluster auto-expanded on initial render, others
  // collapsed. Initialize expandedClusterIds in hydration (NOT via
  // useEffect — StrictMode runs effects twice and would toggle back to
  // collapsed). Toggle semantics still work: user can click first cluster
  // header to collapse it.
  const expandedClusterIds =
    v2State.storyGroupOrder.length > 0 ? [v2State.storyGroupOrder[0]] : []

  // D2.1: AI auto-accept sweep + story cover/sequence defaults.
  // Both are pure transforms producing new objects (no input mutation).
  const assetsById = applyAIAutoAcceptSweep(v2State.assetsById)
  const storyGroupsById = applyStoryDefaults(v2State.storyGroupsById)

  return {
    ...base,
    batch: {
      id: v2State.batch.id,
      createdAt: v2State.batch.createdAt,
      committedAt: v2State.batch.committedAt,
    },
    assetsById,
    assetOrder: v2State.assetOrder,
    storyGroupsById,
    storyGroupOrder: v2State.storyGroupOrder,
    defaults: v2State.defaults,
    ui: {
      ...base.ui,
      storyGroupOverlayOn,
      bulkOpsBarOpen: density === 'batch' || density === 'archive',
      expandedClusterIds,
    },
  }
}
