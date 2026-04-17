'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getAvatarCrop } from '@/lib/avatar-crop'
import { Avatar, BLUR_PLACEHOLDER } from '@/components/discovery/Avatar'
import type { Creator } from '@/data'
import type { PreviewSize } from '@/lib/preview/types'
import { resolveMediaConfig } from '@/lib/preview/media'
import { PreviewActions } from './PreviewActions'
import { PreviewOverlay, OverlaySpacer } from './PreviewOverlay'

interface FrontfilerCardProps {
  creator: Creator
  size?: PreviewSize
  /** Cover image — first featured asset thumbnail. Falls back to avatar. */
  coverSrc?: string | null
  /** Featured asset thumbnails shown in hover overlay */
  featuredThumbnails?: string[]
  className?: string
}

export function FrontfilerCard({
  creator,
  size = 'md',
  coverSrc,
  featuredThumbnails = [],
  className,
}: FrontfilerCardProps) {
  const [coverFailed, setCoverFailed] = useState(false)
  const media = resolveMediaConfig('frontfiler', size)
  const cover = coverSrc ?? featuredThumbnails[0] ?? null
  const showCover = cover && !coverFailed
  const isCompact = size === 'xs' || size === 'sm'

  return (
    <Link
      href={`/creator/${creator.slug}`}
      className={cn('group block border-2 border-black bg-white', className)}
    >
      {/* Media zone — cover image background */}
      <div className={cn('relative overflow-hidden bg-slate-100', media.aspectClass)}>
        {showCover ? (
          <img
            src={cover}
            alt={creator.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setCoverFailed(true)}
          />
        ) : creator.avatarRef ? (
          <img
            src={creator.avatarRef}
            alt={creator.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            style={{ objectPosition: getAvatarCrop(creator.slug) }}
          />
        ) : (
          <img
            src={BLUR_PLACEHOLDER}
            alt=""
            className="w-full h-full object-cover blur-sm scale-110"
            aria-hidden="true"
          />
        )}

        {/* Always-visible: avatar + name at bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-3 px-3">
          <div className="flex items-center gap-2.5">
            <Avatar
              src={creator.avatarRef}
              name={creator.name}
              size={isCompact ? 'md' : 'lg'}
              slug={creator.slug}
            />
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold text-white leading-tight truncate">
                {creator.name}
              </h3>
              <span className="text-[10px] text-white/50 block leading-tight truncate mt-0.5">
                {creator.locationBase}
              </span>
            </div>
          </div>
        </div>

        {/* Verified badge */}
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[18px] border-t-[#0000ff] border-l-[18px] border-l-transparent z-10" />

        {/* Hover overlay — specialties + featured thumbnails + actions */}
        <PreviewOverlay gradient="deep">
          <div className="relative px-3 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Frontfiler
            </span>
          </div>

          <OverlaySpacer />

          <div className="relative px-3 pb-2">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar
                src={creator.avatarRef}
                name={creator.name}
                size={isCompact ? 'sm' : 'md'}
                slug={creator.slug}
              />
              <div className="min-w-0">
                <h3 className="text-[11px] font-bold text-white leading-tight truncate">
                  {creator.name}
                </h3>
                <span className="text-[9px] text-white/50 block leading-tight truncate">
                  {creator.locationBase}
                </span>
              </div>
            </div>
            {!isCompact && creator.specialties.length > 0 && (
              <span className="text-[9px] text-white/35 block line-clamp-1">
                {creator.specialties.slice(0, 3).join(' · ')}
              </span>
            )}
          </div>

          {/* Featured thumbnails */}
          {!isCompact && featuredThumbnails.length > 1 && (
            <div className="relative flex items-center gap-0.5 px-3 pb-2">
              {featuredThumbnails.slice(0, 4).map((thumb, i) => (
                <div
                  key={i}
                  className="w-8 h-5 shrink-0 overflow-hidden border border-white/20"
                >
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <PreviewActions
            actions={['follow', 'message', 'share']}
            entityId={creator.id}
            entityTitle={creator.name}
            sharePath={`/creator/${creator.slug}`}
          />
        </PreviewOverlay>
      </div>
    </Link>
  )
}
