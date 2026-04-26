/**
 * Frontfiles Upload V4 — Top-level Shell (D2.1 §6.1)
 *
 * Spec: UX-SPEC-V4 §2 (three-pane progressive disclosure) + D-PLAN §4.1.
 *
 * The new canonical upload shell. Replaces the C2-era UploadShell at
 * src/app/vault/upload/_components/UploadShell.tsx (now dormant per D2.1
 * §8 dormant-flag pass).
 *
 * Three layout states per spec §2 (resolved by getLayoutState):
 *   'empty'      → EmptyState fills the screen
 *   'workspace'  → three-pane shell with placeholders for D2.2/D2.3/D2.4
 *   'comparing'  → center pane swaps to side-by-side (D2.6 fills)
 *
 * D2.1 ships ONLY the layout primitive + placeholders. Pane content
 * arrives in subsequent D phases:
 *   D2.2 — left rail content (LeftRail + StoryHeader + UnassignedBucket + NewStoryAffordance)
 *   D2.3 — center pane content (ContactSheet + cards + zoom slider + filter chips)
 *   D2.4 — right rail content (RightRailInspector — adapts SideDetailPanel)
 *   D2.5 — contextual action bar
 *   D2.6 — compare view
 *   D2.7 — file ingestion (whole-window listener) + session defaults popover
 *
 * SSR-safe boundary preserved (same as C2 UploadShell): takes batchId +
 * dev params from the server page; V3State computed client-side via
 * useReducer initializer; non-serializable fields never cross the boundary.
 */

'use client'

import { useReducer } from 'react'
import { v3Reducer, v3InitialState } from '@/lib/upload/v3-state'
import { getLayoutState } from '@/lib/upload/upload-selectors'
import { hydrateV3FromV2State } from '@/lib/upload/v3-hydration'
import { hydrateFromScenario } from '@/lib/upload/v2-hydration'
import { SCENARIOS } from '@/lib/upload/v2-mock-scenarios'
import type { ScenarioId } from '@/lib/upload/v2-scenario-registry'
import type { V3State } from '@/lib/upload/v3-types'
// UploadContext lives in C2's _components/ directory and is reused here.
// (Per D2.1 §8 it is NOT dormant-flagged — it's a spine carryover.)
import { UploadContextProvider } from '../_components/UploadContext'
import EmptyState from './EmptyState'
import CenterPane from './CenterPane'

interface Props {
  batchId: string
  /** Dev-only scenario fixture id; null in production or when no ?scenario= param. */
  devScenarioId: ScenarioId | null
  /** Dev-only commit-failure injection (per C2.4 IPIV-5). null in production. */
  devSimulateFailure: number | null
  /** Dev-only AI cluster banner seeding (per C2.5 IPV-5). false in production. */
  devSeedBanners: boolean
}

