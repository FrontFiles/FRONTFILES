/**
 * Frontfiles — Deprecated Preview Name Mapping
 *
 * Documents how legacy/deprecated field names from the beta version
 * and from older internal naming conventions map into the canonical
 * preview shape (CanonicalPreview).
 *
 * PURPOSE: When importing beta records into the new system, the
 * importer must translate old field names to canonical fields.
 * This module provides the mapping table and helper utilities.
 *
 * CURRENT CODEBASE STATUS:
 *   - 'thumbnailRef'  — used in data/assets.ts (discovery mock data)
 *   - 'thumbnailUrl'  — used in VaultAsset, search-data.ts, upload types
 *   - 'previewUrl'    — used in HydratedPostAttachment (resolved delivery URL)
 *   - 'coverImageUrl' — used in Story, Article domain types
 *   - 'avatarUrl'     — used in CreatorProfile
 *   - 'thumbnails'    — used in Collection (array of mosaic URLs)
 *
 * NONE OF THESE ARE DEPRECATED IN THE CURRENT CODEBASE.
 * They are the active field names. The "deprecated" names below
 * are from the OLD BETA version that a future importer would encounter.
 */

import type { PreviewKind, PreviewSource, CanonicalPreview } from './canonical'
import type { PreviewFamily } from './types'

// ══════════════════════════════════════════════
// LEGACY BETA FIELD NAME MAPPING
// ══════════════════════════════════════════════

/**
 * Maps legacy beta field names to their canonical equivalents.
 *
 * The beta version used inconsistent naming across different surfaces.
 * A future importer encountering these fields should map them as follows.
 */
export interface LegacyFieldMapping {
  /** The old field name from the beta schema */
  legacyName: string
  /** The canonical field it maps to in CanonicalPreview */
  canonicalField: keyof CanonicalPreview
  /** Which entity types used this legacy name */
  entityTypes: PreviewFamily[]
  /** What the field contained */
  description: string
  /** How to transform the value during import */
  importRule: string
}

export const LEGACY_FIELD_MAP: LegacyFieldMapping[] = [
  // ── Image reference fields ──────────────────────────────────
  {
    legacyName: 'thumb',
    canonicalField: 'coverImageUrl',
    entityTypes: ['asset'],
    description: 'Raw storage path to thumbnail image',
    importRule: 'Re-resolve through resolveProtectedUrl(assetId, "thumbnail"). Do NOT import the raw path.',
  },
  {
    legacyName: 'thumbnail',
    canonicalField: 'coverImageUrl',
    entityTypes: ['asset', 'story'],
    description: 'Alias for thumb, used inconsistently in some beta surfaces',
    importRule: 'Same as thumb: re-resolve through protected delivery. Map to coverImageUrl.',
  },
  {
    legacyName: 'thumbnailRef',
    canonicalField: 'coverImageUrl',
    entityTypes: ['asset'],
    description: 'Storage reference path (e.g. /assets/8654_large.jpeg). Still used in discovery mock data.',
    importRule: 'This is a storage path, not a delivery URL. Re-resolve via resolveProtectedUrl(assetId, "thumbnail").',
  },
  {
    legacyName: 'thumbnailUrl',
    canonicalField: 'coverImageUrl',
    entityTypes: ['asset'],
    description: 'Pre-resolved thumbnail URL. Used in VaultAsset and search data.',
    importRule: 'If this is already a protected delivery URL (/api/media/...), use directly. If raw storage path, re-resolve.',
  },
  {
    legacyName: 'poster',
    canonicalField: 'coverImageUrl',
    entityTypes: ['story', 'article'],
    description: 'Hero/poster image for stories — beta naming for coverImageUrl',
    importRule: 'Map directly to coverImageUrl. Resolve the source asset ID into coverImageAssetId.',
  },
  {
    legacyName: 'cardImage',
    canonicalField: 'coverImageUrl',
    entityTypes: ['asset', 'story', 'article'],
    description: 'Card-specific preview image — beta used separate card images',
    importRule: 'Map to coverImageUrl. Beta card images were just thumbnails; no separate derivative needed.',
  },
  {
    legacyName: 'cover',
    canonicalField: 'coverImageUrl',
    entityTypes: ['story', 'article'],
    description: 'Short alias for cover image',
    importRule: 'Map to coverImageUrl. Identical semantics to coverImageUrl.',
  },
  {
    legacyName: 'coverImageUrl',
    canonicalField: 'coverImageUrl',
    entityTypes: ['story', 'article'],
    description: 'Current canonical name — no transformation needed',
    importRule: 'Direct mapping. Already canonical.',
  },
  {
    legacyName: 'previewUrl',
    canonicalField: 'coverImageUrl',
    entityTypes: ['asset', 'story', 'article'],
    description: 'Resolved protected delivery URL used in HydratedPostAttachment',
    importRule: 'This is a runtime-resolved URL, not a stored field. Re-derive from entity ID + delivery context.',
  },
  {
    legacyName: 'avatarRef',
    canonicalField: 'coverImageUrl',
    entityTypes: ['frontfiler'],
    description: 'Creator avatar storage reference',
    importRule: 'Map to coverImageUrl with previewSource="avatar-ref". Keep the storage ref as-is.',
  },

  // ── Aspect ratio fields ──────────────────────────────────────
  {
    legacyName: 'aspectRatio',
    canonicalField: 'previewAspectRatio',
    entityTypes: ['asset'],
    description: 'String aspect ratio (e.g. "16:9"). Used in discovery data.',
    importRule: 'Validate against CanonicalAspectRatio values. Default to "16:9" if unrecognised.',
  },

  // ── Format / type fields ─────────────────────────────────────
  {
    legacyName: 'format',
    canonicalField: 'assetFormat',
    entityTypes: ['asset'],
    description: 'Asset format. Beta used capitalised values ("Photo"), current uses lowercase ("photo").',
    importRule: 'Lowercase the value: "Photo" → "photo", "Video" → "video", etc.',
  },
  {
    legacyName: 'mediaTypeDisplay',
    canonicalField: 'assetFormat',
    entityTypes: ['asset'],
    description: 'Human-readable format label (e.g. "Aerial photograph"). Not a canonical format.',
    importRule: 'Do NOT map to assetFormat. This is display text. Derive assetFormat from the format field.',
  },
]

