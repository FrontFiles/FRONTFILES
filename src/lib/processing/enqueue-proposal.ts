/**
 * Frontfiles — Enqueue helper for asset_proposals (E4)
 *
 * Mirrors src/lib/processing/enqueue.ts (PR 3 derivative enqueue) but
 * for the AI proposal layer. Inserts a 'pending' row in asset_proposals
 * for the given asset. Idempotent via the UNIQUE (asset_id) constraint.
 *
 * Called from commit-service.ts on every asset commit, before the
 * dispatcher fires.
 *
 * Format gate: only image formats (photo/illustration/infographic/vector)
 * trigger an enqueue with status='pending'. Non-image formats get a
 * 'not_applicable' row so the audit trail is complete; they don't go
 * through the worker.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import type { AssetFormat } from '@/lib/upload/types'

const IMAGE_FORMATS: ReadonlySet<AssetFormat> = new Set([
  'photo',
  'illustration',
  'infographic',
  'vector',
])

export type EnqueueProposalResult =
  | { kind: 'ok'; status: 'pending' }
  | { kind: 'ok'; status: 'not_applicable' }
  | { kind: 'already_exists' }
  | { kind: 'error'; message: string }

export async function enqueueAssetProposalRow(
  assetId: string,
  format: AssetFormat,
): Promise<EnqueueProposalResult> {
  if (!isSupabaseConfigured()) {
    // Mock-mode: nothing to insert. Pretend success so the calling
    // commit-service path stays unbranched.
    return {
      kind: 'ok',
      status: IMAGE_FORMATS.has(format) ? 'pending' : 'not_applicable',
    }
  }

  const supabase = getSupabaseClient()
  const status = IMAGE_FORMATS.has(format) ? 'pending' : 'not_applicable'

  const { error } = await supabase.from('asset_proposals').insert({
    asset_id: assetId,
    generation_status: status,
  })

  if (error) {
    // UNIQUE violation = already exists. Treat as ok (idempotent retry).
    if ((error as { code?: string }).code === '23505') {
      return { kind: 'already_exists' }
    }
    return { kind: 'error', message: error.message }
  }

  return { kind: 'ok', status }
}
