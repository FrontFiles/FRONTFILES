// ═══════════════════════════════════════════════════════════════
// Frontfiles — Upload batch service
//
// Orchestration layer for the two PR 1.2 endpoints:
//
//   POST /api/v2/batch               — createBatch
//   POST /api/v2/batch/[id]/commit   — commitBatch (open → committed)
//
// The logic is thin — PR 1.2 does not touch vault_assets, does not
// enforce commit-time validation rules, and does not compute the
// V2CompletionSummary. Those responsibilities land in PR 1.3 once
// /api/upload becomes batch-aware and assets actually carry a
// batch_id. PR 1.2 ships the structural endpoints dormant behind
// FFF_REAL_UPLOAD so the /api/v2/batch URL space exists.
//
// The service translates store result kinds into stable outcome
// shapes the route handler can map directly to HTTP status codes.
// ═══════════════════════════════════════════════════════════════

import {
  insertBatch,
  transitionToCommitted,
  type BatchRow,
  type BatchState,
} from './batch-store'
import { dispatchBatchClusteringForProcessing } from '@/lib/processing/batch-clustering-dispatcher'
import { getStorageAdapter } from '@/lib/storage'

// ── Request / result types ─────────────────────────────────

export interface CreateBatchRequest {
  creatorId: string
  newsroomMode: boolean
}

export type CreateBatchResult = CreateBatchOk | CreateBatchFailure

export interface CreateBatchOk {
  ok: true
  batch: BatchRow
}

export interface CreateBatchFailure {
  ok: false
  code: 'persistence_failed'
  detail: string
}

export interface CommitBatchRequest {
  batchId: string
  creatorId: string
}

export type CommitBatchResult = CommitBatchOk | CommitBatchFailure

export interface CommitBatchOk {
  ok: true
  batch: BatchRow
}

export type CommitBatchFailureCode =
  | 'not_found'
  | 'forbidden'
  | 'invalid_state'
  | 'persistence_failed'

export interface CommitBatchFailure {
  ok: false
  code: CommitBatchFailureCode
  detail: string
  /** Present only for 'invalid_state'; the batch's current state. */
  currentState?: BatchState
}

// ── Public entry points ────────────────────────────────────

export async function createBatch(
  req: CreateBatchRequest,
): Promise<CreateBatchResult> {
  const result = await insertBatch({
    creatorId: req.creatorId,
    newsroomMode: req.newsroomMode,
  })
  if (result.kind === 'ok') {
    return { ok: true, batch: result.batch }
  }
  return {
    ok: false,
    code: 'persistence_failed',
    detail: result.error,
  }
}

export async function commitBatch(
  req: CommitBatchRequest,
): Promise<CommitBatchResult> {
  const result = await transitionToCommitted({
    batchId: req.batchId,
    creatorId: req.creatorId,
  })
  switch (result.kind) {
    case 'ok': {
      // E5 — fire-and-forget clustering dispatch. Per E5-DIRECTIVE.md §6.2,
      // the trigger is `commitBatch` success — fire-and-forget after
      // `transitionToCommitted` returns ok. The brief v3 + corrigenda PR
      // already corrected the §4.1 wording from 'committing' to 'committed'.
      // Errors logged but do NOT roll back the commit (the batch is
      // canonical; the reaper + next worker tick recover from any
      // dispatch-time crash).
      dispatchBatchClusteringForProcessing(result.batch.id, getStorageAdapter()).catch(
        (err) => {
          // eslint-disable-next-line no-console
          console.error(
            'commit.dispatch: clustering_dispatch_failed',
            JSON.stringify({
              code: 'clustering_dispatch_failed',
              batch_id: result.batch.id,
              error: err instanceof Error ? err.message : String(err),
            }),
          )
        },
      )
      return { ok: true, batch: result.batch }
    }
    case 'not_found':
      return {
        ok: false,
        code: 'not_found',
        detail: `batch ${req.batchId} not found`,
      }
    case 'forbidden':
      return {
        ok: false,
        code: 'forbidden',
        detail: 'batch belongs to a different creator',
      }
    case 'invalid_state':
      return {
        ok: false,
        code: 'invalid_state',
        detail: `batch is in state "${result.currentState}" and cannot be committed`,
        currentState: result.currentState,
      }
    case 'other':
      return {
        ok: false,
        code: 'persistence_failed',
        detail: result.error,
      }
  }
}
