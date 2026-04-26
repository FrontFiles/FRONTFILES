// ═══════════════════════════════════════════════════════════════
// Frontfiles — Storage Bridge (PR 4)
//
// Adapts the low-level storage adapter (src/lib/storage; methods
// putOriginal / putDerivative / getBytes / exists / delete) to the
// high-level pipeline storage adapter shape (src/lib/processing/
// pipeline.ts; methods readOriginal / writeDerivative).
//
// The pipeline operates on assetId + role as the addressing primitive.
// The storage module operates on storage_ref strings. The bridge
// resolves the original's storage_ref via a media_row lookup.
//
// Server-only.
// ═══════════════════════════════════════════════════════════════

import type { StorageAdapter as LowLevelStorage } from '@/lib/storage'
import type { StorageAdapter as PipelineStorage } from './pipeline'
import { findOriginalStorageRef } from './media-row-adapter'

/**
 * Construct the pipeline-shape storage adapter from the low-level
 * src/lib/storage adapter.
 *
 * - readOriginal(assetId): resolves the original's storage_ref via
 *   findOriginalStorageRef, then calls storage.getBytes. Returns null
 *   if the original row doesn't exist (logged but not thrown — the
 *   pipeline treats null as "original not found" and marks failed).
 *
 * - writeDerivative(assetId, role, buffer, contentType): direct
 *   pass-through to storage.putDerivative.
 */
export function makePipelineStorageAdapter(
  storage: LowLevelStorage,
): PipelineStorage {
  return {
    async readOriginal(assetId) {
      const storageRef = await findOriginalStorageRef(assetId)
      if (!storageRef) return null
      try {
        return await storage.getBytes(storageRef)
      } catch (err) {
        // getBytes can throw if the file doesn't exist on disk — the
        // pipeline treats null as "original not found." Log for
        // operator visibility.
        // eslint-disable-next-line no-console
        console.error(
          'storage-bridge.readOriginal: getBytes_failed',
          JSON.stringify({
            code: 'getBytes_failed',
            asset_id: assetId,
            storage_ref: storageRef,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
        return null
      }
    },

    async writeDerivative(assetId, role, buffer, contentType) {
      return storage.putDerivative({
        assetId,
        role,
        bytes: buffer,
        contentType,
      })
    },
  }
}
