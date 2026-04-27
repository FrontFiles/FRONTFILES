/**
 * Frontfiles Upload V4 — Left Rail Story Header (D2.2 §1.1)
 *
 * Spec: UX-SPEC-V4 §4.2 + §7.3 (cover) + §8.2 (DnD).
 *
 * One row per story in the left rail. Three responsibilities:
 *
 *   1. Display: 16:9 cover thumbnail (per IPD2-2 = b at 64×36) + story name +
 *      asset/ready counts.
 *
 *   2. Filter trigger: click the row → dispatch SET_FILTER { storyGroupId }
 *      so the center pane narrows to this story. Per IPD2-13, also clears
 *      single-asset selection (the inspector would otherwise show a
 *      potentially hidden asset).
 *
 *   3. DnD receiver: TWO drop zones per IPD2-3:
 *        - Body (id: `story-{groupId}-body`) → MOVE_ASSET_TO_CLUSTER
 *        - Cover thumbnail area (id: `story-{groupId}-cover`) → ALSO
 *          SET_STORY_COVER on the dragged asset
 *      The actual dispatch routing happens at UploadShell's drag-end
 *      handler; this component just registers the drop zones.
 */

'use client'

import { useDroppable } from '@dnd-kit/core'
import { useUploadContext } from './UploadContext'
import { getStoryCover, getAssetExceptions } from '@/lib/upload/upload-selectors'
import type { V2StoryGroup } from '@/lib/upload/v3-types'

interface Props {
  story: V2StoryGroup
}

export default function LeftRailStoryHeader({ story }: Props) {
  const { state, dispatch } = useUploadContext()
  const collapsed = state.ui.leftRailCollapsed
  const isFiltered = state.ui.filter.storyGroupId === story.id

  // Cover thumbnail via D2.1 selector (explicit cover OR fallback to first in sequence).
  const cover = getStoryCover(story, state.assetsById)
  const coverUrl = cover?.thumbnailRef ?? null

  // Counts — assets in this story + ready count (mirrors C2 cluster header math).
  const inStory = state.assetOrder
    .map(id => state.assetsById[id])
    .filter(a => a && a.storyGroupId === story.id)
  const totalCount = inStory.length
  const readyCount = inStory.filter(
    a =>
      !a.excluded &&
      getAssetExceptions(a)
        .filter(e => e.type !== 'needs_story')
        .filter(e => e.severity === 'blocking').length === 0,
  ).length

  // Two drop zones per IPD2-3.
  const { isOver: isOverBody, setNodeRef: bodyRef } = useDroppable({
    id: `story-${story.id}-body`,
    data: { kind: 'story-body', storyGroupId: story.id },
  })
  const { isOver: isOverCover, setNodeRef: coverRef } = useDroppable({
    id: `story-${story.id}-cover`,
    data: { kind: 'story-cover', storyGroupId: story.id },
  })

  function handleClick() {
    dispatch({ type: 'SET_FILTER', filter: { storyGroupId: story.id } })
    // Per IPD2-13: clear selection when navigating to a story bucket.
    dispatch({ type: 'DESELECT_ALL_ASSETS' })
  }

  return (
    <div
      ref={bodyRef}
      onClick={handleClick}
      className={`border-b border-black flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors min-w-0 ${
        isOverBody ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''
      } ${isFiltered ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
      data-story-id={story.id}
      role="button"
      tabIndex={0}
    >
      {/* 16:9 cover thumbnail per IPD2-2 = b (64×36). Drop sub-target per IPD2-3. */}
      <div
        ref={coverRef}
        className={`flex-shrink-0 border border-black bg-slate-100 overflow-hidden flex items-center justify-center transition-colors ${
          isOverCover ? 'border-blue-600 border-2 bg-blue-50' : ''
        }`}
        style={{ width: 64, height: 36 }}
        title={isOverCover ? 'Drop to set as cover' : `Cover: ${cover?.filename ?? '(none)'}`}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={cover?.filename ?? ''} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[8px] uppercase tracking-widest text-slate-400">
            {cover?.format ?? '—'}
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-black truncate" title={story.name}>
            {story.name}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5">
            {totalCount} · {readyCount} ready
          </div>
        </div>
      )}
    </div>
  )
}
