'use client'

import { useState, useRef, useEffect } from 'react'
import type { ViewMode } from '@/lib/grid-layout'

/**
 * Frontfiles — Unified Grid Toolbar (v4)
 *
 * Thin, elegant, horizontally collapsible toolbar.
 *
 * v4 changes:
 *   - Thinner chips: h-6 default, h-5 compact, no border-weight, lighter text
 *   - Eye icon always blue with blue frame
 *   - Filter chips collapse horizontally with overflow scroll
 */

export type OverlayMode = 'off' | 'data' | 'magnify'
export type GridToolbarDensity = 'default' | 'compact'

export interface FilterChip {
  label: string
  value: string
  count?: number
}

export interface GridToolbarProps {
  title?: string
  filters: FilterChip[]
  filterGroups?: {
    primary: FilterChip[]
    secondary: FilterChip[]
  }
  activeFilters: Set<string>
  onToggleFilter: (value: string) => void
  overlay: OverlayMode
  onOverlayChange: (mode: OverlayMode) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  rightSlot?: React.ReactNode
  borderTop?: boolean
  density?: GridToolbarDensity
}

const OVERLAY_OPTIONS: { mode: OverlayMode; label: string }[] = [
  { mode: 'magnify', label: 'Magnify' },
  { mode: 'data', label: 'Data' },
  { mode: 'off', label: 'Off' },
]

const OVERLAY_TITLES: Record<OverlayMode, string> = {
  magnify: 'Magnify on hover',
  data: 'Show asset data on hover',
  off: 'Off — do nothing',
}

/**
 * View mode wireframes — miniature layout previews.
 * Order: full picture → 2-col → 4-col → list.
 * Each shows only the column structure as outlined rectangles.
 */
function ViewWireframe({ mode, size }: { mode: ViewMode; size: 'sm' | 'lg' }) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-10 h-10'
  switch (mode) {
    // Full picture — one large square
    case 'grid1':
      return (
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}>
          <rect x="0.5" y="0.5" width="39" height="39" />
          <rect x="3" y="3" width="34" height="34" />
        </svg>
      )
    // Two columns — two squares side by side
    case 'grid2':
      return (
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}>
          <rect x="0.5" y="0.5" width="39" height="39" />
          <rect x="3" y="3" width="16" height="34" />
          <rect x="21" y="3" width="16" height="34" />
        </svg>
      )
    // Four columns — four squares in a row
    case 'grid4':
      return (
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}>
          <rect x="0.5" y="0.5" width="39" height="39" />
          <rect x="3" y="3" width="7" height="34" />
          <rect x="12" y="3" width="7" height="34" />
          <rect x="21" y="3" width="7" height="34" />
          <rect x="30" y="3" width="7" height="34" />
        </svg>
      )
    // List — horizontal rows
    case 'list':
      return (
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}>
          <rect x="0.5" y="0.5" width="39" height="39" />
          <rect x="3" y="3" width="34" height="7" />
          <rect x="3" y="12" width="34" height="7" />
          <rect x="3" y="21" width="34" height="7" />
          <rect x="3" y="30" width="34" height="7" />
        </svg>
      )
  }
}

/** Order: full picture → 2-col → 4-col → list */
const VIEW_MODES: ViewMode[] = ['grid1', 'grid2', 'grid4', 'list']

