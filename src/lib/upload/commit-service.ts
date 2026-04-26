// ═══════════════════════════════════════════════════════════════
// Frontfiles — Upload commit service
//
// The orchestration layer for PR 2. Given validated request
// fields and a byte buffer, it:
//
//   1. computes the three fingerprint values,
//   2. performs the idempotency lookup,
//   3. writes the original bytes through the StorageAdapter,
//   4. calls `insertDraftAndOriginal` to commit both DB rows
//      atomically,
//   5. on any post-storage failure, attempts a compensating
//      `adapter.delete(storage_ref)` and surfaces the delete
//      result as part of the outcome so the route handler can
//      log it and mark the response accordingly.
//
// NEVER silently swallows a failed compensating delete — the
// returned `CommitFailure` carries `compensatingDelete` so the
// route handler can log it and signal `compensating_action_failed`
// to the caller. Orphan blobs in that rare case join the
// long-tail orphan bucket documented in IMPLEMENTATION-PLAN.md
// Orphan blob cleanup §3.
// ═══════════════════════════════════════════════════════════════

import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'

import type { StorageAdapter } from '@/lib/storage'

import { enqueueDerivativeRows } from '@/lib/processing/enqueue'
import { dispatchAssetForProcessing } from '@/lib/processing/dispatcher'

import {
  validateUploadBytes,
  type ServerValidationErrorCode,
} from './server-validation'
import {
  findExistingByToken,
  insertDraftAndOriginal,
  type InsertDraftAndOriginalInput,
} from './upload-store'

// ── Request / result types ─────────────────────────────────

export interface CommitUploadRequest {
  creatorId: string
  clientUploadToken: string
  filename: string
  claimedMime: string
  bytes: Buffer
  /** Arbitrary client metadata — checksummed, not persisted verbatim. */
  metadata: unknown
  // ── PR 1.3 — batch-aware commit ──
  /**
   * FK to upload_batches(id). Required after PR 1.3.
   * The route validates it exists, belongs to the creator, and
   * is in 'open' state before constructing this request.
   */
  batchId: string
  /**
   * jsonb mirror of v2-types.ts AssetProposal (snake_case).
   * NULL-tolerant in PR 1.3; tightened to required after Phase E
   * AI suggestion pipeline ships.
   */
  proposalSnapshot?: unknown | null
  /**
   * jsonb mirror of v2-types.ts ExtractedMetadata (snake_case, flat).
   * NULL-tolerant in PR 1.3; tightened to required after Phase E.
   */
  extractedMetadata?: unknown | null
  /**
   * jsonb partial map { <editable_field_snake_case>: <MetadataSource> }.
   * NULL-tolerant in PR 1.3.
   */
  metadataSource?: unknown | null
  /** Duplicate detection state. NULL = not analysed. */
  duplicateStatus?: 'none' | 'likely_duplicate' | 'confirmed_duplicate' | null
  /**
   * FK to vault_assets(id). Required by DB CHECK when
   * duplicateStatus = 'confirmed_duplicate'; NULL otherwise.
   */
  duplicateOfId?: string | null
}

export type CommitUploadResult = CommitUploadOk | CommitUploadFailure

export interface CommitUploadOk {
  ok: true
  /** 'hit' = idempotency replay with matching fingerprint, no writes. */
  outcome: 'created' | 'hit'
  assetId: string
  /**
   * Present only when a compensating delete was attempted during
   * a token race and the business outcome was still success
   * (matching fingerprints with the winner row). If the delete
   * itself failed, `compensatingDelete.ok === false` and the
   * route handler surfaces it as `compensating_action_failed`
   * in the 200 body. The asset_id and winner state remain valid
   * — only the loser's orphan blob is not cleaned up.
   */
  compensatingDelete?: CompensatingDeleteOutcome
}

export type CommitFailureCode =
  | 'validation'
  | 'decode_failed'
  | 'idempotency_conflict'
  | 'storage_write_failed'
  | 'persistence_failed'

export interface CommitUploadFailure {
  ok: false
  code: CommitFailureCode
  detail: string
  /** Only set for `validation`; surfaces the precise reason. */
  validationCode?: ServerValidationErrorCode
  /** Only set for `idempotency_conflict`; names mismatched fingerprint fields. */
  mismatched?: Array<'original_sha256' | 'original_size_bytes' | 'metadata_checksum'>
  /**
   * Present only when a rollback was attempted AND either it
   * succeeded or it failed. Callers must inspect `delete.ok`
   * to know whether the orphan blob was cleaned up.
   */
  compensatingDelete?: CompensatingDeleteOutcome
}

export type CompensatingDeleteOutcome =
  | { attempted: true; ok: true; storageRef: string }
  | { attempted: true; ok: false; storageRef: string; error: string }

// ── Optional dependency injection for tests ────────────────

