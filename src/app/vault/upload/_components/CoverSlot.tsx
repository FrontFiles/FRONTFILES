/**
 * Frontfiles Upload V4 — Cover Slot (D2.9 Move 9)
 *
 * Spec: D2.9-DIRECTIVE.md §3 Move 9 — when the contact sheet is filtered
 * to a story (state.ui.filter.storyGroupId !== null), the first visible
 * cell is replaced by a special "cover slot" card that represents the
 * story's cover. Drop another asset onto it to set THAT asset as the
 * cover (and move it into the story if not already a member).
 *
 * Per IPD9-2 = (a): when no explicit cover is set, the slot displays the
 * selector's fallback (first asset in sequence). The slot is never
 * visually empty as long as the story has at least one asset. Empty
 * stories show the "Drop here to set cover" hint.
 *
 * NOT clickable (selecting the slot does nothing — selection is a
 * different concept). NOT draggable (the slot itself is not movable).
 * The slot lives OUTSIDE the SortableContext as a sibling of the sortable
 * grid — see ContactSheet.tsx for the mount.
 *
 * Drop routing happens in UploadShell.handleDragEnd via the
 * `story-{id}-cover-slot` over.id pattern.
 */

'use client'

import { useDroppable } from '@dnd-kit/core'
import { useUploadContext } from './UploadContext'
import { getStoryCover } from '@/lib/upload/upload-selectors'
import type { V2StoryGroup } from '@/lib/upload/v3-types'

interface Props {
  story: V2StoryGroup
  /**
   * Reserved — kept on the prop signature for parity with the asset cards
   * (which derive their height from cardSize × 9/16). The slot itself
   * fills its grid cell width and uses `aspect-video` for the 16:9 ratio,
   * so the cell width comes from the grid's `auto-fill` track sizing.
   */
  cardSize?: number
}

export default function CoverSlot({ story }: Props) {
  const { state } = useUploadContext()
  const cover = getStoryCover(story, state.assetsById)

  const { setNodeRef, isOver } = useDroppable({
    id: `story-${story.id}-cover-slot`,
    data: { kind: 'cover-slot', storyGroupId: story.id },
  })

  // 16:9 to match the rest of the contact sheet (founder lock L4). The
  // slot fills the full width of its grid cell (no explicit width) so it
  // sits seamlessly as the first card in the contact-sheet row.
  // Outline is always 4px blue per directive Move 9; intensifies on
  // hover-while-dragging via a ring overlay.
  const outlineClass = isOver
    ? 'outline outline-4 outline-blue-700 outline-offset-0 ring-4 ring-blue-200'
    : 'outline outline-4 outline-blue-600 outline-offset-0'

  return (
    <div
      ref={setNodeRef}
      className={`relative aspect-video w-full bg-slate-50 ${outlineClass} flex items-center justify-center overflow-hidden`}
      data-cover-slot={story.id}
      aria-label={`Cover for story ${story.name}. Drop an asset here to set it as cover.`}
    >
      {/* COVER pill — top-left, always visible */}
      <span className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 leading-none z-10">
        Cover
      </span>

      {/* Either: cover thumbnail OR empty-state hint */}
      {cover && cover.thumbnailRef ? (
        <>
          <img
            src={cover.thumbnailRef}
            alt={cover.filename}
            className="w-full h-full object-cover"
            draggable={false}
          />
          {/* Hover hint when an asset is being dragged over the slot
              and a cover already exists — affords replacement. */}
          {isOver && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest">
                Drop to replace
              </span>
            </div>
          )}
        </>
      ) : (
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2 text-center">
          {isOver ? 'Drop to set cover' : 'Drop here to set cover'}
        </span>
      )}
    </div>
  )
}
