/**
 * Frontfiles Upload V4 — Contact Sheet (D2.3 §1.1, D2.2 DnD augmented)
 *
 * Spec: UX-SPEC-V4 §3.3 (virtualized grid) + §3.4 (click model) + §8 (DnD).
 *
 * Two render paths per IPD2-5:
 *
 *   1. NORMAL (no story filter): virtualized 2D grid via react-window's
 *      FixedSizeGrid. Each card uses useDraggable so it can be dragged
 *      onto left-rail drop targets (story headers / Unassigned).
 *
 *   2. SORTABLE (filter.storyGroupId set): non-virtualized CSS grid wrapped
 *      in @dnd-kit SortableContext. Each card uses useSortable so it can
 *      be drag-reordered within the story. Sortable mode disables
 *      virtualization because @dnd-kit + react-window don't compose
 *      cleanly (drag would lose the dragged item across virtualization
 *      boundaries). Sortable view sizes are bounded (one story = ≤ 60-150
 *      cards typically) — no virtualization is acceptable.
 *
 * Click model per L5 + IPD3-11 (anchor = local component state):
 *   - single-click → SELECT_ASSET (replaces selection); set anchor
 *   - Cmd/Ctrl-click → TOGGLE_ASSET_SELECTION; set anchor
 *   - Shift-click from anchor → SELECT_RANGE (inclusive)
 *   - Click selection-checkbox stops propagation, synthesizes Cmd-click
 *   - Double-click → currently same as single
 *
 * DnD wiring:
 *   - DndContext lives at UploadShell root
 *   - Cards become drag sources here (via useDraggable / useSortable)
 *   - Drop targets live in LeftRail (story headers + Unassigned)
 *   - Drag-end handler at UploadShell routes by over.id and dispatches
 */

'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { FixedSizeGrid, type GridChildComponentProps } from 'react-window'
import { useDraggable } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUploadContext } from './UploadContext'
import {
  getFilteredSortedSearchedAssets,
  type FilterableView,
} from '@/lib/upload/upload-selectors'
import type { V2Asset } from '@/lib/upload/v3-types'
import ContactSheetCard from './ContactSheetCard'

const ZOOM_TO_CARD_WIDTH: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 80,
  2: 120,
  3: 160,
  4: 240,
  5: 360,
}
const CARD_GAP = 8

interface CellData {
  visible: V2Asset[]
  columns: number
  cardSize: number
  onClick: (assetId: string, event: MouseEvent) => void
}

