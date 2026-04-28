/**
 * Frontfiles — AI Suggestion Pipeline (engine, E3 — full Class A orchestration)
 *
 * Public API consumed by E4 worker integration and E6 UI surfaces.
 *
 * E2 shipped this as a thin pass-through to the adapter. E3 expands it to:
 *   1. circuit + quota pre-checks (real-mode only)
 *   2. image-prep (Sharp resize from original; mock-mode supplies stub bytes)
 *   3. cache lookup against ai_analysis (real-mode only)
 *   4. on miss: adapter call (vertex or mock)
 *   5. defensive caption truncation
 *   6. Zod validation
 *   7. tag-confidence filtering
 *   8. cost capture (real-mode only)
 *   9. cache write + embedding write (real-mode only)
 *  10. system-grain audit
 *
 * Dual-mode pattern: when Supabase isn't configured (typical in tests +
 * dev without env), the production-only paths (cache / quota / cost /
 * embedding) are skipped. The adapter still runs (mock returns canned
 * fixture; vertex would throw without creds — caller-side flag selects
 * which adapter is in scope). audit() has its own dual-mode skip in
 * @/lib/logger.
 *
 * SCOPE: the engine returns the AI-generated content + per-call metadata.
 * Persistence to asset_proposals is the WORKER's responsibility (E4).
 *
 * SERVER-ONLY. Never import from a client component.
 */

import crypto from 'node:crypto'
import { audit } from '@/lib/logger'
import { isSupabaseConfigured } from '@/lib/db/client'
import { getAdapter } from './adapters'
import { getEffectiveSettings } from './settings'
import { prepareForVision } from './image-prep'
import { cacheRead, cacheWrite, buildInputHash } from './cache'
import { generateAndUpsertEmbedding } from './embedding'
import { centsForCall } from './cost'
import { checkSpendOrFail } from './quota'
import { checkCircuitOrFail, recordSuccess, recordFailure } from './circuit-breaker'
import { guardCaption } from './caption-guard'
import { MODELS } from './models'
import { VisionResponseSchema } from './schema'
import type { VisionResponse, VertexRegion } from './types'
import type { AssetFormat } from '@/lib/upload/types'

// ── Public types ───────────────────────────────────────────────

export interface GenerateProposalOpts {
  assetId: string
  creatorId: string
  format: AssetFormat
  /** Raw original bytes; the engine handles image-prep internally per E1.5 §6. */
  originalBytes: Buffer
  region: VertexRegion
  /** Top-N tags from the creator's existing taxonomy (per E1.5 §8). */
  taxonomyTopN: string[]
}

export interface GenerateProposalResult {
  visionResponse: VisionResponse
  modelVersion: string
  costCents: number
  latencyMs: number
  cacheHit: boolean
  region: VertexRegion
}

// ── Public API ─────────────────────────────────────────────────

