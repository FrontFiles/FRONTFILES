/**
 * Frontfiles Upload V3 — Top-level Shell (C2.1)
 *
 * Spec: UX-SPEC-V3.md §2 (single screen, three regions).
 *
 * C2.1 scope: mounts the V3 reducer and renders five region placeholders.
 * The actual region rendering ships in C2.2–C2.5; placeholders are
 * intentional so subsequent prompts can drop in DropZone, AssetList,
 * SideDetailPanel, CommitBar, AIProposalBanner without restructuring.
 *
 * SSR-safe boundary: takes `batchId` (a primitive string) from the
 * server page handler. The full V3State (which contains non-serializable
 * fields like V2Asset.file: File | null) is computed entirely client-side
 * via useReducer's initializer.
 *
 * Mobile-aware design discipline (per IP-3 nuance): regions use min-w-0
 * on flex children, no fixed pixel widths, no hover-only interactions.
 * Side panel is structured as a conditionally-rendered region (not a
 * fixed-width column), so a future C5+ pass can collapse it to fullscreen
 * on narrow viewports without restructuring.
 */

'use client'

import { useReducer } from 'react'
import { v3Reducer, v3InitialState } from '@/lib/upload/v3-state'
import { densityForCount } from '@/lib/upload/v3-types'
import { UploadContextProvider } from './UploadContext'

interface Props {
  batchId: string
}

export default function UploadShell({ batchId }: Props) {
  const [state, dispatch] = useReducer(v3Reducer, batchId, v3InitialState)
  const density = densityForCount(state.assetOrder.length)

  return (
    <UploadContextProvider state={state} dispatch={dispatch}>
      <div className="flex flex-col min-h-screen min-w-0">
        {/* Region 1 (top, persistent) — drop zone + collapsible defaults */}
        <div
          data-region="drop-zone"
          className="border-b border-black p-6 min-w-0"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Drop zone — placeholder for C2.2 (currently {density} mode,{' '}
            {state.assetOrder.length} files)
          </div>
        </div>

        <div
          data-region="session-defaults"
          className="border-b border-black px-6 py-2 min-w-0"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Session defaults bar — placeholder for C2.1 (collapsed:{' '}
            {state.ui.sessionDefaultsBarCollapsed ? 'yes' : 'no'})
          </div>
        </div>

        {/* Region 2 (center, virtualized) — asset list */}
        <div
          data-region="asset-list"
          className="flex-1 overflow-auto p-6 min-w-0"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Asset list — placeholder for C2.2 (density: {density},{' '}
            {state.assetOrder.length} assets)
          </div>
        </div>

        {/* Region 3 (overlay-from-right, conditional) — side detail panel */}
        {state.ui.sidePanelOpenAssetId && (
          <div
            data-region="side-panel"
            className="border-l border-black p-6 min-w-0"
          >
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
            Commit bar — placeholder for C2.4 (phase: {state.commit.phase},{' '}
            batch: {batchId})
          </div>
        </div>
      </div>
    </UploadContextProvider>
  )
}
