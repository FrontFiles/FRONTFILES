/**
 * DORMANT — replaced by D2 (ContactSheetFilterChips at top of CenterPane).
 * Scheduled for deletion at the explicit D2.8 cutover PR.
 * DO NOT extend.
 *
 * As of D2.1 this file is no longer on any production path. Filter chips
 * fold into the center pane top per UX-SPEC-V4 §3.2.
 */

/**
 * Frontfiles Upload V3 — Filter Bar (C2.2 §3.7)
 *
 * Spec: UX-SPEC-V3.md §5.1.
 *
 * Renders in Batch + Archive modes only (parent decides whether to mount).
 * Filter chips are EXCLUSIVE (radio-style) per IPII-2 — matches the
 * V2Filter.preset shape (single string, not array).
 *
 * Search input is debounced 200ms (per IPII-4) via local state + useEffect.
 */

'use client'

import { useEffect, useState } from 'react'
import { useUploadContext } from './UploadContext'
import type { V2FilterPreset } from '@/lib/upload/v3-types'

const FILTER_CHIPS: Array<{ preset: V2FilterPreset; label: string }> = [
  { preset: 'all', label: 'All' },
  { preset: 'missing-required', label: 'Needs info' },
  { preset: 'duplicates', label: 'Duplicates' },
  { preset: 'ready', label: 'Ready' },
  { preset: 'excluded', label: 'Excluded' },
]

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'filename:asc', label: 'File order (filename A→Z)' },
  { value: 'filename:desc', label: 'Filename Z→A' },
  { value: 'size:desc', label: 'File size (large first)' },
  { value: 'format:asc', label: 'Format' },
]

const LABEL = 'block text-[10px] font-bold uppercase tracking-widest text-black'

export default function FilterBar() {
  const { state, dispatch } = useUploadContext()
  const [searchInput, setSearchInput] = useState(state.ui.searchQuery)

  // Debounce search input → SET_SEARCH_QUERY
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== state.ui.searchQuery) {
        dispatch({ type: 'SET_SEARCH_QUERY', query: searchInput })
      }
    }, 200)
    return () => clearTimeout(t)
  }, [searchInput, state.ui.searchQuery, dispatch])

  const sortValue = `${state.ui.sortField}:${state.ui.sortDirection}`

  return (
    <div className="border-b border-black bg-white px-4 py-2 flex flex-col gap-2 min-w-0">
      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={LABEL}>Filter:</span>
        {FILTER_CHIPS.map(chip => {
          const active = state.ui.filter.preset === chip.preset
          return (
            <button
              key={chip.preset}
              type="button"
              onClick={() => dispatch({ type: 'SET_FILTER_PRESET', preset: chip.preset })}
              className={`border border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                active
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
              aria-pressed={active}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Sort + search */}
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <label className="flex items-center gap-2 min-w-0">
          <span className={LABEL}>Sort:</span>
          <select
            value={sortValue}
            onChange={e => {
              const [field, direction] = e.target.value.split(':') as [
                Parameters<typeof dispatch>[0] extends { type: 'SET_SORT'; field: infer F } ? F : never,
                'asc' | 'desc',
              ]
              dispatch({ type: 'SET_SORT', field, direction })
            }}
            className="border border-black px-2 py-1 text-sm text-black bg-white"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 flex-1 min-w-0">
          <span className={LABEL}>Search:</span>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="filename, title, tag, format..."
            className="border border-black px-2 py-1 text-sm text-black flex-1 min-w-0"
          />
        </label>
      </div>
    </div>
  )
}