export async function generateAssetProposal(
  opts: GenerateProposalOpts,
): Promise<GenerateProposalResult> {
  const dualMode = isSupabaseConfigured()

  // 1. Pre-flight: circuit + quota (real-mode only — quota hits supabase RPC)
  if (dualMode) {
    await checkCircuitOrFail(opts.region)
    await checkSpendOrFail()
  }

  // 2. Image-prep — Sharp resize. In mock-mode tests, callers supply tiny
  //    stub bytes that Sharp may reject; if Sharp throws, fall back to the
  //    raw bytes (mock adapter doesn't actually inspect the bytes).
  let preparedBytes: Buffer
  let preparedMime: 'image/jpeg' | 'image/png' | 'image/webp'
  try {
    const prepared = await prepareForVision(opts.originalBytes)
    preparedBytes = prepared.bytes
    preparedMime = prepared.mime
  } catch (err) {
    if (!dualMode) {
      // Mock-mode test path: skip image-prep failures; the mock adapter
      // returns canned data regardless of input bytes.
      preparedBytes = opts.originalBytes
      preparedMime = 'image/jpeg'
    } else {
      throw err
    }
  }

  // 3. Cache key (only used in real-mode; cheap to build either way)
  const imageSha = crypto.createHash('sha256').update(preparedBytes).digest('hex')
  const cacheKey = {
    subjectType: 'asset' as const,
    subjectId: opts.assetId,
    model: MODELS.vision_per_asset,
    modelVersion: MODELS.vision_per_asset, // pin string IS the version per E1.5 §3.1
    inputHash: buildInputHash([opts.format, opts.taxonomyTopN.join(','), imageSha]),
  }

  // 4. Cache read (real-mode only)
  if (dualMode) {
    const cached = await cacheRead(cacheKey)
    if (cached) {
      const visionResponse = VisionResponseSchema.parse(cached.output)
      // Even on cache hit, ensure embedding exists (may have been missed if
      // a prior cache-hit run finished before embedding write).
      await generateAndUpsertEmbedding({
        assetId: opts.assetId,
        visionResponse,
        format: opts.format,
        region: opts.region,
      })
      return {
        visionResponse,
        modelVersion: cached.modelVersion,
        costCents: 0, // cache hit costs nothing
        latencyMs: 0,
        cacheHit: true,
        region: opts.region,
      }
    }
  }

  // 5. Adapter call
  const adapter = getAdapter()
  const settings = await getEffectiveSettings()
  let result: Awaited<ReturnType<typeof adapter.analyseImage>>
  try {
    result = await adapter.analyseImage({
      imageBytes: preparedBytes,
      imageMime: preparedMime,
      format: opts.format,
      region: opts.region,
      taxonomyTopN: opts.taxonomyTopN,
      settings,
    })
    if (dualMode) await recordSuccess(opts.region)
  } catch (err) {
    // Permanent errors don't trip the breaker; everything else does
    const name = (err as Error)?.name ?? ''
    const shouldCount = !name.includes('Permanent')
    if (dualMode) await recordFailure(opts.region, shouldCount)
    throw err
  }

  // 6. Defensive caption truncation BEFORE Zod validation
  const truncated = await guardCaption(result.response.caption, opts.assetId)
  const candidate: VisionResponse = { ...result.response, caption: truncated }

  // 7. Zod validation (caption is now within bounds)
  const visionResponse = VisionResponseSchema.parse(candidate)

  // 8. Filter new tags by 0.75 confidence floor (per E1.5 §5.1)
  if (visionResponse.new_tags_with_confidence) {
    const accepted = visionResponse.new_tags_with_confidence
      .filter((t) => t.confidence >= settings.confidence_floor_tags_new)
      .map((t) => t.tag)
    visionResponse.tags = [...visionResponse.tags, ...accepted]
  }

  // 9. Cost capture (real-mode only — cost.ts throws on null pricing)
  let costCents = 0
  if (dualMode) {
    costCents = centsForCall('vision_per_asset', {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      imageCount: 1,
    })
  }

  // 10. Cache write + embedding write (real-mode only)
  if (dualMode) {
    await cacheWrite(cacheKey, {
      output: visionResponse,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costCents,
      region: opts.region,
    })
    await generateAndUpsertEmbedding({
      assetId: opts.assetId,
      visionResponse,
      format: opts.format,
      region: opts.region,
    })
  }

  // 11. System-grain audit (audit() has its own dual-mode skip in @/lib/logger)
  await audit({
    event_type: 'ai.gemini.call',
    target_type: 'asset',
    target_id: opts.assetId,
    metadata: {
      region: opts.region,
      cost_cents: costCents,
      model_version: result.modelVersion,
    },
  })

  return {
    visionResponse,
    modelVersion: result.modelVersion,
    costCents,
    latencyMs: 0, // adapter doesn't surface latencyMs in v1; tracked via google.ts
    cacheHit: false,
    region: opts.region,
  }
}

/** Cluster-naming public API stub (E5 fills in real call). */
export async function generateClusterName(/* opts */): Promise<string | null> {
  throw new Error('generateClusterName not implemented — lands in E5')
}
