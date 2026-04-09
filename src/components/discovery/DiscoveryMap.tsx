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

export function DiscoveryMap() {
  const [mode, setMode] = useState<MapMode>('creators')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
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
      {/* Mode switcher */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-0">
          {(['creators', 'assets', 'stories'] as MapMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedId(null); setHoveredId(null) }}
              className={cn(
                'px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] border-2 transition-colors',
                m === mode ? 'bg-black text-white border-black' : 'bg-white text-black/30 border-black hover:text-black',
                m !== 'creators' && '-ml-[2px]'
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-black/25">{points.length} results</span>
          <span className="text-[8px] text-black/20 uppercase tracking-[0.12em] font-bold">
            {mode === 'creators' ? 'Creator base locations' : mode === 'assets' ? 'Asset geographic clusters' : 'Story coverage regions'}
          </span>
        </div>
      </div>

      {/* Map + result rail — hard frame */}
      <div className="flex gap-0 border-2 border-black" style={{ height: 520 }}>
        {/* Map canvas — ~65% */}
        <div className="flex-[65] relative bg-white overflow-hidden">
          <LeafletMap
            points={points}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={handleSelect}
            onHover={setHoveredId}
            mode={mode}
          />
          <div className="absolute bottom-1.5 left-2 z-[1000]">
            <p className="text-[7px] text-black/15 uppercase tracking-[0.1em]">
              Geographic tags from certification metadata. Not a verification of event location.
            </p>
          </div>
        </div>

        {/* Result rail — ~35% */}
        <div ref={railRef} className="flex-[35] border-l-2 border-black bg-white overflow-y-auto flex flex-col">
          <div className="px-3 py-2 border-b-2 border-black/10 bg-black/[0.02] shrink-0">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/30">
              {mode === 'creators' ? 'Creators' : mode === 'assets' ? 'Asset clusters' : 'Stories'}
              <span className="ml-1.5 font-mono text-black/20">{points.length}</span>
            </span>
          </div>

          {points.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[10px] text-black/25 uppercase tracking-wide">No results in this mode</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
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
  return (
    <button
      data-point-id={point.id}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        'w-full text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset',
        !isFirst && 'border-t border-black/8',
        isSelected
          ? 'bg-blue-600 text-white'
          : isHovered
            ? 'bg-black/[0.04] text-black'
            : 'text-black hover:bg-black/[0.02]'
      )}
    >
      {mode === 'creators' && (
        <div className="px-3 py-2.5 flex items-start gap-2.5">
          <Avatar
            src={point.avatarUrl}
            name={point.label}
            size="md"
            className={isSelected ? 'border-white/30' : ''}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className={cn('text-[11px] font-bold leading-none', isSelected ? 'text-white' : 'text-black')}>{point.label}</p>
              {point.trustBadge && (
                <span className={cn(
                  'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
                  isSelected
                    ? 'border-white/40 text-white/70'
                    : point.trustBadge === 'verified' ? 'border-blue-600 text-blue-600' : 'border-black/20 text-black/40'
                )}>
                  {point.trustBadge === 'verified' ? 'V' : 'T'}
                </span>
              )}
            </div>
            <p className={cn('text-[9px] mt-1 leading-none', isSelected ? 'text-white/50' : 'text-black/30')}>{point.sublabel}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn('text-[8px] font-mono', isSelected ? 'text-white/50' : 'text-black/25')}>{point.count} assets</span>
              {point.storyCount !== undefined && point.storyCount > 0 && (
                <>
                  <span className={cn('text-[8px]', isSelected ? 'text-white/30' : 'text-black/15')}>·</span>
                  <span className={cn('text-[8px] font-mono', isSelected ? 'text-white/50' : 'text-black/25')}>{point.storyCount} stories</span>
                </>
              )}
            </div>
            {point.sampleAssets.length > 0 && (
              <div className="flex gap-0.5 mt-2">
                {point.sampleAssets.slice(0, 4).map(a => (
                  <div key={a.id} className={cn('w-7 h-7 shrink-0 overflow-hidden bg-black/5 border', isSelected ? 'border-white/20' : 'border-black/10')}>
                    <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover" />
                  </div>
                ))}
                {point.sampleAssets.length > 4 && (
                  <div className={cn('w-7 h-7 shrink-0 flex items-center justify-center text-[7px] font-bold border', isSelected ? 'border-white/20 text-white/50 bg-white/10' : 'border-black/10 text-black/30 bg-black/5')}>
                    +{point.sampleAssets.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'assets' && (
        <div className="px-3 py-2 flex items-center gap-2.5">
          {point.sampleAssets[0] ? (
            <div className={cn('w-10 h-10 shrink-0 overflow-hidden bg-black/5 border', isSelected ? 'border-white/20' : 'border-black/10')}>
              <img src={point.sampleAssets[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className={cn('w-10 h-10 shrink-0 flex items-center justify-center text-[8px] font-bold uppercase border', isSelected ? 'border-white/20 text-white/40 bg-white/10' : 'border-black/10 text-black/20 bg-black/5')}>
              {point.formats?.[0]?.slice(0, 3) ?? '—'}
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
      <div className="w-1 self-stretch bg-blue-600 shrink-0" />
      {mode === 'creators' && (
        <div className="shrink-0 px-3">
          <Avatar src={point.avatarUrl} name={point.label} size="md" />
        </div>
      )}
      {mode !== 'creators' && point.sampleAssets[0] && (
        <div className="w-16 h-12 bg-black/5 shrink-0 overflow-hidden border-r border-black/10">
          <img src={point.sampleAssets[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
        </div>
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
            <div key={a.id} className="w-10 h-10 shrink-0 overflow-hidden bg-black/5 border border-black/10">
              <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
      <Link
        href={href}
        className="shrink-0 h-full px-5 bg-black text-white text-[8px] font-bold uppercase tracking-[0.12em] inline-flex items-center hover:bg-blue-600 transition-colors py-3.5"
      >
        {mode === 'creators' ? 'View creator' : mode === 'stories' ? 'View story' : 'Search area'}
      </Link>
    </div>
  )
}
