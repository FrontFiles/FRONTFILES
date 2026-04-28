/**
 * Frontfiles — Creator tag taxonomy fetch
 *
 * Per E1.5 §8.1 + E4-DIRECTIVE.md §7.
 *
 * Top-N tags by usage from creator's vault_assets.tags column, with
 * alphabetical tie-break for determinism (cache-friendly — the same
 * input set produces the same hash, which makes the AI cache key
 * stable across re-runs).
 *
 * Used by the worker (proposal-dispatcher) to inject creator's existing
 * vocabulary into the Gemini prompt so suggested tags prefer existing
 * taxonomy over new ones.
 *
 * NOT cached across invocations (creator may add tags between runs;
 * staleness is more harmful than the small repeated cost). Future
 * optimization: in-process LRU with 60s TTL — v2 enrichment.
 *
 * Performance note: fetches all `tags` arrays for the creator on every
 * call. For creators with many assets, consider a server-side
 * aggregation RPC. v2 enrichment if it surfaces as a hot path.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'

export async function fetchCreatorTagTaxonomy(
  creatorId: string,
  topN: number,
): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    // Mock-mode: no DB, no taxonomy. Return empty so the prompt builder
    // gets the "no prior tags" fallback.
    return []
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('vault_assets')
    .select('tags')
    .eq('creator_id', creatorId)
    .not('tags', 'is', null)

  if (error) {
    throw new Error(
      `fetchCreatorTagTaxonomy failed for creator ${creatorId}: ${error.message}`,
    )
  }

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ tags: string[] | null }>) {
    if (!row.tags) continue
    for (const tag of row.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1] // count DESC
      return a[0].localeCompare(b[0]) // alphabetical ASC tie-break
    })
    .slice(0, topN)
    .map(([tag]) => tag)
}
