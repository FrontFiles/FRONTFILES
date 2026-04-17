'use client'

import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import { cn } from '@/lib/utils'

// ══════════════════════════════════════════════
// ARTICLE PREVIEW — shared editorial preview
// ══════════════════════════════════════════════
//
// Calm, editorial, compact. Used inside the checkout flow
// (cart, review, transaction) to make the article being
// licensed instantly recognisable without marketing chrome.
//
// Media contract:
// - Never receives a raw URL. Only takes an assetId.
// - Always resolves via resolveProtectedUrl(..., 'thumbnail').
// - If the assetId is missing or unknown, the image slot
//   collapses gracefully — no fallback to originals.

export type ArticlePreviewVariant = 'compact' | 'standard'

export type ArticleKind = 'frontfiles_article' | 'creator_article' | 'source_asset'

export interface ArticlePreviewProps {
  /** Headline of the article (required) */
  headline: string
  /** Standfirst / dek / excerpt — optional, shown in standard variant */
  standfirst?: string | null
  /** Byline text (creator or editor name) — optional */
  byline?: string | null
  /**
   * Asset ID for the hero image. The preview resolves this through
   * resolveProtectedUrl to ensure only watermarked thumbnails are served.
   * Raw URLs are not accepted by design.
   */
  heroAssetId?: string | null
  /** Article kind — drives a small badge above the headline */
  kind?: ArticleKind | null
  /** Optional override for alt text */
  alt?: string
  variant?: ArticlePreviewVariant
  className?: string
}

const KIND_LABEL: Record<ArticleKind, string> = {
  frontfiles_article: 'Frontfiles Article',
  creator_article: 'Creator Article',
  source_asset: 'Source Asset',
}

export function ArticlePreview({
  headline,
  standfirst,
  byline,
  heroAssetId,
  kind,
  alt,
  variant = 'standard',
  className,
}: ArticlePreviewProps) {
  const imageUrl = heroAssetId ? resolveProtectedUrl(heroAssetId, 'thumbnail') : ''
  const imageAlt = alt ?? headline
  const kindLabel = kind ? KIND_LABEL[kind] : null

  if (variant === 'compact') {
    return (
      <article className={cn('flex items-stretch gap-3', className)}>
        <div className="w-20 h-16 shrink-0 bg-slate-100 border border-slate-200 overflow-hidden">
          {imageUrl && (
            <img src={imageUrl} alt={imageAlt} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          {kindLabel && (
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {kindLabel}
            </span>
          )}
          <h3 className="text-sm font-bold text-black leading-snug line-clamp-2 tracking-tight">
            {headline}
          </h3>
          {byline && (
            <span className="text-[10px] text-slate-500 truncate">By {byline}</span>
          )}
        </div>
      </article>
    )
  }

  // standard variant
  return (
    <article className={cn('flex flex-col gap-3', className)}>
      {imageUrl && (
        <div className="aspect-[16/9] bg-slate-100 border border-slate-200 overflow-hidden">
          <img src={imageUrl} alt={imageAlt} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {kindLabel && (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {kindLabel}
          </span>
        )}
        <h2 className="text-lg md:text-xl font-bold text-black leading-[1.15] tracking-tight">
          {headline}
        </h2>
        {standfirst && (
          <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
            {standfirst}
          </p>
        )}
        {byline && (
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            By {byline}
          </span>
        )}
      </div>
    </article>
  )
}
