/**
 * Frontfiles Upload V3 — Asset List density router (C2.2 §3.2)
 *
 * Spec: UX-SPEC-V3.md §3–§6.
 *
 * The heart of the new upload UX. Reads asset count, derives density
 * via densityForCount, renders the appropriate variant:
 *
 *   linear   → plain stack of AssetRow (no virtualization, small N)
 *   compact  → virtualized list of AssetRowCompact (react-window per IPII-1)
 *   batch    → same as compact + auto-show BulkOpsBar + FilterBar +
 *              AIProposalBanner
 *   archive  → StoryGroupAccordion per cluster + ungrouped section
 *              (UNLESS state.ui.flatListOverride is on → flat-Compact)
 *
 * Filter/sort/search applied via getFilteredSortedSearchedAssets.
 */

'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { FixedSizeList, type ListChildComponentProps } from 'react-window'
import { useUploadContext } from './UploadContext'
import {
  densityForCount,
  type V3DensityMode,
} from '@/lib/upload/v3-types'
import {
  getFilteredSortedSearchedAssets,
  getStoryGroups,
  type FilterableView,
} from '@/lib/upload/upload-selectors'
import AssetRow from './AssetRow'
import AssetRowCompact from './AssetRowCompact'
import StoryGroupAccordion from './StoryGroupAccordion'
import BulkOpsBar from './BulkOpsBar'
import FilterBar from './FilterBar'
import AIProposalBanner from './AIProposalBanner'

const COMPACT_ROW_HEIGHT = 72 // ~64px row + 8px gap

export default function AssetList() {
  const { state } = useUploadContext()
  const density = densityForCount(state.assetOrder.length)

  // Filtered + sorted + searched assets via shared selector
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

  if (state.assetOrder.length === 0) {
    return (
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 p-6">
        Drop files above to begin
      </div>
    )
  }

  // ── Linear ─────────────────────────────────────────
  if (density === 'linear') {
    return (
      <div className="flex flex-col gap-3 p-3 min-w-0">
        {visible.map(asset => (
          <AssetRow key={asset.id} asset={asset} />
        ))}
      </div>
    )
  }

  // ── Compact / Batch / Archive ───────────────────────

  // Auto-show bulk ops bar in Batch + Archive; respect toggle in Compact.
  const showBulkOpsBar = density === 'batch' || density === 'archive' || state.ui.bulkOpsBarOpen
  const showFilterBar = density === 'batch' || density === 'archive'

  // Archive mode (with flat-list override per IPII-8)
  if (density === 'archive' && !state.ui.flatListOverride) {
    return (
      <div className="flex flex-col min-w-0">
        {showBulkOpsBar && <BulkOpsBar />}
        {showFilterBar && <FilterBar />}
        <div className="p-3">
          <AIProposalBanner />
          <ArchiveAccordionList visible={visible} />
        </div>
      </div>
    )
  }

  // Compact / Batch / Archive-flat-override → virtualized flat list
  return (
    <div className="flex flex-col min-w-0 flex-1">
      {showBulkOpsBar && <BulkOpsBar />}
      {showFilterBar && <FilterBar />}
      {density === 'archive' && state.ui.flatListOverride && <ArchiveFlatNotice />}
      <div className="flex-1 p-3 min-w-0">
        {(density === 'batch' || density === 'archive') && <AIProposalBanner />}
        <VirtualizedCompactList assets={visible} />
      </div>
    </div>
  )
}

/**
 * Virtualized list of AssetRowCompact via react-window. Auto-resizes
 * to fill the viewport via a parent ref.
 */
function VirtualizedCompactList({ assets }: { assets: { id: string }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(600)

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        // 70% of viewport as a reasonable working target
        setHeight(Math.max(400, window.innerHeight * 0.7))
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  if (assets.length === 0) {
    return (
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 p-3">
        No assets match the current filter
      </div>
    )
  }

  // For very small lists (< 20), skip virtualization overhead
  if (assets.length < 20) {
    return (
      <div className="flex flex-col gap-2">
        {assets.map(asset => (
          <CompactRowFromContext key={asset.id} assetId={asset.id} />
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <FixedSizeList
        height={height}
        itemCount={assets.length}
        itemSize={COMPACT_ROW_HEIGHT}
        width="100%"
        itemData={assets}
      >
        {VirtualizedRow}
      </FixedSizeList>
    </div>
  )
}

function VirtualizedRow({ index, style, data }: ListChildComponentProps<{ id: string }[]>) {
  const asset = data[index]
  return (
    <div style={style} className="px-1 pb-2">
      <CompactRowFromContext assetId={asset.id} />
    </div>
  )
}

/**
 * Reads the asset from context by id. This indirection lets the
 * virtualized list pass only the id (lightweight) while the row
 * component pulls fresh state per render.
 */
function CompactRowFromContext({ assetId }: { assetId: string }) {
  const { state } = useUploadContext()
  const asset = state.assetsById[assetId]
  if (!asset) return null
  return <AssetRowCompact asset={asset} />
}

/**
 * Archive mode: render StoryGroupAccordion per cluster + ungrouped
 * section. Per IPII-3: first cluster is auto-expanded by default; this
 * is a pure-render concern (the reducer doesn't track default-expanded).
 */
function ArchiveAccordionList({
  visible,
}: {
  visible: { id: string; storyGroupId: string | null }[]
}) {
  const { state, dispatch } = useUploadContext()
  const groups = getStoryGroups(state)

  // Auto-expand first cluster on initial render if no clusters expanded
  useEffect(() => {
    if (state.ui.expandedClusterIds.length === 0 && groups.length > 0) {
      dispatch({ type: 'TOGGLE_CLUSTER_EXPANDED', clusterId: groups[0].id })
    }
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bucket visible assets by clusterId
  const buckets = useMemo(() => {
    const m = new Map<string | 'ungrouped', typeof visible>()
    for (const a of visible) {
      const key = a.storyGroupId ?? 'ungrouped'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(a)
    }
    return m
  }, [visible])

  return (
    <>
      {groups.map(g => {
        const clusterAssets = buckets.get(g.id) ?? []
        const fullAssets = clusterAssets
          .map(a => state.assetsById[a.id])
          .filter(Boolean)
        return <StoryGroupAccordion key={g.id} cluster={g} assets={fullAssets} />
      })}
      {(() => {
        const ungrouped = (buckets.get('ungrouped') ?? [])
          .map(a => state.assetsById[a.id])
          .filter(Boolean)
        if (ungrouped.length === 0) return null
        return (
          <div className="border border-black bg-white p-3 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Ungrouped — {ungrouped.length} assets
            </div>
            <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
              {ungrouped.map(asset => (
                <AssetRowCompact key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        )
      })()}
    </>
  )
}

function ArchiveFlatNotice() {
  const { dispatch } = useUploadContext()
  return (
    <div className="border-b border-black bg-yellow-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black flex items-center justify-between">
      <span>Flat list override active — accordion grouped view disabled</span>
      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE_FLAT_LIST_OVERRIDE' })}
        className="border border-black px-2 py-0.5 hover:bg-black hover:text-white transition-colors"
      >
        Return to grouped view
      </button>
    </div>
  )
}
