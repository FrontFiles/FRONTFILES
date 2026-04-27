/**
 * Frontfiles Upload V4 — Contact Sheet Card (D2.3 §1.1, D2.2 drag-source augmented)
 *
 * Spec: UX-SPEC-V4 §3.3 (anatomy) + §3.4 (click model) + §11.3 (AI furniture
 * lives ONLY in the inspector — NOT here) + §8 (DnD interaction model).
 *
 * Single asset card. Preview-first. Renders ONLY:
 *   - Thumbnail (object-cover, square)
 *   - Selection checkbox top-left (visible on hover OR when selected)
 *   - Story badge top-right (only when storyGroupId !== null) (per IPD3-5 = a)
 *   - Filename overlay on hover (bottom)
 *   - Status dot bottom-right (per IPD3-4 priority order)
 *
 * NO ✓ accept icons. NO ↻ regenerate. NO Why? link. NO price text. NO chips
 * array. The contact sheet is a visual workspace, not an admin table.
 *
 * D2.2: drag-source props accepted from a parent wrapper (DraggableCellRenderer
 * or SortableCellRenderer in ContactSheet.tsx). The card itself stays
 * presentational — drag-hook calls live in the parent wrappers because
 * useDraggable vs useSortable can't be conditional inside one component.
 */

'use client'

import {
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type Ref,
} from 'react'
import { useUploadContext } from './UploadContext'
import { getAssetExceptions } from '@/lib/upload/upload-selectors'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
  cardSize: number
  /** Click handler from ContactSheet — handles single/Cmd/Shift modifier logic. */
  onClick: (assetId: string, event: MouseEvent) => void
  // ── D2.2 drag-source props (passed from parent wrapper) ──
  /** Ref from useDraggable / useSortable (setNodeRef). */
  dragRef?: Ref<HTMLDivElement>
  /** Listeners from useDraggable / useSortable. Spread onto the card root. */
  dragListeners?: HTMLAttributes<HTMLDivElement>
  /** Attributes (a11y) from useDraggable / useSortable. */
  dragAttributes?: HTMLAttributes<HTMLDivElement>
  /** Sortable transform style (only present when inside a SortableContext). */
  dragStyle?: CSSProperties
  /** True while this card is being dragged. */
  isDragging?: boolean
}

