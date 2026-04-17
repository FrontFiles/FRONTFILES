/**
 * Frontfiles — Derivative Processing Dispatcher
 *
 * Triggered after upload commit. Creates pending asset_media rows
 * for each image derivative, then enqueues processing jobs.
 *
 * DESIGN: Initially in-process (fire-and-forget async).
 * Can be evolved to an external job queue (BullMQ, pg_cron,
 * Supabase Edge Function triggers) when volume demands it.
 *
 * The dispatcher is the bridge between the upload state machine
 * and the processing pipeline. Upload code calls dispatch(),
 * then returns immediately. Derivatives arrive asynchronously.
 */

import type { ProcessingJob, ProcessingResult, WatermarkIntrusionLevel } from './types'
import { IMAGE_DERIVATIVE_SPECS, shortAssetId } from './types'
import { processDerivative } from './pipeline'
import type { StorageAdapter, MediaRowAdapter } from './pipeline'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

/** Input for dispatching derivative processing for one asset. */
export interface DispatchRequest {
  /** The vault asset ID. */
  assetId: string
  /** Asset format — only image formats trigger processing. */
  format: string
  /** The asset's configured intrusion level. */
  intrusionLevel: WatermarkIntrusionLevel
  /** Creator name for watermark attribution. */
  creatorName: string
}

/** Formats that trigger image derivative processing. */
const IMAGE_FORMATS = new Set([
  'photo',
  'illustration',
  'infographic',
  'vector',
])

// ══════════════════════════════════════════════
// DISPATCHER
// ══════════════════════════════════════════════

/**
 * Dispatch derivative processing for a committed asset.
 *
 * 1. Check if format is an image type (skip video/audio/text)
 * 2. Create pending asset_media rows for each derivative
 * 3. Fire-and-forget: process each derivative asynchronously
 *
 * Returns immediately. Results arrive via asset_media status updates.
 *
 * @param request — asset to process
 * @param storage — storage adapter for reading originals / writing derivatives
 * @param mediaRows — adapter for creating/updating asset_media rows
 * @param allowDraft — allow draft profiles (dev mode). Default false.
 */
export async function dispatchDerivativeProcessing(
  request: DispatchRequest,
  storage: StorageAdapter,
  mediaRows: MediaRowAdapter,
  allowDraft = false,
): Promise<void> {
  // Only process image formats
  if (!IMAGE_FORMATS.has(request.format)) return

  const jobs: ProcessingJob[] = IMAGE_DERIVATIVE_SPECS.map(spec => ({
    assetId: request.assetId,
    spec,
    intrusionLevel: request.intrusionLevel,
    assetIdShort: shortAssetId(request.assetId),
    attribution: request.creatorName,
  }))

  // Create pending rows for all derivatives
  for (const job of jobs) {
    await mediaRows.updateMediaRow(job.assetId, job.spec.role, { status: 'pending' as const })
  }

  // Fire-and-forget: process all derivatives concurrently
  // Errors are caught per-job and recorded in asset_media.generation_status
  Promise.all(
    jobs.map(job => processDerivative(job, storage, mediaRows, allowDraft)),
  ).then(results => {
    const failed = results.filter(r => !r.success)
    if (failed.length > 0) {
      console.error(
        `[processing] ${failed.length}/${results.length} derivatives failed for asset ${request.assetId}:`,
        failed.map(f => `${f.role}: ${f.error}`),
      )
    }
  }).catch(err => {
    console.error(`[processing] Unexpected error dispatching derivatives for ${request.assetId}:`, err)
  })
}

/**
 * Batch dispatch for multiple assets (e.g. after a batch upload commit).
 *
 * Processes assets sequentially to avoid overwhelming the server.
 * Each asset's derivatives are processed concurrently within that asset.
 */
export async function dispatchBatch(
  requests: DispatchRequest[],
  storage: StorageAdapter,
  mediaRows: MediaRowAdapter,
  allowDraft = false,
): Promise<void> {
  for (const request of requests) {
    await dispatchDerivativeProcessing(request, storage, mediaRows, allowDraft)
  }
}

/**
 * Backfill dispatcher: find assets with originals but missing derivatives.
 *
 * In production, this queries:
 *   SELECT va.id, va.format, va.intrusion_level, u.display_name
 *   FROM vault_assets va
 *   JOIN users u ON u.id = va.creator_id
 *   WHERE EXISTS (
 *     SELECT 1 FROM asset_media am
 *     WHERE am.asset_id = va.id AND am.media_role = 'original'
 *     AND am.generation_status = 'ready'
 *   )
 *   AND NOT EXISTS (
 *     SELECT 1 FROM asset_media am
 *     WHERE am.asset_id = va.id AND am.media_role = 'watermarked_preview'
 *     AND am.generation_status = 'ready'
 *   )
 *
 * Each result is dispatched through the standard pipeline.
 */
export async function dispatchBackfill(
  assetsToBackfill: DispatchRequest[],
  storage: StorageAdapter,
  mediaRows: MediaRowAdapter,
  allowDraft = false,
): Promise<ProcessingResult[]> {
  const allResults: ProcessingResult[] = []

  for (const request of assetsToBackfill) {
    if (!IMAGE_FORMATS.has(request.format)) continue

    const jobs: ProcessingJob[] = IMAGE_DERIVATIVE_SPECS.map(spec => ({
      assetId: request.assetId,
      spec,
      intrusionLevel: request.intrusionLevel,
      assetIdShort: shortAssetId(request.assetId),
      attribution: request.creatorName,
    }))

    for (const job of jobs) {
      await mediaRows.updateMediaRow(job.assetId, job.spec.role, { status: 'pending' as const })
    }

    const results = await Promise.all(
      jobs.map(job => processDerivative(job, storage, mediaRows, allowDraft)),
    )
    allResults.push(...results)
  }

  return allResults
}
