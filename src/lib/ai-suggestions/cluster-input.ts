/**
 * Frontfiles — Class B clustering input loader + helpers
 *
 * Per E5-DIRECTIVE.md §8.2.
 *
 * Loads embeddings + per-asset metadata for a batch with deterministic
 * ordering (created_at ASC, id ASC) so HDBSCAN's MST construction is
 * order-stable across runs — the cluster naming cache key depends on
 * cluster member order being deterministic.
 *
 * Excludes assets already in an accepted cluster — re-cluster behavior
 * preserves accepted clusters per E5 §6.3.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import type { AssetFormat } from '@/lib/upload/types'

export interface ClusterInputRow {
  assetId: string
  embedding: number[]
  capturedAt: Date | null
  caption: string | null
  format: AssetFormat
}

export async function loadBatchEmbeddings(batchId: string): Promise<ClusterInputRow[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = getSupabaseClient()
  // Two queries because supabase-js's nested-FK syntax has fragile shape.
  // 1. Find batch's asset ids excluding those already in an accepted cluster.
  // 2. Read embedding + captured_at + caption + format for each.
  const { data: assetRows, error: assetErr } = await supabase
    .from('vault_assets')
    .select('id, captured_at, format')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (assetErr || !assetRows) {
    throw new Error(
      `loadBatchEmbeddings: failed to read vault_assets (${assetErr?.message ?? 'no rows'})`,
    )
  }

  if (assetRows.length === 0) return []

  const assetIds = (assetRows as Array<{ id: string }>).map((r) => r.id)

  // Filter out assets already in an accepted cluster
  const { data: acceptedRows } = await supabase
    .from('asset_proposals')
    .select('asset_id, asset_proposal_clusters!inner(accepted_at)')
    .in('asset_id', assetIds)

  const acceptedAssetIds = new Set(
    ((acceptedRows ?? []) as Array<{
      asset_id: string
      asset_proposal_clusters: { accepted_at: string | null } | Array<{ accepted_at: string | null }>
    }>)
      .filter((r) => {
        const cluster = Array.isArray(r.asset_proposal_clusters)
          ? r.asset_proposal_clusters[0]
          : r.asset_proposal_clusters
        return cluster && cluster.accepted_at !== null
      })
      .map((r) => r.asset_id),
  )

  const eligibleAssetIds = assetIds.filter((id) => !acceptedAssetIds.has(id))
  if (eligibleAssetIds.length === 0) return []

  // Embeddings (asset_embeddings) — required
  const { data: embRows, error: embErr } = await supabase
    .from('asset_embeddings')
    .select('asset_id, embedding')
    .in('asset_id', eligibleAssetIds)

  if (embErr) {
    throw new Error(
      `loadBatchEmbeddings: failed to read asset_embeddings (${embErr.message})`,
    )
  }

  // Captions (asset_proposals) — optional; LEFT JOIN semantics
  const { data: propRows } = await supabase
    .from('asset_proposals')
    .select('asset_id, caption')
    .in('asset_id', eligibleAssetIds)

  const captionByAsset = new Map(
    ((propRows ?? []) as Array<{ asset_id: string; caption: string | null }>).map(
      (r) => [r.asset_id, r.caption],
    ),
  )

  const embByAsset = new Map(
    ((embRows ?? []) as Array<{ asset_id: string; embedding: number[] | string }>).map(
      (r) => [r.asset_id, parseEmbedding(r.embedding)],
    ),
  )

  const formatByAsset = new Map(
    (assetRows as Array<{ id: string; format: AssetFormat; captured_at: string | null }>).map(
      (r) => [r.id, { format: r.format, capturedAt: r.captured_at }],
    ),
  )

  // Deterministic order — matches the ORDER BY on the asset query.
  const result: ClusterInputRow[] = []
  for (const assetId of eligibleAssetIds) {
    const embedding = embByAsset.get(assetId)
    if (!embedding) continue // No embedding yet (E3 hasn't run for this asset)
    const meta = formatByAsset.get(assetId)
    if (!meta) continue
    result.push({
      assetId,
      embedding,
      capturedAt: meta.capturedAt ? new Date(meta.capturedAt) : null,
      caption: captionByAsset.get(assetId) ?? null,
      format: meta.format,
    })
  }
  return result
}

/**
 * pgvector returns embeddings as either number[] (newer drivers) or a
 * stringified vector ("[0.1,0.2,...]") (older drivers / certain interop
 * paths). Normalize to number[] here.
 */
function parseEmbedding(raw: number[] | string): number[] {
  if (Array.isArray(raw)) return raw
  // Strip leading "[" and trailing "]" then split on comma
  const inner = raw.replace(/^\[/, '').replace(/\]$/, '')
  return inner.split(',').map((s) => Number(s))
}

/** Format a date range for cluster-naming fallback per E1.5 §9.3. */
export function formatDateRange(dates: Array<Date | null>): string {
  const valid = dates.filter((d): d is Date => d !== null).sort(
    (a, b) => a.getTime() - b.getTime(),
  )
  if (valid.length === 0) return ''
  const first = valid[0]
  const last = valid[valid.length - 1]
  if (sameDay(first, last)) return formatHumanDate(first)
  if (sameMonth(first, last)) {
    return `${first.getDate()}–${last.getDate()} ${formatMonthYear(first)}`
  }
  return `${formatHumanDate(first)} – ${formatHumanDate(last)}`
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

function sameMonth(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
  )
}

function formatHumanDate(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function formatMonthYear(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
