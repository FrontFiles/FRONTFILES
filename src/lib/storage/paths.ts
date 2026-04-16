// ═══════════════════════════════════════════════════════════════
// Frontfiles — Storage path contract
//
// Deterministic path helpers matching ARCHITECTURE-BRIEF §4.1:
//
//   Originals:            originals/{asset_id}/{original_filename}
//   Thumbnails:           derivatives/{asset_id}/thumbnail.jpg
//   Watermarked previews: derivatives/{asset_id}/watermarked_preview.jpg
//   OG images:            derivatives/{asset_id}/og_image.jpg
//
// Rules (brief §4.2):
//
//   1. Paths are deterministic from (asset_id, media_role); the
//      DB `storage_ref` column is the canonical pointer — never
//      derive the path at delivery time.
//   2. Originals preserve the source filename in the path.
//   3. Derivatives use role-based filenames, no versioning in
//      the filename — overwritten on re-generation.
//   4. All derivatives are JPEG.
//
// This module is pure string math. It performs no IO.
// ═══════════════════════════════════════════════════════════════

import {
  DERIVATIVE_ROLES,
  StorageRefError,
  type DerivativeRole,
} from './types'

// ── Path constructors ──────────────────────────────────────

/**
 * Build the canonical storage path for an asset's original file.
 * The filename is preserved; rejected if it would break the path
 * contract (traversal, absolute, empty).
 */
export function originalPath(assetId: string, filename: string): string {
  assertAssetId(assetId)
  assertFilename(filename)
  return `originals/${assetId}/${filename}`
}

/**
 * Build the canonical storage path for a derivative.
 * Derivative filenames are role-based and end in `.jpg` per §4.2.
 */
export function derivativePath(assetId: string, role: DerivativeRole): string {
  assertAssetId(assetId)
  assertDerivativeRole(role)
  return `derivatives/${assetId}/${role}.jpg`
}

// ── Validators ─────────────────────────────────────────────

/**
 * Validate a caller-supplied `storage_ref` before handing it to
 * an adapter. Catches the three classes called out in the PR 1
 * exit criteria: empty, absolute, traversal.
 *
 * Also rejects NUL bytes and backslashes so a ref minted on one
 * OS cannot produce a different filesystem target on another.
 */
export function validateStorageRef(storageRef: string): void {
  if (typeof storageRef !== 'string' || storageRef.length === 0) {
    throw new StorageRefError('empty', String(storageRef), 'storage_ref is empty')
  }
  if (storageRef.startsWith('/')) {
    throw new StorageRefError(
      'absolute',
      storageRef,
      'storage_ref must be relative (no leading slash)',
    )
  }
  if (storageRef.includes('\0')) {
    throw new StorageRefError(
      'invalid_character',
      storageRef,
      'storage_ref contains a NUL byte',
    )
  }
  if (storageRef.includes('\\')) {
    throw new StorageRefError(
      'invalid_character',
      storageRef,
      'storage_ref contains a backslash',
    )
  }
  for (const segment of storageRef.split('/')) {
    if (segment === '..' || segment === '.') {
      throw new StorageRefError(
        'traversal',
        storageRef,
        'storage_ref contains a traversal segment',
      )
    }
    if (segment.length === 0) {
      // empty segment = "originals//foo" or trailing slash
      throw new StorageRefError(
        'invalid_character',
        storageRef,
        'storage_ref contains an empty path segment',
      )
    }
  }
}

function assertAssetId(assetId: string): void {
  if (!assetId || typeof assetId !== 'string') {
    throw new StorageRefError('empty', String(assetId), 'assetId is empty')
  }
  if (assetId.includes('/') || assetId.includes('\\')) {
    throw new StorageRefError(
      'invalid_character',
      assetId,
      'assetId must not contain path separators',
    )
  }
  if (assetId === '.' || assetId === '..' || assetId.includes('\0')) {
    throw new StorageRefError('traversal', assetId, 'assetId is not a valid path segment')
  }
}

function assertFilename(filename: string): void {
  if (!filename || typeof filename !== 'string') {
    throw new StorageRefError('empty', String(filename), 'filename is empty')
  }
  if (filename.includes('/') || filename.includes('\\')) {
    throw new StorageRefError(
      'invalid_character',
      filename,
      'filename must not contain path separators',
    )
  }
  if (filename === '.' || filename === '..' || filename.includes('\0')) {
    throw new StorageRefError('traversal', filename, 'filename is not a valid path segment')
  }
}

function assertDerivativeRole(role: DerivativeRole): void {
  if (!DERIVATIVE_ROLES.includes(role)) {
    throw new StorageRefError(
      'unknown_role',
      String(role),
      `unknown derivative role: ${role}`,
    )
  }
}
