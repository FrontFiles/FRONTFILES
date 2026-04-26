/**
 * Frontfiles Upload V4 — Contact Sheet Card (D2.3 §1.1)
 *
 * Spec: UX-SPEC-V4 §3.3 (anatomy) + §3.4 (click model) + §11.3 (AI furniture
 * lives ONLY in the inspector — NOT here).
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
 * DnD source wiring is DEFERRED to D2.2 (per IPD3-1 default = a). Click-only
 * for now. Drag handle + DragOverlay land when D2.2 ships left-rail receivers.
 */

'use client'

import { useEffect, useMemo, type MouseEvent } from 'react'
import { useUploadContext } from '../_components/UploadContext'
import { getAssetExceptions } from '@/lib/upload/upload-selectors'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
  cardSize: number
  /** Click handler from ContactSheet — handles single/Cmd/Shift modifier logic. */
  onClick: (assetId: string, event: MouseEvent) => void
}

export default function ContactSheetCard({ asset, cardSize, onClick }: Props) {
  const { state } = useUploadContext()
  const isSelected = state.ui.selectedAssetIds.includes(asset.id)
  const story = asset.storyGroupId ? state.storyGroupsById[asset.storyGroupId] : null
  const dot = useMemo(() => resolveStatusDot(asset), [asset])

  // Object-URL hygiene per IPD3-9 (same pattern as C2 SideDetailPanel thumbnail).
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

  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [url])

  // 16:9 landscape per founder lock (D2.3 visual feedback). Width is
  // zoom-driven; height = width × 9/16. Object-cover crops the thumbnail
  // to fill (no letterboxing). Editorial standard for mixed-media contact
  // sheets — matches video content natively, crops photo content cleanly.
  const cardHeight = Math.round((cardSize * 9) / 16)

  return (
    <div
      onClick={e => onClick(asset.id, e)}
      onDoubleClick={e => onClick(asset.id, e)}
      style={{ width: cardSize, height: cardHeight }}
      className={`relative bg-slate-100 cursor-pointer group overflow-hidden ${
        isSelected ? 'border-2 border-blue-600' : 'border border-black'
      } ${asset.excluded ? 'opacity-50' : ''}`}
      data-asset-id={asset.id}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
    >
      {/* Thumbnail or placeholder */}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={asset.filename}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-center text-slate-400 bg-slate-100 pointer-events-none">
          <span className="text-[8px] font-bold uppercase tracking-widest">
            {asset.format ?? 'asset'}
          </span>
          {cardSize >= 160 && (
            <span className="text-[8px] font-mono text-slate-500 mt-1 px-1 truncate w-full">
              {asset.filename}
            </span>
          )}
        </div>
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

      {/* Story badge top-right (per IPD3-5 = a) */}
      {story && cardSize >= 120 && (
        <span
          className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-widest bg-white border border-black px-1 py-0.5 max-w-[70%] truncate pointer-events-none"
          title={story.name}
        >
          {story.name}
        </span>
      )}

      {/* Filename overlay on hover (bottom) — only at sizes where it's legible */}
      {cardSize >= 120 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 opacity-0 group-hover:opacity-100 truncate transition-opacity pointer-events-none">
          {asset.filename}
        </div>
      )}

      {/* Status dot bottom-right — small square per brutalist convention */}
      <span
        className={`absolute bottom-1 right-1 w-2 h-2 border border-black ${dot.bg} pointer-events-none`}
        title={dot.label}
        aria-label={dot.label}
      />
    </div>
  )
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