// ══════════════════════════════════════════════
// PREVIEW KIND DERIVATION FROM LEGACY DATA
// ══════════════════════════════════════════════

/**
 * Derive the canonical PreviewKind from legacy beta entity data.
 *
 * The beta did not have an explicit previewKind field.
 * The importer must infer it from entity type + available image fields.
 */
export function derivePreviewKindFromLegacy(
  entityType: PreviewFamily,
  hasImageUrl: boolean,
  imageFieldUsed: string | null,
): PreviewKind {
  if (!hasImageUrl) return 'holder'

  switch (entityType) {
    case 'asset':
      return 'asset-thumbnail'
    case 'story':
    case 'article':
      return 'cover-image'
    case 'frontfiler':
      return 'avatar'
    case 'collection':
      return 'mosaic'
    default:
      return hasImageUrl ? 'asset-thumbnail' : 'holder'
  }
}

/**
 * Derive the canonical PreviewSource from legacy beta entity data.
 */
export function derivePreviewSourceFromLegacy(
  entityType: PreviewFamily,
  hasImageUrl: boolean,
): PreviewSource {
  if (!hasImageUrl) return 'none'

  switch (entityType) {
    case 'frontfiler':
      return 'avatar-ref'
    case 'collection':
      return 'composite'
    default:
      return 'protected-delivery'
  }
}

// ══════════════════════════════════════════════
// LOOKUP HELPERS
// ══════════════════════════════════════════════

/**
 * Find the canonical field for a legacy field name.
 * Returns null if the legacy name is not recognised.
 */
export function lookupCanonicalField(legacyName: string): keyof CanonicalPreview | null {
  const entry = LEGACY_FIELD_MAP.find(m => m.legacyName === legacyName)
  return entry?.canonicalField ?? null
}

/**
 * Get all legacy names that map to a given canonical field.
 */
export function getLegacyNamesFor(canonicalField: keyof CanonicalPreview): string[] {
  return LEGACY_FIELD_MAP
    .filter(m => m.canonicalField === canonicalField)
    .map(m => m.legacyName)
}
