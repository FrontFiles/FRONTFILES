/**
 * Frontfiles — Deterministic Holder Resolution
 *
 * Resolves placeholder/holder state from stable entity and media facts.
 * No UI heuristics, no viewport-dependent logic, no local visual state.
 *
 * Each resolver answers: "Does this entity have a real preview image,
 * and if not, why?" The answer is deterministic and reproducible by
 * a beta import script mapping legacy rows into the new data model.
 *
 * MIGRATION NOTE: When importing beta records, the importer should
 * call these resolvers on the mapped entity fields. If a legacy row
 * has a thumbnail/cover reference that no longer resolves (broken URL,
 * missing file), the importer should pass null — the resolver will
 * produce the correct holder reason ('image-missing' or format-specific).
 *
 * INVARIANTS:
 *   1. Input: entity fields only (format, thumbnailUrl, coverImageUrl, etc.)
 *   2. Output: HolderReason or null (null = real image available)
 *   3. No network calls, no storage existence checks.
 *      Storage availability is a delivery concern, not a holder concern.
 *   4. Audio/text holders come from format + thumbnail presence,
 *      not from visual rendering context.
 */

import type { AssetFormat } from '@/lib/types'
import type { HolderReason } from './canonical'

// ══════════════════════════════════════════════
// ASSET HOLDER RESOLUTION
// ══════════════════════════════════════════════

/**
 * Resolve holder reason for an asset entity.
 *
 * Decision tree (evaluated top-to-bottom):
 *   1. thumbnailUrl/thumbnailRef present → null (has image)
 *   2. format is 'audio' → 'audio-only'
 *   3. format is 'text' → 'text-only'
 *   4. otherwise → 'no-thumbnail'
 */
export function resolveAssetHolder(
  format: AssetFormat,
  thumbnailUrl: string | null | undefined,
): HolderReason | null {
  if (thumbnailUrl) return null
  if (format === 'audio') return 'audio-only'
  if (format === 'text') return 'text-only'
  return 'no-thumbnail'
}

// ══════════════════════════════════════════════
// STORY HOLDER RESOLUTION
// ══════════════════════════════════════════════

/**
 * Resolve holder reason for a story entity.
 *
 * Stories use a hero/cover image from their first or designated asset.
 * If coverImageUrl is present, the story has a preview.
 * If not, it's a story with no cover image.
 */
export function resolveStoryHolder(
  coverImageUrl: string | null | undefined,
): HolderReason | null {
  if (coverImageUrl) return null
  return 'no-cover-image'
}

// ══════════════════════════════════════════════
// ARTICLE HOLDER RESOLUTION
// ══════════════════════════════════════════════

/**
 * Resolve holder reason for an article entity.
 *
 * Articles use a hero/cover image. If absent, the article
 * is text-only and gets a holder.
 */
export function resolveArticleHolder(
  coverImageUrl: string | null | undefined,
): HolderReason | null {
  if (coverImageUrl) return null
  return 'no-cover-image'
}

// ══════════════════════════════════════════════
// COLLECTION HOLDER RESOLUTION
// ══════════════════════════════════════════════

/**
 * Resolve holder reason for a collection entity.
 *
 * Collections use a 2x2 mosaic of thumbnails from their items.
 * If the collection has zero items, it's empty.
 * If items exist but none have thumbnails, the mosaic renders
 * numbered placeholders — but the preview kind is still 'mosaic',
 * not 'holder'. The holder reason is only for truly empty collections.
 */
export function resolveCollectionHolder(
  itemCount: number,
  thumbnailUrls: string[],
): HolderReason | null {
  if (itemCount === 0) return 'empty-collection'
  if (thumbnailUrls.length === 0) return 'empty-collection'
  return null
}

// ══════════════════════════════════════════════
// CREATOR HOLDER RESOLUTION
// ══════════════════════════════════════════════

/**
 * Resolve holder reason for a creator/frontfiler entity.
 *
 * Creators use their avatar as the preview image.
 * If no avatar is present, a holder renders.
 */
export function resolveCreatorHolder(
  avatarUrl: string | null | undefined,
): HolderReason | null {
  if (avatarUrl) return null
  return 'no-avatar'
}

// ══════════════════════════════════════════════
// GENERIC ENTITY HOLDER (unavailable state)
// ══════════════════════════════════════════════

/**
 * Resolve holder for entities that are no longer available.
 * Used when an entity has been removed, revoked, or is not public.
 *
 * This is separate from per-type holders because it applies
 * regardless of entity type or media state.
 */
export function resolveUnavailableHolder(
  isAvailable: boolean,
): HolderReason | null {
  if (isAvailable) return null
  return 'entity-unavailable'
}

// ══════════════════════════════════════════════
// HOLDER DISPLAY LABELS
// ══════════════════════════════════════════════

/**
 * Human-readable label for holder placeholders.
 * Matches the current UI rendering: "NO IMAGE", "ARTICLE", etc.
 * Export scripts can use these to generate static placeholder references.
 */
export const HOLDER_LABELS: Record<HolderReason, string> = {
  'no-thumbnail': 'NO IMAGE',
  'no-cover-image': 'NO IMAGE',
  'no-avatar': 'NO AVATAR',
  'empty-collection': '',
  'audio-only': 'AUDIO',
  'text-only': 'TEXT',
  'image-missing': 'NO IMAGE',
  'entity-unavailable': 'UNAVAILABLE',
}
