// ═══════════════════════════════════════════════════════════════
// Frontfiles — Derivative pending-row enqueue (PR 3)
//
// Inserts one `asset_media` row per derivative role for a newly
// committed asset. Rows are inserted with `generation_status='pending'`
// (the schema default), `storage_ref=NULL`, and `content_type=NULL`.
// The PR 4 worker (not yet built) will pick them up, generate the
// derivative bytes, write them to storage, and transition the row
// to 'ready' with the storage_ref + content_type populated.
//
// Three roles are enqueued per asset:
//   - thumbnail
//   - watermarked_preview
//   - og_image
//
// `detail_preview` is intentionally not enqueued — per UPLOAD-PR3-AUDIT-
// 2026-04-26.md IP-2, it stays merged with watermarked_preview until
// the lightbox surface needs distinct dimensions/quality.
//
// IDEMPOTENT: the UNIQUE (asset_id, media_role) constraint on
// asset_media (PR 1 substrate) makes replay safe. A second call for
// the same assetId is treated as success — the existing pending row
// is the intended state.
//
// FAIL-DOES-NOT-ROLL-BACK: per UPLOAD-PR3-AUDIT-2026-04-26.md IP-3,
// enqueue failure is logged by the caller (commit-service) and the
// asset commit still returns success. Backfill (PR 6) sweeps any
// orphan asset that committed but failed to enqueue.
//
// Server-only. Do not import from client components.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'

// ── Public constants + types ──────────────────────────────

/**
 * The three derivative roles enqueued per asset.
 * Order is significant for tests asserting on `rolesInserted`.
 *
 * Per UPLOAD-PR3-AUDIT-2026-04-26.md IP-2:
 * - `detail_preview` deferred (merged with watermarked_preview)
 * - `original` is inserted by the upload_commit RPC, not here
 * - `video_stream` / `audio_stream` are non-image roles, out of scope
 */
export const DERIVATIVE_ROLES = [
  'thumbnail',
  'watermarked_preview',
  'og_image',
] as const

export type DerivativeRole = typeof DERIVATIVE_ROLES[number]

export type EnqueueResult =
  | { kind: 'ok'; rolesInserted: DerivativeRole[] }
  | {
      kind: 'partial'
      rolesInserted: DerivativeRole[]
      failures: Array<{ role: DerivativeRole; error: string }>
    }
  | { kind: 'other'; error: string }

// ── In-memory store (mock mode) ────────────────────────────

const mockEnqueued = new Set<string>()
const mockKey = (assetId: string, role: DerivativeRole): string =>
  `${assetId}:${role}`

// ── Public operation ───────────────────────────────────────

/**
 * Enqueue the three derivative pending rows for an asset.
 *
 * Replay-safe: calling twice for the same assetId returns the same
 * `rolesInserted` array both times (the contract is "the asset has
 * these pending roles," not "we just inserted these").
 *
 * In mock mode, tracks `${assetId}:${role}` in an in-memory Set.
 * In real mode, INSERTs against asset_media; a unique-violation
 * (the row already exists from a prior call) is treated as success.
 */
export async function enqueueDerivativeRows(
  assetId: string,
): Promise<EnqueueResult> {
  if (!isSupabaseConfigured()) {
    for (const role of DERIVATIVE_ROLES) {
      mockEnqueued.add(mockKey(assetId, role))
    }
    return { kind: 'ok', rolesInserted: [...DERIVATIVE_ROLES] }
  }

  const client = getSupabaseClient()
  const rolesInserted: DerivativeRole[] = []
  const failures: Array<{ role: DerivativeRole; error: string }> = []

  for (const role of DERIVATIVE_ROLES) {
    const { error } = await client.from('asset_media').insert({
      asset_id: assetId,
      media_role: role,
      // generation_status defaults to 'pending' per the schema
      // (20260413230002_vault_asset_tables.sql:172)
      // storage_ref and content_type are NULL — allowed after the
      // 20260427000002_asset_media_pending_nullable.sql migration.
      // The CHECK constraint asset_media_ready_has_storage enforces
      // that ready rows always have both populated.
    })

    if (!error) {
      rolesInserted.push(role)
      continue
    }

    // PostgreSQL unique_violation = SQLSTATE 23505. The row already
    // exists (UNIQUE on asset_id + media_role). Idempotent: treat
    // as success — the intended pending row exists.
    if ((error as { code?: string }).code === '23505') {
      rolesInserted.push(role)
      continue
    }

    // Some other error per role. Accumulate; do not abort the loop.
    failures.push({ role, error: error.message ?? 'unknown insert error' })
  }

  if (failures.length === 0) {
    return { kind: 'ok', rolesInserted }
  }
  return { kind: 'partial', rolesInserted, failures }
}

// ── Testing helpers ────────────────────────────────────────

export const __testing = {
  reset(): void {
    mockEnqueued.clear()
  },
  size(): number {
    return mockEnqueued.size
  },
  has(assetId: string, role: DerivativeRole): boolean {
    return mockEnqueued.has(mockKey(assetId, role))
  },
}
