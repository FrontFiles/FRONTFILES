'use client'

import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useComposer } from '@/lib/composer/context'
import { getFilteredSearchAssets, getSourceAssets, getInlineTextAssets } from '@/lib/composer/selectors'
import { publicAssets, creatorMap } from '@/data'
import type { AssetData } from '@/data'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'
import { resolveProtectedUrl, resolveProtectedMediaUrl } from '@/lib/media/delivery-policy'
import { type MapSize } from '@/components/discovery/DiscoveryMap'
import { GeoDiscoveryPanel } from '@/components/discovery/GeoDiscoveryPanel'
import { GeoBoltControlGroup, type ContextualPanel } from '@/components/discovery/GeoBoltControlGroup'
import { BoltPanel } from '@/components/discovery/BoltPanel'
import { useBoltSession } from '@/hooks/useBoltSession'
import { deriveScopeFromComposerSearch } from '@/lib/bolt/scope'

const VAULT_FORMATS = ['All', 'Photo', 'Video', 'Audio', 'Text', 'Illustration', 'Infographic', 'Vector'] as const

export interface SearchRailProps {
  /** Fires whenever the active contextual panel changes. ComposerShell
   *  uses this to collapse its SearchRail column down to just the rail
   *  (no gallery, no panel) when both Geo and BOLT are closed. */
  onActivePanelChange?: (panel: ContextualPanel) => void
}

