/**
 * Frontfiles Upload V3 — Top-level Shell (C2.1 base; C2.2 added live AssetList
 * + dev-only fixture loader)
 *
 * Spec: UX-SPEC-V3.md §2 (single screen, three regions).
 *
 * C2.1 mounted the V3 reducer with placeholder regions.
 * C2.2 replaced the asset-list placeholder with the real <AssetList />
 * AND added a dev-only fixture loader (passes scenario fixture data
 * through the V2 hydration path then bridges to V3).
 *
 * SSR-safe boundary preserved: takes batchId (a primitive string) +
 * devScenarioId (a primitive string or null) from the server page handler.
 * V3State is computed client-side via useReducer's initializer, so
 * non-serializable fields (V2Asset.file: File | null) never cross the
 * server→client boundary.
 *
 * Mobile-aware design discipline (per IP-3 nuance): regions use min-w-0
 * on flex children, no fixed pixel widths, no hover-only interactions.
 */

'use client'

import { useEffect, useReducer, useRef } from 'react'
import { v3Reducer, v3InitialState } from '@/lib/upload/v3-state'
import { densityForCount } from '@/lib/upload/v3-types'
import { hydrateV3FromV2State } from '@/lib/upload/v3-hydration'
import { hydrateFromScenario } from '@/lib/upload/v2-hydration'
import { SCENARIOS } from '@/lib/upload/v2-mock-scenarios'
import type { ScenarioId } from '@/lib/upload/v2-scenario-registry'
import type { V3State } from '@/lib/upload/v3-types'
import { UploadContextProvider } from './UploadContext'
import AssetList from './AssetList'
import SideDetailPanel from './SideDetailPanel'
import CommitBar from './CommitBar'
import CommitSuccessPanel from './CommitSuccessPanel'

interface Props {
  batchId: string
  /** Dev-only scenario fixture id; null in production or when no ?scenario= param. */
  devScenarioId: ScenarioId | null
  /** Dev-only commit-failure injection (per C2.4 IPIV-5). null in production. */
  devSimulateFailure: number | null
  /** Dev-only AI cluster banner seeding (per C2.5 IPV-5). false in production. */
  devSeedBanners: boolean
}

