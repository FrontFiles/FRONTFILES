// ═══════════════════════════════════════════════════════════════
// Frontfiles — Upload batch persistence store
//
// The boundary between the batch service and the database.
// Two operations:
//
//   1. insertBatch        — create an upload_batches row (state='open')
//   2. transitionToCommitted — atomic state transition open → committed
//
// Dual-mode mirrors src/lib/upload/upload-store.ts:
//
//   - If isSupabaseConfigured() is true, read/write through the
//     service-role client.
//   - If not, fall back to an in-memory store. Tests exercise this
//     path by default; the `__testing` surface exposes reset +
//     seeding so the route-layer tests can assert each result kind.
//
// Server-only. Do not import from client components.
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto'

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────

export type BatchState = 'open' | 'committing' | 'committed' | 'cancelled'

export interface BatchRow {
  id: string
  creatorId: string
  state: BatchState
  newsroomMode: boolean
  createdAt: string
  updatedAt: string
  committedAt: string | null
  cancelledAt: string | null
}

export interface InsertBatchInput {
  creatorId: string
  newsroomMode: boolean
}

export type InsertBatchResult =
  | { kind: 'ok'; batch: BatchRow }
  | { kind: 'other'; error: string }

export interface TransitionToCommittedInput {
  batchId: string
  creatorId: string
}

export type TransitionToCommittedResult =
  | { kind: 'ok'; batch: BatchRow }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'invalid_state'; currentState: BatchState }
  | { kind: 'other'; error: string }

/**
 * Result of `findBatchForUpload`. Same shape as the commit-time
 * transition result so callers can use the same disambiguation
 * pattern.
 */
export type FindBatchForUploadResult =
  | { kind: 'ok'; batch: BatchRow }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'invalid_state'; currentState: BatchState }
  | { kind: 'other'; error: string }

// ── In-memory store ────────────────────────────────────────

const batchMock = new Map<string, BatchRow>()

// ── Public operations ──────────────────────────────────────

export async function insertBatch(
  input: InsertBatchInput,
): Promise<InsertBatchResult> {
  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString()
    const batch: BatchRow = {
      id: randomUUID(),
      creatorId: input.creatorId,
      state: 'open',
      newsroomMode: input.newsroomMode,
      createdAt: now,
      updatedAt: now,
      committedAt: null,
      cancelledAt: null,
    }
    batchMock.set(batch.id, batch)
    return { kind: 'ok', batch }
  }

  const client = getSupabaseClient()
  const { data, error } = await client
    .from('upload_batches')
    .insert({
      creator_id: input.creatorId,
      newsroom_mode: input.newsroomMode,
    })
    .select(
      'id, creator_id, state, newsroom_mode, created_at, updated_at, committed_at, cancelled_at',
    )
    .single()

  if (error || !data) {
    return {
      kind: 'other',
      error: error?.message ?? 'insertBatch returned no row',
    }
  }
  return { kind: 'ok', batch: rowFromSupabase(data) }
}