export default function ContactSheetCard({
  asset,
  cardSize,
  onClick,
  dragRef,
  dragListeners,
  dragAttributes,
  dragStyle,
  isDragging = false,
}: Props) {
  const { state } = useUploadContext()
  const isSelected = state.ui.selectedAssetIds.includes(asset.id)
  const story = asset.storyGroupId ? state.storyGroupsById[asset.storyGroupId] : null
  const dot = useMemo(() => resolveStatusDot(asset), [asset])

  // Per IPD3-9: prefer thumbnailRef; fall back to a NEW object-URL of
  // asset.file when no thumbnailRef exists. We do NOT revoke on unmount —
  // the blob URL is shared across surfaces (this card AND the right-rail
  // inspector both read asset.thumbnailRef from state). Revoking on
  // individual component unmount kills the URL while the asset is still
  // in state. Leak in dev is acceptable; URLs free on page refresh.
  // Production paths use real backend URLs (not blob:) and don't hit the
  // createObjectURL fallback at all.
  const url = useMemo<string | null>(() => {
    if (asset.thumbnailRef) return asset.thumbnailRef
    if (asset.file) {
      try {
        return URL.createObjectURL(asset.file)
      } catch {
        return null
      }
    }
    return null
  }, [asset.thumbnailRef, asset.file])

  // 16:9 landscape per founder lock (D2.3 visual feedback). Width is
  // zoom-driven; height = width × 9/16. Object-cover crops the thumbnail
  // to fill (no letterboxing). Editorial standard for mixed-media contact
  // sheets — matches video content natively, crops photo content cleanly.
  const cardHeight = Math.round((cardSize * 9) / 16)

  return (
    <div
      ref={dragRef}
      onClick={e => onClick(asset.id, e)}
      onDoubleClick={e => onClick(asset.id, e)}
      style={{ width: cardSize, height: cardHeight, ...dragStyle }}
      // D2.9 Move 2: image IS the card. No outer black border. Selection
      // is communicated via outline (not border) so it doesn't shift layout.
      // outline-offset-0 keeps the outline flush to the image edge.
      className={`relative cursor-pointer group overflow-hidden ${
        isSelected ? 'outline outline-2 outline-blue-600 outline-offset-0' : ''
      } ${asset.excluded ? 'opacity-50' : ''} ${isDragging ? 'opacity-40' : ''}`}
      data-asset-id={asset.id}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      {...dragListeners}
      {...dragAttributes}
    >
      {/* Thumbnail or placeholder.
          D2.9 Move 2: when no thumbnail, render a solid neutral block with
          a tiny 1-letter format pill top-left (replaces the old framed
          placeholder). The pill carries P / V / A / D for photo / video /
          audio / document. */}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={asset.filename}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-slate-200 pointer-events-none" aria-label={asset.format ?? 'asset'} />
      )}

      {/* D2.9 Move 2: 1-letter format pill top-left, only rendered when
          no thumbnail (placeholder branch). 8×8, solid black, white letter.
          Hidden under the selection checkbox on hover/select — acceptable
          overlap since the pill is identification, the checkbox is action. */}
      {!url && (
        <span
          className="absolute top-1 left-1 w-2 h-2 bg-black text-white text-[6px] font-bold uppercase leading-none flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          {formatLetter(asset.format)}
        </span>
      )}

      {/* Selection checkbox top-left — visible on hover OR when selected */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          // Cmd-click semantic = toggle. Synthesize the modifier for ContactSheet's handler.
          onClick(asset.id, { ...e, metaKey: true } as unknown as MouseEvent)
        }}
        className={`absolute top-1 left-1 w-4 h-4 border border-black bg-white flex items-center justify-center text-[10px] leading-none transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label={isSelected ? 'Deselect asset' : 'Select asset'}
        title={isSelected ? 'Deselect' : 'Select'}
      >
        {isSelected ? '✓' : ''}
      </button>

      {/* Story badge top-right (per IPD3-5 = a).
          D2.9 Move 2: 8px font (was 9px), no border, semi-transparent black
          bg with white text — reads as a quiet content tag, not a chip. */}
      {story && cardSize >= 120 && (
        <span
          className="absolute top-1 right-1 text-[8px] font-bold uppercase tracking-widest bg-black/70 text-white px-1 py-0.5 max-w-[70%] truncate pointer-events-none"
          title={story.name}
        >
          {story.name}
        </span>
      )}

      {/* Filename overlay on hover (bottom) — only at sizes where it's legible.
          D2.9 Move 2: gradient (from-black/85 → transparent at top) instead of
          solid black bar; reads as image polish, not a UI strip. */}
      {cardSize >= 120 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent text-white text-[10px] font-mono px-1.5 pt-3 pb-0.5 opacity-0 group-hover:opacity-100 truncate transition-opacity pointer-events-none">
          {asset.filename}
        </div>
      )}

      {/* Status dot bottom-right.
          D2.9 Move 2: 10×10 (was 8×8) with a 2px white ring. Legible against
          any image background — light or dark. */}
      <span
        className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-sm border-2 border-white ${dot.bg} pointer-events-none`}
        title={dot.label}
        aria-label={dot.label}
      />
    </div>
  )
}

/**
 * D2.9 Move 2 helper: 1-letter format identifier for the placeholder pill.
 * P = photo, V = video, A = audio, D = document/illustration/vector, ? = unknown.
 */
function formatLetter(format: V2Asset['format']): string {
  if (!format) return '?'
  if (format === 'photo') return 'P'
  if (format === 'video') return 'V'
  if (format === 'audio') return 'A'
  // illustration / infographic / vector / document → 'D'
  return 'D'
}

/**
 * Status dot resolution per IPD3-4 priority order:
 *   excluded > processing > duplicate > blocking > advisory > ready
 *
 * Returns Tailwind background class + a human label (used for tooltip + a11y).
 *
 * needs_story is filtered out of the blocking check per UX-BRIEF v3 §4.5
 * (Story groups are opt-in in V3) — same pattern as C2 chip rendering.
 */
function resolveStatusDot(asset: V2Asset): { bg: string; label: string } {
  if (asset.excluded) return { bg: 'bg-red-600', label: 'Excluded' }
  if (asset.analysisStatus !== 'complete') return { bg: 'bg-slate-400', label: 'Processing' }
  if (asset.duplicateStatus === 'likely_duplicate')
    return { bg: 'bg-orange-500', label: 'Possible duplicate' }

  const exceptions = getAssetExceptions(asset).filter(e => e.type !== 'needs_story')
  const blocking = exceptions.filter(e => e.severity === 'blocking')
  if (blocking.length > 0) return { bg: 'bg-yellow-400', label: 'Needs info' }

  const advisory = exceptions.filter(e => e.severity === 'advisory')
  if (advisory.length > 0) return { bg: 'bg-slate-400', label: 'Low confidence' }

  return { bg: 'bg-green-500', label: 'Ready' }
}
