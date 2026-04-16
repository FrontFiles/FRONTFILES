// ═══════════════════════════════════════════════════════════════
// Frontfiles — Upload persistence store
//
// The boundary between the commit service and the database.
// Mirrors the dual-mode pattern used in `src/lib/providers/store.ts`:
//
//   - If `isSupabaseConfigured()` is true, read/write through the
//     service-role client (upload_commit RPC + a SELECT for the
//     idempotency lookup).
//   - If not, fall back to an in-memory store. Tests exercise
//     this path by default; the `__testing` surface exposes
//     reset + failure injection so the commit-service rollback
//     path can be asserted deterministically.
//
// Two operations — nothing more:
//
//   1. findExistingByToken  — the idempotency lookup
//   2. insertDraftAndOriginal — the atomic two-row commit
//
// Server-only. Do not import from client components.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────

export interface ExistingUpload {
  assetId: string
  originalSha256: string | null
  originalSizeBytes: number | null
  metadataChecksum: string | null
}

export interface InsertDraftAndOriginalInput {
  assetId: string
  creatorId: string
  slug: string
  title: string
  format: 'photo'
  declarationState: 'provenance_pending'
  clientUploadToken: string
  originalSizeBytes: number
  metadataChecksum: string
  storageRef: string
  contentType: string
  fileSizeBytes: number
  width: number
  height: number
  originalSha256: string
}

export type InsertDraftAndOriginalResult =
  | { kind: 'ok' }
  | { kind: 'unique_violation' }
  | { kind: 'other'; error: string }

// ── In-memory store ────────────────────────────────────────
//
// Indexed by (creator_id, client_upload_token) because that is
// the only lookup path. Each entry also carries the fields
// needed for fingerprint comparison.

interface StoredUpload {
  assetId: string
  creatorId: string
  clientUploadToken: string
  originalSizeBytes: number
  metadataChecksum: string
  originalSha256: string
}

const uploadMock = new Map<string, StoredUpload>()

function mockKey(creatorId: string, token: string): string {
  return `${creatorId}:${token}`
}

// Failure injection for rollback tests. A single-shot queue: the
// next call to insertDraftAndOriginal consumes and acts on it.
// `pendingSeedOnFailure` lets a test simulate a token race by
// installing the winner row at exactly the moment the loser's
// insert raises unique_violation, so the subsequent re-lookup
// inside commitUpload finds a winner.
let pendingFailure: InsertDraftAndOriginalResult | null = null
let pendingSeedOnFailure: StoredUpload | null = null

// ── Public operations ──────────────────────────────────────

export async function findExistingByToken(
  creatorId: string,
  token: string,
): Promise<ExistingUpload | null> {
  if (!isSupabaseConfigured()) {
    const hit = uploadMock.get(mockKey(creatorId, token))
    if (!hit) return null
    return {
      assetId: hit.assetId,
      originalSha256: hit.originalSha256,
      originalSizeBytes: hit.originalSizeBytes,
      metadataChecksum: hit.metadataChecksum,
    }
  }

  const client = getSupabaseClient()
  const { data, error } = await client
    .from('vault_assets')
    .select(
      'id, original_size_bytes, metadata_checksum, asset_media!inner(original_sha256, media_role)',
    )
    .eq('creator_id', creatorId)
    .eq('client_upload_token', token)
    .eq('asset_media.media_role', 'original')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(
      `findExistingByToken failed: ${error.message ?? 'unknown error'}`,
    )
  }
  if (!data) return null

  // The embedded asset_media rows come back as an array even
  // with !inner; take the first (the join is filtered to role=original).
  const mediaRows = (data as { asset_media: Array<{ original_sha256: string | null }> }).asset_media
  const sha = mediaRows?.[0]?.original_sha256 ?? null

  return {
    assetId: (data as { id: string }).id,
    originalSha256: sha,
    originalSizeBytes: (data as { original_size_bytes: number | null }).original_size_bytes,
    metadataChecksum: (data as { metadata_checksum: string | null }).metadata_checksum,
  }
}

export async function insertDraftAndOriginal(
  input: InsertDraftAndOriginalInput,
): Promise<InsertDraftAndOriginalResult> {
  if (!isSupabaseConfigured()) {
    // Single-shot failure injection.
    if (pendingFailure) {
      const f = pendingFailure
      const seed = pendingSeedOnFailure
      pendingFailure = null
      pendingSeedOnFailure = null
      if (seed) {
        uploadMock.set(mockKey(seed.creatorId, seed.clientUploadToken), seed)
      }
      return f
    }
    const key = mockKey(input.creatorId, input.clientUploadToken)
    if (uploadMock.has(key)) return { kind: 'unique_violation' }
    uploadMock.set(key, {
      assetId: input.assetId,
      creatorId: input.creatorId,
      clientUploadToken: input.clientUploadToken,
      originalSizeBytes: input.originalSizeBytes,
      metadataChecksum: input.metadataChecksum,
      originalSha256: input.originalSha256,
    })
    return { kind: 'ok' }
  }

  const client = getSupabaseClient()
  const { error } = await client.rpc('upload_commit', {
    p_asset_id: input.assetId,
    p_creator_id: input.creatorId,
    p_slug: input.slug,
    p_title: input.title,
    p_format: input.format,
    p_declaration_state: input.declarationState,
    p_client_upload_token: input.clientUploadToken,
    p_original_size_bytes: input.originalSizeBytes,
    p_metadata_checksum: input.metadataChecksum,
    p_storage_ref: input.storageRef,
    p_content_type: input.contentType,
    p_file_size_bytes: input.fileSizeBytes,
    p_width: input.width,
    p_height: input.height,
    p_original_sha256: input.originalSha256,
  })

  if (!error) return { kind: 'ok' }
  // PostgreSQL unique_violation is SQLSTATE 23505. PostgREST
  // surfaces it via `error.code`.
  if ((error as { code?: string }).code === '23505') {
    return { kind: 'unique_violation' }
  }
  return {
    kind: 'other',
    error: error.message ?? 'unknown rpc error',
  }
}

// ── Testing helpers ────────────────────────────────────────

export const __testing = {
  reset(): void {
    uploadMock.clear()
    pendingFailure = null
    pendingSeedOnFailure = null
  },
  /**
   * Arrange a single-shot failure outcome for the next
   * insertDraftAndOriginal call. If `seedOnFailure` is supplied,
   * the mock store is seeded with that winner row at the same
   * moment the failure is returned — the idiomatic way to
   * simulate a token race where the pre-check missed but the
   * insert hits a unique_violation.
   */
  makeNextInsertFail(
    outcome: InsertDraftAndOriginalResult,
    seedOnFailure?: StoredUpload,
  ): void {
    pendingFailure = outcome
    pendingSeedOnFailure = seedOnFailure ?? null
  },
  /** Seed the mock store with an existing upload row. */
  seedExisting(record: StoredUpload): void {
    uploadMock.set(mockKey(record.creatorId, record.clientUploadToken), record)
  },
  size(): number {
    return uploadMock.size
  },
}
