/**
 * Frontfiles — Derivative Processing Pipeline
 *
 * Orchestrator that produces one derivative from an original:
 *   1. Read original from storage
 *   2. Resize/compress to target dimensions
 *   3. Composite watermark (if spec requires it)
 *   4. Write to storage
 *   5. Update asset_media row (pending → ready / failed)
 *
 * Each call processes ONE derivative. The dispatcher calls this
 * once per derivative spec per asset.
 *
 * IDEMPOTENT: Re-running for the same (asset_id, media_role)
 * overwrites the previous derivative. Enables profile version
 * bumps and backfill re-generation.
 *
 * FAIL-CLOSED: If no approved watermark profile exists for a
 * watermarked derivative, processing fails. The asset_media row
 * stays in 'pending' or moves to 'failed'.
 */

import type { ProcessingJob, ProcessingResult, TemplateFamily } from './types'
import { resolveTemplateFamily } from './types'
import { resizeImage } from './resize'
import { compositeWatermark } from './watermark-compositor'
import { getApprovedProfile } from './profiles'

// ══════════════════════════════════════════════
// STORAGE ADAPTER (mock)
//
// In production, these read/write to Supabase Storage or S3.
// In mock phase, they operate on in-memory buffers or local fs.
// ══════════════════════════════════════════════

export interface StorageAdapter {
  /** Read the original file for an asset. Returns null if not found. */
  readOriginal(assetId: string): Promise<Buffer | null>
  /** Write a derivative to storage. Returns the storage ref (S3 key). */
  writeDerivative(assetId: string, role: string, buffer: Buffer, contentType: string): Promise<string>
}

export interface MediaRowAdapter {
  /**
   * Update the asset_media row status + metadata.
   *
   * State machine per ARCHITECTURE-BRIEF:
   *   `pending → processing → ready`   (success)
   *   `pending → processing → failed`  (error)
   *
   * The dispatcher writes `pending` when enqueuing jobs; the
   * pipeline writes `processing`, then `ready`/`failed`.
   */
  updateMediaRow(
    assetId: string,
    role: string,
    update: {
      status: 'pending' | 'processing' | 'ready' | 'failed'
      storageRef?: string
      width?: number
      height?: number
      fileSizeBytes?: number
      contentType?: string
      watermarkProfileVersion?: number | null
    },
  ): Promise<void>
}

// ══════════════════════════════════════════════
// PIPELINE
// ══════════════════════════════════════════════

/**
 * Process one derivative for an asset.
 *
 * @param job — what to produce (asset, spec, intrusion level, metadata)
 * @param storage — adapter for reading originals and writing derivatives
 * @param mediaRows — adapter for updating asset_media rows
 * @param allowDraft — if true, allow draft profiles (dev mode). Default false.
 * @returns processing result with success/failure status
 */
export async function processDerivative(
  job: ProcessingJob,
  storage: StorageAdapter,
  mediaRows: MediaRowAdapter,
  allowDraft = false,
): Promise<ProcessingResult> {
  const { assetId, spec, intrusionLevel, assetIdShort, attribution } = job

  // Mark as processing
  await mediaRows.updateMediaRow(assetId, spec.role, { status: 'processing' })

  try {
    // 1. Read original
    const original = await storage.readOriginal(assetId)
    if (!original) {
      throw new Error(`Original not found for asset ${assetId}`)
    }

    // 2. Resize/compress
    const resized = await resizeImage(original, spec)

    // 3. Watermark (if required by spec)
    let outputBuffer = resized.buffer
    let profileVersion: number | null = null

    if (spec.watermarked) {
      const family: TemplateFamily = resolveTemplateFamily(resized.width, resized.height)
      const profile = getApprovedProfile(intrusionLevel, family)

      if (!profile) {
        throw new Error(
          `No watermark profile found for level=${intrusionLevel}, family=${family}`,
        )
      }

      if (profile.approvalStatus !== 'approved' && !allowDraft) {
        throw new Error(
          `Watermark profile ${profile.id} is '${profile.approvalStatus}', not approved. ` +
          `Processing blocked until profile is approved by product owner.`,
        )
      }

      outputBuffer = await compositeWatermark(
        resized.buffer,
        profile,
        assetIdShort,
        attribution,
        spec.quality,
      )
      profileVersion = profile.version
    }

    // 4. Write to storage
    const storageRef = await storage.writeDerivative(
      assetId,
      spec.role,
      outputBuffer,
      'image/jpeg',
    )

    // 5. Update asset_media row → ready
    await mediaRows.updateMediaRow(assetId, spec.role, {
      status: 'ready',
      storageRef,
      width: resized.width,
      height: resized.height,
      fileSizeBytes: outputBuffer.byteLength,
      contentType: 'image/jpeg',
      watermarkProfileVersion: profileVersion,
    })

    return {
      assetId,
      role: spec.role,
      success: true,
      storageRef,
      width: resized.width,
      height: resized.height,
      fileSizeBytes: outputBuffer.byteLength,
      profileVersion,
      error: null,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    // Update asset_media row → failed
    await mediaRows.updateMediaRow(assetId, spec.role, { status: 'failed' }).catch(() => {
      // Best-effort status update. Don't let a DB error mask the original error.
    })

    return {
      assetId,
      role: spec.role,
      success: false,
      storageRef: null,
      width: null,
      height: null,
      fileSizeBytes: null,
      profileVersion: null,
      error: errorMessage,
    }
  }
}
