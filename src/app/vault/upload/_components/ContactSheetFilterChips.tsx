/**
 * Frontfiles Upload V4 — Contact Sheet Filter Chips (D2.3 §1.1)
 *
 * Spec: UX-SPEC-V4 §3.2 + IPD3-6 default = (a) magnifier-triggered search.
 *
 * Replaces C2 FilterBar. Lives at the top of CenterPane (above the contact
 * sheet itself; AIProposalBanner sits ABOVE this row per spec §11.4).
 *
 * Five exclusive chips reuse V2FilterPreset (no new preset types invented).
 * Search affordance is icon-triggered: closed by default, click reveals an
 * inline input that takes focus. Esc clears + dismisses; blank-blur dismisses.
 * Debounced 200ms (matches C2 FilterBar pattern).
 */

'use client'

import { useEffect, useState } from 'react'
import { useUploadContext } from './UploadContext'
import type { V2FilterPreset } from '@/lib/upload/v3-types'

const FILTER_CHIPS: Array<{ preset: V2FilterPreset; label: string }> = [
  { preset: 'all', label: 'All' },
  { preset: 'missing-required', label: 'Needs info' },
  { preset: 'ready', label: 'Ready' },
  { preset: 'duplicates', label: 'Duplicates' },
  { preset: 'excluded', label: 'Excluded' },
]

export default function ContactSheetFilterChips() {
  const { state, dispatch } = useUploadContext()
  const [searchOpen, setSearchOpen] = useState(state.ui.searchQuery !== '')
  const [searchInput, setSearchInput] = useState(state.ui.searchQuery)

  // Per IPD3-6: 200ms debounce on the search input. Same pattern as C2 FilterBar.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== state.ui.searchQuery) {
        dispatch({ type: 'SET_SEARCH_QUERY', query: searchInput })
      }
    }, 200)
    return () => clearTimeout(t)
  }, [searchInput, state.ui.searchQuery, dispatch])

  return (
    <div className="border-b border-black bg-white px-4 py-2 flex items-center justify-between gap-4 flex-wrap min-w-0">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {FILTER_CHIPS.map(chip => {
          const active = state.ui.filter.preset === chip.preset
          return (
            <button
              key={chip.preset}
              type="button"
              onClick={() => dispatch({ type: 'SET_FILTER_PRESET', preset: chip.preset })}
              // D2.9 Move 5: inactive chips drop the black border + reduce
              // contrast. Active chip retains the brutalist black-on-white
              // language so it still anchors the row.
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                active
                  ? 'bg-black text-white border border-black'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-black'
              }`}
              aria-pressed={active}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Search affordance — icon-triggered per IPD3-6 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {searchOpen ? (
          <>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setSearchInput('')
                  setSearchOpen(false)
                }
              }}
              onBlur={() => {
                if (!searchInput) setSearchOpen(false)
              }}
              placeholder="filename, title, tags, format…"
              autoFocus
              className="border border-black px-2 py-1 text-sm text-black bg-white w-64 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setSearchOpen(false)
                }}
                className="border border-black w-6 h-6 flex items-center justify-center text-xs hover:bg-black hover:text-white transition-colors"
                aria-label="Clear search"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            // D2.9 Move 5: search affordance recedes — no border, slate-500
            // text. (Per directive Move 5: full magnifier-icon collapse is a
            // small follow-up; D2.9 default keeps the "Search" word.)
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-transparent hover:text-black transition-colors"
            aria-label="Open search"
          >
            Search
          </button>
        )}
      </div>
    </div>
  )
}
