'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import {
  getFilteredAssets,
  getStoryGroups,
  getAssetExceptions,
  centsToEur,
} from '@/lib/upload/v2-state'
import type { V2Asset } from '@/lib/upload/v2-types'
import type { PrivacyState } from '@/lib/upload/types'
import { ASSET_FORMAT_LABELS, LICENCE_TYPE_LABELS, DECLARATION_STATE_LABELS } from '@/lib/upload/types'
import {
  AlertTriangle, Check, Loader2, Eye, EyeOff, ArrowUp, ArrowDown,
} from 'lucide-react'

// Privacy cycle used inline in the table rows
const PRIVACY_CYCLE: (PrivacyState | null)[] = [null, 'PUBLIC', 'PRIVATE', 'RESTRICTED']

type SortField = 'filename' | 'format' | 'story' | 'privacy' | 'price' | 'declaration' | 'issues'

export function AssetTable() {
  const { state, dispatch } = useUploadV2()
  const groups = getStoryGroups(state)
  const filteredAssets = getFilteredAssets(state)
  const isCompact = state.ui.density === 'compact'

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ assetId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Last clicked for shift-select
  const lastClickedRef = useRef<string | null>(null)

  // Show create story inline from dropdown
  const [creatingStoryForAsset, setCreatingStoryForAsset] = useState<string | null>(null)
  const [newStoryNameInline, setNewStoryNameInline] = useState('')

  const startEdit = (assetId: string, field: string, currentValue: string) => {
    setEditingCell({ assetId, field })
    setEditValue(currentValue)
  }

  const commitEdit = () => {
    if (!editingCell) return
    const { assetId, field } = editingCell
    if (field === 'title') {
      dispatch({ type: 'UPDATE_ASSET_FIELD', assetId, field: 'title', value: editValue })
    } else if (field === 'price') {
      const cents = Math.round(parseFloat(editValue) * 100)
      if (!isNaN(cents) && cents >= 0) {
        dispatch({ type: 'UPDATE_ASSET_FIELD', assetId, field: 'price', value: cents })
      }
    }
    setEditingCell(null)
  }

  const isSelected = (id: string) => state.ui.selectedAssetIds.includes(id)
  const isFocused = (id: string) => state.ui.focusedAssetId === id

  const handleSelectAll = () => {
    if (state.ui.selectedAssetIds.length === filteredAssets.length) {
      dispatch({ type: 'DESELECT_ALL_ASSETS' })
    } else {
      dispatch({ type: 'SELECT_ASSETS', assetIds: filteredAssets.map(a => a.id) })
    }
  }

  const handleRowClick = (assetId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRef.current) {
      dispatch({ type: 'SELECT_RANGE', fromAssetId: lastClickedRef.current, toAssetId: assetId })
    } else {
      dispatch({ type: 'SELECT_ASSET', assetId })
    }
    lastClickedRef.current = assetId
  }

  const handleSort = (field: SortField) => {
    if (state.ui.sortField === field) {
      dispatch({ type: 'SET_SORT', field, direction: state.ui.sortDirection === 'asc' ? 'desc' : 'asc' })
    } else {
      dispatch({ type: 'SET_SORT', field, direction: 'asc' })
    }
  }

  // ── Keyboard Navigation (Newsroom Mode) ──
  const tableRef = useRef<HTMLDivElement>(null)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle when not editing inline
    if (editingCell) return
    const focusedId = state.ui.focusedAssetId
    const assetIds = filteredAssets.map(a => a.id)
    const currentIdx = focusedId ? assetIds.indexOf(focusedId) : -1

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const nextIdx = Math.min(currentIdx + 1, assetIds.length - 1)
        if (assetIds[nextIdx]) {
          if (e.shiftKey) {
            dispatch({ type: 'TOGGLE_ASSET_SELECTION', assetId: assetIds[nextIdx] })
          } else {
            dispatch({ type: 'SELECT_ASSET', assetId: assetIds[nextIdx] })
          }
        }
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prevIdx = Math.max(currentIdx - 1, 0)
        if (assetIds[prevIdx]) {
          if (e.shiftKey) {
            dispatch({ type: 'TOGGLE_ASSET_SELECTION', assetId: assetIds[prevIdx] })
          } else {
            dispatch({ type: 'SELECT_ASSET', assetId: assetIds[prevIdx] })
          }
        }
        break
      }
      case ' ': {
        e.preventDefault()
        if (focusedId) {
          dispatch({ type: 'TOGGLE_ASSET_SELECTION', assetId: focusedId })
        }
        break
      }
      case 'Enter': {
        if (focusedId) {
          const asset = state.assetsById[focusedId]
          if (asset) {
            startEdit(focusedId, 'title', asset.editable.title)
          }
        }
        break
      }
      case 'a': {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          dispatch({ type: 'SELECT_ASSETS', assetIds: assetIds })
        }
        break
      }
      case 'Escape': {
        dispatch({ type: 'DESELECT_ALL_ASSETS' })
        break
      }
    }
  }, [editingCell, filteredAssets, state.ui.focusedAssetId, state.assetsById, dispatch])

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleCreateStoryFromDropdown = () => {
    if (newStoryNameInline.trim()) {
      dispatch({ type: 'CREATE_STORY_GROUP', name: newStoryNameInline.trim() })
      setCreatingStoryForAsset(null)
      setNewStoryNameInline('')
    }
  }

  // Sort indicator helper
  const sortIcon = (field: SortField) => {
    if (state.ui.sortField !== field) return null
    return state.ui.sortDirection === 'asc'
      ? <ArrowUp size={8} className="inline ml-0.5" />
      : <ArrowDown size={8} className="inline ml-0.5" />
  }

  // Bulk assign dropdown
  const [showBulkAssign, setShowBulkAssign] = useState(false)

  // Grid columns based on density
  const gridCols = isCompact
    ? 'grid-cols-[28px_20px_1fr_60px_100px_60px_60px_50px_20px]'
    : 'grid-cols-[28px_28px_1fr_80px_120px_70px_80px_80px_60px_60px_28px]'

  return (
    <div ref={tableRef} tabIndex={0} className="flex flex-col h-full outline-none">
      {/* Bulk actions bar (shown when multi-select) */}
      {state.ui.selectedAssetIds.length > 1 && (
        <div className="px-3 py-1.5 border-b border-black bg-blue-50 flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-blue-700">
            {state.ui.selectedAssetIds.length} selected
          </span>
          <div className="relative">
            <button
              onClick={() => setShowBulkAssign(!showBulkAssign)}
              className="px-2 py-1 text-[10px] font-bold uppercase border border-blue-600 text-blue-600 hover:bg-blue-100"
            >
              Assign to Story
            </button>
            {showBulkAssign && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border-2 border-black shadow-lg min-w-[200px]">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => {
                      dispatch({ type: 'BULK_ASSIGN_ASSETS', assetIds: state.ui.selectedAssetIds, storyGroupId: g.id })
                      setShowBulkAssign(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => dispatch({
              type: 'BULK_UPDATE_FIELD',
              assetIds: state.ui.selectedAssetIds,
              field: 'privacy',
              value: 'PUBLIC',
            })}
            className="px-2 py-1 text-[10px] font-bold uppercase border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            Set Public
          </button>
          <button
            onClick={() => dispatch({
              type: 'BULK_UPDATE_FIELD',
              assetIds: state.ui.selectedAssetIds,
              field: 'privacy',
              value: 'PRIVATE',
            })}
            className="px-2 py-1 text-[10px] font-bold uppercase border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            Set Private
          </button>
          <button
            onClick={() => {
              for (const id of state.ui.selectedAssetIds) {
                const a = state.assetsById[id]
                if (!a?.editable.privacy && a?.proposal?.privacySuggestion) {
                  dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: id, field: 'privacy', value: a.proposal.privacySuggestion })
                }
              }
            }}
            className="px-2 py-1 text-[10px] font-bold uppercase border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50"
          >
            Apply Suggested Privacy
          </button>
          <button
            onClick={() => {
              for (const id of state.ui.selectedAssetIds) {
                const a = state.assetsById[id]
                if (a?.editable.licences.length === 0 && a?.proposal?.licenceSuggestions?.length) {
                  dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: id, field: 'licences', value: [...a.proposal.licenceSuggestions] })
                }
              }
            }}
            className="px-2 py-1 text-[10px] font-bold uppercase border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50"
          >
            Apply Suggested Licences
          </button>
          <button
            onClick={() => {
              for (const id of state.ui.selectedAssetIds) {
                const a = state.assetsById[id]
                if (a?.proposal?.priceSuggestion) {
                  dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: id, field: 'price', value: a.proposal.priceSuggestion.amount })
                }
              }
            }}
            className="px-2 py-1 text-[10px] font-bold uppercase border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50"
          >
            Apply Suggested Prices
          </button>
          <button
            onClick={() => {
              for (const id of state.ui.selectedAssetIds) {
                dispatch({ type: 'TOGGLE_ASSET_EXCLUDED', assetId: id })
              }
            }}
            className="px-2 py-1 text-[10px] font-bold uppercase border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            Toggle Exclude
          </button>
          <button
            onClick={() => dispatch({ type: 'DESELECT_ALL_ASSETS' })}
            className="ml-auto px-2 py-1 text-[10px] text-slate-400 hover:text-black"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table header */}
      <div className={cn(
        'px-3 py-1.5 border-b border-slate-200 grid gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-white flex-shrink-0 items-center select-none',
        isCompact ? gridCols : gridCols,
      )}>
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={state.ui.selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0}
            onChange={handleSelectAll}
            className="w-3 h-3"
          />
        </div>
        <div>{/* exception indicator */}</div>
        <div className="cursor-pointer hover:text-black" onClick={() => handleSort('filename')}>
          Title {sortIcon('filename')}
        </div>
        <div className="cursor-pointer hover:text-black" onClick={() => handleSort('format')}>
          Format {sortIcon('format')}
        </div>
        <div className="cursor-pointer hover:text-black" onClick={() => handleSort('story')}>
          Story {sortIcon('story')}
        </div>
        <div className="cursor-pointer hover:text-black" onClick={() => handleSort('privacy')}>
          Privacy {sortIcon('privacy')}
        </div>
        <div className="cursor-pointer hover:text-black" onClick={() => handleSort('price')}>
          Price {sortIcon('price')}
        </div>
        {!isCompact && (
          <div className="cursor-pointer hover:text-black" onClick={() => handleSort('declaration')}>
            Decl. {sortIcon('declaration')}
          </div>
        )}
        {!isCompact && (
          <div className="cursor-pointer hover:text-black" onClick={() => handleSort('issues')}>
            Issues {sortIcon('issues')}
          </div>
        )}
        <div>Lic.</div>
        <div>{/* exclude */}</div>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto">
        {filteredAssets.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            No assets match the current filter.
          </div>
        )}
        {filteredAssets.map(asset => (
          <AssetRow
            key={asset.id}
            asset={asset}
            isCompact={isCompact}
            gridCols={gridCols}
            isFocused={isFocused(asset.id)}
            isSelectedRow={isSelected(asset.id)}
            editingCell={editingCell}
            editValue={editValue}
            setEditValue={setEditValue}
            startEdit={startEdit}
            commitEdit={commitEdit}
            setEditingCell={setEditingCell}
            onRowClick={handleRowClick}
            creatingStoryForAsset={creatingStoryForAsset}
            setCreatingStoryForAsset={setCreatingStoryForAsset}
            newStoryNameInline={newStoryNameInline}
            setNewStoryNameInline={setNewStoryNameInline}
            handleCreateStoryFromDropdown={handleCreateStoryFromDropdown}
          />
        ))}
      </div>
    </div>
  )
}

