// ═══════════════════════════════════════════════════════════════
// Frontfiles — Stuck-processing Reaper (PR 4)
//
// Sweeps asset_media rows that have been in 'processing' state past
// the configured timeout, resetting them to 'pending' so the next
// worker tick can re-process. Also clears processing_started_at to
// signal "not currently being processed."
//
// Per PR-4-PLAN.md §6:
// - Default timeout: 600 seconds (configurable via FFF_PROCESSING_TIMEOUT_SECONDS)
// - One structured log line per row reset
// - Returns the list of reset rows for caller logging / metrics
//
// Runs at the start of every scripts/process-derivatives.ts
// invocation (before any new dispatch). In Path B, this is the
// recovery mechanism for crashed processing — Path A's claim-then-
// process pattern would handle this inherently via SKIP LOCKED, but
// Path B needs an explicit reaper since dispatch and persistence
// are not unified by a claim step.
//
// Server-only.
// ═══════════════════════════════════════════════════════════════

import { env, isSupabaseEnvPresent } from '@/lib/env'
import { getSupabaseClient } from '@/lib/db/client'
import { __testing as mediaRowTesting } from './media-row-adapter'

// ── Public ─────────────────────────────────────────────────

export interface ReapedRow {
  assetId: string
  mediaRole: string
  stuckDurationSeconds: number
}

/**
 * Reset stuck-processing rows back to pending.
 *
 * @param timeoutSeconds — rows with processing_started_at older than
 *                         (now - timeoutSeconds) are reset. Defaults
 *                         to FFF_PROCESSING_TIMEOUT_SECONDS env var
 *                         (default 600).
 * @returns array of rows that were reset
 */
export async function reapStuckProcessingRows(
  timeoutSeconds?: number,
): Promise<ReapedRow[]> {
  const effectiveTimeout = timeoutSeconds ?? readTimeoutFromEnv()

  if (!isSupabaseEnvPresent()) {
    return reapMockRows(effectiveTimeout)
  }

  return reapRealRows(effectiveTimeout)
}

// ── Real-mode (Supabase) ───────────────────────────────────

async function reapRealRows(timeoutSeconds: number): Promise<ReapedRow[]> {
  const client = getSupabaseClient()
  const cutoffIso = new Date(Date.now() - timeoutSeconds * 1000).toISOString()

  // UPDATE ... RETURNING to do reset + read in one round-trip.
  // Supabase's update().select() returns the updated rows.
  const { data, error } = await client
    .from('asset_media')
    .update({
      generation_status: 'pending',
      processing_started_at: null,
    })
    .eq('generation_status', 'processing')
    .lt('processing_started_at', cutoffIso)
    .select('asset_id, media_role, processing_started_at')

  if (error) {
    throw new Error(
      `reaper: reapStuckProcessingRows failed (${error.message ?? 'unknown'})`,
    )
  }

  const rows = (data ?? []) as Array<{
    asset_id: string
    media_role: string
    processing_started_at: string | null
  }>

  const now = Date.now()
  const reaped: ReapedRow[] = rows.map(r => {
    const stuckMs = r.processing_started_at
      ? now - new Date(r.processing_started_at).getTime()
      : 0
    const reapedRow: ReapedRow = {
      assetId: r.asset_id,
      mediaRole: r.media_role,
      stuckDurationSeconds: Math.round(stuckMs / 1000),
    }
    logReset(reapedRow)
    return reapedRow
  })

  return reaped
}

// ── Mock-mode ──────────────────────────────────────────────

