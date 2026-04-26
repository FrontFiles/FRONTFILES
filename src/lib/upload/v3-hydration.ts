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
import type { V2State } from './v2-types'
import { densityForCount } from './v3-types'

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

  return {
    ...base,
    batch: {
      id: v2State.batch.id,
      createdAt: v2State.batch.createdAt,
      committedAt: v2State.batch.committedAt,
    },
    assetsById: v2State.assetsById,
    assetOrder: v2State.assetOrder,
    storyGroupsById: v2State.storyGroupsById,
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
