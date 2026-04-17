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
    case 'ok':
      return { ok: true, batch: result.batch }
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
