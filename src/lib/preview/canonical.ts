/**
 * Frontfiles — Canonical Preview Shape
 *
 * Stable, migration-safe preview representation that any entity
 * (VaultAsset, Story, Article, Collection, CreatorProfile) can be
 * mapped into — and that legacy beta records can be imported into.
 *
 * Designed to support future beta import/migration: an importer
 * reading old beta rows (which may use different field names like
 * `thumb`, `poster`, `cardImage`) must be able to produce a valid
 * CanonicalPreview from the legacy data without needing UI context
 * or component-specific preview logic.
 *
 * INVARIANTS:
 *   1. Every field is derivable from stable entity + media facts.
 *   2. No UI state (hover, scroll position, viewport size) influences the shape.
 *   3. Holder resolution is deterministic — see ./holders.ts.
 *   4. Legacy/deprecated field names map cleanly — see ./deprecated-map.ts.
 *   5. Imported beta data with missing or broken images produces a
 *      deterministic holder, never an undefined/crash state.
 */

import type { PreviewFamily } from './types'
import type { AssetFormat } from '@/lib/types'

// ══════════════════════════════════════════════
// CANONICAL PREVIEW KIND
// ══════════════════════════════════════════════

/**
 * Discriminates how the preview image was sourced.
 *
 * - 'asset-thumbnail'   — derived from the entity's own thumbnail derivative
 * - 'cover-image'       — story/article hero cover image (distinct asset)
 * - 'avatar'            — creator/frontfiler profile image
 * - 'mosaic'            — composite grid from multiple thumbnails (collections)
 * - 'holder'            — deterministic placeholder (no image available)
 */
export type PreviewKind =
  | 'asset-thumbnail'
  | 'cover-image'
  | 'avatar'
  | 'mosaic'
  | 'holder'

// ══════════════════════════════════════════════
// PREVIEW SOURCE
// ══════════════════════════════════════════════

/**
 * Where the preview image data originates.
 *
 * - 'protected-delivery' — resolved via /api/media/[id]?ctx=... (standard path)
 * - 'avatar-ref'         — creator avatar storage reference
 * - 'composite'          — assembled from multiple protected-delivery URLs
 * - 'none'               — no image source; holder will render
 */
export type PreviewSource =
  | 'protected-delivery'
  | 'avatar-ref'
  | 'composite'
  | 'none'

// ══════════════════════════════════════════════
// CANONICAL ASPECT RATIO
// ══════════════════════════════════════════════

/**
 * Named aspect ratios used by the preview system.
 * Matches the canonical ratios defined in ./media.ts.
 */
export type CanonicalAspectRatio =
  | '1:1'
  | '16:9'
  | '4:3'
  | '3:4'

// ══════════════════════════════════════════════
// HOLDER REASON
// ══════════════════════════════════════════════

/**
 * Why a holder is being shown instead of a real image.
 * Derived from stable entity/media facts, never from UI heuristics.
 */
export type HolderReason =
  | 'no-thumbnail'          // asset has no thumbnail derivative
  | 'no-cover-image'        // story/article has no cover/hero asset
  | 'no-avatar'             // creator has no avatar
  | 'empty-collection'      // collection has zero items
  | 'audio-only'            // audio asset with no visual thumbnail
  | 'text-only'             // text asset with no visual thumbnail
  | 'image-missing'         // thumbnail/cover was expected but not found
  | 'entity-unavailable'    // entity removed, revoked, or not public

// ══════════════════════════════════════════════
// CANONICAL PREVIEW SHAPE
// ══════════════════════════════════════════════

/**
 * The stable, migration-safe preview representation.
 *
 * Every preview rendering surface (grid card, list item, search result,
 * share preview, embed strip) should be derivable from this shape.
 *
 * A future beta importer must be able to produce a valid CanonicalPreview
 * from legacy beta rows — mapping old field names (thumb, poster,
 * cardImage, cover) into these canonical fields. The shape is designed
 * so that missing/broken legacy data lands in a deterministic holder
 * state rather than an undefined rendering.
 */
export interface CanonicalPreview {
  /** What kind of preview image this is */
  previewKind: PreviewKind

  /** Where the image data originates */
  previewSource: PreviewSource

  /** Named aspect ratio for the preview zone */
  previewAspectRatio: CanonicalAspectRatio

  /** Which entity family this preview represents */
  entityType: PreviewFamily

  /** Stable entity ID */
  entityId: string

  /**
   * Resolved cover/hero image URL (protected delivery path).
   * Present for stories, articles, and assets with thumbnails.
   * null when previewKind is 'holder' or 'mosaic'.
   */
  coverImageUrl: string | null

  /**
   * The asset ID that provides the cover image, if any.
   * For assets: the asset's own ID.
   * For stories/articles: the hero asset ID.
   * For collections: null (mosaic uses multiple assets).
   * For creators: null (uses avatar, not an asset).
   */
  coverImageAssetId: string | null

  /** Alt text for the preview image. Derived from entity title. */
  alt: string

  /**
   * Asset format, when the entity is an asset.
   * Determines format-specific rendering (video player, audio waveform).
   * null for non-asset entities.
   */
  assetFormat: AssetFormat | null

  /**
   * For mosaic previews (collections): ordered list of thumbnail URLs.
   * Empty array for non-mosaic previews.
   */
  mosaicUrls: string[]

  /**
   * When previewKind is 'holder', explains why.
   * null when a real image is available.
   */
  holderReason: HolderReason | null
}

// ══════════════════════════════════════════════
// TYPE GUARDS
// ══════════════════════════════════════════════

export function hasImage(preview: CanonicalPreview): boolean {
  return preview.previewKind !== 'holder'
}

export function isMosaic(preview: CanonicalPreview): boolean {
  return preview.previewKind === 'mosaic'
}

export function isHolder(preview: CanonicalPreview): boolean {
  return preview.previewKind === 'holder'
}