export default function UploadShellV4({
  batchId,
  devScenarioId,
  devSimulateFailure,
  devSeedBanners,
}: Props) {
  const [state, dispatch] = useReducer(v3Reducer, { batchId, devScenarioId }, computeInitialState)

  const layout = getLayoutState({
    assetsById: state.assetsById,
    assetOrder: state.assetOrder,
    compareAssetIds: state.ui.compareAssetIds,
  })

  // Empty layout state: EmptyState fills the screen. Three-pane shell + commit
  // bar slot are not mounted — there's nothing yet to populate them.
  if (layout === 'empty') {
    return (
      <UploadContextProvider state={state} dispatch={dispatch}>
        <EmptyState />
      </UploadContextProvider>
    )
  }

  // Workspace and Comparing both render the three-pane shell. Per spec §2:
  // Comparing is a center-pane variant (CompareView replaces the contact sheet),
  // not a structural layout change. D2.6 wires the actual swap.
  return (
    <UploadContextProvider state={state} dispatch={dispatch}>
      <div className="flex flex-col min-h-screen min-w-0">
        <div className="flex flex-row flex-1 min-w-0 min-h-0">
          {/* Left rail — placeholder for D2.2.
           *
           * Per UX-SPEC-V4 §2.0.1 (corrected): mounts as soon as
           * assetOrder.length > 0 (NOT gated on storyGroupOrder.length).
           * Collapsed via state.ui.leftRailCollapsed (D2.2 wires the toggle).
           */}
          {!state.ui.leftRailCollapsed && (
            <div
              data-region="left-rail"
              className="w-[240px] flex-shrink-0 border-r border-black bg-white p-4"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Left rail — placeholder for D2.2
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-2">
                Stories: {state.storyGroupOrder.length}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                Unassigned: {
                  state.assetOrder.filter(
                    id => state.assetsById[id] && !state.assetsById[id].excluded && state.assetsById[id].storyGroupId === null,
                  ).length
                }
              </div>
            </div>
          )}

          {/* Center pane — LIVE per D2.3 (CenterPane orchestrator inside).
           *
           * Hosts AIProposalBanner + ContactSheetFilterChips + ContactSheet
           * (Workspace) or CompareViewPlaceholder (Comparing — D2.6 fills).
           * Bottom row: ZoomSlider (left) + CountFooter (right).
           *
           * The data-region attr stays as 'center-pane' for visual smoke
           * locator continuity. The dev-fixture banner moves into a small
           * hint inside CenterPane is not needed — the count footer carries
           * the contextual info now. */}
          <div data-region="center-pane" className="flex-1 min-w-0 min-h-0 flex flex-col">
            <CenterPane />
            {devScenarioId && (
              <div className="border-t border-slate-200 px-4 py-1 text-[10px] uppercase tracking-widest text-blue-600">
                dev fixture: {devScenarioId}
              </div>
            )}
          </div>

          {/* Right rail — placeholder for D2.4. Per UX-SPEC-V4 §5.1 + IPV4-1:
           *
           * Mounts only when selectedAssetIds.length === 1. Multi-select
           * (length > 1) → contextual action bar appears (D2.5) instead.
           * Empty (length === 0) → no rail.
           */}
          {state.ui.selectedAssetIds.length === 1 && (
            <div
              data-region="right-rail"
              className="w-[400px] flex-shrink-0 border-l border-black bg-white p-4"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Right rail — placeholder for D2.4
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-2">
                asset: {state.ui.selectedAssetIds[0]}
              </div>
            </div>
          )}
        </div>

        {/* Commit bar slot — placeholder for the D-phase that re-mounts CommitBar.
         *
         * The C2.4 commit bar (CommitBar.tsx + 4 sub-panels + useCommitSimulation
         * hook) carries forward unchanged in shape and behavior per D-PLAN §4.2.
         * A subsequent D phase remounts it here as a sibling of the three-pane row.
         */}
        <div
          data-region="commit-bar-slot"
          className="border-t border-black px-6 py-3 sticky bottom-0 bg-white min-w-0"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Commit bar slot — re-mounts C2 CommitBar in a later D phase (phase: {state.commit.phase})
          </div>
          {/* devSimulateFailure / devSeedBanners are forwarded here for the
              future re-mount; D2.1 just acknowledges them so the props don't
              dead-code-warn. */}
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
            {devSimulateFailure !== null && <span>simulateFailure={devSimulateFailure} </span>}
            {devSeedBanners && <span>seedBanners=true</span>}
          </div>
        </div>
      </div>
    </UploadContextProvider>
  )
}

/**
 * useReducer initializer. Same shape as C2's UploadShell — see C2.1 directive
 * for the SSR-safety reasoning (V3State computed client-side; non-serializable
 * V2Asset.file never crosses server→client boundary).
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
      // Hydrate at 'review-assigned' target so cluster accordions populate
      // — same trade-off as Phase 7f of C2 (less faithful to the actual
      // creator flow; more visually inspectable).
      const v2State = hydrateFromScenario(scenario, 'review-assigned')
      return hydrateV3FromV2State(v2State)
    }
  }
  return v3InitialState(batchId)
}
