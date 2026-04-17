'use client'

import Link from 'next/link'
import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type { MapBounds } from './LeafletMap'
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
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'

// Leaflet — dynamic import to avoid SSR issues
import { useRouter } from 'next/navigation'
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
  pointType?: 'creator' | 'asset' | 'story'
  slug?: string
}

export type MapSize = 'hidden' | 'small' | 'large'

// ── Controlled-mode props (additive, all optional) ───────────────────────
// When `externalPoints` is defined, DiscoveryMap renders pins from that
// collection instead of fetching its own global data. When any of
// `hoveredId`/`selectedId` is defined, hover/selection becomes parent-
// controlled. These props let the Discovery page sync map with the results
// grid without changing the map's standalone behaviour.
export interface DiscoveryMapProps {
  mapSize: MapSize
  onMapSizeChange: (s: MapSize) => void
  aboveSpotlight?: ReactNode
  onHide?: () => void

  // ── sync / controlled ──
  externalPoints?: MapPoint[]
  hoveredId?: string | null
  selectedId?: string | null
  onHoverChange?: (id: string | null) => void
  onSelectChange?: (id: string | null) => void

  // ── search-this-area ──
  /** When true, show the floating "Search this area" button overlaid on the map. */
  showSearchThisArea?: boolean
  /** Fired on user click of the "Search this area" button, with current map bounds. */
  onSearchThisArea?: (bounds: MapBounds) => void
  /** Fired on every map bounds change — parent uses this to detect pan/zoom. */
  onMapBoundsChange?: (bounds: MapBounds) => void

  /** When false, omit the ViewportSpotlight list that normally renders
   *  below the map. Composer sets this to false because its own asset
   *  grid immediately below the map already plays that role — without
   *  this flag Composer gets two stacked result grids. Defaults to
   *  true to preserve Discovery's behaviour. */
  showSpotlight?: boolean
}

