// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Post Attachment Embed
//
// Horizontal "attached content" strip that sits inside every
// PostCard. Dispatches on the attachment kind and renders:
//   asset       → thumbnail + title + format label
//   story       → thumbnail + title + subtitle + asset count
//   article     → thumbnail + title + excerpt + word count
//   collection  → 2×2 thumbnail mosaic + title + item count
//
// Every variant includes an attribution chip at the bottom
// showing the original creator — load-bearing when the post
// author is NOT the same person as the attachment creator.
//
// All chrome is centralized in `@/lib/post/styles`.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import type { HydratedPostAttachment } from '@/lib/types'
import * as s from '@/lib/post/styles'

interface PostAttachmentEmbedProps {
  attachment: HydratedPostAttachment
  /** Compact inner-card variant for nested reposts. */
  compact?: boolean
}

export function PostAttachmentEmbed({
  attachment,
  compact = false,
}: PostAttachmentEmbedProps) {
  const variant = compact ? 'compact' : 'default'

  let href = '/'
  let inner: React.ReactNode = null

  switch (attachment.kind) {
    case 'asset':
      href = `/asset/${attachment.id}`
      inner = <AssetStrip attachment={attachment} variant={variant} />
      break
    case 'story':
      href = `/story/${attachment.id}`
      inner = <StoryStrip attachment={attachment} variant={variant} />
      break
    case 'article':
      href = `/article/${attachment.id}`
      inner = <ArticleStrip attachment={attachment} variant={variant} />
      break
    case 'collection':
      href = `/collection/${attachment.id}`
      inner = <CollectionStrip attachment={attachment} variant={variant} />
      break
  }

  return (
    <Link href={href} className={s.embedShell[variant]}>
      {inner}
      <AttributionChip attachment={attachment} variant={variant} />
    </Link>
  )
}

// ─── Attribution chip ────────────────────────────────────────

const KIND_LABELS: Record<HydratedPostAttachment['kind'], string> = {
  asset: 'Asset',
  story: 'Story',
  article: 'Article',
  collection: 'Collection',
}

function AttributionChip({
  attachment,
  variant,
}: {
  attachment: HydratedPostAttachment
  variant: 'default' | 'compact'
}) {
  const kindLabel = KIND_LABELS[attachment.kind]
  const creator = attachment.originalCreator
  return (
    <div className={s.attributionChipMargin}>
      <span className={s.attributionChip[variant]}>
        <span>{kindLabel}</span>
        <span aria-hidden="true">·</span>
        <span>By {creator.displayName}</span>
        {creator.trustBadge && (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className={s.attributionChipBadge}
            aria-label="Verified creator"
          >
            <path
              d="M8 1L3 3.5v4c0 3.5 2.1 6.8 5 7.5 2.9-.7 5-4 5-7.5v-4L8 1z"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="currentColor"
              fillOpacity="0.15"
            />
            <path
              d="M5.5 8l2 2L10.5 6"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </div>
  )
}

// ─── Asset strip ─────────────────────────────────────────────

function AssetStrip({
  attachment,
  variant,
}: {
  attachment: Extract<HydratedPostAttachment, { kind: 'asset' }>
  variant: 'default' | 'compact'
}) {
  return (
    <div className={s.embedRow}>
      <div className={s.embedThumb[variant]}>
        {attachment.previewUrl ? (
          <img
            src={attachment.previewUrl}
            alt={attachment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className={s.embedMetaFaint}>NO IMAGE</span>
          </div>
        )}
        <span className={s.embedFormatPill}>{attachment.format}</span>
      </div>
      <div className={s.embedText}>
        <h3 className={s.embedTitle}>{attachment.title}</h3>
      </div>
    </div>
  )
}

// ─── Story strip ─────────────────────────────────────────────

function StoryStrip({
  attachment,
  variant,
}: {
  attachment: Extract<HydratedPostAttachment, { kind: 'story' }>
  variant: 'default' | 'compact'
}) {
  return (
    <div className={s.embedRow}>
      <div className={s.embedThumb[variant]}>
        {attachment.previewUrl ? (
          <img
            src={attachment.previewUrl}
            alt={attachment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className={s.embedMetaFaint}>NO IMAGE</span>
          </div>
        )}
        <span className={s.embedFormatPill}>
          Story · {attachment.assetCount}
        </span>
      </div>
      <div className={s.embedText}>
        <h3 className={s.embedTitle}>{attachment.title}</h3>
        {variant === 'default' && attachment.subtitle && (
          <p className={s.embedMeta}>{attachment.subtitle}</p>
        )}
      </div>
    </div>
  )
}

// ─── Article strip ───────────────────────────────────────────

function ArticleStrip({
  attachment,
  variant,
}: {
  attachment: Extract<HydratedPostAttachment, { kind: 'article' }>
  variant: 'default' | 'compact'
}) {
  return (
    <div className={s.embedRow}>
      <div className={s.embedThumb[variant]}>
        {attachment.previewUrl ? (
          <img
            src={attachment.previewUrl}
            alt={attachment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className={s.embedMetaFaint}>ARTICLE</span>
          </div>
        )}
        <span className={s.embedFormatPill}>Article</span>
      </div>
      <div className={s.embedText}>
        <h3 className={s.embedTitle}>{attachment.title}</h3>
        {variant === 'default' && attachment.excerpt && (
          <p className={s.embedMeta}>{attachment.excerpt}</p>
        )}
        {variant === 'default' && (
          <p className={s.embedMetaFaint}>
            {attachment.wordCount.toLocaleString('en-US')} words
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Collection strip ────────────────────────────────────────

function CollectionStrip({
  attachment,
  variant,
}: {
  attachment: Extract<HydratedPostAttachment, { kind: 'collection' }>
  variant: 'default' | 'compact'
}) {
  return (
    <div className={s.embedRow}>
      <div className={s.embedThumbMosaic[variant]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--post-surface-nested)] overflow-hidden flex items-center justify-center"
          >
            {attachment.thumbnails[i] ? (
              <img
                src={attachment.thumbnails[i]}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={s.embedMetaFaint}>
                {i < attachment.itemCount ? i + 1 : ''}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className={s.embedText}>
        <h3 className={s.embedTitle}>{attachment.title}</h3>
        <p className={s.embedMetaFaint}>{attachment.itemCount} items</p>
      </div>
    </div>
  )
}
