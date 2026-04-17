'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { StoryData } from '@/data'
import { creatorMap, assetMap } from '@/data'
import { PreviewMedia } from '@/components/preview/PreviewMedia'
import { PreviewActions } from '@/components/preview/PreviewActions'
import { PreviewOverlay, OverlaySpacer } from '@/components/preview/PreviewOverlay'
import { PreviewIdentity } from '@/components/preview/PreviewIdentity'
import { PreviewMeta } from '@/components/preview/PreviewMeta'
import type { PreviewSize } from '@/lib/preview/types'

interface StoryCardProps {
  story: StoryData
  size?: 'default' | 'large' | 'compact'
  reason?: string
}

const SIZE_MAP: Record<'default' | 'large' | 'compact', PreviewSize> = {
  compact: 'sm',
  default: 'md',
  large: 'lg',
}

export function StoryCard({ story, size = 'default', reason }: StoryCardProps) {
  const creator = creatorMap[story.creatorId]

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const heroAsset = useMemo(() => {
    if (!mounted) return assetMap[story.heroAssetId]
    try {
      const saved = localStorage.getItem(`story-order-${story.id}`)
      if (saved) {
        const ids: string[] = JSON.parse(saved)
        const asset = ids[0] ? assetMap[ids[0]] : null
        if (asset) return asset
      }
    } catch {}
    return assetMap[story.heroAssetId]
  }, [mounted, story.id, story.heroAssetId])

  const previewSize = SIZE_MAP[size]

  return (
    <Link
      href={`/story/${story.id}`}
      className="group block bg-black"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/lightbox-item', story.id); e.dataTransfer.effectAllowed = 'copy' }}
    >
      <PreviewMedia
        family="story"
        size={previewSize}
        src={heroAsset?.thumbnailRef}
        assetId={heroAsset?.id}
        alt={story.title}
        creatorSlugCrop="50% 30%"
      >
        {/* Hover overlay */}
        <PreviewOverlay gradient="deep">
          {/* Top left: type label */}
          <div className="relative px-3 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Story &middot; {story.assetIds.length} assets
            </span>
          </div>

          <OverlaySpacer />

          {/* Bottom: info */}
          <div className="relative px-3 pb-1.5 overflow-hidden">
            {creator && (
              <div className="mb-2">
                <PreviewIdentity
                  name={creator.name}
                  avatarSrc={creator.avatarRef}
                  avatarSlug={creator.slug}
                  location={creator.locationBase}
                  variant="dark"
                  avatarSize="xs"
                />
              </div>
            )}

            <h3 className="font-black text-white leading-tight text-[14px] line-clamp-2">{story.title}</h3>
            <p className="text-[11px] text-white/60 leading-snug line-clamp-2 mt-1">{story.dek}</p>

            <PreviewMeta
              items={[
                story.coverageWindow.start.slice(0, 10),
                story.primaryGeography,
              ]}
              variant="dark"
              className="mt-1.5"
            />
          </div>

          <PreviewActions
            actions={['lightbox', 'like', 'comment', 'share']}
            entityId={story.id}
            entityTitle={story.title}
            sharePath={`/story/${story.id}`}
          />
        </PreviewOverlay>
      </PreviewMedia>
    </Link>
  )
}
