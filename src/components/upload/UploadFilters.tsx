'use client'

import { cn } from '@/lib/utils'
import type { BatchFilterState } from '@/lib/upload/batch-types'
import type { AssetFormat, PrivacyState } from '@/lib/upload/types'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'

interface UploadFiltersProps {
  filter: BatchFilterState
  onFilter: (filter: Partial<BatchFilterState>) => void
  viewMode: 'grid' | 'table'
  onViewMode: (mode: 'grid' | 'table') => void
}

export function UploadFilters({ filter, onFilter, viewMode, onViewMode }: UploadFiltersProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Format filter */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">FORMAT:</span>
        <FilterButton active={filter.format === 'all'} onClick={() => onFilter({ format: 'all' })}>All</FilterButton>
        {(['photo', 'video', 'audio', 'text'] as AssetFormat[]).map(f => (
          <FilterButton key={f} active={filter.format === f} onClick={() => onFilter({ format: f })}>
            {ASSET_FORMAT_LABELS[f]}
          </FilterButton>
        ))}
      </div>

      {/* Privacy filter */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">PRIVACY:</span>
        <FilterButton active={filter.privacy === 'all'} onClick={() => onFilter({ privacy: 'all' })}>All</FilterButton>
        {(['PUBLIC', 'PRIVATE', 'RESTRICTED'] as (PrivacyState | 'unset')[]).map(p => (
          <FilterButton key={p} active={filter.privacy === p} onClick={() => onFilter({ privacy: p })}>
            {p}
          </FilterButton>
        ))}
        <FilterButton active={filter.privacy === 'unset'} onClick={() => onFilter({ privacy: 'unset' })}>Unset</FilterButton>
      </div>

      {/* Story filter */}
      <div className="flex items-center gap-1">
        <FilterButton active={filter.story === 'unassigned'} onClick={() => onFilter({ story: filter.story === 'unassigned' ? 'all' : 'unassigned' })}>
          No Story
        </FilterButton>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View toggle */}
      <div className="flex items-center border border-black">
        <button
          className={cn('px-2 py-1 text-[10px] font-bold uppercase tracking-widest', viewMode === 'table' ? 'bg-black text-white' : 'text-black')}
          onClick={() => onViewMode('table')}
        >
          Table
        </button>
        <button
          className={cn('px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-l border-black', viewMode === 'grid' ? 'bg-black text-white' : 'text-black')}
          onClick={() => onViewMode('grid')}
        >
          Grid
        </button>
      </div>
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors',
        active ? 'bg-black text-white' : 'text-slate-500 hover:text-black'
      )}
    >
      {children}
    </button>
  )
}