function reapMockRows(timeoutSeconds: number): ReapedRow[] {
  // The mock store is owned by media-row-adapter; we iterate it here
  // and reset rows in-place. Tests seed processing rows via
  // mediaRowTesting.seed before calling.
  const cutoffMs = Date.now() - timeoutSeconds * 1000
  const reaped: ReapedRow[] = []

  // mediaRowTesting exposes `get(assetId, role)` but no full iteration.
  // For mock purposes, the test must call reapStuckProcessingRows with
  // explicit knowledge of which rows it seeded. To keep the helper
  // simple, we provide an iteration helper via a known-key list maintained
  // by the test (or a future enhancement). For PR 4, the tests pass
  // explicit rows via seed; the mock reaper iterates a simple list.
  //
  // For correctness in this implementation: iterate the underlying mock
  // by introspection. The __testing surface needs to expose iteration
  // for the reaper to be testable in mock mode.
  //
  // Implementation: extend mediaRowTesting to expose entries(). This is
  // done in the same file (this is the only consumer that needs full
  // iteration in mock mode).

  const allRows = mediaRowTesting._allRowsForReaper?.() ?? []
  for (const row of allRows) {
    if (row.generationStatus !== 'processing') continue
    if (!row.processingStartedAt) continue
    const startedMs = new Date(row.processingStartedAt).getTime()
    if (startedMs >= cutoffMs) continue

    // Reset the row
    mediaRowTesting.seed({
      ...row,
      generationStatus: 'pending',
      processingStartedAt: null,
    })

    const reapedRow: ReapedRow = {
      assetId: row.assetId,
      mediaRole: row.mediaRole,
      stuckDurationSeconds: Math.round((Date.now() - startedMs) / 1000),
    }
    logReset(reapedRow)
    reaped.push(reapedRow)
  }

  return reaped
}

// ── Helpers ────────────────────────────────────────────────

function readTimeoutFromEnv(): number {
  const raw = env.FFF_PROCESSING_TIMEOUT_SECONDS
  if (typeof raw === 'string' && raw.length > 0) {
    const parsed = parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return 600
}

function logReset(reapedRow: ReapedRow): void {
  // eslint-disable-next-line no-console
  console.warn(
    'reaper.stuck_processing_reset',
    JSON.stringify({
      code: 'stuck_processing_reset',
      asset_id: reapedRow.assetId,
      media_role: reapedRow.mediaRole,
      stuck_duration_seconds: reapedRow.stuckDurationSeconds,
    }),
  )
}

// ── E4 — asset_proposals reaper ─────────────────────────────
//
// Parallel function for the AI proposal layer. Same shape as
// reapStuckProcessingRows but operates on asset_proposals instead
// of asset_media. Per E4-DIRECTIVE.md §9 design choice — parallel
// function preferred over a generic `reapStuckRows(table, ...)` to
// keep table names typed at the call site (no SQL-injection vector
// from generic table-name strings).

export async function reapStuckProposalRows(
  timeoutSeconds?: number,
): Promise<ReapedRow[]> {
  const effectiveTimeout = timeoutSeconds ?? readTimeoutFromEnv()

  if (!isSupabaseEnvPresent()) {
    return []
  }

  const client = getSupabaseClient()
  const cutoffIso = new Date(Date.now() - effectiveTimeout * 1000).toISOString()

  const { data, error } = await client
    .from('asset_proposals')
    .update({
      generation_status: 'pending',
      processing_started_at: null,
    })
    .eq('generation_status', 'processing')
    .lt('processing_started_at', cutoffIso)
    .select('asset_id, processing_started_at')

  if (error) {
    throw new Error(
      `reaper: reapStuckProposalRows failed (${error.message ?? 'unknown'})`,
    )
  }

  const rows = (data ?? []) as Array<{
    asset_id: string
    processing_started_at: string | null
  }>

  const now = Date.now()
  return rows.map(r => {
    const stuckMs = r.processing_started_at
      ? now - new Date(r.processing_started_at).getTime()
      : 0
    const reapedRow: ReapedRow = {
      assetId: r.asset_id,
      // Synthetic media_role — proposals don't have a media_role column;
      // the synthetic value lets the existing ReapedRow type carry both
      // kinds without restructuring. Logged output makes the kind visible.
      mediaRole: 'ai_proposal',
      stuckDurationSeconds: Math.round(stuckMs / 1000),
    }
    logReset(reapedRow)
    return reapedRow
  })
}