interface AssetRowProps {
  asset: V2Asset
  isCompact: boolean
  gridCols: string
  isFocused: boolean
  isSelectedRow: boolean
  editingCell: { assetId: string; field: string } | null
  editValue: string
  setEditValue: (v: string) => void
  startEdit: (assetId: string, field: string, currentValue: string) => void
  commitEdit: () => void
  setEditingCell: (v: null) => void
  onRowClick: (assetId: string, e: React.MouseEvent) => void
  creatingStoryForAsset: string | null
  setCreatingStoryForAsset: (v: string | null) => void
  newStoryNameInline: string
  setNewStoryNameInline: (v: string) => void
  handleCreateStoryFromDropdown: () => void
}

function AssetRow({
  asset,
  isCompact,
  gridCols,
  isFocused,
  isSelectedRow,
  editingCell,
  editValue,
  setEditValue,
  startEdit,
  commitEdit,
  setEditingCell,
  onRowClick,
  creatingStoryForAsset,
  setCreatingStoryForAsset,
  newStoryNameInline,
  setNewStoryNameInline,
  handleCreateStoryFromDropdown,
}: AssetRowProps) {
  const { state, dispatch } = useUploadV2()
  const groups = getStoryGroups(state)
  const exceptions = getAssetExceptions(asset)
  const hasBlocking = exceptions.some(e => e.severity === 'blocking')
  const hasAdvisory = exceptions.some(e => e.severity === 'advisory')
  const isAnalysing = asset.analysisStatus !== 'complete' && asset.analysisStatus !== 'failed'
  const isFailed = asset.analysisStatus === 'failed'

  const getExceptionBorderColor = (): string => {
    if (isFailed) return 'border-l-black'
    if (asset.excluded) return 'border-l-slate-300'
    if (hasBlocking) return 'border-l-red-500'
    if (hasAdvisory) return 'border-l-amber-400'
    return 'border-l-transparent'
  }

  const rowPy = isCompact ? 'py-0.5' : 'py-1.5'

  return (
    <div
      className={cn(
        'px-3 grid gap-1 items-center text-xs border-b border-slate-50 border-l-3 cursor-pointer transition-colors',
        rowPy,
        gridCols,
        getExceptionBorderColor(),
        isFocused && 'bg-blue-50',
        isSelectedRow && !isFocused && 'bg-slate-50',
        asset.excluded && 'opacity-40',
        isFailed && 'bg-slate-50 opacity-60',
      )}
      onClick={e => onRowClick(asset.id, e)}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelectedRow}
          onChange={() => dispatch({ type: 'TOGGLE_ASSET_SELECTION', assetId: asset.id })}
          className="w-3 h-3"
        />
      </div>

      {/* Exception indicator */}
      <div className="flex items-center justify-center">
        {isFailed && <span className="text-[8px] font-bold bg-black text-white px-1 py-0.5 uppercase tracking-wide">Failed</span>}
        {!isFailed && isAnalysing && <Loader2 size={12} className="text-slate-300 animate-spin" />}
        {!isFailed && !isAnalysing && hasBlocking && <AlertTriangle size={12} className="text-red-500" />}
        {!isFailed && !isAnalysing && !hasBlocking && hasAdvisory && <AlertTriangle size={12} className="text-amber-400" />}
        {!isFailed && !isAnalysing && !hasBlocking && !hasAdvisory && !asset.excluded && <Check size={12} className="text-blue-600" />}
      </div>

      {/* Title (inline editable) */}
      <div className="min-w-0" onClick={e => e.stopPropagation()}>
        {editingCell?.assetId === asset.id && editingCell.field === 'title' ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
            className="w-full text-xs border-b-2 border-blue-600 bg-transparent outline-none py-0.5"
          />
        ) : (
          <span
            className="truncate block cursor-text hover:bg-blue-50 px-1 py-0.5 -mx-1"
            onClick={() => startEdit(asset.id, 'title', asset.editable.title)}
            title={asset.editable.title || asset.filename}
          >
            {asset.editable.title || <span className="text-slate-300 italic">{asset.filename}</span>}
          </span>
        )}
      </div>

      {/* Format */}
      <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">
        {asset.format ? ASSET_FORMAT_LABELS[asset.format] : '\u2014'}
      </div>

      {/* Story (dropdown with Create New Story option) */}
      <div onClick={e => e.stopPropagation()}>
        {creatingStoryForAsset === asset.id ? (
          <div className="flex items-center gap-0.5">
            <input
              autoFocus
              value={newStoryNameInline}
              onChange={e => setNewStoryNameInline(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateStoryFromDropdown()
                if (e.key === 'Escape') { setCreatingStoryForAsset(null); setNewStoryNameInline('') }
              }}
              placeholder="Name..."
              className="flex-1 text-[10px] border-b border-blue-600 bg-transparent outline-none py-0.5 min-w-0"
            />
            <button onClick={() => { setCreatingStoryForAsset(null); setNewStoryNameInline('') }} className="p-0.5">
              <X size={8} className="text-slate-400" />
            </button>
          </div>
        ) : (
          <select
            value={asset.storyGroupId ?? ''}
            onChange={e => {
              const val = e.target.value
              if (val === '__create__') {
                setCreatingStoryForAsset(asset.id)
                setNewStoryNameInline('')
              } else if (val) {
                dispatch({ type: 'ASSIGN_ASSET_TO_STORY', assetId: asset.id, storyGroupId: val })
              } else {
                dispatch({ type: 'UNASSIGN_ASSET_FROM_STORY', assetId: asset.id })
              }
            }}
            className={cn(
              'w-full text-[10px] border px-1 py-0.5 bg-white truncate',
              !asset.storyGroupId ? 'border-red-300 text-red-500' : 'border-slate-200',
            )}
          >
            <option value="">{'\u2014'} None {'\u2014'}</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
            <option value="__create__">+ Create New Story</option>
          </select>
        )}
      </div>

      {/* Privacy (toggle) */}
      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => {
            const idx = PRIVACY_CYCLE.indexOf(asset.editable.privacy)
            const next = PRIVACY_CYCLE[(idx + 1) % PRIVACY_CYCLE.length]
            dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'privacy', value: next })
          }}
          className={cn(
            'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 border w-full text-center',
            asset.editable.privacy === 'PUBLIC' && 'border-blue-600 text-blue-600 bg-blue-50',
            asset.editable.privacy === 'PRIVATE' && 'border-slate-400 text-slate-500 bg-slate-50',
            asset.editable.privacy === 'RESTRICTED' && 'border-amber-500 text-amber-600 bg-amber-50',
            !asset.editable.privacy && 'border-red-300 text-red-400',
          )}
        >
          {asset.editable.privacy ?? (asset.proposal?.privacySuggestion ? `${asset.proposal.privacySuggestion}?` : 'Set')}
        </button>
      </div>

      {/* Price (inline editable) */}
      <div onClick={e => e.stopPropagation()}>
        {editingCell?.assetId === asset.id && editingCell.field === 'price' ? (
          <input
            autoFocus
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
            className="w-full text-xs border-b-2 border-blue-600 bg-transparent outline-none py-0.5 text-right"
          />
        ) : (
          <span
            className={cn(
              'block text-right cursor-text hover:bg-blue-50 px-1 py-0.5',
              asset.editable.price !== null ? 'font-mono' : 'text-slate-300 italic text-[10px]',
            )}
            onClick={() => startEdit(asset.id, 'price', asset.editable.price !== null ? (asset.editable.price / 100).toString() : '')}
          >
            {asset.editable.price !== null
              ? centsToEur(asset.editable.price)
              : asset.proposal?.priceSuggestion
                ? `${centsToEur(asset.proposal.priceSuggestion.amount)} sug.`
                : '\u2014'}
          </span>
        )}
      </div>

      {/* Declaration check (comfortable only) */}
      {!isCompact && (
        <div className="text-[10px] truncate">
          {asset.declarationState ? (
            <span className={cn(
              'font-bold uppercase tracking-wide',
              asset.declarationState === 'fully_validated' && 'text-blue-600',
              asset.declarationState === 'corroborated' && 'text-green-600',
              asset.declarationState === 'provenance_pending' && 'text-amber-600',
              asset.declarationState === 'manifest_invalid' && 'text-red-600',
              !['fully_validated', 'corroborated', 'provenance_pending', 'manifest_invalid'].includes(asset.declarationState) && 'text-slate-400',
            )}>
              {DECLARATION_STATE_LABELS[asset.declarationState]}
            </span>
          ) : (
            <span className="text-slate-300">{'\u2014'}</span>
          )}
        </div>
      )}

      {/* Issues chips (comfortable only) */}
      {!isCompact && (
        <div className="flex items-center gap-0.5 overflow-hidden">
          {exceptions.length === 0 && !asset.excluded && (
            <span className="text-[9px] text-blue-500 font-bold uppercase">OK</span>
          )}
          {exceptions.filter(e => e.severity === 'blocking').length > 0 && (
            <span className="bg-red-100 text-red-600 text-[8px] font-bold uppercase px-1 py-0.5 whitespace-nowrap">
              {exceptions.filter(e => e.severity === 'blocking').length} block
            </span>
          )}
          {exceptions.filter(e => e.severity === 'advisory').length > 0 && (
            <span className="bg-amber-100 text-amber-600 text-[8px] font-bold uppercase px-1 py-0.5 whitespace-nowrap">
              {exceptions.filter(e => e.severity === 'advisory').length} adv
            </span>
          )}
        </div>
      )}

      {/* Licence indicator */}
      <div className="text-[10px] text-slate-400 truncate" title={asset.editable.licences.join(', ')}>
        {asset.editable.licences.length > 0
          ? asset.editable.licences.length === 1
            ? LICENCE_TYPE_LABELS[asset.editable.licences[0]]
            : `${asset.editable.licences.length} lic.`
          : <span className="text-red-300">None</span>
        }
      </div>

      {/* Exclude toggle */}
      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_ASSET_EXCLUDED', assetId: asset.id })}
          className="p-0.5 hover:bg-slate-100 transition-colors"
          title={asset.excluded ? 'Include in batch' : 'Exclude from batch'}
        >
          {asset.excluded
            ? <EyeOff size={12} className="text-slate-300" />
            : <Eye size={12} className="text-slate-400" />
          }
        </button>
      </div>
    </div>
  )
}

// Import X for inline create
import { X } from 'lucide-react'
