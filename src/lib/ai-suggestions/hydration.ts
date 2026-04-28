/**
 * Frontfiles — AI proposal hydration (server-side, E6)
 *
 * Per E6-DIRECTIVE.md §6 + §8.
 *
 * Server-side function that loads the proposal + cluster state for a
 * batch and shapes it into the V4 store's expected types. Reconciles
 * the four data-shape mismatches between V4's combined `AssetProposal`
 * and the AI-pipeline schema:
 *
 *   §6.2 — per-field confidences (no fabricated overall)
 *   §6.3 — synthesized rationale (factual, no AI generation here)
 *   §6.4 — cluster banner consumes proposed_name + synthesized rationale
 *   §6.5 — geography NOT from AI (kept out of this hydration)
 *
 * Honors per-creator opt-out (§12) — returns empty arrays when set.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import { formatDateRange } from './cluster-input'

// ── View types (returned to API route + V4 hydration layer) ────

export interface ProposalView {
  asset_id: string
  generation_status: 'pending' | 'processing' | 'ready' | 'failed' | 'not_applicable'
  caption: string | null
  caption_confidence: number | null
  keywords: string[] | null
  keywords_confidence: number | null
  tags: string[] | null
  tags_confidence: number | null
  cluster_id: string | null
  cluster_confidence: number | null
  /** Synthesized factual rationale (§6.3) — null when high-confidence. */
  rationale: string | null
}

export interface ClusterView {
  id: string
  proposed_name: string | null
  asset_count: number
  silhouette_score: number | null
  member_asset_ids: string[]
  /** Synthesized factual rationale (§6.4) — never AI-generated. */
  rationale: string
}

export interface HydrationResult {
  proposals: ProposalView[]
  clusters: ClusterView[]
  /** Echoed for the client to know whether to render any AI surfaces at all. */
  optedOut: boolean
}

// ── Public API ─────────────────────────────────────────────────

export async function hydrateBatchAiProposals(
  batchId: string,
  creatorId: string,
): Promise<HydrationResult> {
  if (!isSupabaseConfigured()) {
    return { proposals: [], clusters: [], optedOut: false }
  }

  const supabase = getSupabaseClient()

  // Per §12 — opt-out check returns empty arrays
  const { data: user } = await supabase
    .from('users')
    .select('ai_suggestions_opt_out')
    .eq('id', creatorId)
    .maybeSingle()

  if (user && (user as { ai_suggestions_opt_out: boolean }).ai_suggestions_opt_out) {
    return { proposals: [], clusters: [], optedOut: true }
  }

  // Fetch asset_ids in this batch
  const { data: assetRows } = await supabase
    .from('vault_assets')
    .select('id')
    .eq('batch_id', batchId)
  const assetIds = ((assetRows ?? []) as Array<{ id: string }>).map((r) => r.id)

  if (assetIds.length === 0) {
    return { proposals: [], clusters: [], optedOut: false }
  }

  // Proposals
  const { data: propRows } = await supabase
    .from('asset_proposals')
    .select(
      'asset_id, generation_status, caption, caption_confidence, keywords, keywords_confidence, tags, tags_confidence, cluster_id, cluster_confidence',
    )
    .in('asset_id', assetIds)

  const proposals: ProposalView[] = ((propRows ?? []) as Array<ProposalView>).map(
    (row) => ({
      ...row,
      rationale: synthesizeAssetRationale(row),
    }),
  )

  // Clusters (only pending — accepted/dismissed are filtered out per §6.4)
  const { data: clusterRows } = await supabase
    .from('asset_proposal_clusters')
    .select('id, proposed_name, asset_count, silhouette_score, generated_at')
    .eq('batch_id', batchId)
    .is('accepted_at', null)
    .is('dismissed_at', null)

  const clusters: ClusterView[] = []
  for (const c of (clusterRows ?? []) as Array<{
    id: string
    proposed_name: string | null
    asset_count: number
    silhouette_score: number | null
  }>) {
    // Look up cluster members + capture dates for the synthesized rationale
    const { data: memberRows } = await supabase
      .from('asset_proposals')
      .select('asset_id, vault_assets!inner(captured_at)')
      .eq('cluster_id', c.id)

    const memberData = (memberRows ?? []) as Array<{
      asset_id: string
      vault_assets:
        | { captured_at: string | null }
        | Array<{ captured_at: string | null }>
        | null
    }>
    const memberAssetIds = memberData.map((m) => m.asset_id)
    const dates = memberData.map((m) => {
      const va = Array.isArray(m.vault_assets) ? m.vault_assets[0] : m.vault_assets
      return va?.captured_at ? new Date(va.captured_at) : null
    })

    clusters.push({
      id: c.id,
      proposed_name: c.proposed_name,
      asset_count: c.asset_count,
      silhouette_score: c.silhouette_score,
      member_asset_ids: memberAssetIds,
      rationale: synthesizeClusterRationale(c.asset_count, c.silhouette_score, dates),
    })
  }

  return { proposals, clusters, optedOut: false }
}

// ── Synthesized rationales (deterministic; not AI-generated) ───

function synthesizeAssetRationale(p: ProposalView): string | null {
  if (p.generation_status !== 'ready') return null
  const lowConfFields: string[] = []
  if ((p.caption_confidence ?? 1) < 0.5) lowConfFields.push('caption')
  if ((p.keywords_confidence ?? 1) < 0.5) lowConfFields.push('keywords')
  if ((p.tags_confidence ?? 1) < 0.5) lowConfFields.push('tags')
  if (lowConfFields.length === 0) return null
  return `Lower confidence on: ${lowConfFields.join(', ')}.`
}

function synthesizeClusterRationale(
  assetCount: number,
  silhouette: number | null,
  dates: Array<Date | null>,
): string {
  const dateRangeText = formatDateRange(dates)
  const dateClause = dateRangeText ? `, ${dateRangeText}` : ''
  const silClause = silhouette !== null ? `. Silhouette ${silhouette.toFixed(2)}.` : '.'
  return `${assetCount} assets${dateClause}${silClause}`
}
