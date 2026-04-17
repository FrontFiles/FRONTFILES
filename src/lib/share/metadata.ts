// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Share Preview Metadata Resolver
//
// Resolves preview-safe, creator-aware metadata for share links.
// Contract: previewImageUrl is ALWAYS a protected delivery URL
// (resolveProtectedUrl or avatar path), never a raw storage path.
// ═══════════════════════════════════════════════════════════════

import { shareMap } from '@/data/shares'
import { assetMap } from '@/data/assets'
import { collectionMap } from '@/data/collections'
import { creatorMap, creatorBySlug } from '@/data/creators'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'

export type ShareMetadataStatus = 'active' | 'expired' | 'revoked' | 'missing'
export type OgTemplate = 'asset' | 'collection' | 'creator' | 'frontfolio'

export interface SharePreviewMetadataPayload {
  token: string
  status: ShareMetadataStatus
  canonicalPath: string
  title: string
  description: string
  creatorName?: string
  creatorHandle?: string
  /**
   * Relative path to the public preview derivative (thumbnailRef or avatarRef).
   * This is NEVER an original file URL. Callers prepend the app base URL.
   */
  previewImageUrl?: string
  ogTemplate?: OgTemplate
  /** Source asset ID — available for 'asset' template. Used by OG watermark. */
  assetId?: string
}

const FALLBACK_TITLE = 'Frontfiles'
const FALLBACK_DESC = 'Verified editorial content on Frontfiles.'

function fallback(token: string, status: ShareMetadataStatus): SharePreviewMetadataPayload {
  return { token, status, canonicalPath: `/share/${token}`, title: FALLBACK_TITLE, description: FALLBACK_DESC }
}

export function getSharePreviewMetadataPayload(token: string): SharePreviewMetadataPayload {
  const record = shareMap[token]

  if (!record) return fallback(token, 'missing')
  if (record.status !== 'active') return fallback(token, record.status)

  // ── asset ────────────────────────────────────────────────────
  if (record.template === 'asset' && record.assetId) {
    const asset = assetMap[record.assetId]
    if (!asset) return fallback(token, 'missing')
    const creator = creatorMap[asset.creatorId]
    return {
      token,
      status: 'active',
      canonicalPath: `/share/${token}`,
      title: asset.title,
      description: asset.description.length > 160 ? asset.description.slice(0, 157) + '…' : asset.description,
      creatorName: creator?.name,
      creatorHandle: creator?.slug,
      previewImageUrl: resolveProtectedUrl(asset.id, 'share-preview'),
      ogTemplate: 'asset',
      assetId: asset.id,
    }
  }

  // ── creator / frontfolio ─────────────────────────────────────
  if ((record.template === 'creator' || record.template === 'frontfolio') && record.creatorHandle) {
    const creator = creatorBySlug[record.creatorHandle]
    if (!creator) return fallback(token, 'missing')
    const summary = creator.frontfolioSummary || creator.bio
    return {
      token,
      status: 'active',
      canonicalPath: `/share/${token}`,
      title: record.template === 'frontfolio' ? `${creator.name} — Frontfolio` : creator.name,
      description: summary.length > 160 ? summary.slice(0, 157) + '…' : summary,
      creatorName: creator.name,
      creatorHandle: creator.slug,
      previewImageUrl: creator.avatarRef,
      ogTemplate: record.template,
    }
  }

  // ── collection ───────────────────────────────────────────────
  if (record.template === 'collection' && record.collectionId) {
    const collection = collectionMap[record.collectionId]
    if (!collection) return fallback(token, 'missing')
    const heroAsset = assetMap[collection.heroAssetId]
    return {
      token,
      status: 'active',
      canonicalPath: `/share/${token}`,
      title: collection.title,
      description: collection.dek.length > 160 ? collection.dek.slice(0, 157) + '…' : collection.dek,
      previewImageUrl: heroAsset ? resolveProtectedUrl(heroAsset.id, 'share-preview') : undefined,
      ogTemplate: 'collection',
    }
  }

  return fallback(token, 'missing')
}
