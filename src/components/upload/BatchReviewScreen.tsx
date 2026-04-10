'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset, BatchFilterState, BatchCounters } from '@/lib/upload/batch-types'
import type { BatchAction } from '@/lib/upload/batch-state'
import { getCounters, getFilteredAssets, getExceptionAssets, getCommitSummary } from '@/lib/upload/batch-state'
import { BatchSummaryBar } from './BatchSummaryBar'
import { UploadFilters } from './UploadFilters'
import { BulkActionBar } from './BulkActionBar'
import { BulkEditDrawer } from './BulkEditDrawer'
import { UploadAssetRow } from './UploadAssetRow'
import { UploadAssetCard } from './UploadAssetCard'
import type { BulkApplyMode } from '@/lib/upload/batch-types'
import { MOCK_STORIES } from '@/lib/upload/batch-mock-data'
import type { PrivacyState, LicenceType } from '@/lib/upload/types'

interface BatchReviewScreenProps {
  assets: BatchAsset[]
  selectedAssetIds: string[]
  filterState: BatchFilterState
  viewMode: 'grid' | 'table'
  drawerOpen: boolean
  dispatch: (action: BatchAction) => void
}

export function BatchReviewScreen({
  assets,
  selectedAssetIds,
  filterState,
  viewMode,
  drawerOpen,
  dispatch,
}: BatchReviewScreenProps) {
  const counters = getCounters(assets)
  const filteredAssets = getFilteredAssets(assets, filterState)
  const exceptions = getExceptionAssets(assets)
  const summary = getCommitSummary(assets)
  const selectedAssets = assets.filter(a => selectedAssetIds.includes(a.id))

  const handleFilterState = (state: string) => {
    dispatch({ type: 'SET_FILTER', filter: { state: state as BatchFilterState['state'] } })
  }

  const handleBulkAction = (action: string) => {
    if (selectedAssetIds.length === 0) return

    switch (action) {
      case 'assign_story': {
        // Quick-assign first available story
        const story = MOCK_STORIES[0]
        dispatch({ type: 'BULK_UPDATE', assetIds: selectedAssetIds, updates: { storyAssignment: story }, mode: 'fill_blanks' })
        break
      }
      case 'set_privacy':
        dispatch({ type: 'BULK_UPDATE', assetIds: selectedAssetIds, updates: { privacy: 'PUBLIC' as PrivacyState }, mode: 'fill_blanks' })
        break
      case 'apply_licences':
        dispatch({ type: 'BULK_UPDATE', assetIds: selectedAssetIds, updates: { enabledLicences: ['editorial'] as LicenceType[] }, mode: 'fill_blanks' })
        break
      case 'apply_recommended_price':
        dispatch({ type: 'APPLY_RECOMMENDED_PRICES', assetIds: selectedAssetIds })
        break
      case 'hold_from_commit':
        dispatch({ type: 'BULK_UPDATE', assetIds: selectedAssetIds, updates: { heldFromCommit: true }, mode: 'overwrite' })
        break
      case 'remove_from_batch':
        dispatch({ type: 'REMOVE_ASSETS', assetIds: selectedAssetIds })
        break
    }
  }

  const handleBulkUpdate = (updates: Record<string, unknown>, mode: BulkApplyMode) => {
    dispatch({ type: 'BULK_UPDATE', assetIds: selectedAssetIds, updates: updates as BatchAction extends { type: 'BULK_UPDATE' } ? BatchAction['updates'] : never, mode })
  }

  const handleApplyRecommendedPrices = () => {
    dispatch({ type: 'APPLY_RECOMMENDED_PRICES', assetIds: selectedAssetIds })
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Summary + Filters */}
        <div className="p-4 space-y-3 border-b border-slate-200 flex-shrink-0">
          <BatchSummaryBar
            counters={counters}
            onFilterState={handleFilterState}
            activeFilter={filterState.state}
          />
          <UploadFilters
            filter={filterState}
            onFilter={(f) => dispatch({ type: 'SET_FILTER', filter: f })}
            viewMode={viewMode}
            onViewMode={(mode) => dispatch({ type: 'SET_VIEW_MODE', mode })}
          />
        </div>

        {/* Bulk Action Bar */}
        <div className="flex-shrink-0">
          <BulkActionBar
            selectedCount={selectedAssetIds.length}
            totalCount={filteredAssets.length}
            onSelectAll={() => dispatch({ type: 'SELECT_ALL' })}
            onDeselectAll={() => dispatch({ type: 'DESELECT_ALL' })}
            onBulkAction={handleBulkAction}
            onToggleDrawer={() => dispatch({ type: 'TOGGLE_DRAWER' })}
          />
        </div>

        {/* Asset list/grid */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'table' ? (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0}
                      onChange={() => {
                        if (selectedAssetIds.length === filteredAssets.length) {
                          dispatch({ type: 'DESELECT_ALL' })
                        } else {
                          dispatch({ type: 'SELECT_ASSETS', assetIds: filteredAssets.map(a => a.id) })
                        }
                      }}
                      className="w-3.5 h-3.5 accent-[#0000ff]"
                    />
                  </th>
                  <th className="w-12 px-1 py-2" />
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Format</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Size</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Story</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Privacy</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Price</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">State</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => (
                  <UploadAssetRow
                    key={asset.id}
                    asset={asset}
                    selected={selectedAssetIds.includes(asset.id)}
                    onToggleSelect={() => dispatch({ type: 'TOGGLE_SELECT_ASSET', assetId: asset.id })}
                    onEdit={() => dispatch({ type: 'TOGGLE_DRAWER' })}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredAssets.map(asset => (
                <UploadAssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedAssetIds.includes(asset.id)}
                  onToggleSelect={() => dispatch({ type: 'TOGGLE_SELECT_ASSET', assetId: asset.id })}
                  onEdit={() => dispatch({ type: 'TOGGLE_DRAWER' })}
                />
              ))}
            </div>
          )}

          {filteredAssets.length === 0 && (
            <div className="p-8 text-center">
              <span className="text-sm font-mono text-slate-400">No assets match current filters</span>
            </div>
          )}
        </div>

        {/* Bottom bar: commit-ready summary */}
        <div className="border-t-2 border-black p-3 flex items-center justify-between flex-shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {summary.readyAssets.length} READY TO COMMIT
            </span>
            {exceptions.length > 0 && (
              <button
                onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'exceptions' })}
                className="text-[10px] font-bold uppercase tracking-widest text-black border-b border-black hover:text-[#0000ff] hover:border-[#0000ff] transition-colors"
              >
                {exceptions.length} EXCEPTIONS
              </button>
            )}
            {summary.heldAssets.length > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                {summary.heldAssets.length} held
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {summary.totalPrice > 0 && (
              <span className="text-sm font-mono font-bold">
                &euro;{(summary.totalPrice / 100).toFixed(0)} total
              </span>
            )}
            <button
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'commit' })}
              disabled={summary.readyAssets.length === 0}
              className={cn(
                'px-4 py-2 text-xs font-bold uppercase tracking-widest border-2 transition-colors',
                summary.readyAssets.length > 0
                  ? 'border-[#0000ff] bg-[#0000ff] text-white hover:bg-[#0000cc]'
                  : 'border-slate-200 text-slate-300 cursor-not-allowed'
              )}
            >
              Review Commit
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Edit Drawer */}
      <BulkEditDrawer
        open={drawerOpen}
        selectedAssets={selectedAssets}
        onClose={() => dispatch({ type: 'TOGGLE_DRAWER' })}
        onBulkUpdate={handleBulkUpdate}
        onApplyRecommendedPrices={handleApplyRecommendedPrices}
      />
    </div>
  )
}
