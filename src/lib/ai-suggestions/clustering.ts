/**
 * Frontfiles — Class B (batch clustering) engine
 *
 * Per AI-PIPELINE-BRIEF.md v2 §4.3 + E1.5 §9 + §10 + E5-DIRECTIVE.md §8.
 *
 * Triggered by batch-clustering-dispatcher.ts (this engine is pure;
 * the dispatcher handles claim + lifecycle + audit + retries).
 *
 * Inputs:
 *   - batchId, creatorId, region (resolved by the dispatcher upstream)
 *
 * Output: ClusterEngineResult — array of clusters with name, members,
 *         silhouette, and provenance. The dispatcher persists.
 *
 * HDBSCAN library: per E5-DIRECTIVE.md §7.1, no specific package is
 * locked here. The `runHdbscan` helper below is a stub that throws
 * with a clear message until founder picks a library at implementation
 * (per §7.2 evaluation). This stub keeps the surrounding code
 * type-safe + unit-testable; the algorithm choice is the only gap.
 *
 * SERVER-ONLY.
 */

import { audit } from '@/lib/logger'
import { getEffectiveSettings } from './settings'
import { MODELS } from './models'
import { proposeClusterName } from './cluster-naming'
import { loadBatchEmbeddings, formatDateRange } from './cluster-input'
import type { VertexRegion } from './types'
import type { ClusterInputRow } from './cluster-input'

// ── Public types ───────────────────────────────────────────────

export interface ClusterEngineOpts {
  batchId: string
  creatorId: string
  region: VertexRegion
}

export interface ProposedCluster {
  members: Array<{ assetId: string }>
  silhouetteScore: number
  proposedName: string | null
  modelVersion: string
  region: VertexRegion
}

export interface ClusterEngineResult {
  clusters: ProposedCluster[]
  totalAssets: number
  noiseAssets: number
  belowFloorClusters: number
  cacheHitsForNaming: number
  cacheMissesForNaming: number
}

// ── Public API ─────────────────────────────────────────────────

export async function clusterBatch(opts: ClusterEngineOpts): Promise<ClusterEngineResult> {
  const settings = await getEffectiveSettings()
  const rows = await loadBatchEmbeddings(opts.batchId)

  if (rows.length < settings.cluster_min_size) {
    return emptyResult(rows.length)
  }

  // Run HDBSCAN — returns one label per row (-1 = noise)
  const labels = await runHdbscan({
    vectors: rows.map((r) => r.embedding),
    minClusterSize: settings.cluster_min_size,
    minSamples: settings.cluster_min_samples,
    metric: 'cosine',
    seed: opts.batchId, // deterministic per batch
  })

  // Group by label (skip -1 = noise, capture noise count first)
  const groups = groupByLabel(rows, labels)
  const noiseAssets = (groups.get(-1) ?? []).length
  groups.delete(-1)

  // Compute silhouette per cluster
  const silhouettes = silhouettePerCluster(rows.map((r) => r.embedding), labels, 'cosine')

  // Filter by silhouette floor
  type SurvivingCluster = { label: number; members: ClusterInputRow[]; silhouette: number }
  const surviving: SurvivingCluster[] = []
  let belowFloor = 0
  for (const [label, members] of groups) {
    const s = silhouettes.get(label) ?? 0
    if (s < settings.confidence_floor_silhouette) {
      belowFloor++
      continue
    }
    surviving.push({ label, members, silhouette: s })
  }

  // Name each surviving cluster (cached via ai_analysis)
  let cacheHits = 0
  let cacheMisses = 0
  const proposed: ProposedCluster[] = []
  for (const cluster of surviving) {
    const captions = cluster.members.map((m) => m.caption ?? '')
    const dates = cluster.members.map((m) => m.capturedAt)
    const dateRangeText = formatDateRange(dates)

    const naming = await proposeClusterName({
      captions,
      dateRangeText,
      region: opts.region,
    })
    if (naming.cacheHit) cacheHits++
    else cacheMisses++

    proposed.push({
      members: cluster.members.map((m) => ({ assetId: m.assetId })),
      silhouetteScore: cluster.silhouette,
      proposedName: naming.name,
      modelVersion: MODELS.cluster_naming,
      region: opts.region,
    })
  }

  await audit({
    event_type: 'ai.gemini.call', // covered by the per-cluster naming events; this is a summary
    target_type: 'upload_batch',
    target_id: opts.batchId,
    metadata: {
      cluster_count: proposed.length,
      total_assets: rows.length,
      noise_assets: noiseAssets,
      below_floor_clusters: belowFloor,
      cache_hits_for_naming: cacheHits,
      cache_misses_for_naming: cacheMisses,
    },
  })

  return {
    clusters: proposed,
    totalAssets: rows.length,
    noiseAssets,
    belowFloorClusters: belowFloor,
    cacheHitsForNaming: cacheHits,
    cacheMissesForNaming: cacheMisses,
  }
}

function emptyResult(totalAssets: number): ClusterEngineResult {
  return {
    clusters: [],
    totalAssets,
    noiseAssets: 0,
    belowFloorClusters: 0,
    cacheHitsForNaming: 0,
    cacheMissesForNaming: 0,
  }
}

function groupByLabel<T>(items: T[], labels: number[]): Map<number, T[]> {
  const m = new Map<number, T[]>()
  for (let i = 0; i < items.length; i++) {
    const label = labels[i]
    const arr = m.get(label) ?? []
    arr.push(items[i])
    m.set(label, arr)
  }
  return m
}

// ── HDBSCAN library shim (verify-at-implementation per §7.2) ───

interface HdbscanOpts {
  vectors: number[][]
  minClusterSize: number
  minSamples: number | null
  metric: 'cosine'
  seed: string
}

/**
 * STUB — replace with a real HDBSCAN call at implementation time per
 * E5-DIRECTIVE.md §7.2.
 *
 * Selection criteria (§7.1):
 *   - Cosine similarity over 768-dim float arrays
 *   - Determinism (seedable RNG)
 *   - Min cluster size configurable
 *   - Output: per-point label (int; -1 = noise) + silhouette per cluster
 *   - Pure JS / pure TS strongly preferred
 *
 * Candidates to evaluate (§7.2):
 *   - hdbscan-ts (pure TS port; verify maintained + deterministic)
 *   - WASM port of Python hdbscan (verify Vercel runtime support)
 *   - Vendored DIY (~500-800 LOC; fallback if A and B fail)
 *
 * Until a library is selected and wired here, this throws a clear error
 * so production calls fail loud rather than silent-empty.
 */
async function runHdbscan(_opts: HdbscanOpts): Promise<number[]> {
  throw new Error(
    'HDBSCAN library not yet selected — see E5-DIRECTIVE.md §7.2 for evaluation criteria. ' +
      'Replace this stub with a real call (e.g., to hdbscan-ts, WASM port, or vendored impl).',
  )
}

/**
 * Silhouette per cluster — placeholder. Real implementation depends on
 * the chosen HDBSCAN library (some libs return silhouette directly;
 * others require computing post-hoc from labels + cosine distance).
 */
function silhouettePerCluster(
  _vectors: number[][],
  _labels: number[],
  _metric: 'cosine',
): Map<number, number> {
  // Stub returns 1.0 for every label seen (max confidence); real impl
  // computes from intra-cluster vs nearest-cluster cosine distance.
  // Replace at HDBSCAN library wiring time.
  const m = new Map<number, number>()
  for (const l of _labels) {
    if (l === -1) continue
    if (!m.has(l)) m.set(l, 1.0)
  }
  return m
}