export default function ContactSheet() {
  const { state, dispatch } = useUploadContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [anchorId, setAnchorId] = useState<string | null>(null)

  const filterView: FilterableView = useMemo(
    () => ({
      assetsById: state.assetsById,
      assetOrder: state.assetOrder,
      filter: state.ui.filter,
      searchQuery: state.ui.searchQuery,
      sortField: state.ui.sortField,
      sortDirection: state.ui.sortDirection,
    }),
    [
      state.assetsById,
      state.assetOrder,
      state.ui.filter,
      state.ui.searchQuery,
      state.ui.sortField,
      state.ui.sortDirection,
    ],
  )
  const visible = useMemo(() => getFilteredSortedSearchedAssets(filterView), [filterView])

  const cardWidth = ZOOM_TO_CARD_WIDTH[state.ui.contactSheetZoom]
  const cardHeight = Math.round((cardWidth * 9) / 16)
  const cardWithGap = cardWidth + CARD_GAP
  const rowWithGap = cardHeight + CARD_GAP
  const columns = Math.max(1, Math.floor((size.width + CARD_GAP) / cardWithGap))
  const rows = Math.ceil(visible.length / columns)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function measure() {
      if (el) setSize({ width: el.clientWidth, height: el.clientHeight })
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  function handleCardClick(assetId: string, event: MouseEvent): void {
    if (event.shiftKey && anchorId) {
      const ids = visible.map(a => a.id)
      const fromIdx = ids.indexOf(anchorId)
      const toIdx = ids.indexOf(assetId)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        dispatch({
          type: 'SELECT_RANGE',
          fromAssetId: ids[start],
          toAssetId: ids[end],
        })
        return
      }
    }
    if (event.metaKey || event.ctrlKey) {
      dispatch({ type: 'TOGGLE_ASSET_SELECTION', assetId })
      setAnchorId(assetId)
      return
    }
    dispatch({ type: 'SELECT_ASSET', assetId })
    setAnchorId(assetId)
  }

  if (visible.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-w-0 min-h-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400"
      >
        No assets match the current filter
      </div>
    )
  }

  // SORTABLE PATH — when filter narrows to a story (per IPD2-5).
  // Non-virtualized; cards drag-reorder via @dnd-kit/sortable.
  if (state.ui.filter.storyGroupId) {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-w-0 min-h-0 overflow-auto p-2"
        data-mode="sortable"
      >
        <SortableContext items={visible.map(a => a.id)} strategy={rectSortingStrategy}>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))` }}
          >
            {visible.map(asset => (
              <SortableCellRenderer
                key={asset.id}
                asset={asset}
                cardSize={cardWidth}
                onClick={handleCardClick}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    )
  }

  // DEFAULT PATH — virtualized via FixedSizeGrid; cards use useDraggable.
  return (
    <div ref={containerRef} className="flex-1 min-w-0 min-h-0 overflow-hidden" data-mode="virtual">
      {size.width > 0 && size.height > 0 && (
        <FixedSizeGrid<CellData>
          columnCount={columns}
          rowCount={rows}
          columnWidth={cardWithGap}
          rowHeight={rowWithGap}
          width={size.width}
          height={size.height}
          itemData={{ visible, columns, cardSize: cardWidth, onClick: handleCardClick }}
        >
          {DraggableGridCell}
        </FixedSizeGrid>
      )}
    </div>
  )
}

/**
 * Virtualized grid cell — wraps ContactSheetCard with useDraggable.
 * Each cell is independently draggable; drop happens at the DndContext
 * level (UploadShell) by routing over.id.
 */
function DraggableGridCell({
  columnIndex,
  rowIndex,
  style,
  data,
}: GridChildComponentProps<CellData>) {
  const idx = rowIndex * data.columns + columnIndex
  const asset = data.visible[idx]
  if (!asset) return null
  return (
    <div style={style} className="p-1">
      <DraggableCardRenderer asset={asset} cardSize={data.cardSize} onClick={data.onClick} />
    </div>
  )
}

/**
 * useDraggable wrapper — for the default (non-sortable) virtualized grid.
 * Spreads drag listeners + ref onto the inner ContactSheetCard.
 */
function DraggableCardRenderer({
  asset,
  cardSize,
  onClick,
}: {
  asset: V2Asset
  cardSize: number
  onClick: (assetId: string, event: MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    data: { kind: 'asset', assetId: asset.id },
  })
  return (
    <ContactSheetCard
      asset={asset}
      cardSize={cardSize}
      onClick={onClick}
      dragRef={setNodeRef}
      dragListeners={listeners as never}
      dragAttributes={attributes as never}
      isDragging={isDragging}
    />
  )
}

/**
 * useSortable wrapper — for the sortable (story-filtered) grid. Provides
 * positioning transforms in addition to drag listeners.
 */
function SortableCellRenderer({
  asset,
  cardSize,
  onClick,
}: {
  asset: V2Asset
  cardSize: number
  onClick: (assetId: string, event: MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: asset.id,
    data: { kind: 'asset', assetId: asset.id },
  })
  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <ContactSheetCard
      asset={asset}
      cardSize={cardSize}
      onClick={onClick}
      dragRef={setNodeRef}
      dragListeners={listeners as never}
      dragAttributes={attributes as never}
      dragStyle={dragStyle}
      isDragging={isDragging}
    />
  )
}