export interface CommitUploadDeps {
  adapter: StorageAdapter
  /** Override only in tests that need deterministic ids or fingerprints. */
  generateAssetId?: () => string
  imageMetadata?: (bytes: Buffer) => Promise<{ width: number; height: number }>
}

// ── Public entry point ─────────────────────────────────────

export async function commitUpload(
  req: CommitUploadRequest,
  deps: CommitUploadDeps,
): Promise<CommitUploadResult> {
  // 1. Validate bytes against the allowed-MIME whitelist.
  const validation = validateUploadBytes(req.bytes, req.claimedMime)
  if (!validation.ok) {
    return {
      ok: false,
      code: 'validation',
      detail: validation.detail,
      validationCode: validation.code,
    }
  }

  // 2. Fingerprints — all three server-computed.
  const originalSha256 = sha256Hex(req.bytes)
  const originalSizeBytes = req.bytes.length
  const metadataChecksum = sha256Hex(
    Buffer.from(canonicalJSONStringify(req.metadata), 'utf8'),
  )

  // 3. Idempotency lookup.
  const existing = await findExistingByToken(
    req.creatorId,
    req.clientUploadToken,
  )
  if (existing) {
    const mismatched = diffFingerprints(existing, {
      originalSha256,
      originalSizeBytes,
      metadataChecksum,
    })
    if (mismatched.length === 0) {
      return { ok: true, outcome: 'hit', assetId: existing.assetId }
    }
    return {
      ok: false,
      code: 'idempotency_conflict',
      detail: `existing upload with token has different ${mismatched.join(', ')}`,
      mismatched,
    }
  }

  // 4. Pre-generate asset id and decode image dimensions.
  const assetId = deps.generateAssetId ? deps.generateAssetId() : randomUUID()

  let width: number
  let height: number
  try {
    const md = await (deps.imageMetadata
      ? deps.imageMetadata(req.bytes)
      : readImageMetadata(req.bytes))
    width = md.width
    height = md.height
  } catch (err) {
    return {
      ok: false,
      code: 'decode_failed',
      detail: toErrorMessage(err),
    }
  }

  // 5. Storage write. No DB state has been touched; a throw
  //    here bubbles up as storage_write_failed and the caller
  //    may retry with the same token.
  let storageRef: string
  try {
    storageRef = await deps.adapter.putOriginal({
      assetId,
      filename: req.filename,
      bytes: req.bytes,
      contentType: validation.mime,
    })
  } catch (err) {
    return {
      ok: false,
      code: 'storage_write_failed',
      detail: toErrorMessage(err),
    }
  }

  // 6. Atomic two-row insert via 21-arg upload_commit RPC (or
  //    the in-memory mock store in non-Supabase environments).
  //    PR 1.3 added the 6 new fields below; the 15 PR 2 fields
  //    are unchanged. Idempotency contract preserved exactly.
  const input: InsertDraftAndOriginalInput = {
    assetId,
    creatorId: req.creatorId,
    slug: `draft-${assetId}`,
    title: titleFromFilename(req.filename),
    format: 'photo',
    declarationState: 'provenance_pending',
    clientUploadToken: req.clientUploadToken,
    originalSizeBytes,
    metadataChecksum,
    storageRef,
    contentType: validation.mime,
    fileSizeBytes: originalSizeBytes,
    width,
    height,
    originalSha256,
    // PR 1.3 batch-aware fields — coalesce optional inputs to null
    batchId: req.batchId,
    proposalSnapshot: req.proposalSnapshot ?? null,
    extractedMetadata: req.extractedMetadata ?? null,
    metadataSource: req.metadataSource ?? null,
    duplicateStatus: req.duplicateStatus ?? null,
    duplicateOfId: req.duplicateOfId ?? null,
  }

  const outcome = await insertDraftAndOriginal(input)
  if (outcome.kind === 'ok') {
    // PR 3 — enqueue the three derivative pending rows for the
    // worker. Failure does NOT roll back the commit per
    // UPLOAD-PR3-AUDIT-2026-04-26.md IP-3 — the asset row is
    // canonical; backfill (PR 6) sweeps any orphan that committed
    // but failed to enqueue. Logged with structured detail for
    // operator visibility.
    const enqueueResult = await enqueueDerivativeRows(assetId)
    if (enqueueResult.kind !== 'ok') {
      // eslint-disable-next-line no-console
      console.error(
        'commit.enqueue: derivative_enqueue_failed',
        JSON.stringify({
          code: 'derivative_enqueue_failed',
          asset_id: assetId,
          result: enqueueResult,
        }),
      )
    }
    // PR 4 — fire-and-forget dispatch. The dispatcher resolves the
    // asset's intrusion_level + creator name + format internally and
    // processes the derivative pending rows asynchronously. Errors
    // are logged but do NOT roll back the commit (the asset row is
    // canonical; the reaper + next worker tick recover from any
    // dispatch-time crash). Per PR-4-PLAN.md §4 dispatch hook.
    dispatchAssetForProcessing(assetId, deps.adapter).catch(err => {
      // eslint-disable-next-line no-console
      console.error(
        'commit.dispatch: dispatch_fired_failed',
        JSON.stringify({
          code: 'dispatch_fired_failed',
          asset_id: assetId,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    })
    return { ok: true, outcome: 'created', assetId }
  }

  // 7. Rollback. In both failure branches we attempt the
  //    compensating delete and carry the outcome forward.
  if (outcome.kind === 'unique_violation') {
    // Token race: another request with the same token won.
    // The bytes we just wrote are orphans under our losing
    // asset_id path — delete them, then replay the idempotency
    // lookup to decide 200-hit vs 409-conflict.
    const compensating = await attemptDelete(deps.adapter, storageRef)
    const now = await findExistingByToken(
      req.creatorId,
      req.clientUploadToken,
    )
    if (now) {
      const mismatched = diffFingerprints(now, {
        originalSha256,
        originalSizeBytes,
        metadataChecksum,
      })
      if (mismatched.length === 0) {
        // Canonical business outcome is success. If the loser's
        // blob delete failed, the failure is attached to the OK
        // result so the route can log ERROR and set
        // `compensating_action_failed: true` in the 200 body.
        // The orphan blob is left behind and joins the long-tail
        // orphan bucket documented in IMPLEMENTATION-PLAN.md
        // Orphan blob cleanup §3.
        return {
          ok: true,
          outcome: 'hit',
          assetId: now.assetId,
          ...(compensating.ok ? {} : { compensatingDelete: compensating }),
        }
      }
      return {
        ok: false,
        code: 'idempotency_conflict',
        detail: `token race and fingerprint mismatch on ${mismatched.join(', ')}`,
        mismatched,
        compensatingDelete: compensating,
      }
    }
    // Existing row disappeared between race and re-lookup —
    // treat as generic persistence failure.
    return {
      ok: false,
      code: 'persistence_failed',
      detail: 'token race but winner row not found on re-lookup',
      compensatingDelete: compensating,
    }
  }

  // Generic persistence failure.
  const compensating = await attemptDelete(deps.adapter, storageRef)
  return {
    ok: false,
    code: 'persistence_failed',
    detail: outcome.error,
    compensatingDelete: compensating,
  }
}

// ── Internals ──────────────────────────────────────────────

async function attemptDelete(
  adapter: StorageAdapter,
  storageRef: string,
): Promise<CompensatingDeleteOutcome> {
  try {
    await adapter.delete(storageRef)
    return { attempted: true, ok: true, storageRef }
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      storageRef,
      error: toErrorMessage(err),
    }
  }
}

function diffFingerprints(
  existing: {
    originalSha256: string | null
    originalSizeBytes: number | null
    metadataChecksum: string | null
  },
  candidate: {
    originalSha256: string
    originalSizeBytes: number
    metadataChecksum: string
  },
): Array<'original_sha256' | 'original_size_bytes' | 'metadata_checksum'> {
  const out: Array<
    'original_sha256' | 'original_size_bytes' | 'metadata_checksum'
  > = []
  if (existing.originalSha256 !== candidate.originalSha256) {
    out.push('original_sha256')
  }
  if (existing.originalSizeBytes !== candidate.originalSizeBytes) {
    out.push('original_size_bytes')
  }
  if (existing.metadataChecksum !== candidate.metadataChecksum) {
    out.push('metadata_checksum')
  }
  return out
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Stable JSON serialization — keys sorted at every object level.
 * Used for the metadata checksum so two requests that submit the
 * same logical metadata with different key orderings get the
 * same fingerprint.
 */
export function canonicalJSONStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJSONStringify).join(',') + ']'
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return (
    '{' +
    keys
      .map(k => JSON.stringify(k) + ':' + canonicalJSONStringify(record[k]))
      .join(',') +
    '}'
  )
}

async function readImageMetadata(
  bytes: Buffer,
): Promise<{ width: number; height: number }> {
  const md = await sharp(bytes).metadata()
  if (!md.width || !md.height || md.width <= 0 || md.height <= 0) {
    throw new Error('sharp could not read positive image dimensions')
  }
  return { width: md.width, height: md.height }
}

function titleFromFilename(filename: string): string {
  // Strip trailing extension; collapse whitespace; cap length.
  const withoutExt = filename.replace(/\.[^./\\]+$/, '').trim()
  const collapsed = withoutExt.replace(/\s+/g, ' ')
  const capped = collapsed.slice(0, 200)
  return capped.length > 0 ? capped : 'Untitled'
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
