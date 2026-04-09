'use client'

import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import {
  getPublishReadiness,
  getUnassignedAssets,
  getBlockingExceptions,
  getAdvisoryExceptions,
  getBatchExceptionCounts,
  getAssets, getFilteredAssets, getIncludedAssets,
} from '@/lib/upload/v2-state'
import type { V2FilterPreset } from '@/lib/upload/v2-types'
import {
  Search, LayoutGrid, LayoutList, Plus, PanelRight, Zap,
} from 'lucide-react'

const FILTER_PRESETS: { id: V2FilterPreset; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'blocking', label: 'Blocking' },
  { id: 'advisory', label: 'Advisory' },
  { id: 'missing-required', label: 'Missing required' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'private-ready', label: 'Private ready' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
  { id: 'excluded', label: 'Excluded' },
]

interface ReviewHeaderBarProps {
  totalAssets: number
  totalGroups: number
}

export function ReviewHeaderBar({ totalAssets, totalGroups }: ReviewHeaderBarProps) {
  const { state, dispatch } = useUploadV2()
  const readiness = getPublishReadiness(state)
  const allAssets = getAssets(state)
  const exCounts = getBatchExceptionCounts(state)
  const unassignedCount = getUnassignedAssets(state).length
  const blockingCount = getBlockingExceptions(state).length
  const advisoryCount = getAdvisoryExceptions(state).length
  const readyCount = readiness.readyCount
  const processingCount = allAssets.filter(a => a.analysisStatus === 'uploading' || a.analysisStatus === 'analysing' || a.analysisStatus === 'pending').length
  const failedCount = allAssets.filter(a => a.analysisStatus === 'failed').length
  const conflictCount = exCounts.conflicts
  const missingRequiredCount = exCounts.missingStory + exCounts.missingPrivacy + exCounts.missingPrice + exCounts.missingLicences
  const privateReadyCount = allAssets.filter(a => !a.excluded && a.editable.privacy === 'PRIVATE' && a.storyGroupId !== null).length

  return (
    <div className="border-b-2 border-black bg-white flex-shrink-0">
      {/* Top row: search + summary + actions */}
      <div className="px-3 py-2 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-[320px]">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={state.ui.searchQuery}
            onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
            placeholder="Search files, titles, tags..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border-2 border-slate-200 focus:border-black outline-none"
          />
        </div>

        {/* Batch summary chips */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-slate-500">
            {totalAssets} file{totalAssets !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">
            {totalGroups} {totalGroups === 1 ? 'story' : 'stories'}
          </span>
          {readiness.ready && (
            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-bold uppercase">
              Ready
            </span>
          )}
          {!readiness.ready && readiness.blockedCount > 0 && (
            <span className="bg-black text-white px-1.5 py-0.5 text-[9px] font-bold uppercase">
              {readiness.blockedCount} blocked
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Density toggle */}
          <div className="flex border-2 border-slate-200">
            <button
              onClick={() => dispatch({ type: 'SET_DENSITY', density: 'comfortable' })}
              className={cn(
                'p-1 transition-colors',
                state.ui.density === 'comfortable' ? 'bg-black text-white' : 'text-slate-400 hover:text-black',
              )}
              title="Comfortable density"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_DENSITY', density: 'compact' })}
              className={cn(
                'p-1 transition-colors',
                state.ui.density === 'compact' ? 'bg-black text-white' : 'text-slate-400 hover:text-black',
              )}
              title="Compact density"
            >
              <LayoutList size={14} />
            </button>
          </div>

          {/* Create new story (quick action) */}
          <button
            onClick={() => {
              const name = prompt('Story name:')
              if (name?.trim()) {
                dispatch({ type: 'CREATE_STORY_GROUP', name: name.trim() })
              }
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide border-2 border-black hover:bg-slate-50 transition-colors"
          >
            <Plus size={12} /> New Story
          </button>

          {/* Inspector toggle */}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_INSPECTOR' })}
            className={cn(
              'p-1 border-2 transition-colors',
              state.ui.inspectorCollapsed
                ? 'border-slate-200 text-slate-400 hover:text-black hover:border-black'
                : 'border-black bg-black text-white',
            )}
            title={state.ui.inspectorCollapsed ? 'Show inspector' : 'Hide inspector'}
          >
            <PanelRight size={14} />
          </button>

          {/* Newsroom mode toggle */}
          <button
            onClick={() => dispatch({ type: 'ACTIVATE_NEWSROOM_MODE', active: !state.ui.newsroomMode })}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide border-2 transition-colors',
              state.ui.newsroomMode
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 text-slate-400 hover:border-black hover:text-black',
            )}
            title="Newsroom mode: compact + keyboard navigation"
          >
            <Zap size={10} /> Newsroom
          </button>

          {/* Accept all proposed button */}
          {unassignedCount > 0 && (
            <button
              onClick={() => dispatch({ type: 'ACCEPT_ALL_PROPOSED_ASSIGNMENTS' })}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Accept all proposals
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="px-3 pb-2 flex items-center gap-1 overflow-x-auto">
        {FILTER_PRESETS.map(fp => {
          const count = fp.id === 'blocking' ? blockingCount
            : fp.id === 'advisory' ? advisoryCount
            : fp.id === 'unassigned' ? unassignedCount
            : fp.id === 'ready' ? readyCount
            : fp.id === 'processing' ? processingCount
            : fp.id === 'failed' ? failedCount
            : fp.id === 'conflicts' ? conflictCount
            : fp.id === 'missing-required' ? missingRequiredCount
            : fp.id === 'duplicates' ? exCounts.duplicates
            : fp.id === 'private-ready' ? privateReadyCount
            : null
          return (
            <button
              key={fp.id}
              onClick={() => dispatch({ type: 'SET_FILTER_PRESET', preset: fp.id })}
              className={cn(
                'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide border transition-colors whitespace-nowrap',
                state.ui.filter.preset === fp.id
                  ? 'border-black bg-black text-white'
                  : 'border-slate-200 text-slate-500 hover:border-black hover:text-black',
              )}
            >
              {fp.label}
              {count !== null && count > 0 && (
                <span className={cn(
                  'ml-1 px-1 py-0.5 text-[9px]',
                  fp.id === 'blocking' || fp.id === 'missing-required' || fp.id === 'conflicts'
                    ? 'bg-black text-white'
                    : fp.id === 'advisory' || fp.id === 'duplicates'
                    ? 'border border-black text-black'
                    : 'bg-slate-100 text-slate-500',
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
