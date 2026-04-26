/**
 * Frontfiles — Asset-form constants + pure helpers (NR-D7a, F7a)
 *
 * Client-safe foundation for the Pack-editor Assets tab. Length
 * caps, accepted MIME catalogue, kind-from-MIME mapper, and the
 * newsroom-namespaced storage-path helper.
 *
 * NO `'server-only'` marker — F3 (`'use client'` upload zone)
 * imports values for client-side validation hints + path preview.
 * IP-2 ratified the split mirroring NR-D6b's pack-form pattern.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P7 (asset upload validation rules)
 *   - directives/NR-D7a-asset-upload-storage-metadata.md §F7
 *   - migration newsroom_assets — column types, dim CHECKs
 *   - src/lib/storage/paths.ts — vault-side path scheme (different
 *     namespace; newsroom keeps its own prefix to avoid collision)
 */

import type { NewsroomAssetKind } from '@/lib/db/schema'

// ── Length caps ────────────────────────────────────────────────

export const ASSET_MAX_BYTES = 500 * 1024 * 1024 // 500 MB (PRD §5.1 P7)
export const ASSET_CAPTION_MAX = 500
export const ASSET_ALT_TEXT_MAX = 500

// ── Accepted MIME catalogue ────────────────────────────────────

/**
 * Accepted MIME types per kind, per PRD §5.1 P7 ("Images, video,
 * audio, PDFs, up to 500 MB each."). The catalogue is the source
 * of truth for client-side validation and server-side zod enums.
 *
 * Adding a new MIME type:
 *   1. Add to this map under the right kind.
 *   2. Add to the EXTENSION_FOR_MIME map below if the path
 *      generator needs to know the file extension.
 *   3. Update the F8 vitest cases that enumerate accepted MIMEs.
 */
export const ACCEPTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg'],
  document: ['application/pdf'],
  text: ['text/plain', 'text/markdown'],
} as const satisfies Record<NewsroomAssetKind, readonly string[]>

const EXTENSION_FOR_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
}

/**
 * Map a MIME type to its NewsroomAssetKind. Returns `null` for
 * MIMEs outside ACCEPTED_MIME_TYPES.
 *
 * The mapping is strict and case-insensitive on the canonical
 * MIME (e.g. `'image/JPEG'` lowercases to `'image/jpeg'`). Browsers
 * may emit upper-case MIME parts in some flows (PDFs especially),
 * so the lower-case fold is defensive.
 */
export function kindFromMime(mime: string): NewsroomAssetKind | null {
  const m = mime.trim().toLowerCase()
  for (const [kind, list] of Object.entries(ACCEPTED_MIME_TYPES) as Array<
    [NewsroomAssetKind, readonly string[]]
  >) {
    if (list.includes(m)) return kind
  }
  return null
}

/**
 * Map a MIME type to its canonical file extension (no leading
 * dot). Returns `null` for unaccepted MIMEs.
 *
 * The extension is the deterministic suffix on the storage path's
 * `original.{ext}` filename — see `newsroomOriginalPath` below.
 */
export function extensionForMime(mime: string): string | null {
  const m = mime.trim().toLowerCase()
  return EXTENSION_FOR_MIME[m] ?? null
}

// ── Storage path helper ────────────────────────────────────────

/**
 * Build the canonical storage path for a Newsroom asset's original.
 *
 * Path scheme:
 *   newsroom/packs/{packId}/assets/{assetId}/original.{ext}
 *
 * The newsroom prefix keeps these objects distinct from the
 * Frontfiles vault namespace at `originals/{assetId}/{filename}`
 * managed by `src/lib/storage/paths.ts`. UUID collision between
 * assetIds across the two namespaces is impossible by construction
 * (uuid v4), but namespace separation also makes audit + retention
 * policies easier to reason about.
 *
 * The single canonical filename `original.{ext}` is by design:
 * - Stable, predictable key for derivatives + receipt provenance
 * - No dependence on user-supplied filename quirks
 * - The display filename lives in the DB column
 *   `newsroom_assets.original_filename`
 */
export function newsroomOriginalPath(
  packId: string,
  assetId: string,
  extension: string,
): string {
  return `newsroom/packs/${packId}/assets/${assetId}/original.${extension}`
}