export async function transitionToCommitted(
  input: TransitionToCommittedInput,
): Promise<TransitionToCommittedResult> {
  if (!isSupabaseConfigured()) {
    const batch = batchMock.get(input.batchId)
    if (!batch) return { kind: 'not_found' }
    if (batch.creatorId !== input.creatorId) return { kind: 'forbidden' }
    if (batch.state !== 'open') {
      return { kind: 'invalid_state', currentState: batch.state }
    }
    const now = new Date().toISOString()
    const updated: BatchRow = {
      ...batch,
      state: 'committed',
      committedAt: now,
      updatedAt: now,
    }
    batchMock.set(input.batchId, updated)
    return { kind: 'ok', batch: updated }
  }

  const client = getSupabaseClient()
  const nowIso = new Date().toISOString()

  // Atomic conditional UPDATE — the (id, creator_id, state='open')
  // filter means only the owning creator can flip a batch that is
  // still open. Concurrent commit requests race for this UPDATE;
  // exactly one wins (row returned), others get zero rows and
  // fall through to the disambiguation query below.
  const { data: updated, error: updateError } = await client
    .from('upload_batches')
    .update({
      state: 'committed',
      committed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', input.batchId)
    .eq('creator_id', input.creatorId)
    .eq('state', 'open')
    .select(
      'id, creator_id, state, newsroom_mode, created_at, updated_at, committed_at, cancelled_at',
    )
    .maybeSingle()

  if (updateError) {
    return { kind: 'other', error: updateError.message }
  }
  if (updated) {
    return { kind: 'ok', batch: rowFromSupabase(updated) }
  }

  // UPDATE affected zero rows — disambiguate the reason.
  const { data: lookup, error: lookupError } = await client
    .from('upload_batches')
    .select('creator_id, state')
    .eq('id', input.batchId)
    .maybeSingle()

  if (lookupError) {
    return { kind: 'other', error: lookupError.message }
  }
  if (!lookup) {
    return { kind: 'not_found' }
  }
  if ((lookup as { creator_id: string }).creator_id !== input.creatorId) {
    return { kind: 'forbidden' }
  }
  return {
    kind: 'invalid_state',
    currentState: (lookup as { state: BatchState }).state,
  }
}

/**
 * PR 1.3 — read-only batch lookup used by `/api/upload` to validate
 * `X-Batch-Id` before any storage write. Verifies the batch exists,
 * belongs to the requesting creator, and is still `'open'` (i.e.
 * accepting new uploads). Returns a typed reason on each failure
 * mode so the route can map to the appropriate HTTP status.
 *
 * Cost in real mode: one indexed SELECT against
 * `upload_batches_creator_state_idx` (PR 1.1). ~1ms.
 */
export async function findBatchForUpload(
  batchId: string,
  creatorId: string,
): Promise<FindBatchForUploadResult> {
  if (!isSupabaseConfigured()) {
    const batch = batchMock.get(batchId)
    if (!batch) return { kind: 'not_found' }
    if (batch.creatorId !== creatorId) return { kind: 'forbidden' }
    if (batch.state !== 'open') {
      return { kind: 'invalid_state', currentState: batch.state }
    }
    return { kind: 'ok', batch }
  }

  const client = getSupabaseClient()
  const { data, error } = await client
    .from('upload_batches')
    .select(
      'id, creator_id, state, newsroom_mode, created_at, updated_at, committed_at, cancelled_at',
    )
    .eq('id', batchId)
    .maybeSingle()

  if (error) return { kind: 'other', error: error.message }
  if (!data) return { kind: 'not_found' }

  const row = rowFromSupabase(data)
  if (row.creatorId !== creatorId) return { kind: 'forbidden' }
  if (row.state !== 'open') {
    return { kind: 'invalid_state', currentState: row.state }
  }
  return { kind: 'ok', batch: row }
}

// ── Helpers ────────────────────────────────────────────────

type SupabaseBatchRow = {
  id: string
  creator_id: string
  state: BatchState
  newsroom_mode: boolean
  created_at: string
  updated_at: string
  committed_at: string | null
  cancelled_at: string | null
}

function rowFromSupabase(row: unknown): BatchRow {
  const r = row as SupabaseBatchRow
  return {
    id: r.id,
    creatorId: r.creator_id,
    state: r.state,
    newsroomMode: r.newsroom_mode,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    committedAt: r.committed_at,
    cancelledAt: r.cancelled_at,
  }
}

// ── Testing helpers ────────────────────────────────────────

export const __testing = {
  reset(): void {
    batchMock.clear()
  },
  /** Seed the mock store with an existing batch row. */
  seed(batch: BatchRow): void {
    batchMock.set(batch.id, batch)
  },
  /** Read-through the mock store for assertions. */
  get(id: string): BatchRow | undefined {
    return batchMock.get(id)
  },
  size(): number {
    return batchMock.size
  },
}
