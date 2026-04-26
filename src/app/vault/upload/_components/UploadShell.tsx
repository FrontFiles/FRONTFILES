/**
 * Frontfiles Upload V3 — Top-level Shell (updated by C2.2)
 *
 * Spec: UX-SPEC-V3.md §2 (single screen, three regions).
 *
 * C2.1 mounted the V3 reducer with placeholder regions.
 * C2.2 replaces the asset-list placeholder with the real <AssetList />
 * (which itself routes between density-mode variants and mounts
 * BulkOpsBar / FilterBar / AIProposalBanner conditionally).
 *
 * Other 4 region placeholders (drop zone, session defaults, side panel,
 * commit bar) remain placeholders pending C2.3–C2.5.
 *
 * SSR-safe boundary preserved: takes batchId (a primitive string) from
 * the server page handler; computes V3State client-side via useReducer's
 * initializer.
 *
 * Mobile-aware design discipline (per IP-3 nuance): regions use min-w-0
 * on flex children, no fixed pixel widths, no hover-only interactions.
 */

'use client'

import { useReducer } from 'react'
import { v3Reducer, v3InitialState } from '@/lib/upload/v3-state'
import { densityForCount } from '@/lib/upload/v3-types'
import { UploadContextProvider } from './UploadContext'
import AssetList from './AssetList'

interface Props {
  batchId: string
}

export default function UploadShell({ batchId }: Props) {
  const [state, dispatch] = useReducer(v3Reducer, batchId, v3InitialState)
  const density = densityForCount(state.assetOrder.length)

  return (
    <UploadContextProvider state={state} dispatch={dispatch}>
      <div className="flex flex-col min-h-screen min-w-0">
        {/* Region 1 (top, persistent) — drop zone */}
        <div data-region="drop-zone" className="border-b border-black p-6 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Drop zone — placeholder for C2.2 (currently {density} mode,{' '}
            {state.assetOrder.length} files)
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
