'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { PreviewFamily, PreviewSize, MediaConfig } from '@/lib/preview/types'
import { resolveMediaConfig, resolveObjectPosition } from '@/lib/preview/media'
import { WatermarkOverlay } from '@/components/watermark'
import type { WatermarkConfig } from '@/lib/watermark/types'
import { resolvePreviewUrl } from '@/lib/media/resolve-url'
import { resolveProtectedMediaUrl } from '@/lib/media/delivery-policy'

interface PreviewMediaProps {
  family: PreviewFamily
  size: PreviewSize
  src?: string | null
  alt: string
  videoUrl?: string | null
  audioUrl?: string | null
  textExcerpt?: string | null
  format?: string
  focalPoint?: { x: number; y: number } | null
  creatorSlugCrop?: string | null
  durationSeconds?: number
  watermarkConfig?: WatermarkConfig | null
  assetId?: string
  attribution?: string
  mediaConfig?: MediaConfig
  className?: string
  children?: React.ReactNode
}

export function PreviewMedia({
  family,
  size,
  src,
  alt,
  videoUrl,
  audioUrl,
  textExcerpt,
  format,
  focalPoint,
  creatorSlugCrop,
  durationSeconds,
  watermarkConfig,
  assetId,
  attribution,
  mediaConfig: mediaOverride,
  className,
  children,
}: PreviewMediaProps) {
  const media = mediaOverride ?? resolveMediaConfig(family, size)
  const objectPosition = resolveObjectPosition(family, focalPoint, creatorSlugCrop)
  const [cardDims, setCardDims] = useState<{ w: number; h: number } | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setCardDims({ w: node.clientWidth, h: node.clientHeight })
  }, [])

  // Resolve protected URL — browser never sees original in watermark-required contexts
  const protectedSrc = resolvePreviewUrl(assetId ?? '')

  const showFormatRendering = media.formatRendering && family === 'asset'
  const isVideoFormat = showFormatRendering && format === 'Video'
  const isAudioFormat = showFormatRendering && format === 'Audio'
  const isTextFormat = showFormatRendering && format === 'Text'
  const hasVideo = isVideoFormat && !!videoUrl
  const hasAudio = isAudioFormat && !!audioUrl

  // ─── Hover-to-play (videos only) ───────────────────────────
  // The poster shows the still by default. On mouse enter the
  // video element starts playing; on mouse leave it pauses.
  // The ref is attached only to the <video> element below, so
  // these handlers are no-ops for non-video previews.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handlePreviewEnter = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    // Reset to start so each hover replays from the beginning.
    try { v.currentTime = 0 } catch { /* seek may fail before metadata loads */ }
    v.play().catch(() => { /* play() may be rejected by autoplay policy — silent no-op */ })
  }, [])
  const handlePreviewLeave = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    // Don't reset currentTime here — leaving the playhead where
    // it stopped means the poster (which only shows when paused
    // before any play) takes over again on the next render. The
    // video element will display its last-painted frame, which
    // visually feels like a "pause" rather than a "rewind".
  }, [])

  return (
    <div
      ref={containerRef}
      onMouseEnter={hasVideo ? handlePreviewEnter : undefined}
      onMouseLeave={hasVideo ? handlePreviewLeave : undefined}
      className={cn('relative isolate overflow-hidden bg-slate-100', media.aspectClass, className)}
    >
      {hasVideo ? (
        // `poster` is REQUIRED for reliable thumbnail rendering.
        // Without it, we relied on `preload="metadata"` + a
        // currentTime=0.5 seek to paint the first frame — but
        // many browsers (notably some Chromium build modes and
        // any environment that doesn't autoplay video) refuse
        // to paint a video's frame until `play()` is called,
        // leaving the slate-100 container empty. The poster is
        // an `<img>`-style fetch the browser always renders, so
        // the thumbnail appears no matter what. `protectedSrc`
        // is the same URL the still-image branch uses below,
        // so video and non-video Discovery cards now show
        // identical thumbnails when not hovered.
        <video
          ref={videoRef}
          src={resolveProtectedMediaUrl(assetId, 'video', 'thumbnail')}
          poster={protectedSrc}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.5 }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : hasAudio ? (
        <div className="w-full h-full bg-black flex items-center justify-center relative">
          <audio src={resolveProtectedMediaUrl(assetId, 'audio', 'thumbnail')} preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-10 h-10 border-2 border-white/60 flex items-center justify-center">
              <svg className="w-4 h-4 text-white/60 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          <div className="flex items-end gap-[3px] h-10">
            {[0.3, 0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.35, 0.7, 0.5, 0.8, 0.45, 0.65].map((h, i) => (
              <div
                key={i}
                className="w-[3px] bg-white/40"
                style={{ height: `${h * 100}%` }}
              />
            ))}
          </div>
        </div>
      ) : isAudioFormat ? (
        <div className="w-full h-full bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-white/60 flex items-center justify-center">
            <svg className="w-4 h-4 text-white/60 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      ) : isVideoFormat ? (
        <div className="w-full h-full bg-black flex items-center justify-center relative">
          {protectedSrc && <img src={protectedSrc} alt={alt} className="w-full h-full object-cover opacity-60" />}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/80 flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      ) : isTextFormat ? (
        <div className="w-full h-full bg-stone-50 overflow-hidden flex flex-col justify-center px-5 py-4">
          <h4 className="text-[11px] font-bold text-black/70 leading-tight line-clamp-2 mb-2">{alt}</h4>
          {textExcerpt ? (
            <p className="text-[11px] leading-[1.6] text-black/40 font-serif italic line-clamp-3">{textExcerpt}</p>
          ) : (
            <p className="text-[10px] text-black/20 font-serif italic">Text asset — no preview available</p>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-stone-50 to-transparent" />
        </div>
      ) : protectedSrc ? (
        <img
          src={protectedSrc}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ objectPosition }}
        />
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-black/20">
            {format || 'No image'}
          </span>
        </div>
      )}

      {watermarkConfig?.enabled && cardDims && assetId && (
        <WatermarkOverlay
          intensity={watermarkConfig.intensity}
          imageWidth={cardDims.w}
          imageHeight={cardDims.h}
          assetId={assetId}
          attribution={attribution}
        />
      )}

      {durationSeconds != null && durationSeconds > 0 && (
        <span className="absolute bottom-2 right-2 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 font-mono z-10">
          {Math.floor(durationSeconds / 60)}:{String(durationSeconds % 60).padStart(2, '0')}
        </span>
      )}

      {children}
    </div>
  )
}
