/**
 * Frontfiles Upload V4 — Left Rail Story Header (D2.2 §1.1, D2.9 Move 4)
 *
 * Spec: UX-SPEC-V4 §4.2 + §7.3 (cover) + §8.2 (DnD) + D2.9-DIRECTIVE.md
 * §3 Move 4 (visual story navigator).
 *
 * One row per story in the left rail. Three responsibilities:
 *
 *   1. Display: 16:9 cover thumbnail at full rail-width-minus-padding (~288×162
 *      in the 320px-wide expanded rail per D2.9 Move 4) + story name (12px
 *      font-bold) + count line (10px slate-500) "N · M ready". Cover-first
 *      layout — the eye lands on the image, then reads the name.
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
 *
 * D2.9 Move 4 changes vs. D2.2:
 *   - Cover image size: 64×36 → ~288×162 (rail-width minus 16px padding,
 *     16:9 aspect preserved per L4).
 *   - Story name: position changed from right-of-thumbnail to below cover.
 *   - Active (filtered) state: outline outline-2 outline-blue-600 around
 *     the cover image only (NOT a whole-row bg shift).
 *   - Hover: cover scales subtly (hover:scale-[1.02]).
 *   - Drop highlight on cover sub-target: outline thickens to 4px.
 *   - Drop highlight on body: row bg → bg-blue-50/50.
 *   - Vertical gap between rows: 16px (handled by the row's own bottom
 *     margin; LeftRail wrapper doesn't add gap to preserve sticky-header
 *     behavior).
 *   - "PHOTO" placeholder pill removed.
 *
 * Collapsed-rail variant: a small thumbnail with no name/counts, retains
 * both drop zones for parity with expanded mode.
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

  // ── Collapsed variant: tiny cover, no name/counts ──
  // Same drop targets as expanded so the rail stays usable as a DnD surface
  // even when minimized. No hover-scale (too cramped).
  if (collapsed) {
    return (
      <div
        ref={bodyRef}
        onClick={handleClick}
        className={`flex items-center justify-center px-2 py-2 cursor-pointer transition-colors ${
          isOverBody ? 'bg-blue-100' : ''
        }`}
        data-story-id={story.id}
        role="button"
        tabIndex={0}
        title={story.name}
      >
        <div
          ref={coverRef}
          className={`flex-shrink-0 bg-slate-200 overflow-hidden ${
            isOverCover
              ? 'outline outline-4 outline-blue-600 outline-offset-0'
              : isFiltered
                ? 'outline outline-2 outline-blue-600 outline-offset-0'
                : ''
          }`}
          style={{ width: 64, height: 36 }}
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={cover?.filename ?? ''} className="w-full h-full object-cover" />
          )}
        </div>
      </div>
    )
  }

  // ── Expanded variant: cover-first layout ──
  return (
    <div
      ref={bodyRef}
      onClick={handleClick}
      // D2.9 follow-up: drop highlight bumped from bg-blue-50/50 (too subtle
      // over slate-50) to bg-blue-100 (clearly visible).
      className={`px-3 pb-4 pt-2 cursor-pointer transition-colors min-w-0 ${
        isOverBody ? 'bg-blue-100' : ''
      }`}
      data-story-id={story.id}
      role="button"
      tabIndex={0}
    >
      {/* 16:9 cover at rail-width minus 24px (12px padding × 2). Drop sub-
          target. Active outline (filtered): 2px blue. Hover: subtle scale.
          Drop hover (cover): outline thickens to 4px (overrides filtered
          outline visually — drop intent dominates). */}
      <div
        ref={coverRef}
        className={`relative aspect-video bg-slate-200 overflow-hidden transition-transform hover:scale-[1.02] ${
          isOverCover
            ? 'outline outline-4 outline-blue-600 outline-offset-0'
            : isFiltered
              ? 'outline outline-2 outline-blue-600 outline-offset-0'
              : ''
        }`}
        title={isOverCover ? 'Drop to set as cover' : `Cover: ${cover?.filename ?? '(none)'}`}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={cover?.filename ?? ''} className="w-full h-full object-cover" />
        ) : null}
      </div>

      {/* Below cover: 8px gap → name (12px bold) + count line (10px slate-500). */}
      <div className="mt-2 min-w-0">
        <div
          className="text-xs font-bold text-black truncate"
          title={story.name}
        >
          {story.name}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5">
          {totalCount} · {readyCount} ready
        </div>
      </div>
    </div>
  )
}
