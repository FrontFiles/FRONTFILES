'use client'

import Link from 'next/link'
import type { ArticleData } from '@/data'
import { assetMap } from '@/data'
import { PreviewMedia } from '@/components/preview/PreviewMedia'
import { PreviewActions } from '@/components/preview/PreviewActions'
import { PreviewOverlay, OverlaySpacer } from '@/components/preview/PreviewOverlay'
import { FormatBadge } from '@/components/preview/PreviewMeta'
import type { PreviewSize } from '@/lib/preview/types'
import { resolvePreviewUrl } from '@/lib/media/resolve-url'

interface ArticleCardProps {
  article: ArticleData
  size?: 'default' | 'large'
  reason?: string
}

const SIZE_MAP: Record<'default' | 'large', PreviewSize> = {
  default: 'md',
  large: 'lg',
}

export function ArticleCard({ article, size = 'default', reason }: ArticleCardProps) {
  const heroAsset = assetMap[article.heroAssetId]
  const sourceAssets = article.sourceAssetIds.map(id => assetMap[id]).filter(Boolean)
  const previewSize = SIZE_MAP[size]
  const isFrontfiles = article.articleType === 'frontfiles_article'

  return (
      <Link
        href={`/article/${article.id}`}
        className="group block bg-black"
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('text/lightbox-item', article.id); e.dataTransfer.effectAllowed = 'copy' }}
      >
        <PreviewMedia
          family="article"
          size={previewSize}
          src={heroAsset?.thumbnailRef}
          assetId={heroAsset?.id}
          alt={article.title}
          creatorSlugCrop="50% 30%"
        >
          {/* Hover overlay */}
          <PreviewOverlay>
            <OverlaySpacer />

            <div className="relative px-3 pt-2 overflow-hidden">
              <FormatBadge
                format={isFrontfiles ? 'Frontfiles Article' : 'Creator Article'}
                detail={`${article.sourceAssetIds.length} sources`}
                variant={isFrontfiles ? 'dark' : 'blue'}
                className="mb-1"
              />
              {reason && (
                <span className="block text-[9px] font-bold uppercase tracking-widest text-[#6666ff] mb-0.5">{reason}</span>
              )}
              <h3 className="font-black text-white leading-tight text-[13px] line-clamp-2 tracking-tight">{article.title}</h3>
              <p className="mt-0.5 text-white/50 text-[10px] leading-snug line-clamp-1">{article.dek}</p>
              {sourceAssets.length > 0 && (
                <div className="mt-1.5 mb-0.5 flex items-center gap-1">
                  {sourceAssets.slice(0, 5).map(a => (
                    <div key={a.id} className="w-8 h-5 shrink-0 overflow-hidden border border-white/20">
                      {a.thumbnailRef ? (
                        <img src={resolvePreviewUrl(a.id)} alt={a.title} className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className="w-full h-full bg-white/10" />
                      )}
                    </div>
                  ))}
                  {sourceAssets.length > 5 && (
                    <div className="w-8 h-5 shrink-0 bg-white/10 border border-white/10 flex items-center justify-center">
                      <span className="text-[7px] font-bold text-white/40">+{sourceAssets.length - 5}</span>
                    </div>
                  )}
                  <span className="ml-auto text-[9px] font-bold text-white/30 font-mono">{(article.wordCount / 1000).toFixed(1)}k</span>
                </div>
              )}
            </div>

            <PreviewActions
              actions={['lightbox', 'like', 'comment', 'share']}
              entityId={article.id}
              entityTitle={article.title}
              sharePath={`/article/${article.id}`}
            />
          </PreviewOverlay>
        </PreviewMedia>
      </Link>
  )
}
