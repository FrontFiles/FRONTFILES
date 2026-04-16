// ═══════════════════════════════════════════════════════════════
// Frontfiles — Storage adapter contract
//
// Substrate for the image asset lifecycle. All writes of original
// bytes or derivative bytes go through a `StorageAdapter`. All
// reads at delivery time go through `getBytes(storage_ref)`.
//
// PR 1 landing posture (dormant):
//
//   - The interface is defined and two implementations ship
//     (filesystem for dev, Supabase Storage for prod).
//   - Nothing in `src/app/**`, `src/lib/upload/**`, `src/lib/media/**`,
//     or `src/lib/processing/**` imports this module yet.
//   - Later PRs wire it into the upload route (PR 2), derivative
//     enqueue (PR 3), and processing worker (PR 4).
//
// GOVERNING PRINCIPLE (from ARCHITECTURE-BRIEF §9):
//
//   The database knows what a file is, what role it has, and
//   whether it is ready. Storage paths support that, not replace it.
//
// That is why this interface deliberately does NOT expose:
//
//   - MIME type inference from extension
//   - role inference from path
//   - readiness inference from `exists()`
//
// Callers resolve those from DB columns. The adapter only moves
// bytes and tells you whether bytes are present.
// ═══════════════════════════════════════════════════════════════

// ── Derivative roles ───────────────────────────────────────
//
// The three image derivative roles that have a deterministic
// path per ARCHITECTURE-BRIEF §4.1. `detail_preview` is in the
// media_role enum but its path contract is deferred (brief §7.4);
// it is not accepted by the adapter until that decision lands.
// `video_stream` / `audio_stream` are out of image-asset scope.
export type DerivativeRole =
  | 'thumbnail'
  | 'watermarked_preview'
  | 'og_image'

export const DERIVATIVE_ROLES: readonly DerivativeRole[] = [
  'thumbnail',
  'watermarked_preview',
  'og_image',
] as const

// ── Inputs ─────────────────────────────────────────────────

export interface PutOriginalInput {
  assetId: string
  /** Source filename preserved in the path for provenance (brief §4.2 rule 2). */
  filename: string
  bytes: Buffer | Uint8Array
  /** MIME of the original. Stored alongside for the Supabase adapter; unused on fs. */
  contentType: string
}

export interface PutDerivativeInput {
  assetId: string
  role: DerivativeRole
  bytes: Buffer | Uint8Array
  /** MIME of the derivative (always image/jpeg in the current contract). */
  contentType: string
}

// ── Interface ──────────────────────────────────────────────

export interface StorageAdapter {
  /**
   * Write the original bytes for an asset.
   * Returns the `storage_ref` to persist on `asset_media`.
   */
  putOriginal(input: PutOriginalInput): Promise<string>

  /**
   * Write a derivative's bytes for an asset.
   * Returns the `storage_ref` to persist on `asset_media`.
   * Idempotent: the same (assetId, role) overwrites byte-equivalently.
   */
  putDerivative(input: PutDerivativeInput): Promise<string>

  /**
   * Read bytes for a previously-written `storage_ref`.
   * Returns a `Buffer`. Throws on missing / unreadable refs.
   */
  getBytes(storageRef: string): Promise<Buffer>

  /**
   * Check whether bytes exist for a `storage_ref`.
   * Existence is not truth — readiness comes from the DB.
   */
  exists(storageRef: string): Promise<boolean>

  /**
   * Remove the bytes at `storage_ref`. Idempotent on missing
   * targets (a non-existent ref resolves silently), so the
   * commit-service rollback path can safely retry. Any other
   * error (permissions, transport) throws — the caller is
   * responsible for logging it as a compensating-action failure.
   */
  delete(storageRef: string): Promise<void>
}

// ── Errors ─────────────────────────────────────────────────

/**
 * A `storage_ref` or its input pieces violated the path contract.
 * Thrown by path helpers and surfaced up from both adapters so
 * callers get a typed failure shape rather than a generic Error.
 */
export class StorageRefError extends Error {
  constructor(
    public readonly code: StorageRefErrorCode,
    public readonly input: string,
    message: string,
  ) {
    super(message)
    this.name = 'StorageRefError'
  }
}

export type StorageRefErrorCode =
  | 'empty'
  | 'absolute'
  | 'traversal'
  | 'invalid_character'
  | 'unknown_role'
