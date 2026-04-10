'use client'

import { useMemo, useState, useRef, useCallback, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useComposer } from '@/lib/composer/context'
import { getFilteredSearchAssets, getSourceAssets, getInlineTextAssets } from '@/lib/composer/selectors'
import { publicAssets, creatorMap } from '@/data'
import type { AssetData } from '@/data'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'
import type { AssetFormat } from '@/lib/types'

const FORMAT_FILTERS: (AssetFormat | 'all')[] = [
  'all', 'photo', 'video', 'audio', 'text', 'illustration', 'infographic', 'vector',
]

export function SearchRail() {
  const { state, dispatch } = useComposer()
  const results = useMemo(() => getFilteredSearchAssets(state, publicAssets), [state])
  const sourceAssets = getSourceAssets(state)
  const inlineTextAssets = getInlineTextAssets(state)
  const totalSelected = sourceAssets.length + inlineTextAssets.length

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="px-3 py-3 border-b border-slate-200 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
          Source assets
        </span>
        <input
          type="text"
          value={state.search.query}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
          placeholder="Search vault..."
          className="w-full h-8 border-2 border-black px-2 text-xs text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
        />
        {/* Format filter — all 7 formats */}
        <div className="flex flex-wrap gap-1 mt-2">
          {FORMAT_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => dispatch({ type: 'SET_SEARCH_FORMAT_FILTER', payload: f })}
              className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border transition-colors ${
                state.search.formatFilter === f
                  ? 'bg-[#0000ff] text-white border-[#0000ff]'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-black hover:text-black'
              }`}
            >
              {f === 'infographic' ? 'infog.' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Selected sources — vault assets + inline text assets */}
      {totalSelected > 0 && (
        <div className="px-3 py-2 border-b border-slate-200 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] block mb-1">
            Selected ({totalSelected})
          </span>
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
            {sourceAssets.map(asset => (
              <div key={asset.id} className="flex items-center gap-2 group">
                <div className="w-8 h-6 bg-slate-100 shrink-0 overflow-hidden">
                  <img src={asset.thumbnailRef} alt="" className="w-full h-full object-cover" />
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

      {/* Saved searches */}
      {state.savedSearches.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-200 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
            Saved searches
          </span>
          <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto">
            {state.savedSearches.map(s => (
              <div key={s.id} className="flex items-center gap-1 group/saved">
                <button
                  onClick={() => dispatch({ type: 'APPLY_SAVED_SEARCH', payload: { id: s.id } })}
                  className="text-[10px] text-[#0000ff] hover:text-[#00008b] truncate flex-1 text-left"
                >
                  {s.label}
                </button>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_SEARCH_ALERT', payload: { id: s.id } })}
                  className={`text-[8px] font-bold uppercase px-1 py-0.5 border transition-colors shrink-0 ${
                    s.alertEnabled
                      ? 'bg-[#0000ff] text-white border-[#0000ff]'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-black'
                  }`}
                  title={s.alertEnabled ? 'Alert on' : 'Alert off'}
                >
                  {s.alertEnabled ? 'Alert on' : 'Alert'}
                </button>
                <button
                  onClick={() => dispatch({ type: 'REMOVE_SAVED_SEARCH', payload: { id: s.id } })}
                  className="text-[10px] text-slate-300 hover:text-black opacity-0 group-hover/saved:opacity-100 transition-opacity shrink-0"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save current search button */}
      {state.search.query.trim() && (
        <div className="px-3 py-1.5 border-b border-slate-200 shrink-0">
          <SaveSearchButton />
        </div>
      )}

      {/* Search results */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {results.length === 0 && (
            <p className="text-[10px] text-slate-400 px-3 py-4">No matching assets.</p>
          )}
          {results.slice(0, 50).map(asset => (
            <SearchResultCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="px-3 py-2 border-t border-slate-200 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {results.length} results
        </span>
      </div>
    </div>
  )
}

// ── Search result card with preview ─────────────────────────

function SearchResultCard({ asset }: { asset: AssetData }) {
  const { dispatch } = useComposer()
  const creator = creatorMap[asset.creatorId]

  // Inline playback on hover (video/audio only — no fullscreen takeover)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Click-to-preview (fullscreen, does not block drag)
  const [showPreview, setShowPreview] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)

  const hasVideo = !!asset.videoUrl
  const hasAudio = !!asset.audioUrl
  const hasText = asset.format === 'Text' && !!asset.textExcerpt

  const handleMouseEnter = useCallback(() => {
    // Only inline playback — no fullscreen magnify on hover
    if (hasAudio && audioRef.current) {
      audioRef.current.play().catch(() => {})
      setAudioPlaying(true)
    } else if (hasVideo && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [hasAudio, hasVideo])

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
    if (hasText && !textContent && asset.textUrl) {
      fetch(asset.textUrl).then(r => r.text()).then(t => setTextContent(t)).catch(() => {})
    }
    setShowPreview(true)
  }, [hasText, textContent, asset.textUrl])

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
              src={asset.videoUrl}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={e => { e.currentTarget.currentTime = 0.5 }}
              className="w-full h-full object-cover"
            />
          ) : hasAudio ? (
            <div className="w-full h-full bg-black flex items-center justify-center relative">
              <audio ref={audioRef} src={asset.audioUrl!} preload="metadata" />
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
            <img src={asset.thumbnailRef} alt={asset.title} className="w-full h-full object-cover" />
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

        {/* Info */}
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
              <span className="text-[9px] font-bold font-mono text-black">&euro;{asset.price}</span>
            )}
          </div>
        </div>
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
                {textContent || asset.textExcerpt}
              </p>
            </div>
          ) : hasVideo ? (
            <video
              src={asset.videoUrl}
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
              <audio src={asset.audioUrl!} autoPlay controls className="w-64" />
              <style>{`@keyframes audioBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>
            </div>
          ) : (
            <img
              src={asset.thumbnailRef}
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

// ── Save search button ─────────────────────────────────────

function SaveSearchButton() {
  const { state, dispatch } = useComposer()
  const [naming, setNaming] = useState(false)
  const [label, setLabel] = useState('')

  if (!naming) {
    return (
      <button
        onClick={() => { setNaming(true); setLabel(state.search.query) }}
        className="text-[9px] font-bold uppercase tracking-widest text-[#0000ff] hover:text-[#00008b] transition-colors"
      >
        Save this search
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        autoFocus
        className="flex-1 h-5 border border-slate-200 px-1 text-[10px] text-black focus:outline-none focus:border-[#0000ff]"
        onKeyDown={e => {
          if (e.key === 'Enter' && label.trim()) {
            dispatch({ type: 'SAVE_CURRENT_SEARCH', payload: { label: label.trim() } })
            setNaming(false)
            setLabel('')
          }
          if (e.key === 'Escape') {
            setNaming(false)
            setLabel('')
          }
        }}
      />
      <button
        onClick={() => {
          if (label.trim()) {
            dispatch({ type: 'SAVE_CURRENT_SEARCH', payload: { label: label.trim() } })
          }
          setNaming(false)
          setLabel('')
        }}
        className="text-[9px] font-bold text-[#0000ff] hover:text-[#00008b]"
      >
        Save
      </button>
    </div>
  )
}
