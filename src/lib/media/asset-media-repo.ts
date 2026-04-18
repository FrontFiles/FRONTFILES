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
 * Dual-mode:
 *   mock (in-memory): reads current `assetMap` + `mockVaultAssets`.
 *   real (Supabase):  SELECTs from `vault_assets` and `asset_media`.
 *
 * The mode is decided once at module load from `isSupabaseEnvPresent`.
 * The public async contract is identical across modes — callers
 * never branch on mode.
 *
 * PRINCIPLE: file existence != access right. access right != file existence.
 * This module answers existence questions. Authorization decisions
 * are made by the route handler using these answers.
 *
 * SERVER-ONLY. Never import from a client component.
 */

import { env, isSupabaseEnvPresent } from '@/lib/env'
import { assetMap } from '@/data/assets'
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

// ─── Mode selector (CCP 4) ──────────────────────────────────
//
// Decided once at module load from `isSupabaseEnvPresent`.
// No per-call branching beyond `MODE === 'mock'`.

const MODE: 'real' | 'mock' = isSupabaseEnvPresent ? 'real' : 'mock'

let _modeLogged = false
function logModeOnce(): void {
  if (_modeLogged) return
  _modeLogged = true
  if (env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.info(`[ff:mode] asset-media=${MODE}`)
  }
}

// ─── Lazy Supabase client accessor ──────────────────────────

async function db() {
  const { getSupabaseClient } = await import('@/lib/db/client')
  return getSupabaseClient()
}

// ══════════════════════════════════════════════
// CONTEXT → ROLE MAPPING (pure, sync — unchanged)
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
// CONTENT TYPE RESOLUTION (used by mock path only)
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
// PUBLIC — governance
// ══════════════════════════════════════════════

/**
 * Get asset governance state for delivery decisions.
 * Returns null if asset does not exist.
 *
 * Real path: SELECT from `vault_assets` (one row).
 * Mock path: scan `assetMap` then `mockVaultAssets`.
 */
export async function getAssetGovernance(
  assetId: string,
): Promise<AssetGovernance | null> {
  logModeOnce()

  if (MODE === 'mock') {
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
    const vaultAsset = mockVaultAssets.find((a) => a.id === assetId)
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

  // Real path — one SELECT on vault_assets
  const client = await db()
  const { data, error } = await client
    .from('vault_assets')
    .select(
      'creator_id, privacy_state, publication_state, declaration_state',
    )
    .eq('id', assetId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `asset-media-repo: getAssetGovernance failed (${error.message})`,
    )
  }
  if (!data) return null

  return {
    creatorId: data.creator_id as string,
    privacyState: data.privacy_state as AssetGovernance['privacyState'],
    publicationState:
      data.publication_state as AssetGovernance['publicationState'],
    declarationState: (data.declaration_state as string | null) ?? null,
  }
}

// ══════════════════════════════════════════════
// PUBLIC — media derivatives
// ══════════════════════════════════════════════

/**
 * Get a ready media derivative for an asset by role.
 * Returns null if the derivative does not exist or is not ready.
 *
 * Real path:
 *   SELECT storage_ref, content_type, file_size_bytes
 *   FROM asset_media
 *   WHERE asset_id = ? AND media_role = ? AND generation_status = 'ready'
 *
 * Mock path:
 *   In-memory mapping — all derivatives point at the same source file.
 *   The mock does NOT fall back to original when a derivative is missing;
 *   it treats the mock file AS the derivative.
 */
export async function getReadyMedia(
  assetId: string,
  role: MediaRole,
): Promise<MediaRecord | null> {
  logModeOnce()

  if (MODE === 'mock') {
    const asset = assetMap[assetId]
    const vaultAsset = mockVaultAssets.find((a) => a.id === assetId)

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

  // Real path — single SELECT on asset_media
  const client = await db()
  const { data, error } = await client
    .from('asset_media')
    .select('storage_ref, content_type, file_size_bytes')
    .eq('asset_id', assetId)
    .eq('media_role', role)
    .eq('generation_status', 'ready')
    .maybeSingle()

  if (error) {
    throw new Error(
      `asset-media-repo: getReadyMedia failed (${error.message})`,
    )
  }
  if (!data) return null

  return {
    storageRef: data.storage_ref as string,
    contentType: data.content_type as string,
    fileSizeBytes: (data.file_size_bytes as number | null) ?? null,
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
 *
 * This function was already async and mode-agnostic (it delegates
 * to the entitlement module, which handles its own dual-mode). We
 * still call `logModeOnce()` so operators see the asset-media mode
 * when the delivery route enters here first.
 */
export async function hasActiveGrant(
  assetId: string,
  buyerId: string,
): Promise<boolean> {
  logModeOnce()
  const { resolveDownloadAuthorization } = await import('@/lib/entitlement')
  const decision = await resolveDownloadAuthorization(buyerId, assetId)
  return decision.allowed
}
