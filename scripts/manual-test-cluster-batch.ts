/**
 * Frontfiles — Engineer-local manual smoke test for the Class B clustering
 * pipeline (E5 §11.4 empirical-knob calibration script)
 *
 * NOT run in CI. Requires real GCP credentials, real `asset_embeddings`
 * data populated by E3, and a real HDBSCAN library wired into
 * `src/lib/ai-suggestions/clustering.ts` (the stub will throw — that's
 * the design per E5-DIRECTIVE.md §7.2).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *   GOOGLE_CLOUD_PROJECT_ID=frontfiles-prod \
 *   FFF_AI_REAL_PIPELINE=true \
 *   bun run scripts/manual-test-cluster-batch.ts <batch-id>
 *
 * What it does (per E5 §11.4):
 *   1. Resolves the batch's creator + ai_region from upload_batches + users
 *   2. Calls clusterBatch (loads embeddings, runs HDBSCAN, names surviving
 *      clusters via gemini-2.5-pro)
 *   3. Prints HDBSCAN cluster count, per-cluster size + silhouette,
 *      per-cluster proposed name + cache hit/miss, total wall time
 *   4. Queries ai_analysis for cluster_naming rows in this run's window
 *      and prints the summed cost_cents (cluster naming is the only
 *      Vertex billing surface this script exercises)
 *
 * Output drives founder ratification of `min_cluster_size` +
 * `confidence_floor_silhouette` per E5 §7.3 — the empirical knobs that
 * real `asset_embeddings` data is needed to calibrate.
 *
 * SERVER-ONLY. Side-effect: writes audit_log + ai_analysis rows on
 * cache miss; persists nothing else (the dispatcher is what persists
 * `asset_proposal_clusters` rows in production).
 */

import { clusterBatch } from '@/lib/ai-suggestions/clustering'
import { getSupabaseClient } from '@/lib/db/client'
import type { UserAiRegion, VertexRegion } from '@/lib/ai-suggestions/types'

const REGION_MAP: Record<UserAiRegion, VertexRegion> = {
  eu: 'europe-west4',
  us: 'us-central1',
}

interface BatchRow {
  creator_id: string
  users: { ai_region: UserAiRegion } | Array<{ ai_region: UserAiRegion }> | null
}

async function main(): Promise<void> {
  const batchId = process.argv[2]
  if (!batchId) {
    console.error('Usage: bun run scripts/manual-test-cluster-batch.ts <batch-id>')
    process.exit(1)
  }

  if (process.env.FFF_AI_REAL_PIPELINE !== 'true') {
    console.error('FFF_AI_REAL_PIPELINE must be "true" for this script.')
    process.exit(1)
  }

  console.log(`▶ Looking up batch ${batchId}…`)
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('upload_batches')
    .select('creator_id, users!inner(ai_region)')
    .eq('id', batchId)
    .maybeSingle()

  if (error || !data) {
    console.error('batch not found:', error?.message ?? 'no row')
    process.exit(1)
  }

  const row = data as BatchRow
  const usersRow = Array.isArray(row.users) ? row.users[0] : row.users
  const aiRegion: UserAiRegion = usersRow?.ai_region ?? 'eu'
  const vertexRegion = REGION_MAP[aiRegion]
  console.log(`  creator=${row.creator_id} region=${vertexRegion}`)

  console.log('▶ Running clusterBatch…')
  // Capture cost-window start so we can sum ai_analysis rows the engine
  // wrote during this run only (§11.4: "Total cost (cents) for naming").
  const startedAtIso = new Date().toISOString()
  const startedAt = Date.now()

  const result = await clusterBatch({
    batchId,
    creatorId: row.creator_id,
    region: vertexRegion,
  })

  const elapsedMs = Date.now() - startedAt

  // Cost: sum cluster_naming spend captured by the engine (per E5 §6.4 +
  // E1.5 §9.6). Cache hits cost zero; misses charge gemini-2.5-pro.
  let costCents = 0
  const { data: costRows } = await supabase
    .from('ai_analysis')
    .select('cost_cents')
    .eq('subject_type', 'cluster')
    .gte('created_at', startedAtIso)
  if (costRows) {
    for (const r of costRows as Array<{ cost_cents: number | null }>) {
      costCents += r.cost_cents ?? 0
    }
  }

  console.log('')
  console.log('=== Result ===')
  console.log(`total_assets:           ${result.totalAssets}`)
  console.log(`noise_assets:           ${result.noiseAssets}`)
  console.log(`clusters_surfaced:      ${result.clusters.length}`)
  console.log(`below_floor_clusters:   ${result.belowFloorClusters}`)
  console.log(`naming_cache_hits:      ${result.cacheHitsForNaming}`)
  console.log(`naming_cache_misses:    ${result.cacheMissesForNaming}`)
  console.log('')
  console.log('=== Per-cluster ===')
  if (result.clusters.length === 0) {
    console.log('(no surviving clusters)')
  } else {
    for (let i = 0; i < result.clusters.length; i++) {
      const c = result.clusters[i]
      console.log(
        `  [${i}] size=${c.members.length}` +
          ` silhouette=${c.silhouetteScore.toFixed(3)}` +
          ` name=${c.proposedName === null ? '(date-range fallback)' : JSON.stringify(c.proposedName)}`,
      )
    }
  }
  console.log('')
  console.log(`elapsed:                ${elapsedMs} ms`)
  console.log(`cluster-naming cost:    ${costCents} cents`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
