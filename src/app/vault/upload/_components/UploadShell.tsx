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

import { useReducer } from 'react'
import { v3Reducer, v3InitialState } from '@/lib/upload/v3-state'
import { densityForCount } from '@/lib/upload/v3-types'
import { hydrateV3FromV2State } from '@/lib/upload/v3-hydration'
import { hydrateFromScenario } from '@/lib/upload/v2-hydration'
import { SCENARIOS } from '@/lib/upload/v2-mock-scenarios'
import type { ScenarioId } from '@/lib/upload/v2-scenario-registry'
import type { V3State } from '@/lib/upload/v3-types'
import { UploadContextProvider } from './UploadContext'
import AssetList from './AssetList'

interface Props {
  batchId: string
  /** Dev-only scenario fixture id; null in production or when no ?scenario= param. */
  devScenarioId: ScenarioId | null
}

export default function UploadShell({ batchId, devScenarioId }: Props) {
  const [state, dispatch] = useReducer(v3Reducer, { batchId, devScenarioId }, computeInitialState)
  const density = densityForCount(state.assetOrder.length)

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

        {/* Region 2 — Asset list (LIVE per C2.2) */}
        <div data-region="asset-list" className="flex-1 overflow-auto min-w-0">
          <AssetList />
        </div>

        {/* Region 3 — Side detail panel (overlay-from-right, conditional) */}
        {state.ui.sidePanelOpenAssetId && (
          <div data-region="side-panel" className="border-l border-black p-6 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Side detail panel — placeholder for C2.3 (asset:{' '}
              {state.ui.sidePanelOpenAssetId})
            </div>
          </div>
        )}

        {/* Region 3 (bottom, sticky) — commit bar */}
        <div
          data-region="commit-bar"
          className="border-t border-black px-6 py-3 sticky bottom-0 bg-white min-w-0"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Commit bar — placeholder for C2.4 (phase: {state.commit.phase}, batch: {batchId})
          </div>
        </div>
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
