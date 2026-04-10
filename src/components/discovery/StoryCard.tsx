'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { StoryData } from '@/data'
import { creatorMap, assetMap } from '@/data'
import { Avatar } from './Avatar'

interface StoryCardProps {
  story: StoryData
  size?: 'default' | 'large' | 'compact'
  reason?: string
  disablePreview?: boolean
}

export function StoryCard({ story, size = 'default', reason, disablePreview = false }: StoryCardProps) {
  const creator = creatorMap[story.creatorId]
  const heroAsset = assetMap[story.heroAssetId]
  const storyAssets = story.assetIds.map(id => assetMap[id]).filter(Boolean)
  const isLarge = size === 'large'
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hoverScale = disablePreview ? '' : 'group-hover:scale-[1.02]'

  const handleMouseEnter = useCallback(() => {
    if (disablePreview) return
    timerRef.current = setTimeout(() => setShowPreview(true), 400)
  }, [disablePreview])
  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowPreview(false)
  }, [])

  return (
    <>
      <Link
        href={`/story/${story.id}`}
        className="group block border border-slate-200 hover:border-black transition-colors bg-white"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {heroAsset && (
          <div className="relative overflow-hidden bg-slate-100 aspect-video">
            <img
              src={heroAsset.thumbnailRef}
              alt={story.title}
              className={`w-full h-full object-cover object-top ${hoverScale} transition-transform duration-300`}
            />
            <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest bg-[#0000ff] text-white px-2 py-0.5">
              Story &middot; {story.assetIds.length} assets
            </span>
          </div>
        )}
        <div className={isLarge ? 'p-4' : 'p-3'}>
          {reason && (
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#0000ff] mb-1">{reason}</span>
          )}
          <h3 className={`font-bold text-black leading-tight ${isLarge ? 'text-base' : 'text-sm'}`}>
            {story.title}
          </h3>
          <p className={`mt-1 text-slate-500 leading-snug line-clamp-2 ${isLarge ? 'text-sm' : 'text-xs'}`}>
            {story.dek}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
            {creator && (
              <span className="flex items-center gap-1.5">
                <Avatar src={creator.avatarRef} name={creator.name} size="xs" className="inline-block" />
                <span>{creator.name}</span>
              </span>
            )}
            <span>&middot;</span>
            <span>{story.coverageWindow.start.slice(0, 7)}</span>
            {story.topicTags.slice(0, 2).map(t => (
              <span key={t} className="border border-slate-200 px-1.5 py-0 uppercase tracking-wider font-bold text-slate-400">{t}</span>
            ))}
          </div>
        </div>
      </Link>

      {showPreview && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
          <div className="max-w-[85vw] max-h-[85vh] flex flex-col items-center gap-4">
            {/* Hero image large */}
            {heroAsset && (
              <img src={heroAsset.thumbnailRef} alt={story.title} className="max-w-full max-h-[50vh] object-contain" />
            )}
            {/* Story info */}
            <div className="text-center max-w-[600px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]/60">
                Story &middot; {storyAssets.length} assets
              </span>
              <h2 className="text-xl font-black text-white mt-1">{story.title}</h2>
              <p className="text-sm text-white/60 mt-1 line-clamp-2">{story.dek}</p>
            </div>
            {/* Asset thumbnails strip */}
            {storyAssets.length > 1 && (
              <div className="flex items-center gap-1 overflow-hidden max-w-[85vw]">
                {storyAssets.slice(0, 6).map(a => (
                  <div key={a.id} className="w-20 h-14 shrink-0 overflow-hidden">
                    <img src={a.thumbnailRef} alt={a.title} className="w-full h-full object-cover object-top" />
                  </div>
                ))}
                {storyAssets.length > 6 && (
                  <div className="w-20 h-14 shrink-0 bg-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white/50">+{storyAssets.length - 6}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