export function DiscoveryMap({
  mapSize,
  onMapSizeChange,
  aboveSpotlight,
  onHide,
  externalPoints,
  hoveredId: hoveredIdProp,
  selectedId: selectedIdProp,
  onHoverChange,
  onSelectChange,
  showSearchThisArea = false,
  onSearchThisArea,
  onMapBoundsChange,
  showSpotlight = true,
}: DiscoveryMapProps) {
  const router = useRouter()
  const [mapFilter, setMapFilter] = useState<MapFilter>('All')
  const mode = filterToMode(mapFilter)
  const [spotlightFmt, setSpotlightFmt] = useState('All')
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const hoverClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setMapSize = onMapSizeChange
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)

  // Controlled when the parent drives points. Hover/selection callbacks are
  // always honoured if provided; internal state is the fallback.
  const isControlled = externalPoints !== undefined
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : internalSelectedId
  const hoveredId = hoveredIdProp !== undefined ? hoveredIdProp : internalHoveredId

  const setSelectedId = useCallback((id: string | null | ((prev: string | null) => string | null)) => {
    const next = typeof id === 'function' ? id(selectedId) : id
    if (selectedIdProp === undefined) setInternalSelectedId(next)
    onSelectChange?.(next)
  }, [selectedId, selectedIdProp, onSelectChange])

  const setHoveredId = useCallback((id: string | null) => {
    if (hoveredIdProp === undefined) setInternalHoveredId(id)
    onHoverChange?.(id)
  }, [hoveredIdProp, onHoverChange])

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds)
    onMapBoundsChange?.(bounds)
  }, [onMapBoundsChange])

  const handleHoverPosition = useCallback((data: { id: string; x: number; y: number } | null) => {
    if (data) {
      if (hoverClearRef.current) clearTimeout(hoverClearRef.current)
      setHoverPos(data)
    } else {
      hoverClearRef.current = setTimeout(() => setHoverPos(null), 180)
    }
  }, [])

  // In standalone mode, pull global search data; in controlled mode the
  // parent supplies points from the current Discovery result set so the map
  // reflects what's in the grid rather than a static catalog.
  const searchCreators = useMemo(() => (isControlled ? [] : getSearchCreators()), [isControlled])
  const searchStories = useMemo(() => (isControlled ? [] : getSearchStories()), [isControlled])
  const searchClusters = useMemo(
    () => (isControlled ? [] : getSearchAssetClusters(mapFilter)),
    [isControlled, mapFilter]
  )

  // Rail points — what appears in the result rail
  const points: MapPoint[] = useMemo(() => {
    if (isControlled) return externalPoints ?? []
    if (mode === 'creators') {
      return searchCreators.map(c => ({
        id: c.id,
        slug: c.slug,
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
        pointType: 'creator' as const,
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
        pointType: 'story' as const,
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
      pointType: 'asset' as const,
    }))
  }, [isControlled, externalPoints, mode, searchCreators, searchStories, searchClusters])

  // Apply spotlight format filter to points (affects both map and gallery)
  const fmtFiltered = useMemo(() => {
    if (spotlightFmt === 'All') return points
    return points.filter(p => p.formats?.some(f => f.toLowerCase() === spotlightFmt.toLowerCase()))
  }, [points, spotlightFmt])

  // Creator overlay points for the map when ALL is selected (standalone only —
  // in controlled mode, creators are already inside externalPoints).
  const creatorOverlay: MapPoint[] = useMemo(() => {
    if (isControlled || mapFilter !== 'All') return []
    return searchCreators.map(c => ({
      id: c.id,
      slug: c.slug,
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
      pointType: 'creator' as const,
    }))
  }, [isControlled, mapFilter, searchCreators])

  // Map points = format-filtered points + creator overlay (when ALL, standalone only)
  const mapPoints: MapPoint[] = useMemo(() => {
    if (!isControlled && mapFilter === 'All') return [...fmtFiltered, ...creatorOverlay]
    return fmtFiltered
  }, [isControlled, mapFilter, fmtFiltered, creatorOverlay])

  const hoverCardData = useMemo(() => {
    if (!hoverPos) return null
    const pt = mapPoints.find(p => p.id === hoverPos.id)
    if (!pt) return null
    const mapH = 390
    const cardW = 280
    const cardH = Math.min(60 + pt.sampleAssets.length * 70, 380)
    const left = hoverPos.x > cardW + 20 ? hoverPos.x - cardW - 12 : hoverPos.x + 16
    const top = hoverPos.y + cardH > mapH - 20 ? Math.max(4, hoverPos.y - cardH + 10) : hoverPos.y - 10
    return { pt, style: { left, top, width: cardW } as React.CSSProperties }
  }, [hoverPos, mapPoints, mapSize])

  const selected = points.find(p => p.id === selectedId) ?? null

  const visiblePoints = useMemo(() => {
    if (!mapBounds) return [...fmtFiltered].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 20)
    return fmtFiltered
      .filter(p =>
        p.lat >= mapBounds.south &&
        p.lat <= mapBounds.north &&
        p.lng >= mapBounds.west &&
        p.lng <= mapBounds.east
      )
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  }, [fmtFiltered, mapBounds])

  const handleSelect = useCallback((id: string | null) => {
    // Standalone-only shortcut: in ALL mode, creator marker clicks navigate
    // directly to the creator page. In controlled mode the parent decides
    // what selection means (Discovery highlights the card).
    if (!isControlled && id && mapFilter === 'All') {
      const creatorPoint = creatorOverlay.find(p => p.id === id)
      if (creatorPoint) { router.push(`/creator/${creatorPoint.slug ?? id}`); return }
    }
    setSelectedId(prev => prev === id ? null : id)
  }, [isControlled, mapFilter, creatorOverlay, router, setSelectedId])

  return (
    <div className="flex flex-col gap-0">
      {/* Row 1: Geo Discovery label + Hide/Compact/Expand */}
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-[22px] font-serif italic leading-none tracking-tight">
          <span className="text-[#0000ff]">Geo</span>
          <span className="text-black"> Discovery</span>
        </h2>
        <button
          onClick={() => { setMapSize('hidden'); if (onHide) onHide() }}
          className="px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] border border-black/20 bg-white hover:bg-black/5 text-[#0000ff] transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3 text-[#0000ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Hide
        </button>
      </div>

      {/* Map + Viewport Spotlight — unified block */}
      {mapSize !== 'hidden' && (
        <div className="flex flex-col border border-black/20">
          {/* Map canvas — full width */}
          <div
            className="relative bg-white overflow-hidden"
            style={{ height: 390 }}
          >
            <LeafletMap
              points={mapPoints}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={handleSelect}
              onHover={setHoveredId}
              onHoverPosition={handleHoverPosition}
              mode={mode}
              mapSize={mapSize}
              formatFilter={spotlightFmt}
              onBoundsChange={handleBoundsChange}
            />
            {/* Hover magnification card */}
            {hoverCardData && (
              <MapHoverCard
                point={hoverCardData.pt}
                mode={mode}
                style={hoverCardData.style}
                onMouseEnter={() => { if (hoverClearRef.current) clearTimeout(hoverClearRef.current) }}
                onMouseLeave={() => { setHoverPos(null); setHoveredId(null) }}
              />
            )}
            {/* Search-this-area affordance — only appears after the user
                has moved the map; never auto-reruns on pan/zoom. */}
            {showSearchThisArea && isControlled && (
              <button
                type="button"
                onClick={() => { if (mapBounds) onSearchThisArea?.(mapBounds) }}
                className="absolute left-1/2 -translate-x-1/2 bottom-3 z-[1100] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] bg-white border border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors flex items-center gap-1 shadow-sm"
                aria-label="Search this area"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Search this area
              </button>
            )}
            <div className="absolute bottom-1.5 left-2 z-[1000]">
              <p className="text-[7px] text-black/15 uppercase tracking-[0.1em]">
                Geographic tags from certification metadata. Not a verification of event location.
              </p>
            </div>
          </div>
          {aboveSpotlight}
          {/* Viewport Spotlight — updates as map pans/zooms.
              Gated on `showSpotlight` so Composer can suppress the
              below-map list that duplicates its own asset grid. */}
          {showSpotlight && (
            <ViewportSpotlight points={visiblePoints} mode={mode} selectedId={selectedId} onSelect={handleSelect} fmtFilter={spotlightFmt} onFmtFilterChange={setSpotlightFmt} />
          )}
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
// VIEWPORT SPOTLIGHT — grid/list view below map
// Updates as map pans/zooms. Same view options as feed.
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// MAP HOVER CARD — magnification popup on marker hover
// Shows large thumbnails + full info. Thumbnails draggable to lightbox.
// ══════════════════════════════════════════════════════

function MapHoverCard({ point, mode, style, onMouseEnter, onMouseLeave }: {
  point: MapPoint
  mode: MapMode
  style: React.CSSProperties
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const effectiveMode = point.pointType === 'creator' ? 'creators'
    : point.pointType === 'story' ? 'stories'
    : 'assets'

  const assets = point.sampleAssets

  return (
    <div
      className="absolute z-[2000] bg-white border border-black/20 shadow-lg"
      style={{ ...style, pointerEvents: 'all' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-black/10 bg-black/[0.02]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-black leading-tight truncate">{point.label}</p>
            <p className="text-[9px] text-black/40 mt-0.5 truncate">{point.sublabel}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {point.count !== undefined && (
              <span className="text-[8px] font-bold font-mono text-[#0000ff]">{point.count}</span>
            )}
            {point.formats && point.formats.slice(0, 2).map(f => (
              <span key={f} className="text-[6px] font-bold uppercase tracking-wider border border-black/20 text-black/40 px-1 py-0.5 leading-none">{f}</span>
            ))}
          </div>
        </div>
        {effectiveMode === 'creators' && point.specialties && point.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {point.specialties.slice(0, 3).map(s => (
              <span key={s} className="text-[7px] text-black/35 border border-black/10 px-1.5 py-0.5 leading-none">{s}</span>
            ))}
          </div>
        )}
        {effectiveMode === 'stories' && point.dek && (
          <p className="text-[8px] text-black/40 mt-1 leading-snug line-clamp-2">{point.dek}</p>
        )}
        {effectiveMode === 'assets' && point.creatorNames && point.creatorNames.length > 0 && (
          <p className="text-[7px] text-black/30 mt-1 truncate">{point.creatorNames.slice(0, 3).join(' · ')}</p>
        )}
      </div>

      {/* Drag hint */}
      <div className="px-3 py-1 border-b border-black/5 bg-[#0000ff]/[0.02]">
        <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-[#0000ff]/50">
          Drag thumbnails to lightbox
        </p>
      </div>

      {/* Asset thumbnails — draggable to lightbox */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 gap-[2px] p-1.5">
          {assets.slice(0, 6).map(asset => (
            <div
              key={asset.id}
              className="relative aspect-[4/3] overflow-hidden bg-black/5 group cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('text/lightbox-item', asset.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
            >
              <img
                src={resolveProtectedUrl(asset.id, 'thumbnail')}
                alt={asset.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                draggable={false}
              />
              {/* Format badge */}
              <span className="absolute top-1 left-1 text-[6px] font-bold uppercase tracking-wider bg-black text-white px-1 py-0.5 leading-none">
                {asset.format}
              </span>
              {/* Drag indicator on hover */}
              <div className="absolute inset-0 bg-[#0000ff]/0 group-hover:bg-[#0000ff]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <svg className="w-5 h-5 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                </svg>
              </div>
              {/* Title on hover */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[6px] font-bold text-white leading-tight line-clamp-2">{asset.title}</p>
              </div>
            </div>
          ))}
          {assets.length > 6 && (
            <div className="aspect-[4/3] bg-black/5 flex items-center justify-center">
              <span className="text-[9px] font-bold font-mono text-black/25">+{assets.length - 6}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-black/8 flex items-center justify-between">
        <span className="text-[7px] font-bold uppercase tracking-widest text-black/25">
          {point.count ?? assets.length} assets
        </span>
        <span className="text-[7px] text-[#0000ff]/50 font-bold uppercase tracking-wider">
          Click marker to select
        </span>
      </div>
    </div>
  )
}

const SPOTLIGHT_FORMATS = ['All', 'Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const

/** Spotlight view picker — dropdown matching GridToolbar pattern */
function SpotlightViewPicker({ viewMode, onViewModeChange }: { viewMode: 'grid1' | 'grid2' | 'grid4' | 'list'; onViewModeChange: (m: 'grid1' | 'grid2' | 'grid4' | 'list') => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'h-5 w-5 inline-flex items-center justify-center border border-[#0000ff]/40 transition-colors',
          open ? 'bg-[#0000ff] text-white' : 'bg-white text-[#0000ff] hover:bg-[#0000ff]/8'
        )}
        title="View mode"
      >
        <ViewWireframeMini mode={viewMode} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 bg-white border border-black/15 shadow-md p-1.5 grid grid-cols-2 gap-1">
          {(['grid1', 'grid2', 'grid4', 'list'] as const).map(vm => (
            <button
              key={vm}
              onClick={() => { onViewModeChange(vm); setOpen(false) }}
              className={cn(
                'p-1 border transition-colors flex items-center justify-center',
                viewMode === vm
                  ? 'border-[#0000ff] bg-[#0000ff] text-white'
                  : 'border-black/10 bg-white text-black/35 hover:border-[#0000ff] hover:text-[#0000ff]'
              )}
            >
              <ViewWireframeMini mode={vm} size="lg" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Miniature view wireframes for the spotlight toolbar */
function ViewWireframeMini({ mode, size = 'sm' }: { mode: 'grid1' | 'grid2' | 'grid4' | 'list'; size?: 'sm' | 'lg' }) {
  const cls = size === 'sm' ? 'w-3 h-3' : 'w-8 h-8'
  switch (mode) {
    case 'grid1':
      return (<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}><rect x="0.5" y="0.5" width="39" height="39" /><rect x="3" y="3" width="34" height="34" /></svg>)
    case 'grid2':
      return (<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}><rect x="0.5" y="0.5" width="39" height="39" /><rect x="3" y="3" width="16" height="34" /><rect x="21" y="3" width="16" height="34" /></svg>)
    case 'grid4':
      return (<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}><rect x="0.5" y="0.5" width="39" height="39" /><rect x="3" y="3" width="7" height="34" /><rect x="12" y="3" width="7" height="34" /><rect x="21" y="3" width="7" height="34" /><rect x="30" y="3" width="7" height="34" /></svg>)
    case 'list':
      return (<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className={cls}><rect x="0.5" y="0.5" width="39" height="39" /><rect x="3" y="3" width="34" height="7" /><rect x="3" y="12" width="34" height="7" /><rect x="3" y="21" width="34" height="7" /><rect x="3" y="30" width="34" height="7" /></svg>)
  }
}

function ViewportSpotlight({ points, mode, selectedId, onSelect, fmtFilter, onFmtFilterChange }: {
  points: MapPoint[]
  mode: MapMode
  selectedId: string | null
  onSelect: (id: string) => void
  fmtFilter: string
  onFmtFilterChange: (fmt: string) => void
}) {
  const [viewMode, setViewMode] = useState<'grid4' | 'grid2' | 'grid1' | 'list'>('grid4')

  if (points.length === 0) return null

  // Points are already format-filtered by the parent — use them directly
  const filtered = points

  // Max height chosen so grid4 ≈ 4 rows, grid2 ≈ 2 rows visible
  const maxH = viewMode === 'grid4' ? 'max-h-[448px]'
    : viewMode === 'grid2' ? 'max-h-[420px]'
    : viewMode === 'grid1' ? 'max-h-[400px]'
    : 'max-h-[300px]'

  return (
    <div className="border-t border-black/20 bg-white">
      {/* Header — matching GridToolbar v4: thin chips + single view trigger dropdown */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-black/8 min-w-0">
        <div className="flex items-center gap-0.5 min-w-0 flex-1 overflow-x-auto scrollbar-none">
          <span className="text-[7px] font-semibold uppercase tracking-widest text-black/30 shrink-0 mr-0.5">Spotlight</span>
          <span className="text-[7px] font-mono text-black/20 shrink-0 mr-0.5">{filtered.length}</span>
          {SPOTLIGHT_FORMATS.map(fmt => (
            <button
              key={fmt}
              onClick={() => onFmtFilterChange(fmt)}
              className={cn(
                'h-5 px-1.5 inline-flex items-center justify-center text-[7px] font-semibold uppercase tracking-wider border transition-colors whitespace-nowrap shrink-0',
                fmtFilter === fmt
                  ? 'bg-[#0000ff] text-white border-[#0000ff]'
                  : (fmt === 'All')
                    ? 'bg-white border-[#0000ff]/40 text-[#0000ff] hover:bg-[#0000ff] hover:text-white hover:border-[#0000ff]'
                    : 'bg-white border-black/15 text-black/45 hover:bg-[#0000ff] hover:text-white hover:border-[#0000ff]'
              )}
            >
              {fmt}
            </button>
          ))}
        </div>
        {/* Right: single view trigger — matches GridToolbar dropdown pattern */}
        <SpotlightViewPicker viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {/* Scrollable content */}
      <div className={cn('overflow-y-auto', maxH)}>
        {viewMode === 'list' ? (
          <div className="flex flex-col">
            {filtered.map(point => (
              <SpotlightCard key={point.id} point={point} mode={mode} isSelected={point.id === selectedId} viewMode={viewMode} onSelect={() => onSelect(point.id)} />
            ))}
          </div>
        ) : (
          <div className={cn(
            'grid p-2',
            viewMode === 'grid4' ? 'grid-cols-4 gap-2' : viewMode === 'grid2' ? 'grid-cols-2 gap-3' : 'grid-cols-1 gap-3'
          )}>
            {filtered.map(point => (
              <SpotlightCard key={point.id} point={point} mode={mode} isSelected={point.id === selectedId} viewMode={viewMode} onSelect={() => onSelect(point.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SpotlightCard({ point, mode, isSelected, viewMode, onSelect }: {
  point: MapPoint
  mode: MapMode
  isSelected: boolean
  viewMode: 'grid4' | 'grid2' | 'grid1' | 'list'
  onSelect: () => void
}) {
  const thumb = (mode === 'creators' && point.avatarUrl)
    ? point.avatarUrl
    : point.sampleAssets[0] ? resolveProtectedUrl(point.sampleAssets[0].id, 'thumbnail') : undefined

  if (viewMode === 'list') {
    return (
      <button
        onClick={onSelect}
        className={cn(
          'flex items-center gap-2 px-2 py-2 border-b border-black/8 text-left w-full transition-colors hover:bg-black/[0.03]',
          isSelected ? 'bg-[#0000ff]/5' : ''
        )}
      >
        <div className={cn('w-14 h-9 shrink-0 overflow-hidden bg-black/5 border', isSelected ? 'border-[#0000ff]' : 'border-black/10')}>
          {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-bold leading-none truncate', isSelected ? 'text-[#0000ff]' : 'text-black')}>{point.label}</p>
          <p className="text-[8px] text-black/30 mt-0.5 truncate">{point.sublabel}</p>
        </div>
        <span className="text-[8px] font-mono text-black/25 shrink-0">{point.count ?? 0}</span>
      </button>
    )
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        'border overflow-hidden transition-colors text-left',
        isSelected ? 'border-[#0000ff]' : 'border-black/15 hover:border-black'
      )}
    >
      <div className="aspect-video bg-black/5 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={point.label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[8px] text-black/20 font-bold uppercase">{mode[0]}</span>
          </div>
        )}
      </div>
      <div className={viewMode === 'grid4' ? 'px-1.5 py-1' : 'px-2 py-1.5'}>
        <p className={cn(
          'font-bold leading-tight truncate',
          viewMode === 'grid4' ? 'text-[8px]' : viewMode === 'grid2' ? 'text-[10px]' : 'text-[12px]',
          isSelected ? 'text-[#0000ff]' : 'text-black'
        )}>{point.label}</p>
        {viewMode !== 'grid4' && (
          <p className="text-[8px] text-black/40 mt-0.5 truncate">{point.sublabel}</p>
        )}
        <p className={cn('font-mono text-black/25 mt-0.5', viewMode === 'grid4' ? 'text-[7px]' : 'text-[8px]')}>{point.count ?? 0}</p>
      </div>
    </button>
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
  const href = mode === 'creators'
    ? `/creator/${point.slug || point.id}/frontfolio`
    : mode === 'stories'
      ? `/story/${point.id}`
      : `/search?q=${encodeURIComponent(point.label)}`

  if (mode === 'creators') {
    return (
      <CreatorCard
        point={point}
        href={href}
        isSelected={isSelected}
        isHovered={isHovered}
        isFirst={isFirst}
        onSelect={onSelect}
        onHover={onHover}
      />
    )
  }

  return (
    <Link
      href={href}
      data-point-id={point.id}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        'w-full text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0000ff] focus-visible:ring-inset block',
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
              <img src={resolveProtectedUrl(point.sampleAssets[0].id, 'thumbnail')} alt="" className="w-full h-full object-cover" />
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
              <img src={resolveProtectedUrl(point.sampleAssets[0].id, 'thumbnail')} alt="" className="w-full h-full object-cover" />
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
    </Link>
  )
}

// ══════════════════════════════════════════════════════
// CREATOR CARD — image background with slideshow
// ══════════════════════════════════════════════════════

function CreatorCard({ point, href, isSelected, isHovered, isFirst, onSelect, onHover }: {
  point: MapPoint
  href: string
  isSelected: boolean
  isHovered: boolean
  isFirst: boolean
  onSelect: () => void
  onHover: (h: boolean) => void
}) {
  const router = useRouter()
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
      onClick={(e) => { if (didDrag.current) { didDrag.current = false; e.stopPropagation(); return } router.push(href) }}
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
          src={assets[slideIndex] ? resolveProtectedUrl(assets[slideIndex].id, 'thumbnail') : undefined}
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
    ? `/creator/${point.slug || point.id}/frontfolio`
    : mode === 'stories'
      ? `/story/${point.id}`
      : `/search?q=${encodeURIComponent(point.label)}`

  return (
    <div className="border border-black/20 border-t-0 bg-white flex items-center gap-0">
      <div className="w-1 self-stretch bg-[#0000ff] shrink-0" />
      {mode === 'creators' && (
        <div className="shrink-0 px-3">
          <Avatar src={point.avatarUrl} name={point.label} size="md" />
        </div>
      )}
      {mode !== 'creators' && point.sampleAssets[0] && (
        <Link href={`/asset/${point.sampleAssets[0].id}`} className="w-16 h-12 bg-black/5 shrink-0 overflow-hidden border-r border-black/10">
          <img src={resolveProtectedUrl(point.sampleAssets[0].id, 'thumbnail')} alt="" className="w-full h-full object-cover" />
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
              <img src={resolveProtectedUrl(a.id, 'thumbnail')} alt={a.title} className="w-full h-full object-cover" />
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
