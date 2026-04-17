'use client'

import Link from 'next/link'
import type { AssetData } from '@/data'
import { creatorMap } from '@/data'
import { ValidationBadge } from './ValidationBadge'
import { useWatermark } from '@/hooks/useWatermark'
import { PreviewMedia } from '@/components/preview/PreviewMedia'
import { PreviewActions } from '@/components/preview/PreviewActions'
import { PreviewOverlay, OverlaySpacer } from '@/components/preview/PreviewOverlay'
import { PreviewIdentity } from '@/components/preview/PreviewIdentity'
import { FormatBadge } from '@/components/preview/PreviewMeta'
import type { PreviewSize } from '@/lib/preview/types'
import type { WatermarkMode } from '@/lib/watermark/types'

interface AssetCardProps {
  asset: AssetData
  size?: 'default' | 'large' | 'compact'
  showCreator?: boolean
  reason?: string
  overlay?: 'off' | 'data' | 'magnify'
  /**
   * Per-card watermark override. When provided, this takes priority
   * over the asset's own `watermarkMode`. Pass `'none'` from a
   * caller that doesn't want watermarks on this card (e.g. the
   * Discovery grid where 236×133 thumbnails are too small for the
   * watermark to be useful and just create visual noise). When
   * omitted, the asset's per-instance setting is used (default).
   */
  watermarkMode?: WatermarkMode | null
}

/** Map legacy size names to canonical preview sizes */
const SIZE_MAP: Record<'default' | 'large' | 'compact', PreviewSize> = {
  compact: 'sm',
  default: 'md',
  large: 'lg',
}

export function AssetCard({ asset, size = 'default', showCreator = true, reason, overlay = 'data', watermarkMode }: AssetCardProps) {
  const creator = creatorMap[asset.creatorId]
  // The override (if provided) wins; otherwise fall back to the
  // asset's own watermarkMode. Passing `null` explicitly is treated
  // as "use the asset's setting" (same as omitting the prop).
  const wmConfig = useWatermark('asset-preview', watermarkMode ?? asset.watermarkMode)
  const previewSize = SIZE_MAP[size]

  return (
    <Link
      href={`/asset/${asset.id}`}
      className="group block bg-black overflow-hidden"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/lightbox-item', asset.id); e.dataTransfer.effectAllowed = 'copy' }}
    >
      <PreviewMedia
        family="asset"
        size={previewSize}
        src={asset.thumbnailRef}
        alt={asset.title}
        videoUrl={asset.videoUrl}
        audioUrl={asset.audioUrl}
        textExcerpt={asset.textExcerpt}
        format={asset.format}
        durationSeconds={asset.durationSeconds}
        watermarkConfig={wmConfig}
        assetId={asset.id}
        attribution={creator?.name}
        className={overlay === 'magnify' ? 'transition-transform duration-300 group-hover:scale-[1.15]' : undefined}
      >
        {/* Data overlay — only in 'data' mode (hover-reveal) */}
        <PreviewOverlay
          visible={overlay === 'data' ? undefined : false}
        >
          <OverlaySpacer />

          <div className="relative px-3 pt-2 overflow-hidden">
            <FormatBadge
              format={asset.format}
              detail={asset.wordCount ? `${asset.wordCount} words` : undefined}
              className="mb-1"
            />
            {reason && (
              <span className="block text-[9px] font-bold uppercase tracking-widest text-[#6666ff] mb-0.5">{reason}</span>
            )}
            <h3 className="font-bold text-white leading-tight text-[13px] line-clamp-2">{asset.title}</h3>
            <div className="mt-1 mb-0.5 flex items-center gap-2 text-[9px] text-white/50 flex-wrap">
              {showCreator && creator && (
                <PreviewIdentity
                  name={creator.name}
                  avatarSrc={creator.avatarRef}
                  avatarSlug={creator.slug}
                  variant="dark"
                  avatarSize="xs"
                />
              )}
              <span>{asset.locationLabel}</span>
              <ValidationBadge state={asset.validationDeclaration} />
              {asset.price && <span className="font-bold text-white/60 font-mono">&euro;{asset.price.toFixed(2)}</span>}
            </div>
          </div>

          <PreviewActions
            actions={['lightbox', 'like', 'comment', 'share']}
            entityId={asset.id}
            entityTitle={asset.title}
            sharePath={`/asset/${asset.id}`}
          />
        </PreviewOverlay>
      </PreviewMedia>
    </Link>
  )
}
