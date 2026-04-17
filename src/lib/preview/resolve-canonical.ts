/**
 * Frontfiles — Canonical Preview Resolver
 *
 * Maps current domain entities (VaultAsset, Story, Article, Collection,
 * CreatorProfile) into the stable CanonicalPreview shape.
 *
 * Each resolver takes entity data as plain fields — no live objects,
 * no imports from data modules, no UI context. This makes the resolvers
 * usable by both:
 *   - Current UI components (passing fields from live entity objects)
 *   - Future beta importers (passing fields mapped from legacy rows)
 *
 * PRINCIPLE: Every preview decision is derived from the entity fields
 * passed in. If a field is null/undefined, the resolver produces a
 * deterministic holder — it never crashes or returns undefined.
 */

import type { AssetFormat } from '@/lib/types'
import type { CanonicalPreview, CanonicalAspectRatio } from './canonical'
import {
  resolveAssetHolder,
  resolveStoryHolder,
  resolveArticleHolder,
  resolveCollectionHolder,
  resolveCreatorHolder,
} from './holders'

// ══════════════════════════════════════════════
// ASSET → CANONICAL PREVIEW
// ══════════════════════════════════════════════

interface AssetPreviewInput {
  id: string
  title: string
  format: AssetFormat
  /** Protected delivery URL or null */
  thumbnailUrl: string | null
  /** Source aspect ratio string, e.g. "16:9" */
  aspectRatio?: string | null
}

export function resolveAssetPreview(input: AssetPreviewInput): CanonicalPreview {
  const holderReason = resolveAssetHolder(input.format, input.thumbnailUrl)

  return {
    previewKind: holderReason ? 'holder' : 'asset-thumbnail',
    previewSource: holderReason ? 'none' : 'protected-delivery',
    previewAspectRatio: normalizeAspectRatio(input.aspectRatio),
    entityType: 'asset',
    entityId: input.id,
    coverImageUrl: input.thumbnailUrl ?? null,
    coverImageAssetId: input.thumbnailUrl ? input.id : null,
    alt: input.title,
    assetFormat: input.format,
    mosaicUrls: [],
    holderReason,
  }
}

// ══════════════════════════════════════════════
// STORY → CANONICAL PREVIEW
// ══════════════════════════════════════════════

interface StoryPreviewInput {
  id: string
  title: string
  /** Protected delivery URL for hero/cover image, or null */
  coverImageUrl: string | null
  /** The asset ID that provides the cover image, if known */
  heroAssetId?: string | null
}

export function resolveStoryPreview(input: StoryPreviewInput): CanonicalPreview {
  const holderReason = resolveStoryHolder(input.coverImageUrl)

  return {
    previewKind: holderReason ? 'holder' : 'cover-image',
    previewSource: holderReason ? 'none' : 'protected-delivery',
    previewAspectRatio: '16:9',
    entityType: 'story',
    entityId: input.id,
    coverImageUrl: input.coverImageUrl ?? null,
    coverImageAssetId: input.heroAssetId ?? null,
    alt: input.title,
    assetFormat: null,
    mosaicUrls: [],
    holderReason,
  }
}

// ══════════════════════════════════════════════
// ARTICLE → CANONICAL PREVIEW
// ══════════════════════════════════════════════

interface ArticlePreviewInput {
  id: string
  title: string
  /** Protected delivery URL for hero/cover image, or null */
  coverImageUrl: string | null
  /** The asset ID that provides the cover image, if known */
  heroAssetId?: string | null
}

export function resolveArticlePreview(input: ArticlePreviewInput): CanonicalPreview {
  const holderReason = resolveArticleHolder(input.coverImageUrl)

  return {
    previewKind: holderReason ? 'holder' : 'cover-image',
    previewSource: holderReason ? 'none' : 'protected-delivery',
    previewAspectRatio: '16:9',
    entityType: 'article',
    entityId: input.id,
    coverImageUrl: input.coverImageUrl ?? null,
    coverImageAssetId: input.heroAssetId ?? null,
    alt: input.title,
    assetFormat: null,
    mosaicUrls: [],
    holderReason,
  }
}

// ══════════════════════════════════════════════
// COLLECTION → CANONICAL PREVIEW
// ══════════════════════════════════════════════

interface CollectionPreviewInput {
  id: string
  title: string
  itemCount: number
  /** Ordered thumbnail URLs for mosaic (up to 4) */
  thumbnailUrls: string[]
}

export function resolveCollectionPreview(input: CollectionPreviewInput): CanonicalPreview {
  const holderReason = resolveCollectionHolder(input.itemCount, input.thumbnailUrls)

  return {
    previewKind: holderReason ? 'holder' : 'mosaic',
    previewSource: holderReason ? 'none' : 'composite',
    previewAspectRatio: '1:1',
    entityType: 'collection',
    entityId: input.id,
    coverImageUrl: null,
    coverImageAssetId: null,
    alt: input.title,
    assetFormat: null,
    mosaicUrls: holderReason ? [] : input.thumbnailUrls.slice(0, 4),
    holderReason,
  }
}

// ══════════════════════════════════════════════
// CREATOR → CANONICAL PREVIEW
// ══════════════════════════════════════════════

interface CreatorPreviewInput {
  id: string
  displayName: string
  /** Avatar storage reference or URL */
  avatarUrl: string | null
}

export function resolveCreatorPreview(input: CreatorPreviewInput): CanonicalPreview {
  const holderReason = resolveCreatorHolder(input.avatarUrl)

  return {
    previewKind: holderReason ? 'holder' : 'avatar',
    previewSource: holderReason ? 'none' : 'avatar-ref',
    previewAspectRatio: '3:4',
    entityType: 'frontfiler',
    entityId: input.id,
    coverImageUrl: input.avatarUrl ?? null,
    coverImageAssetId: null,
    alt: input.displayName,
    assetFormat: null,
    mosaicUrls: [],
    holderReason,
  }
}

// ══════════════════════════════════════════════
// ASPECT RATIO NORMALIZER
// ══════════════════════════════════════════════

const KNOWN_RATIOS: Record<string, CanonicalAspectRatio> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '4:3': '4:3',
  '3:4': '3:4',
}

/**
 * Normalize a string aspect ratio to a CanonicalAspectRatio.
 * Falls back to '16:9' for unrecognised or missing values.
 *
 * Beta data may contain non-standard ratios; the importer should
 * pass the raw value and this function handles normalisation.
 */
function normalizeAspectRatio(raw: string | null | undefined): CanonicalAspectRatio {
  if (!raw) return '16:9'
  return KNOWN_RATIOS[raw] ?? '16:9'
}
