/**
 * Frontfiles — Batch Clustering Dispatcher (Class B worker entry, E5)
 *
 * Per AI-PIPELINE-BRIEF v2 §4.3 + E5-DIRECTIVE.md §10.1.
 *
 * Called from:
 *   - batch-service.ts commitBatch success branch (fire-and-forget)
 *   - scripts/process-derivatives.ts stuck-batch recovery loop
 *   - E6 "Re-analyze this session" creator action (callable from API)
 *
 * Lifecycle:
 *   1. Claim the batch (CAS on clustering_started_at IS NULL)
 *   2. Re-cluster behavior: delete pending (un-accepted, un-dismissed)
 *      asset_proposal_clusters rows for the batch
 *   3. Run the engine (clusterBatch)
 *   4. Persist surviving clusters + update asset_proposals.cluster_id
 *   5. Write cluster_proposed audit events per member
 *   6. Release the claim
 *   7. On exception: log + release claim with error stamped
 *
 * No retry-once at the batch level: clustering failures are recovered
 * via the creator's "Re-analyze" action (E6) or the reaper sweep.
 *
 * SERVER-ONLY.
 */

import type { StorageAdapter as LowLevelStorage } from '@/lib/storage'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import { clusterBatch } from '@/lib/ai-suggestions/clustering'
import { writeAuditEvent } from '@/lib/ai-suggestions/audit'
import { audit } from '@/lib/logger'
import {
  claimBatchForClustering,
  releaseBatchClusteringClaim,
} from './enqueue-clustering'
import type { UserAiRegion, VertexRegion } from '@/lib/ai-suggestions/types'

const REGION_MAP: Record<UserAiRegion, VertexRegion> = {
  eu: 'europe-west4',
  us: 'us-central1',
}

export async function dispatchBatchClusteringForProcessing(
  batchId: string,
  _storage: LowLevelStorage, // unused; clustering reads embeddings, not bytes
): Promise<void> {
  // Mock-mode: nothing to dispatch
  if (!isSupabaseConfigured()) return

  // 1. Claim
  const claim = await claimBatchForClustering(batchId)
  if (!claim.ok) {
    // Either not found or already in-flight (legitimate concurrent call)
    return
  }

  const { creatorId, aiRegion } = claim
  const vertexRegion = REGION_MAP[aiRegion]
  const supabase = getSupabaseClient()

  try {
    // 2. Re-cluster behavior — delete pending clusters for the batch
    await deletePendingClustersForBatch(batchId)

    // 3. Run the engine
    const result = await clusterBatch({
      batchId,
      creatorId,
      region: vertexRegion,
    })

    // 4. Persist clusters
    for (const cluster of result.clusters) {
      const { data: row } = await supabase
        .from('asset_proposal_clusters')
        .insert({
          creator_id: creatorId,
          batch_id: batchId,
          proposed_name: cluster.proposedName,
          asset_count: cluster.members.length,
          silhouette_score: cluster.silhouetteScore,
          model_version: cluster.modelVersion,
          region: vertexRegion,
        })
        .select('id')
        .single()

      const clusterId = (row as { id: string } | null)?.id
      if (!clusterId) continue // shouldn't happen; defensive

      const memberIds = cluster.members.map((m) => m.assetId)

      // 4a. Update member asset_proposals.cluster_id
      await supabase
        .from('asset_proposals')
        .update({
          cluster_id: clusterId,
          cluster_confidence: cluster.silhouetteScore,
        })
        .in('asset_id', memberIds)

      // 5. Field-grain audit per member
      for (const memberId of memberIds) {
        await writeAuditEvent({
          asset_id: memberId,
          creator_id: creatorId,
          event_type: 'cluster_proposed',
          cluster_id: clusterId,
          surface: 'system',
          after_value: {
            cluster_id: clusterId,
            silhouette_score: cluster.silhouetteScore,
            proposed_name: cluster.proposedName,
          },
        })
      }
    }

    // System-grain audit
    await audit({
      event_type: 'ai.gemini.call',
      target_type: 'upload_batch',
      target_id: batchId,
      metadata: {
        kind: 'clustering_batch_completed',
        cluster_count: result.clusters.length,
        total_assets: result.totalAssets,
        noise_assets: result.noiseAssets,
        below_floor_clusters: result.belowFloorClusters,
        cache_hits_for_naming: result.cacheHitsForNaming,
        cache_misses_for_naming: result.cacheMissesForNaming,
      },
    })

    await releaseBatchClusteringClaim(batchId)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await audit({
      event_type: 'ai.gemini.call',
      target_type: 'upload_batch',
      target_id: batchId,
      metadata: { kind: 'clustering_batch_failed', error: errorMessage },
    })
    await releaseBatchClusteringClaim(batchId, errorMessage)
    // Do NOT re-throw — fire-and-forget callers (commit-service hook)
    // expect this function to swallow errors. The reaper picks up
    // long-stuck cases via clustering_started_at + missing
    // clustering_completed_at.
  }
}

async function deletePendingClustersForBatch(batchId: string): Promise<void> {
  const supabase = getSupabaseClient()
  // Delete clusters that are still pending (no accept, no dismiss).
  // ON DELETE SET NULL on asset_proposals.cluster_id handles member cleanup.
  await supabase
    .from('asset_proposal_clusters')
    .delete()
    .eq('batch_id', batchId)
    .is('accepted_at', null)
    .is('dismissed_at', null)
}
