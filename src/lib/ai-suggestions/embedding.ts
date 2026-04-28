/**
 * Frontfiles — Embedding generation + storage
 *
 * Per E1 v2 §3 E3 + E1.5 §10 + E3-DIRECTIVE.md §11.
 *
 *   embedding input = caption + " | " + tags.join(", ") + " | " + format
 *   model           = text-embedding-004 (768-dim, D7 lock)
 *   storage         = asset_embeddings (shipped 2026-04-19)
 *   region          = matches Vertex call region (D8 binding;
 *                     write region == read region)
 *
 * Upserts on asset_id (one row per asset).
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient } from '@/lib/db/client'
import { generateEmbedding as vertexEmbedding } from '@/lib/ai/google'
import { MODELS } from './models'
import type { VertexRegion, VisionResponse } from './types'
import type { AssetFormat } from '@/lib/upload/types'

export function buildEmbeddingInput(
  caption: string,
  tags: string[],
  format: AssetFormat,
): string {
  const tagsStr = tags.length > 0 ? tags.join(', ') : '(no tags)'
  return `${caption} | ${tagsStr} | ${format}`
}

export interface UpsertEmbeddingOpts {
  assetId: string
  visionResponse: VisionResponse
  format: AssetFormat
  region: VertexRegion
}

export async function generateAndUpsertEmbedding(
  opts: UpsertEmbeddingOpts,
): Promise<{ inputTokens: number; latencyMs: number }> {
  const text = buildEmbeddingInput(
    opts.visionResponse.caption,
    opts.visionResponse.tags,
    opts.format,
  )

  const result = await vertexEmbedding({ text, region: opts.region })

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('asset_embeddings').upsert({
    asset_id: opts.assetId,
    embedding: result.embedding, // pgvector accepts number[]
    model: MODELS.embedding,
    model_version: result.modelVersion,
    region: opts.region,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    throw new Error(
      `Failed to upsert asset_embeddings for ${opts.assetId}: ${error.message}`,
    )
  }

  return { inputTokens: result.inputTokens, latencyMs: result.latencyMs }
}