export function SearchRail({ onActivePanelChange }: SearchRailProps = {}) {
  const { state, dispatch } = useComposer()
  const allResults = useMemo(() => getFilteredSearchAssets(state, publicAssets), [state])
  const sourceAssets = getSourceAssets(state)
  const inlineTextAssets = getInlineTextAssets(state)
  const totalSelected = sourceAssets.length + inlineTextAssets.length
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mapSize, setMapSize] = useState<MapSize>('small')
  const [viewMode, setViewMode] = useState<'grid4' | 'grid2' | 'grid1' | 'list'>('grid4')
  const [hoverEnabled, setHoverEnabled] = useState(true)
  const [fmtFilter, setFmtFilter] = useState('All')

  // ── BOLT — wired identically to Discovery's /search page ──
  // Same `useBoltSession` hook + same `BoltPanel` component as Discovery.
  // The only difference vs Discovery is the scope source: Discovery reads
  // URL params, Composer reads the Composer reducer.
  const boltButtonRef = useRef<HTMLButtonElement>(null)
  const boltScope = useMemo(
    () => deriveScopeFromComposerSearch(state.search),
    [state.search]
  )
  const bolt = useBoltSession(boltScope)

  // Geo ↔ BOLT mutual exclusivity — same derived-state + single-funnel
  // pattern used in `src/app/search/page.tsx`. The GeoBoltControlGroup
  // rail is dumb; every toggle lands in `handleSelectPanel`.
  const boltOpen = bolt.state.status !== 'closed'
  const activePanel: ContextualPanel = sidebarOpen ? 'geo' : boltOpen ? 'bolt' : null
  // Mirror activePanel to ComposerShell so it can collapse the SearchRail
  // column width when both panels are closed.
  useEffect(() => {
    onActivePanelChange?.(activePanel)
  }, [activePanel, onActivePanelChange])
  const handleSelectPanel = useCallback((next: ContextualPanel) => {
    if (next === 'geo') {
      bolt.close()
      setSidebarOpen(true)
      // Same map-revival rule as Discovery: if the user previously dismissed
      // the in-map HIDE button (which sets mapSize='hidden'), restore a
      // visible size on every Geo open.
      setMapSize((prev) => (prev === 'hidden' ? 'small' : prev))
    } else if (next === 'bolt') {
      setSidebarOpen(false)
      void bolt.run()
    } else {
      bolt.close()
      setSidebarOpen(false)
    }
  }, [bolt])
  const handleBoltRequestScope = useCallback(() => {
    bolt.close()
    // Return focus to the canonical Composer search input above.
    document
      .querySelector<HTMLInputElement>('input[data-composer-search]')
      ?.focus()
  }, [bolt])

  const results = useMemo(() => {
    if (fmtFilter === 'All') return allResults
    return allResults.filter(a => a.format.toLowerCase() === fmtFilter.toLowerCase())
  }, [allResults, fmtFilter])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Single scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">

        {/* ── Geo + BOLT panel section ──
            Same paired rail + same panel surfaces as Discovery. Mutual
            exclusivity is enforced by `activePanel` + `handleSelectPanel`
            above — only one of geo/bolt is mounted in the column slot at
            any moment, identical to Discovery's behaviour.

            When BOLT is the active surface, this section grows to fill
            the entire SearchRail scroll area (`flex-1 min-h-0` + inner
            `items-stretch h-full`) so BoltPanel takes the whole column
            vertically. BoltPanel itself is given an `outerClassName`
            override so it fills the remaining width next to the rail
            instead of sitting at its default 480px fixed width.

            In the Geo or closed states the section is content-sized
            (`shrink-0` + `items-start`) so the gallery below can flow
            naturally and the rail stays at its 240px min-height. */}
        <div
          className={`${
            activePanel === 'bolt' ? 'flex-1 min-h-0' : 'shrink-0'
          } border-b-2 border-black`}
        >
          <div
            className={`flex px-3 pt-3 pb-3 ${
              activePanel === 'bolt' ? 'items-stretch h-full' : 'items-start'
            }`}
          >
            <GeoBoltControlGroup
              ref={boltButtonRef}
              activePanel={activePanel}
              onSelectPanel={handleSelectPanel}
            />
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <GeoDiscoveryPanel
                  mapSize={mapSize}
                  onMapSizeChange={setMapSize}
                  onHide={() => handleSelectPanel(null)}
                  showSpotlight={false}
                />
              </div>
            )}
            <BoltPanel
              state={bolt.state}
              preview={bolt.preview}
              onClose={bolt.close}
              onRetry={() => { void bolt.run() }}
              onRequestScope={handleBoltRequestScope}
              openButtonRef={boltButtonRef}
              outerClassName="flex-1 min-w-0 border-l-2 border-black bg-white flex flex-col h-full overflow-hidden"
            />
          </div>
        </div>

        {/* Selected sources strip */}
        {totalSelected > 0 && (
          <div className="px-3 py-2 border-b border-black/10 shrink-0 bg-[#0000ff]/[0.03]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#0000ff] block mb-1">
              In article ({totalSelected})
            </span>
            <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
              {sourceAssets.map(asset => (
                <div key={asset.id} className="flex items-center gap-2 group">
                  <div className="w-8 h-6 bg-slate-100 shrink-0 overflow-hidden">
                    <img src={resolveProtectedUrl(asset.id, 'composer')} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-bold text-black truncate flex-1">{asset.title}</span>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_SOURCE_ASSET', payload: { assetId: asset.id } })}
                    className="text-[10px] text-slate-300 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {inlineTextAssets.map(ta => (
                <div key={ta.blockId} className="flex items-center gap-2">
                  <div className="w-8 h-6 bg-black shrink-0 flex items-center justify-center">
                    <span className="text-[7px] font-bold uppercase text-white">Text</span>
                  </div>
                  <span className="text-[10px] font-bold text-black truncate flex-1">{ta.title}</span>
                  <span className="text-[9px] font-mono text-slate-400 shrink-0">{ta.wordCount}w</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Asset gallery — search + toolbar + grid ──
            Coupled to Geo visibility (`sidebarOpen`). The gallery is the
            sibling surface of the map: when the user switches to BOLT, the
            gallery collapses together with the map so the column reads as
            "BOLT takes the whole context" (same pattern as Discovery's
            right-column spotlight hiding when BOLT opens).
            The canonical search bar lives at the top of this block, just
            above the format chip toolbar, so it reads as the gallery's own
            header — but it still writes to `state.search.query`, the
            single source of truth that feeds both Geo and BOLT scope. */}
        {sidebarOpen && (
          <>
            {/* Composer canonical search bar — single source of truth */}
            <div className="shrink-0 border-b-2 border-black px-3 pt-3 pb-3">
              <div className="flex items-stretch h-9 border-2 border-[#0000ff] bg-white">
                <div className="flex items-center px-3 shrink-0 text-[#0000ff]/40">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <input
                  type="text"
                  data-composer-search
                  value={state.search.query}
                  onChange={(e) =>
                    dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })
                  }
                  placeholder="Describe the content, story, coverage or help required."
                  className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-black placeholder:text-[#0000ff]/30"
                />
              </div>
            </div>

            {/* Unified results bar: count + format chips (scrollable) + hover toggle + view toggles */}
            <div className="flex items-center gap-3 px-3 py-2 border-b border-black/10 shrink-0">
              {/* Left: count + format chips */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto scrollbar-none">
                <span className="text-[10px] font-mono text-black/40 shrink-0 mr-2">{results.length}</span>
                {VAULT_FORMATS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFmtFilter(f)}
                    className={`h-9 px-3 inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-wider border-2 transition-colors whitespace-nowrap shrink-0 ${
                      fmtFilter === f
                        ? 'bg-[#0000ff] text-white border-[#0000ff]'
                        : 'bg-white border-black text-black hover:bg-[#0000ff] hover:text-white hover:border-[#0000ff]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {/* Right: hover toggle + view toggles */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setHoverEnabled(h => !h)}
                  className={`h-9 w-9 inline-flex items-center justify-center border-2 transition-colors ${
                    hoverEnabled
                      ? 'bg-[#0000ff] text-white border-[#0000ff]'
                      : 'bg-white text-black border-black hover:bg-[#0000ff] hover:text-white hover:border-[#0000ff]'
                  }`}
                  title={hoverEnabled ? 'Hover preview on' : 'Hover preview off'}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 2v17l4.5-4.5 3.5 7 2.5-1.3-3.5-7H17.5L5 2z" />
                    {!hoverEnabled && <rect x="1" y="1" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" rx="0" />}
                  </svg>
                </button>
                <div className="flex items-stretch h-9 border-2 border-black">
                  {([
                    ['grid4', <><span className="flex gap-[2px] w-3 h-3 items-stretch"><span className="bg-current flex-1" /><span className="bg-current flex-1" /><span className="bg-current flex-1" /><span className="bg-current flex-1" /></span></>],
                    ['grid2', <><span className="grid grid-cols-2 gap-[2px] w-3 h-3"><span className="bg-current col-span-1 row-span-2 h-3" /><span className="bg-current col-span-1 row-span-2 h-3" /></span></>],
                    ['grid1', <><span className="flex flex-col gap-[2px] w-3 h-3"><span className="bg-current flex-1" /></span></>],
                    ['list',  <><span className="flex flex-col gap-[2px] w-3 h-3"><span className="bg-current h-[2px]" /><span className="bg-current h-[2px]" /><span className="bg-current h-[2px]" /></span></>],
                  ] as [string, React.ReactNode][]).map(([vm, icon], i) => (
                    <button
                      key={vm}
                      onClick={() => setViewMode(vm as typeof viewMode)}
                      className={`w-9 inline-flex items-center justify-center transition-colors ${i > 0 ? 'border-l-2 border-black' : ''} ${
                        viewMode === vm ? 'bg-[#0000ff] text-white' : 'bg-white text-black hover:bg-[#0000ff] hover:text-white'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results grid */}
            <div className={
              viewMode === 'grid4' ? 'grid grid-cols-4 gap-0' :
              viewMode === 'grid2' ? 'grid grid-cols-2 gap-0' :
              viewMode === 'grid1' ? 'flex flex-col' :
              'flex flex-col'
            }>
              {results.length === 0 && (
                <p className="text-[10px] text-slate-400 px-3 py-4 col-span-4">No matching assets.</p>
              )}
              {results.slice(0, 60).map(asset => (
                <SearchResultCard key={asset.id} asset={asset} compact={viewMode === 'grid4' || viewMode === 'grid2'} hoverEnabled={hoverEnabled} />
              ))}
            </div>
          </>
        )}

      </div>{/* end scroll area */}
    </div>
  )
}

// ── Search result card with preview ─────────────────────────

function SearchResultCard({ asset, compact = false, hoverEnabled = true }: { asset: AssetData; compact?: boolean; hoverEnabled?: boolean }) {
  const { dispatch } = useComposer()
  const creator = creatorMap[asset.creatorId]

  // Inline playback on hover (video/audio only — no fullscreen takeover)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Click-to-preview (fullscreen, does not block drag)
  const [showPreview, setShowPreview] = useState(false)
  // Text preview uses asset.textExcerpt — full text is original-only.

  const hasVideo = !!asset.videoUrl
  const hasAudio = !!asset.audioUrl
  const hasText = asset.format === 'Text' && !!asset.textExcerpt

  const handleMouseEnter = useCallback(() => {
    if (!hoverEnabled) return
    // Only inline playback — no fullscreen magnify on hover
    if (hasAudio && audioRef.current) {
      audioRef.current.play().catch(() => {})
      setAudioPlaying(true)
    } else if (hasVideo && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [hoverEnabled, hasAudio, hasVideo])

  const handleMouseLeave = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setAudioPlaying(false)
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0.5
    }
  }, [])

  const openPreview = useCallback(() => {
    setShowPreview(true)
  }, [])

  return (
    <>
      <div
        className="relative group border-b border-slate-100 hover:bg-slate-50 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('text/plain', asset.id)
          e.dataTransfer.effectAllowed = 'copy'
        }}
      >
        {/* Thumbnail with format-specific inline preview */}
        <div className="relative aspect-video overflow-hidden bg-slate-100">
          {asset.videoUrl ? (
            <video
              ref={videoRef}
              src={resolveProtectedMediaUrl(asset.id, 'video', 'composer')}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={e => { e.currentTarget.currentTime = 0.5 }}
              className="w-full h-full object-cover"
            />
          ) : hasAudio ? (
            <div className="w-full h-full bg-black flex items-center justify-center relative">
              <audio ref={audioRef} src={resolveProtectedMediaUrl(asset.id, 'audio', 'composer')} preload="metadata" />
              {!audioPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="w-8 h-8 border-2 border-white/60 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white/60 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              )}
              <div className="flex items-end gap-[2px] h-6">
                {[0.3, 0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.35, 0.7, 0.5, 0.85, 0.4].map((h, i) => (
                  <div
                    key={i}
                    className={`w-[2px] ${audioPlaying ? 'bg-[#0000ff]/60' : 'bg-white/40'} transition-colors`}
                    style={{
                      height: `${h * 100}%`,
                      animation: audioPlaying ? `audioBar 0.8s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
                    }}
                  />
                ))}
              </div>
              <style>{`@keyframes audioBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>
            </div>
          ) : hasText ? (
            <div className="w-full h-full bg-white px-3 py-2 overflow-hidden relative flex flex-col">
              <h4 className="text-[9px] font-bold text-black leading-tight line-clamp-1">{asset.title}</h4>
              <p className="text-[7px] leading-[1.5] text-black/50 font-serif mt-1 line-clamp-3 flex-1">{asset.textExcerpt}</p>
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent" />
            </div>
          ) : (
            <img src={resolveProtectedUrl(asset.id, 'composer')} alt={asset.title} className="w-full h-full object-cover" />
          )}

          {/* Format badge */}
          <span className="absolute top-1 left-1 text-[8px] font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5 leading-none">
            {asset.format}
          </span>

          {/* Duration / word count */}
          {asset.durationSeconds && (
            <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-black/80 text-white px-1.5 py-0.5 font-mono leading-none">
              {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
            </span>
          )}
          {asset.wordCount && (
            <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-black/80 text-white px-1.5 py-0.5 font-mono leading-none">
              {asset.wordCount}w
            </span>
          )}

          {/* Hover action buttons */}
          <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {/* Preview button — click to open fullscreen */}
            <button
              onClick={e => { e.stopPropagation(); openPreview() }}
              className="w-5 h-5 bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
              title="Preview"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
                <path d="M8 3C4 3 1.5 8 1.5 8s2.5 5 6.5 5 6.5-5 6.5-5S12 3 8 3z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {/* Add button */}
            <button
              onClick={e => {
                e.stopPropagation()
                dispatch({ type: 'ADD_SOURCE_ASSET', payload: { assetId: asset.id } })
              }}
              className="w-5 h-5 bg-[#0000ff] text-white text-xs flex items-center justify-center hover:bg-[#0000cc] transition-colors"
              title="Add to article"
            >
              +
            </button>
          </div>
        </div>

        {/* Info — hidden in compact grid mode */}
        {!compact && (
          <div className="px-2 py-1.5">
            <div className="text-[10px] font-bold text-black truncate">{asset.title}</div>
            <div className="flex items-center gap-1 mt-0.5">
              {creator && <span className="text-[9px] text-slate-400 truncate">{creator.name}</span>}
              <span className="text-[9px] text-slate-300">&middot;</span>
              <span className="text-[9px] text-slate-400">{asset.locationLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <ValidationBadge state={asset.validationDeclaration} />
              {asset.price && (
                <span className="text-[9px] font-bold font-mono text-black">&euro;{asset.price.toFixed(2)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen preview portal — click-triggered, click to dismiss */}
      {showPreview && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-pointer animate-in fade-in duration-200"
          onClick={() => setShowPreview(false)}
        >
          {/* Close hint */}
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest z-10"
            onClick={() => setShowPreview(false)}
          >
            Close
          </button>

          {hasText ? (
            <div
              className="bg-white max-w-[700px] w-[90vw] max-h-[85vh] overflow-y-auto p-10 relative select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <span className="text-[80px] font-black uppercase tracking-[0.2em] text-black/[0.04] rotate-[-30deg] whitespace-nowrap select-none">LICENSABLE</span>
              </div>
              <p className="text-[13px] leading-[1.8] text-black/80 font-serif whitespace-pre-line relative z-10">
                {asset.textExcerpt}
              </p>
            </div>
          ) : hasVideo ? (
            <video
              src={resolveProtectedMediaUrl(asset.id, 'video', 'composer')}
              autoPlay
              muted
              loop
              playsInline
              className="max-w-[85vw] max-h-[85vh] object-contain"
              onClick={e => e.stopPropagation()}
            />
          ) : hasAudio ? (
            <div className="bg-black p-8 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-end gap-[3px] h-16">
                {[0.3, 0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.35, 0.7, 0.5, 0.85, 0.4, 0.6, 0.9, 0.3, 0.7].map((h, i) => (
                  <div
                    key={i}
                    className="w-[4px] bg-[#0000ff]/60"
                    style={{
                      height: `${h * 100}%`,
                      animation: `audioBar 0.8s ease-in-out ${i * 0.05}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
              <audio src={resolveProtectedMediaUrl(asset.id, 'audio', 'composer')} autoPlay controls className="w-64" />
              <style>{`@keyframes audioBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>
            </div>
          ) : (
            <img
              src={resolveProtectedUrl(asset.id, 'composer')}
              alt={asset.title}
              className="max-w-[85vw] max-h-[85vh] object-contain"
            />
          )}

          {/* Asset info bar at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-6 py-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]/60">{asset.format}</span>
                <h3 className="text-sm font-bold text-white mt-0.5">{asset.title}</h3>
                <span className="text-[10px] text-white/60">
                  {creator?.name} &middot; {asset.locationLabel}
                </span>
              </div>
              <button
                className="h-8 px-4 bg-[#0000ff] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#0000cc] transition-colors"
                onClick={e => {
                  e.stopPropagation()
                  dispatch({ type: 'ADD_SOURCE_ASSET', payload: { assetId: asset.id } })
                  setShowPreview(false)
                }}
              >
                Add to article
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

