'use client'

import { useState, useRef, useEffect } from 'react'
import type { AssetData } from '@/data'
import { WatermarkOverlay } from '@/components/watermark'
import { useWatermark } from '@/hooks/useWatermark'
import { resolveDetailUrl } from '@/lib/media/resolve-url'
import { resolveProtectedMediaUrl } from '@/lib/media/delivery-policy'

/**
 * Format dispatcher — routes to the correct viewer per asset format.
 */
export function AssetViewer({ asset, creatorName }: { asset: AssetData; creatorName?: string }) {
  switch (asset.format) {
    case 'Text':
      return <TextViewer asset={asset} />
    case 'Audio':
      return <AudioViewer asset={asset} />
    case 'Video':
      return <VideoViewer asset={asset} />
    case 'Infographic':
      return <InfographicViewer asset={asset} creatorName={creatorName} />
    default:
      return <ImageViewer asset={asset} creatorName={creatorName} />
  }
}

// ── Lightbox overlay (shared by image viewers) ──────────

function LightboxOverlay({ src, alt, onClose, scrollable }: { src: string; alt: string; onClose: () => void; scrollable?: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out ${scrollable ? 'overflow-auto' : ''}`}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 text-white/60 hover:text-white transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img src={src} alt={alt} className={`max-w-[90vw] object-contain ${scrollable ? 'max-h-none' : 'max-h-[90vh]'}`} />
    </div>
  )
}

// ── Image viewer (Photo / Illustration / Vector) ────────

function ImageViewer({ asset, creatorName }: { asset: AssetData; creatorName?: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)
  const wmConfig = useWatermark('detail-preview', asset.watermarkMode)
  const protectedSrc = resolveDetailUrl(asset.id)

  return (
    <>
      <div
        className="relative isolate bg-slate-50 border-2 border-black overflow-hidden cursor-zoom-in"
        onClick={() => setZoomed(true)}
      >
        {protectedSrc ? (
          <img
            src={protectedSrc}
            alt={asset.title}
            className="max-w-full h-auto block"
            style={{ maxHeight: '70vh' }}
            onLoad={(e) => {
              const el = e.currentTarget
              setImgDims({ w: el.clientWidth, h: el.clientHeight })
            }}
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center">
            <span className="text-sm font-bold font-mono text-black/20">{asset.format}</span>
          </div>
        )}
        {wmConfig.enabled && imgDims && (
          <WatermarkOverlay intensity={wmConfig.intensity} imageWidth={imgDims.w} imageHeight={imgDims.h} assetId={asset.id} attribution={creatorName} />
        )}
      </div>
      {zoomed && protectedSrc && (
        <LightboxOverlay src={protectedSrc} alt={asset.title} onClose={() => setZoomed(false)} />
      )}
    </>
  )
}

// ── Infographic viewer ──────────────────────────────────

function InfographicViewer({ asset, creatorName }: { asset: AssetData; creatorName?: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)
  const wmConfig = useWatermark('detail-preview', asset.watermarkMode)
  const protectedSrc = resolveDetailUrl(asset.id)

  return (
    <>
      <div
        className="relative isolate bg-white border-2 border-black overflow-hidden cursor-zoom-in"
        onClick={() => setZoomed(true)}
      >
        {protectedSrc ? (
          <img
            src={protectedSrc}
            alt={asset.title}
            className="w-full h-auto"
            onLoad={(e) => {
              const el = e.currentTarget
              setImgDims({ w: el.clientWidth, h: el.clientHeight })
            }}
          />
        ) : (
          <div className="w-full aspect-[3/4] flex items-center justify-center">
            <span className="text-sm font-bold font-mono text-black/20">INFOGRAPHIC</span>
          </div>
        )}
        {wmConfig.enabled && imgDims && (
          <WatermarkOverlay intensity={wmConfig.intensity} imageWidth={imgDims.w} imageHeight={imgDims.h} assetId={asset.id} attribution={creatorName} />
        )}
      </div>
      {zoomed && protectedSrc && (
        <LightboxOverlay src={protectedSrc} alt={asset.title} onClose={() => setZoomed(false)} scrollable />
      )}
    </>
  )
}

// ── Video viewer ────────────────────────────────────────

function VideoViewer({ asset }: { asset: AssetData }) {
  const wmConfig = useWatermark('detail-preview', asset.watermarkMode)
  const protectedPoster = resolveDetailUrl(asset.id)

  return (
    <div className="border-2 border-black overflow-hidden bg-black">
      {asset.videoUrl ? (
        <video src={resolveProtectedMediaUrl(asset.id, 'video', 'preview')} controls className="w-full aspect-video object-contain" poster={protectedPoster || undefined} />
      ) : protectedPoster ? (
        <div className="relative aspect-video">
          <img src={protectedPoster} alt={asset.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-white/80 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
          {asset.durationSeconds && (
            <span className="absolute bottom-3 right-3 text-[10px] font-bold bg-black/80 text-white px-2 py-0.5 font-mono">
              {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video flex items-center justify-center bg-black">
          <span className="text-sm font-bold font-mono text-white/20">VIDEO</span>
        </div>
      )}
    </div>
  )
}

// ── Audio viewer ────────────────────────────────────────

const WAVEFORM_BARS = [0.3,0.5,0.8,0.4,1,0.6,0.9,0.35,0.7,0.5,0.85,0.4,0.6,0.9,0.3,0.7,0.5,0.8,0.45,0.65,0.3,0.5,0.8,0.4,1,0.6,0.9,0.35,0.7,0.5,0.85,0.4,0.6,0.9,0.3,0.7,0.5,0.8,0.45,0.65]

function AudioViewer({ asset }: { asset: AssetData }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else audioRef.current.play().catch(() => {})
    setPlaying(!playing)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="border-2 border-black">
      <div className="bg-black px-6 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Audio</span>
        {asset.durationSeconds && (
          <span className="text-[10px] font-mono text-white/50">{fmt(asset.durationSeconds)}</span>
        )}
      </div>
      <div className="bg-black px-6 py-10 flex flex-col items-center gap-6">
        <audio
          ref={audioRef}
          src={resolveProtectedMediaUrl(asset.id, 'audio', 'preview')}
          preload="metadata"
          onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration) }}
          onTimeUpdate={() => { if (audioRef.current && duration) setProgress(audioRef.current.currentTime / duration) }}
          onEnded={() => setPlaying(false)}
        />
        <div className="flex items-end gap-[3px] h-20 w-full max-w-2xl justify-center">
          {WAVEFORM_BARS.map((h, i) => (
            <div
              key={i}
              className={`w-[5px] transition-colors ${i / WAVEFORM_BARS.length <= progress ? 'bg-[#0000ff]/70' : 'bg-white/20'}`}
              style={{ height: `${h * 100}%`, animation: playing ? `audioBar 0.8s ease-in-out ${i * 0.05}s infinite alternate` : 'none' }}
            />
          ))}
        </div>
        <style>{`@keyframes audioBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>
        <div className="flex items-center gap-4 text-[10px] font-mono text-white/40">
          <span>{duration > 0 ? fmt(progress * duration) : '0:00'}</span>
          <span>/</span>
          <span>{duration > 0 ? fmt(duration) : (asset.durationSeconds ? fmt(asset.durationSeconds) : '0:00')}</span>
        </div>
        <button onClick={toggle} className="w-14 h-14 border-2 border-white/60 flex items-center justify-center hover:border-white transition-colors">
          {playing ? (
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Text viewer ─────────────────────────────────────────

function TextViewer({ asset }: { asset: AssetData }) {
  // Text preview uses the excerpt stored on the asset record.
  // Full text is original-only — requires entitlement via ?delivery=original.
  const text = asset.textExcerpt ?? null

  const handleDownload = () => {
    const content = asset.textExcerpt || ''
    if (!content) return
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${asset.slug || asset.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border-2 border-black">
      <div className="bg-black px-6 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Text</span>
        <div className="flex items-center gap-4">
          {asset.wordCount && <span className="text-[10px] font-mono text-white/50">{asset.wordCount} words</span>}
          <button onClick={handleDownload} className="text-[10px] font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 px-3 py-1 transition-colors flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      </div>
      <div className="bg-white p-8 max-h-[70vh] overflow-y-auto relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="text-[80px] font-black uppercase tracking-[0.2em] text-black/[0.03] rotate-[-30deg] whitespace-nowrap select-none">LICENSABLE</span>
        </div>
        <div className="max-w-[680px] mx-auto relative z-10" style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={e => e.preventDefault()}>
          {(text || asset.description) ? (
            <p className="text-[15px] leading-[1.9] text-black/80 font-serif whitespace-pre-line">{text || asset.description}</p>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No text content available for preview.</p>
          )}
        </div>
      </div>
    </div>
  )
}