export default function UploadShell({
  batchId,
  devScenarioId,
  devSimulateFailure,
  devSeedBanners,
}: Props) {
  const [state, dispatch] = useReducer(v3Reducer, { batchId, devScenarioId }, computeInitialState)
  const density = densityForCount(state.assetOrder.length)

  // Per C2.5 IPV-5: seed AIProposalBanner with synthetic proposals so the
  // banner is visually QAable in dev. Synthesizes 1–2 proposals from the
  // first 1–2 storyGroups present after hydration. One-shot via a ref guard
  // (StrictMode double-mount safe). Production never takes this path —
  // devSeedBanners is hard-false unless ?seedBanners=1 is set in dev.
  const seededRef = useRef(false)
  useEffect(() => {
    if (!devSeedBanners) return
    if (seededRef.current) return
    if (state.aiClusterProposals.length > 0) return // don't seed if real ones exist
    if (state.storyGroupOrder.length === 0) return // nothing to seed from
    seededRef.current = true
    const seedCount = Math.min(2, state.storyGroupOrder.length)
    for (let i = 0; i < seedCount; i++) {
      const group = state.storyGroupsById[state.storyGroupOrder[i]]
      if (!group) continue
      dispatch({
        type: 'RECEIVE_AI_CLUSTER_PROPOSAL',
        proposal: {
          proposalId: `seed_${i}_${Date.now().toString(36)}`,
          clusterName: group.name,
          proposedAssetIds: group.proposedAssetIds.slice(0, 5),
          rationale: 'Synthetic proposal seeded for visual QA (dev: ?seedBanners=1).',
          confidence: 0.85,
          status: 'pending',
        },
      })
    }
  }, [devSeedBanners, state.aiClusterProposals.length, state.storyGroupOrder, state.storyGroupsById])

  // Per C2.4 L6 + IPIV-2: success phase replaces the entire screen body.
  // Drop zone, session defaults, asset list, side panel, commit bar all
  // hide. CommitSuccessPanel takes over.
  if (state.commit.phase === 'success') {
    return (
      <UploadContextProvider state={state} dispatch={dispatch}>
        <CommitSuccessPanel />
      </UploadContextProvider>
    )
  }

  return (
    <UploadContextProvider state={state} dispatch={dispatch}>
      <div className="flex flex-col min-h-screen min-w-0">
        {/* Region 1 (top, persistent) — drop zone */}
        <div data-region="drop-zone" className="border-b border-black p-6 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Drop zone — placeholder for C2.2 (currently {density} mode,{' '}
            {state.assetOrder.length} files)
            {devScenarioId && (
              <span className="ml-3 text-blue-600">
                · dev fixture loaded: {devScenarioId}
              </span>
            )}
          </div>
        </div>

        {/* Session defaults bar (collapsible) */}
        <div data-region="session-defaults" className="border-b border-black px-6 py-2 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Session defaults bar — placeholder for C2.1 (collapsed:{' '}
            {state.ui.sessionDefaultsBarCollapsed ? 'yes' : 'no'})
          </div>
        </div>

        {/* Region 2 + Region 3 (side panel) — push layout per UX-SPEC-V3 §7.
         *
         * Asset list and side panel sit side-by-side in a horizontal flex.
         * The panel is push-style (NOT overlay) so multi-row context stays
         * visible to the left when a single asset is being edited (spec §7:
         * "overlay would obscure context for multi-row workflows").
         *
         * Note on the C2-PLAN drift corrected at C2.3 land: §4.1 of
         * C2-PLAN.md and an earlier placeholder comment here both said
         * "overlay-from-right". UX-SPEC-V3 §7 is canonical and says push.
         *
         * SideDetailPanel renders nothing when sidePanelOpenAssetId is null,
         * so the asset-list takes the full width by default and shrinks left
         * by 480px when the panel mounts. */}
        <div className="flex flex-row flex-1 min-w-0 min-h-0">
          <div data-region="asset-list" className="flex-1 overflow-auto min-w-0">
            <AssetList />
          </div>
          <SideDetailPanel />
        </div>

        {/* Region 3 (bottom, sticky) — commit bar (LIVE per C2.4).
         *
         * Per UX-SPEC-V3 §11 + C2-PLAN §9: CommitBar orchestrates four
         * visible phases (idle / summary / committing / partial-failure).
         * The fifth phase ('success') is handled by the top-level branch
         * above (renders CommitSuccessPanel as full screen body per L6).
         *
         * useCommitSimulation hook (mounted inside CommitBar) drives the
         * fake committing → success/partial-failure transition. Real
         * network is PR 5. */}
        <CommitBar simulateFailure={devSimulateFailure} />
      </div>
    </UploadContextProvider>
  )
}

/**
 * useReducer initializer. Computed client-side (no SSR serialization
 * concerns). If devScenarioId is set, hydrate from the fixture via the
 * V2 hydration path and bridge to V3. Otherwise return an empty batch.
 */
function computeInitialState({
  batchId,
  devScenarioId,
}: {
  batchId: string
  devScenarioId: ScenarioId | null
}): V3State {
  if (devScenarioId) {
    const scenario = SCENARIOS[devScenarioId]
    if (scenario) {
      // Hydrate at 'review-assigned' target — analysis complete AND
      // assets pre-assigned to their proposed story groups (skips the
      // creator Accept-All flow).
      //
      // Trade-off: less faithful to the actual creator flow (in real
      // life, the user sees AI cluster proposal banners and explicitly
      // accepts). The dev loader uses 'review-assigned' so cluster
      // accordions populate and the full Archive density mode UX is
      // visually inspectable. Production code never takes this path
      // (gated by devScenarioId being null in non-dev builds).
      const v2State = hydrateFromScenario(scenario, 'review-assigned')
      return hydrateV3FromV2State(v2State)
    }
  }
  return v3InitialState(batchId)
}
