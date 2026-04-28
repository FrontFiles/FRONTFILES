/**
 * Frontfiles — AI Suggestion Pipeline (engine)
 *
 * Public API consumed by E4 worker integration and E6 UI surfaces.
 * E2 ships the typed surface; E3 expands this engine to add cache
 * read-through, embedding write, image preparation, cost capture,
 * region routing, and circuit-breaker semantics.
 *
 * SCOPE: the engine returns the AI-generated content shape (VisionResponse).
 * Persistence to asset_proposals is the WORKER's responsibility (E4) —
 * the engine is pure orchestration over adapters + cache + (in E3)
 * embedding.
 *
 * SERVER-ONLY. Never import from a client component.
 */

import type { VisionResponse, VertexRegion } from './types'
import type { AssetFormat } from '@/lib/upload/types'
import { getAdapter } from './adapters'
import { getEffectiveSettings } from './settings'

export interface GenerateProposalOpts {
  assetId: string
  creatorId: string
  format: AssetFormat
  imageBytes: Buffer // resized per E1.5 §6 BEFORE this call (E3 does the resize)
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp'
  region: VertexRegion
}

/**
 * Generate per-asset proposal content (Class A).
 *
 * E2: thin pass-through to the adapter (mock returns deterministic
 *     fixture; production stub throws NotImplementedError).
 * E3: orchestrates cache → adapter → embedding → cost capture and
 *     returns a richer GenerateProposalResult shape with token
 *     counts + cost + cache-hit flag.
 *
 * The WORKER (E4) is responsible for inserting/updating the
 * asset_proposals row and writing the audit event after this returns.
 */
export async function generateAssetProposal(
  opts: GenerateProposalOpts,
): Promise<VisionResponse> {
  const adapter = getAdapter()
  const settings = await getEffectiveSettings()
  const result = await adapter.analyseImage({
    imageBytes: opts.imageBytes,
    imageMime: opts.imageMime,
    format: opts.format,
    region: opts.region,
    // Taxonomy injection happens in E3; mock-mode ignores it.
    // E2 passes empty array; E3 supplies top-N from creator's
    // existing tags (via a fetch the worker performs).
    taxonomyTopN: [],
    settings,
  })
  return result.response
}

// Cluster-naming public API stub (E5 fills in real call)
export async function generateClusterName(/* opts */): Promise<string | null> {
  throw new Error('generateClusterName not implemented — lands in E5')
}
