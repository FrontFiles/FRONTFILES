/**
 * Frontfiles — Asset Media Repository
 *
 * Data access layer for the protected delivery system.
 * The delivery route calls this — never imports mock data directly.
 *
 * Three queries, no business logic:
 *   1. getAssetGovernance — is this asset servable at all?
 *   2. getReadyMedia — does the requested derivative exist?
 *   3. hasActiveGrant — is this user entitled to the original?
 *
 * Mock implementations read from current in-memory data.
 * Production implementations will query vault_assets, asset_media,
 * and licence_grants via Supabase.
 *
 * PRINCIPLE: file existence != access right. access right != file existence.
 * This module answers existence questions. Authorization decisions
 * are made by the route handler using these answers.
 */

import { assetMap, type AssetData } from '@/data/assets'
import { mockVaultAssets } from '@/lib/mock-data'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface AssetGovernance {
  creatorId: string
  privacyState: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED'
  publicationState: 'PUBLISHED' | 'DRAFT' | 'UNPUBLISHED'
  declarationState: string | null
}

export interface MediaRecord {
  storageRef: string
  contentType: string
  fileSizeBytes: number | null
}

/**
 * Media roles matching the asset_media.media_role enum.
 * Determines which derivative the delivery route serves.
 */
export type MediaRole =
  | 'original'
  | 'watermarked_preview'
  | 'thumbnail'
  | 'detail_preview'
  | 'og_image'
  | 'video_stream'
  | 'audio_stream'

// ══════════════════════════════════════════════
// CONTEXT → ROLE MAPPING
// ══════════════════════════════════════════════

const CONTEXT_ROLE_MAP: Record<string, MediaRole> = {
  thumbnail: 'thumbnail',
  preview: 'watermarked_preview',
  'lightbox-preview': 'detail_preview',
  'share-preview': 'og_image',
  'upload-preview': 'thumbnail',
  composer: 'thumbnail',
}

/**
 * Resolve which media_role to query based on request parameters.
 * Priority: delivery=original → variant override → context map.
 *
 * INVARIANT: Only delivery=original may resolve to 'original'.
 * No preview, variant, or context request may ever reach the original.
 * If the required derivative does not exist, the route returns 404.
 *
 * Variant mapping:
 *   video → video_stream (playable video derivative)
 *   audio → audio_stream (playable audio derivative)
 *   illustration → thumbnail (illustration assets use a visual derivative)
 *
 * NOTE: 'text' is NOT a variant. Text preview uses vault_assets.text_excerpt.
 * If the thumbnail derivative does not exist, delivery fails closed with 404.
 */
export function resolveMediaRole(
  delivery: string | null,
  variant: string | null,
  ctx: string,
): MediaRole {
  if (delivery === 'original') return 'original'
  if (variant === 'video') return 'video_stream'
  if (variant === 'audio') return 'audio_stream'
  if (variant === 'illustration') return 'thumbnail'
  return CONTEXT_ROLE_MAP[ctx] ?? 'thumbnail'
}

// ══════════════════════════════════════════════
// CONTENT TYPE RESOLUTION
// ══════════════════════════════════════════════

const EXT_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg',
  m4a: 'audio/mp4', aac: 'audio/aac',
  txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf',
}

function resolveContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return EXT_CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

// ══════════════════════════════════════════════
// MOCK IMPLEMENTATIONS
//
// In production, these query vault_assets, asset_media,
// and licence_grants via Supabase. In mock phase, they
// read from in-memory data arrays.
// ══════════════════════════════════════════════

/**
 * Get asset governance state for delivery decisions.
 * Returns null if asset does not exist.
 */
export function getAssetGovernance(assetId: string): AssetGovernance | null {
  // Check discovery model first
  const asset = assetMap[assetId]
  if (asset) {
    return {
      creatorId: asset.creatorId,
      privacyState: asset.privacyLevel,
      publicationState: 'PUBLISHED', // discovery assets are implicitly published
      declarationState: asset.validationDeclaration ?? null,
    }
  }

  // Check vault model
  const vaultAsset = mockVaultAssets.find(a => a.id === assetId)
  if (vaultAsset) {
    return {
      creatorId: 'creator-010', // mock: all vault assets belong to session user
      privacyState: vaultAsset.privacy,
      publicationState: vaultAsset.publication,
      declarationState: vaultAsset.declarationState ?? null,
    }
  }

  return null
}

/**
 * Get a ready media derivative for an asset by role.
 * Returns null if the derivative does not exist or is not ready.
 *
 * MOCK: Maps current asset fields to the repository interface.
 * In production, queries: asset_media WHERE asset_id = ? AND media_role = ? AND generation_status = 'ready'
 */
export function getReadyMedia(assetId: string, role: MediaRole): MediaRecord | null {
  // In mock phase, all derivatives map to the same source files.
  // The mock does NOT fall back to original when a derivative is missing —
  // it treats the mock file AS the derivative.

  const asset = assetMap[assetId]
  const vaultAsset = mockVaultAssets.find(a => a.id === assetId)

  // Resolve the storage ref based on role
  let storageRef: string | null = null

  switch (role) {
    case 'original':
    case 'thumbnail':
    case 'watermarked_preview':
    case 'detail_preview':
    case 'og_image':
      // All visual roles resolve to the thumbnail/image file in mock
      storageRef = asset?.thumbnailRef ?? vaultAsset?.thumbnailUrl ?? null
      break
    case 'video_stream':
      storageRef = asset?.videoUrl ?? vaultAsset?.videoUrl ?? null
      break
    case 'audio_stream':
      storageRef = asset?.audioUrl ?? vaultAsset?.audioUrl ?? null
      break
  }

  if (!storageRef) return null

  return {
    storageRef,
    contentType: resolveContentType(storageRef),
    fileSizeBytes: null,
  }
}

/**
 * Check whether a user has an active licence grant for an asset.
 *
 * Delegates to the entitlement module which queries licence_grants —
 * the SOLE authorization source. Does NOT check package artifacts,
 * asset_media existence, or storage paths.
 *
 * For the full structured decision (grant type, deny reason, media
 * resolution), use resolveDownloadAuthorization() from @/lib/entitlement.
 * This function is a convenience boolean for the delivery route.
 */
export async function hasActiveGrant(assetId: string, buyerId: string): Promise<boolean> {
  const { resolveDownloadAuthorization } = await import('@/lib/entitlement')
  const decision = await resolveDownloadAuthorization(buyerId, assetId)
  return decision.allowed
}
