/**
 * Frontfiles Upload V4 — Right Rail Inspector (D2.4 §1.1)
 *
 * Spec: UX-SPEC-V4 §5 (canonical) + §7.3 (Set as cover) + §11 (AI surfacing).
 *
 * The persistent right rail. Mounts when state.ui.selectedAssetIds.length === 1
 * (single-asset focus mode). Multi-select unmounts the rail (D2.5 contextual
 * action bar fills the gap). No selection unmounts.
 *
 * Layout (top → bottom):
 *   InspectorThumbnail               — sticky filename header + 16:9 thumbnail
 *   SetAsCoverButton                 — visible when asset has storyGroupId
 *   InspectorFieldEditor             — Title / Caption / Price / Privacy
 *                                     always visible; Tags / Geography /
 *                                     Licences collapsible (closed by default)
 *   InspectorExceptionsSection       — collapsible (closed by default)
 *   InspectorAIProposalDetail        — collapsible (closed by default)
 *
 * Keyboard (rail-level):
 *   Esc → DESELECT_ALL_ASSETS (closes the rail)
 *   J / K → NAVIGATE_SIDE_PANEL (action's selectedAssetIds write keeps it useful)
 *   J/K skipped while typing inside an INPUT/TEXTAREA/SELECT
 *
 * Defensive auto-deselect (IPD4-9): if the open asset id ceases to exist
 * in assetsById (e.g., a future delete action), dispatch DESELECT_ALL_ASSETS
 * to clean up.
 *
 * UploadShellV4 gates the rail mount on:
 *   - selectedAssetIds.length === 1
 *   - commit.phase ∈ {idle, summary} (per IPD4-12; rail suppressed during commit)
 * So this component renders unconditionally when mounted; no internal phase
 * check needed beyond the stale-id guard.
 */

'use client'

import { useEffect } from 'react'
import { useUploadContext } from '../_components/UploadContext'
import InspectorThumbnail from './inspector/InspectorThumbnail'
import SetAsCoverButton from './inspector/SetAsCoverButton'
import InspectorFieldEditor from './inspector/InspectorFieldEditor'
import InspectorExceptionsSection from './inspector/InspectorExceptionsSection'
import InspectorAIProposalDetail from './inspector/InspectorAIProposalDetail'

export default function RightRailInspector() {
  const { state, dispatch } = useUploadContext()
  const selectedId =
    state.ui.selectedAssetIds.length === 1 ? state.ui.selectedAssetIds[0] : null
  const asset = selectedId ? state.assetsById[selectedId] : null

  // IPD4-9: stale-id guard. Asset removed from map → deselect.
  useEffect(() => {
    if (selectedId && !asset) {
      dispatch({ type: 'DESELECT_ALL_ASSETS' })
    }
  }, [selectedId, asset, dispatch])

  // IPD4-7 (Esc) + IPD4-6 (J/K via NAVIGATE_SIDE_PANEL).
  useEffect(() => {
    if (!selectedId) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        e.preventDefault()
        dispatch({ type: 'DESELECT_ALL_ASSETS' })
        if (inField) target?.blur()
        return
      }
      if (inField) return

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        dispatch({ type: 'NAVIGATE_SIDE_PANEL', direction: 'next' })
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        dispatch({ type: 'NAVIGATE_SIDE_PANEL', direction: 'prev' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, dispatch])

  if (!asset) return null

  return (
    <aside
      role="complementary"
      aria-label={`Inspector for ${asset.filename}`}
      // D2.5b (round 5): flex-1 min-h-0 instead of h-full. Diagnosis from
      // DevTools console:
      //   {asideOffset: 771, asideScroll: 771, body: 199, viewport: 199}
      // The aside was growing to content size (771px) instead of being
      // constrained to its parent (~143px). h-full was being ignored in
      // the flex chain. flex-1 + min-h-0 forces the aside to FIT INSIDE
      // its flex-col parent (the rail wrapper) and lets overflow-y-auto
      // activate properly when content exceeds that.
      //
      // The wrapper is `flex flex-col h-full` so the aside as a flex-1
      // child fills the wrapper's height exactly, then overflows internally.
      className="w-full flex-1 min-h-0 flex flex-col bg-white overflow-y-auto"
    >
      <InspectorThumbnail asset={asset} />
      <SetAsCoverButton asset={asset} />
      <InspectorFieldEditor asset={asset} />
      <InspectorExceptionsSection asset={asset} />
      <InspectorAIProposalDetail asset={asset} />
    </aside>
  )
}
