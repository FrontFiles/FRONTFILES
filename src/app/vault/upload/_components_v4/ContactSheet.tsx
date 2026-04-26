/**
 * Frontfiles Upload V4 — Contact Sheet (D2.3 §1.1)
 *
 * Spec: UX-SPEC-V4 §3.3 (virtualized grid) + §3.4 (click model).
 *
 * Virtualized 2D grid via react-window's FixedSizeGrid (v1.x already pinned
 * in C2). Column count derived from container width + cardWidth (zoom-driven).
 * Row count = ceil(visible.length / columns).
 *
 * Click model per L5 + IPD3-11 (anchor = local component state):
 *   - single-click → SELECT_ASSET (replaces selection); set anchor
 *   - Cmd/Ctrl-click → TOGGLE_ASSET_SELECTION; set anchor
 *   - Shift-click from anchor → SELECT_RANGE (inclusive)
 *   - Click selection-checkbox stops propagation, synthesizes Cmd-click
 *   - Double-click → currently same as single (per IPD3-3 = a); D2.4 adds
 *     inspector full-bleed
 *
 * DnD source wiring DEFERRED to D2.2 (per IPD3-1 default = a). When D2.2
 * lands, ContactSheetCard becomes a draggable; this component remains
 * unchanged (DragContext lives at UploadShellV4 root).
 */

'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { FixedSizeGrid, type GridChildComponentProps } from 'react-window'
import { useUploadContext } from '../_components/UploadContext'
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

  // Anchor for shift-click range select. Local state per IPD3-11 = (a).
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
  const cardWithGap = cardWidth + CARD_GAP
  const columns = Math.max(1, Math.floor((size.width + CARD_GAP) / cardWithGap))
  const rows = Math.ceil(visible.length / columns)

  // ResizeObserver to track container size; FixedSizeGrid needs explicit
  // width + height. Avoids the react-virtualized-auto-sizer dep.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function measure() {
      if (el) {
        setSize({ width: el.clientWidth, height: el.clientHeight })
      }
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  function handleCardClick(assetId: string, event: MouseEvent): void {
    if (event.shiftKey && anchorId) {
      // Range-select. Validate anchor is still in the visible list (it may
      // have been filtered out since anchor was set); if not, fall back to
      // single-select behavior.
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
      // Anchor stale → fall through to single-select.
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

  return (
    <div ref={containerRef} className="flex-1 min-w-0 min-h-0 overflow-hidden">
      {size.width > 0 && size.height > 0 && (
        <FixedSizeGrid<CellData>
          columnCount={columns}
          rowCount={rows}
          columnWidth={cardWithGap}
          rowHeight={cardWithGap}
          width={size.width}
          height={size.height}
          itemData={{ visible, columns, cardSize: cardWidth, onClick: handleCardClick }}
        >
          {GridCell}
        </FixedSizeGrid>
      )}
    </div>
  )
}

function GridCell({ columnIndex, rowIndex, style, data }: GridChildComponentProps<CellData>) {
  const idx = rowIndex * data.columns + columnIndex
  const asset = data.visible[idx]
  if (!asset) return null
  return (
    <div style={style} className="p-1">
      <ContactSheetCard asset={asset} cardSize={data.cardSize} onClick={data.onClick} />
    </div>
  )
}
