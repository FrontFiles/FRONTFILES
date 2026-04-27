/**
 * Frontfiles Upload V4 — Compare View (D2.6 §1.1)
 *
 * Spec: UX-SPEC-V4 §10 (canonical) + D-PLAN §12 + D2.6-DIRECTIVE.
 *
 * The 2-up focused review. Mounted by CenterPane when getLayoutState
 * returns 'comparing' (i.e., state.ui.compareAssetIds.length === 2).
 *
 * Layout (top → bottom):
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  COMPARE                                       EXIT (Esc)    │  ← header (h-10)
 *   ├──────────────────────────────┬───────────────────────────────┤
 *   │                              │                               │
 *   │       <CompareCard a/>       │       <CompareCard b/>        │
 *   │                              │                               │
 *   └──────────────────────────────┴───────────────────────────────┘
 *
 * Per spec §10:
 *   - Strict 2-only (IPV4-3 = a). Reducer enforces; this component assumes both.
 *   - Esc OR "EXIT (Esc)" button → EXIT_COMPARE_MODE. Selection persists.
 *   - On exit, getLayoutState falls back to 'workspace' and CenterPane
 *     re-renders the contact sheet. The contextual action bar (which
 *     was suppressed during compare per IPD6-1) reappears at the bottom.
 *
 * Defensive (IPD4-9-style): if either compared asset id is missing from
 * assetsById (e.g., a future delete action), dispatch EXIT_COMPARE_MODE
 * to clean up. Better than rendering a broken half-pane.
 */

'use client'

import { useEffect } from 'react'
import { useUploadContext } from './UploadContext'
import CompareCard from './compare/CompareCard'

export default function CompareView() {
  const { state, dispatch } = useUploadContext()
  const [idA, idB] = state.ui.compareAssetIds
  const assetA = idA ? state.assetsById[idA] : null
  const assetB = idB ? state.assetsById[idB] : null

  // Defensive auto-exit if either id has gone stale.
  useEffect(() => {
    if (idA && !assetA) {
      dispatch({ type: 'EXIT_COMPARE_MODE' })
      return
    }
    if (idB && !assetB) {
      dispatch({ type: 'EXIT_COMPARE_MODE' })
    }
  }, [idA, idB, assetA, assetB, dispatch])

  // Esc anywhere → exit. Skip when typing into a field (defensive — there
  // are no fields in compare today, but a future inline rename or note
  // might add one and this guard keeps the keyboard contract sane).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      dispatch({ type: 'EXIT_COMPARE_MODE' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  if (!assetA || !assetB) return null

  return (
    <div
      data-region="compare-view"
      role="region"
      aria-label="Compare two assets"
      className="flex flex-col flex-1 min-h-0 min-w-0 bg-white"
    >
      {/* Header bar — COMPARE label + EXIT button. */}
      <div className="border-b border-black px-4 h-10 flex items-center justify-between flex-shrink-0 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-black">
          Compare
        </span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'EXIT_COMPARE_MODE' })}
          className="border border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black bg-white hover:bg-black hover:text-white transition-colors"
          title="Exit compare (Esc)"
        >
          Exit (Esc)
        </button>
      </div>

      {/* 2-up grid: 50/50 columns with a black divider between. */}
      <div className="grid grid-cols-2 divide-x divide-black flex-1 min-h-0 min-w-0">
        <CompareCard asset={assetA} />
        <CompareCard asset={assetB} />
      </div>
    </div>
  )
}
