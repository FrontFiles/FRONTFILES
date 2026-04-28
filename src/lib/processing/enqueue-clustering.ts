/**
 * Frontfiles — Batch clustering claim helper (E5)
 *
 * Per E5-DIRECTIVE.md §10.2.
 *
 * CAS-style atomic claim on upload_batches.clustering_started_at.
 * Reset support for the "Re-analyze this session" creator action.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import type { UserAiRegion } from '@/lib/ai-suggestions/types'

export type ClaimResult =
  | { ok: true; creatorId: string; aiRegion: UserAiRegion }
  | { ok: false; reason: 'not_found' | 'already_in_flight' }

/**
 * Try to claim a batch for clustering. Atomic CAS: succeeds only when
 * clustering_started_at IS NULL.
 */
export async function claimBatchForClustering(batchId: string): Promise<ClaimResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: 'not_found' }
  }

  const supabase = getSupabaseClient()
  const { data: claim, error } = await supabase
    .from('upload_batches')
    .update({
      clustering_started_at: new Date().toISOString(),
      clustering_completed_at: null,
      clustering_error: null,
    })
    .eq('id', batchId)
    .is('clustering_started_at', null) // CAS condition
    .select('id, creator_id')
    .maybeSingle()

  if (error || !claim) {
    // Either batch not found or already in flight (CAS lost).
    // Disambiguate via a quick lookup.
    const { data: existing } = await supabase
      .from('upload_batches')
      .select('id, clustering_started_at')
      .eq('id', batchId)
      .maybeSingle()

    if (!existing) return { ok: false, reason: 'not_found' }
    return { ok: false, reason: 'already_in_flight' }
  }

  // Look up creator's ai_region
  const creatorId = (claim as { creator_id: string }).creator_id
  const { data: user } = await supabase
    .from('users')
    .select('ai_region')
    .eq('id', creatorId)
    .single()

  return {
    ok: true,
    creatorId,
    aiRegion: ((user as { ai_region: UserAiRegion } | null)?.ai_region) ?? 'eu',
  }
}

/** Release the claim (success or failure path). */
export async function releaseBatchClusteringClaim(
  batchId: string,
  errorMessage?: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()
  await supabase
    .from('upload_batches')
    .update({
      clustering_completed_at: new Date().toISOString(),
      clustering_error: errorMessage ?? null,
    })
    .eq('id', batchId)
}

/**
 * Reset the claim for re-analysis. Only the batch's own creator can reset.
 * Used by the "Re-analyze this session" creator action (E6 wires UI).
 */
export async function resetBatchClusteringClaim(
  batchId: string,
  creatorId: string,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('upload_batches')
    .update({
      clustering_started_at: null,
      clustering_completed_at: null,
      clustering_error: null,
    })
    .eq('id', batchId)
    .eq('creator_id', creatorId)
    .select('id')
    .maybeSingle()
  return { ok: !error && data !== null }
}
