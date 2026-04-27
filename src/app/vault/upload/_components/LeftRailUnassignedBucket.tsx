/**
 * Frontfiles Upload V4 — Left Rail Unassigned Bucket (D2.2 §1.1)
 *
 * Spec: UX-SPEC-V4 §4.3.
 *
 * System bucket showing the count of assets without a storyGroupId.
 * Drop target (id `unassigned`) → MOVE_ASSET_TO_UNGROUPED on the dragged
 * asset (or all selected if multi-select drag, per IPD2-6 — handled at
 * UploadShell's drag-end router).
 *
 * Click → filter center to ungrouped assets via SET_FILTER. Per IPD2-13
 * also clears selection.
 *
 * No cover thumbnail (this bucket is system, not a Story).
 */

'use client'

import { useDroppable } from '@dnd-kit/core'
import { useUploadContext } from './UploadContext'

export default function LeftRailUnassignedBucket() {
  const { state, dispatch } = useUploadContext()
  const collapsed = state.ui.leftRailCollapsed

  // V2Filter has no explicit "unassigned" preset; use a sentinel via storyGroupId.
  // The 'unassigned' filter preset already exists for this case — reuse it.
  const isFiltered = state.ui.filter.preset === 'unassigned'

  const unassignedCount = state.assetOrder
    .map(id => state.assetsById[id])
    .filter(a => a && !a.excluded && a.storyGroupId === null).length

  const { isOver, setNodeRef } = useDroppable({
    id: 'unassigned',
    data: { kind: 'unassigned' },
  })

  function handleClick() {
    dispatch({ type: 'SET_FILTER_PRESET', preset: 'unassigned' })
    dispatch({ type: 'DESELECT_ALL_ASSETS' })
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`border-b border-black flex items-center gap-2 px-2 py-2 cursor-pointer transition-colors min-w-0 ${
        isOver ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''
      } ${isFiltered ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
      role="button"
      tabIndex={0}
      title={isOver ? 'Drop to unassign' : 'Click to filter to unassigned'}
    >
      {/* Placeholder icon block — same 64×36 shape as story cover thumb to keep rows aligned. */}
      <div
        className="flex-shrink-0 border border-black bg-white flex items-center justify-center"
        style={{ width: 64, height: 36 }}
      >
        <span className="text-[8px] uppercase tracking-widest text-slate-500">▢</span>
      </div>

      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-black truncate">
            Unassigned
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5">
            {unassignedCount}
          </div>
        </div>
      )}
    </div>
  )
}
