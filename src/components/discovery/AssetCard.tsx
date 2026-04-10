'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { AssetData } from '@/data'
import { creatorMap } from '@/data'
import { ValidationBadge } from './ValidationBadge'
import { Avatar } from './Avatar'

interface AssetCardProps {
  asset: AssetData
  size?: 'default' | 'large' | 'compact'
  showCreator?: boolean
  reason?: string
  disablePreview?: boolean
}

export function AssetCard({ asset, size = 'default', showCreator = true, reason, disablePreview = false }: AssetCardProps) {
  const hoverScale = disablePreview ? '' : 'group-hover:scale-[1.02]'
  const creator = creatorMap[asset.creatorId]
  const isLarge = size === 'large'
  const isCompact = size === 'compact'
  const [showPreview, setShowPreview] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hasVideo = !!asset.videoUrl
  const hasAudio = !!asset.audioUrl
  const hasText = asset.format === 'Text' && !!asset.textExcerpt

  const handleMouseEnter = useCallback(() => {
    if (disablePreview) return
    if (hasAudio) {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {})
        setAudioPlaying(true)
      }
    } else if (hasVideo) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {})
      }
    } else {
      timerRef.current = setTimeout(() => setShowPreview(true), 400)
    }
    if (hasText && !textContent && asset.textUrl) {
      fetch(asset.textUrl).then(r => r.text()).then(t => setTextContent(t)).catch(() => {})
    }
  }, [disablePreview, hasAudio, hasVideo, hasText, textContent, asset.textUrl])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowPreview(false)
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

  return (
    <>
      <Link
        href={`/asset/${asset.id}`}
        className="group block border border-slate-200 hover:border-black transition-colors bg-white relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Thumbnail */}
        <div className="relative overflow-hidden bg-slate-100 aspect-video">
          {asset.videoUrl ? (
            <video
              ref={videoRef}
              src={asset.videoUrl}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.5 }}
              className={`w-full h-full object-cover ${hoverScale} transition-transform duration-300`}
            />
          ) : hasAudio ? (
            <div className="w-full h-full bg-black flex items-center justify-center relative">
              <audio ref={audioRef} src={asset.audioUrl!} preload="metadata" />
              {!audioPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="w-10 h-10 border-2 border-white/60 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white/60 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              )}
              <div className="flex items-end gap-[3px] h-10">
                {[0.3, 0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.35, 0.7, 0.5, 0.85, 0.4, 0.6, 0.9, 0.3, 0.7, 0.5, 0.8, 0.45, 0.65].map((h, i) => (
                  <div
                    key={i}
                    className={`w-[3px] ${audioPlaying ? 'bg-[#0000ff]/60' : 'bg-white/40'} transition-colors`}
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
            <div className="w-full h-full bg-stone-50 overflow-hidden relative flex items-center justify-center px-6 py-6">
              <div className="w-full max-w-[90%] text-center">
                <p className="text-[12px] leading-[1.7] text-black/50 font-serif italic line-clamp-5">{asset.textExcerpt}</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-stone-50 to-transparent" />
            </div>
          ) : (
            <img
              src={asset.thumbnailRef}
              alt={asset.title}
              className={`w-full h-full object-cover object-center ${hoverScale} transition-transform duration-300`}
            />
          )}
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
            {asset.format}
          </span>
          {asset.durationSeconds && (
            <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/80 text-white px-2 py-0.5 font-mono">
              {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
            </span>
          )}
          {asset.wordCount && (
            <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/80 text-white px-2 py-0.5 font-mono">
              {asset.wordCount} words
            </span>
          )}
        </div>

        {/* Content */}
        <div className={`${isLarge ? 'p-4' : 'p-3'}`}>
          {reason && (
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#0000ff] mb-1">{reason}</span>
          )}
          <h3 className={`font-bold text-black leading-tight ${isLarge ? 'text-sm' : 'text-xs'} ${isCompact ? 'line-clamp-2' : 'line-clamp-3'}`}>
            {asset.title}
          </h3>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {showCreator && creator && (
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Avatar src={creator.avatarRef} name={creator.name} size="xs" className="inline-block" />
                {creator.name}
              </span>
            )}
            <span className="text-[10px] text-slate-400">{asset.locationLabel}</span>
          </div>
          {!isCompact && (
            <div className="mt-2 flex items-center gap-2">
              <ValidationBadge state={asset.validationDeclaration} />
              {asset.price && (
                <span className="text-[10px] font-bold text-black font-mono">&euro;{asset.price}</span>
              )}
            </div>
          )}
        </div>
      </Link>

      {/* Fullscreen dark popup preview */}
      {showPreview && !hasAudio && !hasVideo && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none animate-in fade-in duration-200"
        >
          {hasText ? (
            <div
              className="bg-white max-w-[700px] w-[90vw] max-h-[85vh] overflow-y-auto p-10 relative select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <span className="text-[80px] font-black uppercase tracking-[0.2em] text-black/[0.04] rotate-[-30deg] whitespace-nowrap select-none">LICENSABLE</span>
              </div>
              <p className="text-[13px] leading-[1.8] text-black/80 font-serif whitespace-pre-line relative z-10">
                {textContent || asset.textExcerpt}
              </p>
            </div>
          ) : (
            <img
              src={asset.thumbnailRef}
              alt={asset.title}
              className="max-w-[85vw] max-h-[85vh] object-contain"
            />
          )}
        </div>,
        document.body
      )}
    </>
  )
}