export function GridToolbar({
  title,
  filters,
  filterGroups,
  activeFilters,
  onToggleFilter,
  overlay,
  onOverlayChange,
  viewMode,
  onViewModeChange,
  rightSlot,
  borderTop = true,
  density = 'default',
}: GridToolbarProps) {
  const isCompact = density === 'compact'

  // ─── Popover state ─────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const [eyeOpen, setEyeOpen] = useState(false)
  const eyeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen && !eyeOpen) return
    function onClickOutside(e: MouseEvent) {
      if (settingsOpen && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
      if (eyeOpen && eyeRef.current && !eyeRef.current.contains(e.target as Node)) {
        setEyeOpen(false)
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') { setSettingsOpen(false); setEyeOpen(false) }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [settingsOpen, eyeOpen])

  // ─── Density tokens ────────────────────────────────────
  const chipClass = isCompact
    ? 'h-5 px-1.5 inline-flex items-center justify-center text-[7.5px] font-semibold uppercase tracking-wider border transition-colors whitespace-nowrap shrink-0'
    : 'h-6 px-2 inline-flex items-center justify-center text-[8px] font-semibold uppercase tracking-wider border transition-colors whitespace-nowrap shrink-0'

  const wrapperClass = isCompact
    ? 'flex items-center gap-1'
    : `flex items-center gap-1.5 mt-1.5 pt-1.5 ${borderTop ? 'border-t border-black/8' : ''}`

  const eyeBtnClass = isCompact ? 'h-5 w-5' : 'h-6 w-6'

  // ─── Filter expand/collapse ─────────────────────────────
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  // ─── Chip colors ───────────────────────────────────────
  const activeChip = 'bg-[#0000ff] text-white border-[#0000ff]'
  const inactiveChip = 'bg-white border-black/20 text-black/55 hover:bg-[#0000ff] hover:text-white hover:border-[#0000ff]'
  const allChipStyle = 'bg-white border-[#0000ff]/40 text-[#0000ff] hover:bg-[#0000ff] hover:text-white hover:border-[#0000ff]'

  function renderChip(f: FilterChip, visible: boolean) {
    if (!visible) return null
    const isAll = f.value === 'All' || f.value === 'all'
    const isActive = activeFilters.has(f.value)
    let color = inactiveChip
    if (isActive) color = activeChip
    else if (isAll) color = allChipStyle
    return (
      <button
        key={f.value}
        onClick={() => onToggleFilter(f.value)}
        className={`${chipClass} ${color}`}
      >
        {f.label}{f.count != null ? ` ${f.count}` : ''}
      </button>
    )
  }

  // ─── Resolve filter groups ─────────────────────────────
  const hasTwoGroups = !!filterGroups
  const primaryFilters = filterGroups?.primary ?? filters
  const secondaryFilters = filterGroups?.secondary ?? []
  const allChips = [...primaryFilters, ...secondaryFilters]

  // Collapsed by default. "All" is always visible.
  // Other chips only show when active OR when expanded.
  const collapsed = !filtersExpanded

  function isVisible(f: FilterChip): boolean {
    if (f.value === 'All' || f.value === 'all') return true
    if (!collapsed) return true
    return activeFilters.has(f.value)
  }

  // Count hidden chips for the expand button label
  const hiddenCount = collapsed ? allChips.filter(f => !isVisible(f)).length : 0

  return (
    <div className={wrapperClass}>
      {/* Filter chips — shows only active when collapsed */}
      <div className="flex items-center gap-0.5 min-w-0 flex-1 overflow-x-auto scrollbar-none">
        {title && (
          <span className={`${isCompact ? 'text-[7px]' : 'text-[8px]'} font-semibold uppercase tracking-widest text-black/35 shrink-0 mr-1`}>{title}</span>
        )}
        {primaryFilters.map(f => renderChip(f, isVisible(f)))}
        {hasTwoGroups && secondaryFilters.length > 0 && (
          <>
            {/* Separator — only show when both groups have visible chips */}
            {primaryFilters.some(f => isVisible(f)) && secondaryFilters.some(f => isVisible(f)) && (
              <span className="shrink-0 w-px h-3 bg-black/10 mx-0.5" />
            )}
            {secondaryFilters.map(f => renderChip(f, isVisible(f)))}
          </>
        )}
        {/* Expand/collapse toggle — always visible */}
        {hiddenCount > 0 || !collapsed ? (
          <button
            onClick={() => setFiltersExpanded(e => !e)}
            className={`shrink-0 ${isCompact ? 'h-5 w-5' : 'h-6 w-6'} inline-flex items-center justify-center text-black/30 hover:text-[#0000ff] transition-colors`}
            title={collapsed ? `Show all filters (+${hiddenCount})` : 'Collapse filters'}
          >
            {collapsed ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2.5 h-2.5">
                <path d="M4 6.5h8M8 2.5v8" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2.5 h-2.5">
                <path d="M4 8h8" />
              </svg>
            )}
          </button>
        ) : null}
      </div>

      {/* View trigger (wireframe of active mode) + dropdown */}
      <div className="relative flex items-center gap-1 shrink-0" ref={settingsRef}>
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className={`${eyeBtnClass} inline-flex items-center justify-center border border-[#0000ff]/40 transition-colors ${
            settingsOpen
              ? 'bg-[#0000ff] text-white'
              : 'bg-white text-[#0000ff] hover:bg-[#0000ff]/8'
          }`}
          title="Display settings"
        >
          <ViewWireframe mode={viewMode} size="sm" />
        </button>

        {/* Eye / overlay picker */}
        <div className="relative" ref={eyeRef}>
          <button
            onClick={() => { setEyeOpen(o => !o); setSettingsOpen(false) }}
            className={`${eyeBtnClass} inline-flex items-center justify-center border border-[#0000ff]/40 transition-colors ${
              eyeOpen
                ? 'bg-[#0000ff] text-white'
                : overlay === 'off'
                  ? 'bg-white text-[#0000ff]/30 hover:bg-[#0000ff]/8'
                  : 'bg-white text-[#0000ff] hover:bg-[#0000ff]/8'
            }`}
            title={OVERLAY_TITLES[overlay]}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'}>
              {overlay === 'off' ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>

          {eyeOpen && (
            <div className="absolute right-0 bottom-full mb-1 z-50 bg-white border border-black/15 shadow-md py-1 min-w-[160px]">
              {OVERLAY_OPTIONS.map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => { onOverlayChange(mode); setEyeOpen(false) }}
                  className={`w-full px-2.5 py-1.5 flex items-center gap-2 text-left transition-colors ${
                    overlay === mode
                      ? 'bg-[#0000ff]/8 text-[#0000ff]'
                      : 'text-black/55 hover:bg-black/4'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                    {mode === 'magnify' && (
                      <>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </>
                    )}
                    {mode === 'data' && (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                    {mode === 'off' && (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                  <span className="text-[8px] font-semibold uppercase tracking-wider">{label}</span>
                  {overlay === mode && (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 ml-auto"><path d="M6.5 12.5l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z" /></svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dropdown — view wireframe grid + overlay selector */}
        {settingsOpen && (
          <div className="absolute right-0 bottom-full mb-1 z-50 bg-white border border-black/15 shadow-md p-2 flex flex-col gap-2">
            {/* View grid — 2x2 wireframe thumbnails */}
            <div className="grid grid-cols-2 gap-1.5">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => { onViewModeChange(mode); setSettingsOpen(false) }}
                  className={`p-1.5 border transition-colors flex items-center justify-center ${
                    viewMode === mode
                      ? 'border-[#0000ff] bg-[#0000ff] text-white'
                      : 'border-black/15 bg-white text-black/40 hover:border-[#0000ff] hover:text-[#0000ff]'
                  }`}
                >
                  <ViewWireframe mode={mode} size="lg" />
                </button>
              ))}
            </div>

          </div>
        )}

        {rightSlot}
      </div>
    </div>
  )
}
