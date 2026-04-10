'use client'

import Link from 'next/link'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import {
  getSearchCreators,
  getSearchStories,
  getSearchAssetClusters,
  type SearchCreator,
  type SearchStory,
  type SearchAssetCluster,
  type SampleAsset,
} from '@/lib/search-data'

// Leaflet — dynamic import to avoid SSR issues
import dynamic from 'next/dynamic'
const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

// ══════════════════════════════════════════════════════
// DISCOVERY MAP
// Professional geosearch. Black, blue, white.
// Real cartography via Leaflet + monochrome tiles.
// Synchronized map + result rail.
// ══════════════════════════════════════════════════════

export type MapMode = 'creators' | 'assets' | 'stories'

// Format icon SVG components for the rail
const FORMAT_RAIL_ICONS: Record<string, React.ReactNode> = {
  photo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>,
  video: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>,
  audio: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 3v9.28a4.5 4.5 0 1 0 2 3.72V7h4V3h-6zM9.5 19a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>,
  text: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>,
  infographic: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>,
  illustration: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/></svg>,
  vector: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 14H7v-4h4v4zm0-6H7V7h4v4zm6 6h-4v-4h4v4zm0-6h-4V7h4v4z"/></svg>,
}

function FormatIcon({ format, className }: { format?: string; className?: string }) {
  const key = format?.toLowerCase() || 'photo'
  return <span className={className}>{FORMAT_RAIL_ICONS[key] || FORMAT_RAIL_ICONS.photo}</span>
}

const MAP_FILTER_OPTIONS = [
  'All', 'Frontfiler', 'Article', 'Story', 'Collection',
  'Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector',
] as const
type MapFilter = typeof MAP_FILTER_OPTIONS[number]

function filterToMode(filter: MapFilter): MapMode {
  if (filter === 'Frontfiler') return 'creators'
  if (filter === 'Story' || filter === 'Article' || filter === 'Collection') return 'stories'
  if (filter === 'All') return 'creators'
  return 'assets'
}

export interface MapPoint {
  id: string
  label: string
  lat: number
  lng: number
  sublabel: string
  count?: number
  avatarUrl?: string | null
  initials?: string
  trustBadge?: 'verified' | 'trusted'
  sampleAssets: SampleAsset[]
  storyCount?: number
  specialties?: string[]
  formats?: string[]
  creatorNames?: string[]
  dek?: string
  creatorName?: string
  creatorAvatarUrl?: string | null
}

export type MapSize = 'hidden' | 'small' | 'large'

