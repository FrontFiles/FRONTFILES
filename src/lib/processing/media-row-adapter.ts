// ═══════════════════════════════════════════════════════════════
// Frontfiles — Media Row Adapter (PR 4)
//
// Production implementation of the MediaRowAdapter interface
// declared in pipeline.ts. Updates asset_media rows as the
// derivative state machine transitions:
//
//   pending → processing → ready    (success)
//   pending → processing → failed   (error)
//   pending → processing → pending  (stay-pending policy gate)
//   processing → pending             (reaper reset)
//
// Stamps processing_started_at on entry to 'processing'; clears it
// on any other transition. The reaper queries this column.
//
// Dual-mode (mock + Supabase) per the upload-store / batch-store
// pattern. Mock mode used for tests; real mode used at runtime.
//
// Server-only.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import type { MediaRowAdapter } from './pipeline'

// ── Types ──────────────────────────────────────────────────

export type MediaGenerationStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface MediaRowState {
  assetId: string
  mediaRole: string
  generationStatus: MediaGenerationStatus
  storageRef: string | null
  contentType: string | null
  fileSizeBytes: number | null
  width: number | null
  height: number | null
  watermarkProfileVersion: number | null
  processingStartedAt: string | null
}

// ── In-memory store (mock mode) ────────────────────────────

const mockKey = (assetId: string, role: string): string => `${assetId}:${role}`
const mediaRowMock = new Map<string, MediaRowState>()

// ── Real-mode helpers ──────────────────────────────────────

/**
 * Build the UPDATE payload for one transition. Precise rules per
 * PR-4-PLAN.md §5: processing_started_at stamps on entry to processing,
 * clears on transition to ready/failed/pending.
 */
function buildUpdatePayload(update: {
  status: MediaGenerationStatus
  storageRef?: string
  width?: number
  height?: number
  fileSizeBytes?: number
  contentType?: string
  watermarkProfileVersion?: number | null
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    generation_status: update.status,
  }
  if (update.status === 'processing') {
    payload.processing_started_at = new Date().toISOString()
  } else {
    // ready | failed | pending — clear the stamp
    payload.processing_started_at = null
  }
  if (update.storageRef !== undefined) payload.storage_ref = update.storageRef
  if (update.contentType !== undefined) payload.content_type = update.contentType
  if (update.fileSizeBytes !== undefined) payload.file_size_bytes = update.fileSizeBytes
  if (update.width !== undefined) payload.width = update.width
  if (update.height !== undefined) payload.height = update.height
  if (update.watermarkProfileVersion !== undefined) {
    payload.watermark_profile_version = update.watermarkProfileVersion
  }
  return payload
}

// ── Public adapter factory ─────────────────────────────────

/**
 * Construct the production MediaRowAdapter.
 *
 * In mock mode, all updates land in the in-memory `mediaRowMock`
 * Map, which tests can inspect via the `__testing` surface below.
 *
 * In real mode, updates execute as `UPDATE asset_media SET ...
 * WHERE asset_id = $1 AND media_role = $2`. No RPC needed.
 */
export function makeMediaRowAdapter(): MediaRowAdapter {
  return {
    async updateMediaRow(assetId, role, update) {
      if (!isSupabaseConfigured()) {
        const key = mockKey(assetId, role)
        const existing = mediaRowMock.get(key) ?? {
          assetId,
          mediaRole: role,
          generationStatus: 'pending',
          storageRef: null,
          contentType: null,
          fileSizeBytes: null,
          width: null,
          height: null,
          watermarkProfileVersion: null,
          processingStartedAt: null,
        }
        const next: MediaRowState = {
          ...existing,
          generationStatus: update.status,
          processingStartedAt:
            update.status === 'processing' ? new Date().toISOString() : null,
          storageRef: update.storageRef ?? existing.storageRef,
          contentType: update.contentType ?? existing.contentType,
          fileSizeBytes: update.fileSizeBytes ?? existing.fileSizeBytes,
          width: update.width ?? existing.width,
          height: update.height ?? existing.height,
          watermarkProfileVersion:
            update.watermarkProfileVersion !== undefined
              ? update.watermarkProfileVersion
              : existing.watermarkProfileVersion,
        }
        mediaRowMock.set(key, next)
        return
      }

      const client = getSupabaseClient()
      const payload = buildUpdatePayload(update)
      const { error } = await client
        .from('asset_media')
        .update(payload)
        .eq('asset_id', assetId)
        .eq('media_role', role)
      if (error) {
        throw new Error(
          `media-row-adapter: updateMediaRow failed (${error.message ?? 'unknown'})`,
        )
      }
    },
  }
}

// ── Lookup helper for the storage bridge ───────────────────

/**
 * Look up the storage_ref for an asset's 'original' media row.
 * Used by the storage bridge's readOriginal() implementation.
 *
 * Returns null if the row doesn't exist or the storage_ref is NULL
 * (which shouldn't happen for original — original is always written
 * with a storage_ref by upload_commit RPC, per the PR 3 schema CHECK
 * `asset_media_ready_has_storage` since original status is 'ready').
 */
export async function findOriginalStorageRef(
  assetId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    const row = mediaRowMock.get(mockKey(assetId, 'original'))
    return row?.storageRef ?? null
  }

  const client = getSupabaseClient()
  const { data, error } = await client
    .from('asset_media')
    .select('storage_ref')
    .eq('asset_id', assetId)
    .eq('media_role', 'original')
    .maybeSingle()
  if (error) {
    throw new Error(
      `media-row-adapter: findOriginalStorageRef failed (${error.message ?? 'unknown'})`,
    )
  }
  return (data as { storage_ref: string | null } | null)?.storage_ref ?? null
}

// ── Testing helpers ────────────────────────────────────────

export const __testing = {
  reset(): void {
    mediaRowMock.clear()
  },
  size(): number {
    return mediaRowMock.size
  },
  get(assetId: string, role: string): MediaRowState | undefined {
    return mediaRowMock.get(mockKey(assetId, role))
  },
  /** Seed a row directly (used to simulate prior PR 3 enqueue + original commit). */
  seed(state: MediaRowState): void {
    mediaRowMock.set(mockKey(state.assetId, state.mediaRole), state)
  },
  /**
   * Internal use by reaper.ts in mock mode — exposes full iteration
   * over the mock store. Kept under an underscored name to signal
   * "not for general test use." Tests assert on individual rows
   * via `get(assetId, role)`.
   */
  _allRowsForReaper(): MediaRowState[] {
    return Array.from(mediaRowMock.values())
  },
}
