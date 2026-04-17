// ═══════════════════════════════════════════════════════════════
// Per-creator content adapters
// Converts canonical data-layer types → UI types (VaultAsset, Story, etc.)
// so creator profile and frontfolio pages show the correct creator's content.
// ═══════════════════════════════════════════════════════════════

import { assets, assetMap } from './assets'
import type { AssetData } from './assets'
import { stories } from './stories'
import { articles } from './articles'
import { collections } from './collections'
import { creatorBySlug } from './creators'
import type {
  VaultAsset,
  Story,
  Article,
  Collection,
  CertificationEvent,
  ContentMix,
  AssetFormat,
} from '@/lib/types'
import { resolveProtectedUrl, resolveProtectedMediaUrl } from '@/lib/media/delivery-policy'

// ── Asset adapter ──

function toVaultAsset(a: AssetData): VaultAsset {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    format: a.format.toLowerCase() as AssetFormat,
    thumbnailUrl: resolveProtectedUrl(a.id, 'thumbnail') || null,
    videoUrl: a.videoUrl ? resolveProtectedMediaUrl(a.id, 'video', 'preview') : null,
    audioUrl: a.audioUrl ? resolveProtectedMediaUrl(a.id, 'audio', 'preview') : null,
    illustrationUrl: a.illustrationUrl ? resolveProtectedMediaUrl(a.id, 'illustration', 'preview') : null,
    textUrl: null, // Text preview uses textExcerpt. Full text is original-only.
    textExcerpt: a.textExcerpt ?? null,
    privacy: a.privacyLevel,
    declarationState: a.validationDeclaration,
    publication: 'PUBLISHED',
    uploadedAt: a.publishedAt,
    certifiedAt: a.publishedAt,
    certificationHash: `fcs-${a.id.replace('asset-', '')}`,
    fileSize: '12 MB',
    storyId: a.storyId,
    creatorPrice: a.price ? a.price * 100 : null,
    enabledLicences: ['editorial'],
    exclusiveLock: null,
  }
}

export function getCreatorAssets(creatorId: string): VaultAsset[] {
  return assets
    .filter(a => a.creatorId === creatorId)
    .map(toVaultAsset)
}

// ── Story adapter ──

function computeContentMix(assetIds: string[]): ContentMix {
  const mix: ContentMix = { photo: 0, video: 0, audio: 0, text: 0, illustration: 0, infographic: 0, vector: 0 }
  for (const id of assetIds) {
    const a = assetMap[id]
    if (!a) continue
    const key = a.format.toLowerCase() as keyof ContentMix
    if (key in mix) mix[key]++
  }
  return mix
}

function toStoryUI(s: typeof stories[number]): Story {
  const hero = assetMap[s.heroAssetId]
  return {
    id: s.id,
    title: s.title,
    subtitle: s.dek,
    excerpt: s.summary,
    privacy: 'PUBLIC',
    publication: 'PUBLISHED',
    publishedAt: s.coverageWindow.end,
    contentMix: computeContentMix(s.assetIds),
    assetCount: s.assetIds.length,
    coverImageUrl: hero?.thumbnailRef || null,
  }
}

export function getCreatorStories(creatorId: string): Story[] {
  return stories
    .filter(s => s.creatorId === creatorId)
    .map(toStoryUI)
}

// ── Article adapter ──

function toArticleUI(a: typeof articles[number]): Article {
  const hero = assetMap[a.heroAssetId]
  return {
    id: a.id,
    title: a.title,
    excerpt: a.dek,
    articleType: a.articleType,
    wordCount: a.wordCount,
    publishState: 'published',
    publishedAt: a.publishedAt,
    assemblyVerified: true,
    sourceAssetCount: a.sourceAssetIds.length,
    certificationHash: `fcs-art-${a.id.replace('article-', '')}`,
    editorHandle: null,
    coverImageUrl: hero?.thumbnailRef || null,
  }
}

export function getCreatorArticles(creatorId: string): Article[] {
  return articles
    .filter(a => a.sourceCreatorIds.includes(creatorId))
    .map(toArticleUI)
}

// ── Collection adapter ──

function toCollectionUI(c: typeof collections[number]): Collection {
  const thumbs = c.assetIds.slice(0, 4).map(id => assetMap[id]?.thumbnailRef).filter((t): t is string => !!t)
  return {
    id: c.id,
    title: c.title,
    itemCount: c.assetIds.length,
    privacy: 'PUBLIC',
    thumbnails: thumbs,
  }
}

export function getCreatorCollections(creatorId: string): Collection[] {
  return collections
    .filter(c => c.creatorIds.includes(creatorId))
    .map(toCollectionUI)
}

// ── Certification events from asset data ──

export function getCreatorEvents(creatorId: string): CertificationEvent[] {
  const creatorAssets = assets.filter(a => a.creatorId === creatorId)
  const events: CertificationEvent[] = []

  for (const a of creatorAssets.slice(0, 8)) {
    events.push({
      id: `evt-cert-${a.id}`,
      type: 'fcs_layer_complete',
      description: `Asset certified: ${a.title}`,
      timestamp: a.publishedAt,
      metadata: null,
    })
  }

  // Sort most recent first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return events
}

// ── Resolve handle → creatorId ──

export function resolveCreatorId(handle: string): string | null {
  const creator = creatorBySlug[handle]
  return creator?.id ?? null
}