export function DiscoveryMap({ mapSize, onMapSizeChange }: { mapSize: MapSize; onMapSizeChange: (s: MapSize) => void }) {
  const [mapFilter, setMapFilter] = useState<MapFilter>('All')
  const mode = filterToMode(mapFilter)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const setMapSize = onMapSizeChange
  const railRef = useRef<HTMLDivElement>(null)

  const searchCreators = useMemo(() => getSearchCreators(), [])
  const searchStories = useMemo(() => getSearchStories(), [])
  const searchClusters = useMemo(() => getSearchAssetClusters(), [])

  const points: MapPoint[] = useMemo(() => {
    if (mode === 'creators') {
      return searchCreators.map(c => ({
        id: c.id,
        label: c.name,
        lat: c.lat,
        lng: c.lng,
        sublabel: c.locationBase,
        avatarUrl: c.avatarUrl,
        initials: c.initials,
        trustBadge: c.trustBadge,
        count: c.assetCount,
        storyCount: c.storyCount,
        specialties: c.specialties,
        sampleAssets: c.sampleAssets,
      }))
    }
    if (mode === 'stories') {
      return searchStories.map(s => ({
        id: s.id,
        label: s.title,
        lat: s.lat,
        lng: s.lng,
        sublabel: s.creatorName,
        count: s.assetCount,
        dek: s.dek,
        creatorName: s.creatorName,
        creatorAvatarUrl: s.creatorAvatarUrl,
        sampleAssets: s.sampleAssets,
      }))
    }
    return searchClusters.map(c => ({
      id: c.id,
      label: c.geographyLabel,
      lat: c.lat,
      lng: c.lng,
      sublabel: c.country,
      count: c.assetCount,
      formats: c.formats,
      creatorNames: c.creatorNames,
      sampleAssets: c.sampleAssets,
    }))
  }, [mode, searchCreators, searchStories, searchClusters])

  const selected = points.find(p => p.id === selectedId) ?? null

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(prev => prev === id ? null : id)
  }, [])

  // Scroll rail to selected item
  useEffect(() => {
    if (!selectedId || !railRef.current) return
    const el = railRef.current.querySelector(`[data-point-id="${selectedId}"]`)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  return (
    <div className="flex flex-col gap-0">
      {/* Filter dropdown + info + Geo Discovery controls */}
      <div className="flex items-end justify-between mb-3">
        {/* Left: Geo Discovery + map size buttons */}
        <div className="flex items-end gap-4">
          <div>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block">FrontSearch</span>
            <span className="text-[13px] font-serif italic text-black tracking-tight leading-none">Geo Discovery</span>
          </div>
          <div className="flex items-center gap-0">
            {([['hidden', 'Hide'], ['small', 'Compact'], ['large', 'Expand']] as [typeof mapSize, string][]).map(([s, label], i) => (
              <button
                key={s}
                onClick={() => setMapSize(s)}
                className={`px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border-2 transition-colors ${
                  mapSize === s ? 'bg-[#0000ff] text-white border-[#0000ff]' : 'bg-white text-black/30 border-black hover:text-black'
                } ${i > 0 ? '-ml-[2px]' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* Right: results count + filter dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-black/25">{points.length} results</span>
          <span className="text-[8px] text-black/20 uppercase tracking-[0.12em] font-bold">
            Format
          </span>
          <select
            value={mapFilter}
            onChange={(e) => { setMapFilter(e.target.value as MapFilter); setSelectedId(null); setHoveredId(null) }}
            className={cn(
              'text-[9px] font-bold uppercase tracking-[0.1em] bg-white text-black border-2 border-black px-2.5 py-1.5 appearance-none cursor-pointer hover:border-[#0000ff] focus:border-[#0000ff] focus:outline-none pr-6',
              mapSize === 'large' ? 'w-[220px]' : 'w-[160px]',
            )}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
          >
            {MAP_FILTER_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Map + result rail — hard frame */}
      {mapSize !== 'hidden' && (
        <div
          className="flex gap-0 border-2 border-black"
          style={{ height: mapSize === 'large' ? 780 : 390 }}
        >
          {/* Map canvas — fills remaining space */}
          <div className="flex-1 relative bg-white overflow-hidden">
            <LeafletMap
              points={points}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={handleSelect}
              onHover={setHoveredId}
              mode={mode}
              mapSize={mapSize}
              formatFilter={mapFilter}
            />
            <div className="absolute bottom-1.5 left-2 z-[1000]">
              <p className="text-[7px] text-black/15 uppercase tracking-[0.1em]">
                Geographic tags from certification metadata. Not a verification of event location.
              </p>
            </div>
          </div>

          {/* Result rail — fits card width */}
          <div ref={railRef} className={cn(
            'shrink-0 border-l-2 border-black bg-white flex flex-col',
            mapSize === 'large' ? 'w-[220px]' : 'w-[160px]',
          )}>
            <div className="flex-1 overflow-y-auto">
            {points.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-[10px] text-black/25 uppercase tracking-wide">No results</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {points.map((point, i) => (
                  <RailRow
                    key={point.id}
                    point={point}
                    mode={mode}
                    isSelected={point.id === selectedId}
                    isHovered={point.id === hoveredId}
                    isFirst={i === 0}
                    onSelect={() => handleSelect(point.id)}
                    onHover={(h) => setHoveredId(h ? point.id : null)}
                  />
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}


      {/* Selected detail strip */}
      {selected && (
        <SelectedStrip point={selected} mode={mode} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// RAIL ROW — creator/asset/story result row
// ══════════════════════════════════════════════════════

function RailRow({ point, mode, isSelected, isHovered, isFirst, onSelect, onHover }: {
  point: MapPoint
  mode: MapMode
  isSelected: boolean
  isHovered: boolean
  isFirst: boolean
  onSelect: () => void
  onHover: (h: boolean) => void
}) {
  if (mode === 'creators') {
    return (
      <CreatorCard
        point={point}
        isSelected={isSelected}
        isHovered={isHovered}
        isFirst={isFirst}
        onSelect={onSelect}
        onHover={onHover}
      />
    )
  }

  return (
    <button
      data-point-id={point.id}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        'w-full text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0000ff] focus-visible:ring-inset',
        !isFirst && 'border-t border-black/8',
        isSelected
          ? 'bg-[#0000ff] text-white'
          : isHovered
            ? 'bg-black/[0.04] text-black'
            : 'text-black hover:bg-black/[0.02]'
      )}
    >
      {mode === 'assets' && (
        <div className="px-3 py-2 flex items-center gap-2.5">
          {point.sampleAssets[0] ? (
            <div className={cn('w-10 h-10 shrink-0 overflow-hidden bg-black/5 border', isSelected ? 'border-white/20' : 'border-black/10')}>
              <img src={point.sampleAssets[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className={cn('w-10 h-10 shrink-0 flex items-center justify-center border', isSelected ? 'border-white/20 text-white/50 bg-white/10' : 'border-black/10 text-black/30 bg-black/5')}>
              <FormatIcon format={point.formats?.[0]} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={cn('text-[10px] font-bold leading-none', isSelected ? 'text-white' : 'text-black')}>{point.label}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn('text-[8px] font-mono', isSelected ? 'text-white/50' : 'text-black/25')}>{point.count} assets</span>
              {point.formats && point.formats.length > 0 && (
                <>
                  <span className={cn('text-[8px]', isSelected ? 'text-white/30' : 'text-black/15')}>·</span>
                  <span className={cn('text-[8px] uppercase tracking-wider', isSelected ? 'text-white/50' : 'text-black/25')}>{point.formats.join(', ')}</span>
                </>
              )}
            </div>
            {point.creatorNames && point.creatorNames.length > 0 && (
              <p className={cn('text-[8px] mt-1', isSelected ? 'text-white/40' : 'text-black/20')}>{point.creatorNames.slice(0, 2).join(', ')}</p>
            )}
          </div>
        </div>
      )}

      {mode === 'stories' && (
        <div className="px-3 py-2.5 flex items-start gap-2.5">
          {point.sampleAssets[0] ? (
            <div className={cn('w-12 h-8 shrink-0 overflow-hidden bg-black/5 border', isSelected ? 'border-white/20' : 'border-black/10')}>
              <img src={point.sampleAssets[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className={cn('text-[10px] font-bold leading-tight', isSelected ? 'text-white' : 'text-black')}>{point.label}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {point.creatorName && (
                <span className={cn('text-[8px]', isSelected ? 'text-white/50' : 'text-black/30')}>{point.creatorName}</span>
              )}
              <span className={cn('text-[8px] font-mono', isSelected ? 'text-white/50' : 'text-black/25')}>{point.count} assets</span>
            </div>
          </div>
        </div>
      )}
    </button>
  )
}

// ══════════════════════════════════════════════════════
// CREATOR CARD — image background with slideshow
// ══════════════════════════════════════════════════════

function CreatorCard({ point, isSelected, isHovered, isFirst, onSelect, onHover }: {
  point: MapPoint
  isSelected: boolean
  isHovered: boolean
  isFirst: boolean
  onSelect: () => void
  onHover: (h: boolean) => void
}) {
  const [slideIndex, setSlideIndex] = useState(0)
  const dragStartX = useRef(0)
  const dragging = useRef(false)
  const didDrag = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const assets = point.sampleAssets
  const total = assets.length

  const slideRef = useRef(slideIndex)
  slideRef.current = slideIndex

  const goTo = useCallback((i: number) => {
    if (total <= 1) return
    setSlideIndex(((i % total) + total) % total)
  }, [total])

  const goToRef = useRef(goTo)
  goToRef.current = goTo

  // Unified drag: works for both mouse and touch
  const onDragStart = useCallback((startX: number) => {
    dragStartX.current = startX
    dragging.current = true
    didDrag.current = false
  }, [])

  const onDragEnd = useCallback((endX: number) => {
    if (!dragging.current) return
    dragging.current = false
    const dx = endX - dragStartX.current
    if (Math.abs(dx) > 30) {
      didDrag.current = true
      goToRef.current(slideRef.current + (dx < 0 ? 1 : -1))
    }
  }, [])

  // Mouse drag + two-finger trackpad swipe
  const wheelAccum = useRef(0)
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el || total <= 1) return

    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current && Math.abs(e.clientX - dragStartX.current) > 5) {
        didDrag.current = true
      }
    }
    const onMouseUp = (e: MouseEvent) => onDragEnd(e.clientX)

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
      e.preventDefault()
      wheelAccum.current += e.deltaX
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => { wheelAccum.current = 0 }, 200)
      if (Math.abs(wheelAccum.current) > 50) {
        goToRef.current(slideRef.current + (wheelAccum.current > 0 ? 1 : -1))
        wheelAccum.current = 0
      }
    }

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('mouseup', onMouseUp)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
    }
  }, [total, onDragEnd])

  return (
    <div
      ref={cardRef}
      data-point-id={point.id}
      role="button"
      tabIndex={0}
      onClick={(e) => { if (didDrag.current) { didDrag.current = false; e.stopPropagation(); return } onSelect() }}
      onMouseDown={(e) => { if (total > 1) { e.preventDefault(); onDragStart(e.clientX) } }}
      onTouchStart={(e) => { if (total > 1) onDragStart(e.touches[0].clientX) }}
      onTouchEnd={(e) => onDragEnd(e.changedTouches[0].clientX)}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => { onHover(false); dragging.current = false }}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() }
        if (e.key === 'ArrowLeft') goTo(slideIndex - 1)
        if (e.key === 'ArrowRight') goTo(slideIndex + 1)
      }}
      className={cn(
        'w-full text-left cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0000ff] focus-visible:ring-inset relative overflow-hidden aspect-[4/3] select-none',
        !isFirst && 'border-t border-black/8',
        isSelected ? 'ring-2 ring-inset ring-[#0000ff]' : '',
      )}
    >
      {/* Background image */}
      {assets.length > 0 && (
        <img
          key={assets[slideIndex]?.id}
          src={assets[slideIndex]?.thumbnailUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}

      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 pointer-events-none" />

      {/* Content — bottom-aligned */}
      <div className="absolute inset-0 flex flex-col justify-end p-3 pointer-events-none">
        <div className="flex items-end gap-2.5">
          <Avatar
            src={point.avatarUrl}
            name={point.label}
            size="md"
            className="border-white/30 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-white leading-none drop-shadow-sm">{point.label}</p>
            <p className="text-[10px] text-white/60 mt-1 leading-none">{point.sublabel}</p>
          </div>
        </div>
      </div>

      {/* Slide dots — top right */}
      {total > 1 && (
        <div className="absolute top-2 right-2 flex gap-1 z-20 pointer-events-none">
          {assets.slice(0, Math.min(total, 15)).map((_, i) => (
            <span
              key={i}
              className={cn(
                'w-1.5 h-1.5 transition-colors',
                i === slideIndex ? 'bg-white' : 'bg-white/40'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// SELECTED DETAIL STRIP — below the map
// ══════════════════════════════════════════════════════

function SelectedStrip({ point, mode }: { point: MapPoint; mode: MapMode }) {
  const href = mode === 'creators'
    ? `/creator/${point.id}`
    : mode === 'stories'
      ? `/story/${point.id}`
      : `/search?q=${encodeURIComponent(point.label)}`

  return (
    <div className="border-2 border-black border-t-0 bg-white flex items-center gap-0">
      <div className="w-1 self-stretch bg-[#0000ff] shrink-0" />
      {mode === 'creators' && (
        <div className="shrink-0 px-3">
          <Avatar src={point.avatarUrl} name={point.label} size="md" />
        </div>
      )}
      {mode !== 'creators' && point.sampleAssets[0] && (
        <Link href={`/asset/${point.sampleAssets[0].id}`} className="w-16 h-12 bg-black/5 shrink-0 overflow-hidden border-r border-black/10">
          <img src={point.sampleAssets[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
        </Link>
      )}
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <p className="text-[11px] font-bold text-black leading-none">{point.label}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-black/35 leading-none">{point.sublabel}</span>
          {point.count !== undefined && <span className="text-[9px] font-mono text-black/25">{point.count} assets</span>}
          {point.storyCount !== undefined && point.storyCount > 0 && <span className="text-[9px] font-mono text-black/25">{point.storyCount} stories</span>}
        </div>
      </div>
      {point.sampleAssets.length > 0 && (
        <div className="flex gap-0.5 px-2 shrink-0">
          {point.sampleAssets.slice(0, 3).map(a => (
            <Link key={a.id} href={`/asset/${a.id}`} className="w-10 h-10 shrink-0 overflow-hidden bg-black/5 border border-black/10 hover:border-[#0000ff] transition-colors">
              <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover" />
            </Link>
          ))}
        </div>
      )}
      <Link
        href={href}
        className="shrink-0 h-full px-5 bg-black text-white text-[8px] font-bold uppercase tracking-[0.12em] inline-flex items-center hover:bg-[#0000ff] transition-colors py-3.5"
      >
        {mode === 'creators' ? 'View creator' : mode === 'stories' ? 'View story' : 'Search area'}
      </Link>
    </div>
  )
}
