/**
 * Frontfiles Upload V4 — Left Rail (D2.2 §1.1)
 *
 * Spec: UX-SPEC-V4 §4 (canonical) + §2.0.1 (mounts when assetOrder.length > 0).
 *
 * The organization navigator. Vertical stack:
 *
 *   ┌──────────────────┐
 *   │ LeftRailHeader   │   + Add files / cog
 *   ├──────────────────┤
 *   │ Unassigned (N)   │   System bucket — drop target
 *   ├──────────────────┤
 *   │ STORIES          │   Section label
 *   │   ▦ Story A      │   Per-story drop targets via LeftRailStoryHeader
 *   │   ▦ Story B      │
 *   │   ▦ ...          │
 *   ├──────────────────┤
 *   │ + New story      │   Inline input affordance
 *   └──────────────────┘
 *
 * Width: 240px when expanded, ~64px when collapsed (just enough for the
 * cover thumbs + collapse arrow). Collapse state lives in V3UIState.
 *
 * Mount gating happens at UploadShellV4 (renders this component when
 * assetOrder.length > 0 AND not in Empty layout state).
 */

'use client'

import { useUploadContext } from '../_components/UploadContext'
import LeftRailHeader from './LeftRailHeader'
import LeftRailStoryHeader from './LeftRailStoryHeader'
import LeftRailUnassignedBucket from './LeftRailUnassignedBucket'
import LeftRailNewStoryAffordance from './LeftRailNewStoryAffordance'

export default function LeftRail() {
  const { state } = useUploadContext()
  const collapsed = state.ui.leftRailCollapsed

  return (
    <aside
      data-region="left-rail"
      className={`flex flex-col bg-white min-w-0 flex-shrink-0 ${collapsed ? 'w-[80px]' : 'w-[240px]'}`}
      aria-label="Story navigator"
    >
      <LeftRailHeader />

      {/* Unassigned bucket always visible at top of nav (per UX-SPEC-V4 §4.3). */}
      <LeftRailUnassignedBucket />

      {/* Stories section — header label + list. Scrollable when many stories. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!collapsed && state.storyGroupOrder.length > 0 && (
          <div className="border-b border-black px-2 py-1.5 sticky top-0 bg-white z-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Stories
            </span>
          </div>
        )}

        {state.storyGroupOrder.map(id => {
          const story = state.storyGroupsById[id]
          if (!story) return null
          return <LeftRailStoryHeader key={id} story={story} />
        })}

        {!collapsed && state.storyGroupOrder.length === 0 && (
          <div className="px-2 py-3 text-[10px] uppercase tracking-widest text-slate-400 italic">
            No stories yet
          </div>
        )}
      </div>

      <LeftRailNewStoryAffordance />
    </aside>
  )
}
