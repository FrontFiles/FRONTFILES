/**
 * Frontfiles — Cluster name proposal
 *
 * Per E1.5 §9 + E5-DIRECTIVE.md §9.
 *
 * Reads cache via ai_analysis (subject_type='cluster'); calls
 * gemini-2.5-pro on miss; falls back to date range on empty/generic
 * response.
 *
 * Cache key uses a sorted-captions hash so re-runs with identical
 * input (typical: creator's "Re-analyze" action on an unchanged batch)
 * return the cached name without re-billing Vertex.
 *
 * SERVER-ONLY.
 */

import { generateText } from '@/lib/ai/google'
import { cacheRead, cacheWrite, buildInputHash } from './cache'
import { centsForCall } from './cost'
import { audit } from '@/lib/logger'
import { isSupabaseConfigured } from '@/lib/db/client'
import {
  checkCircuitOrFail,
  recordSuccess,
  recordFailure,
} from './circuit-breaker'
import { checkSpendOrFail } from './quota'
import { MODELS } from './models'
import type { VertexRegion } from './types'

const GENERIC_NAMES = new Set([
  'photos',
  'images',
  'pictures',
  'group',
  'stuff',
  'photo',
  'image',
  'picture',
  'asset',
  'assets',
  'media',
])

export interface ProposeClusterNameOpts {
  captions: string[]
  dateRangeText: string
  region: VertexRegion
}

export interface ProposeClusterNameResult {
  name: string | null
  cacheHit: boolean
  modelVersion: string
}

export async function proposeClusterName(
  opts: ProposeClusterNameOpts,
): Promise<ProposeClusterNameResult> {
  const sortedCaptions = [...opts.captions].sort() // deterministic input hash
  const inputHash = buildInputHash([sortedCaptions.join('\n'), opts.dateRangeText])
  const dualMode = isSupabaseConfigured()

  const cacheKey = {
    subjectType: 'cluster' as const,
    subjectId: null, // cluster-grain naming is reusable across re-runs
    model: MODELS.cluster_naming,
    modelVersion: MODELS.cluster_naming,
    inputHash,
  }

  // Cache read (real-mode only)
  if (dualMode) {
    const cached = await cacheRead(cacheKey)
    if (cached) {
      const raw = typeof cached.output === 'string' ? cached.output : ''
      return {
        name: extractNameOrFallback(raw, opts.dateRangeText),
        cacheHit: true,
        modelVersion: cached.modelVersion,
      }
    }
  }

  // Pre-flight (real-mode only)
  if (dualMode) {
    await checkCircuitOrFail(opts.region)
    await checkSpendOrFail()
  }

  // Vertex call
  const prompt = buildClusterNamingPrompt(sortedCaptions, opts.dateRangeText)
  let result
  try {
    result = await generateText({
      prompt,
      model: 'pro',
      region: opts.region,
    })
    if (dualMode) await recordSuccess(opts.region)
  } catch (err) {
    const name = (err as Error)?.name ?? ''
    const shouldCount = !name.includes('Permanent')
    if (dualMode) await recordFailure(opts.region, shouldCount)
    // Cluster naming failure shouldn't block the cluster from being surfaced.
    // Log + fall back to date range.
    // eslint-disable-next-line no-console
    console.error(
      'cluster-naming: vertex_call_failed',
      JSON.stringify({
        code: 'cluster_naming_vertex_failed',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    return {
      name: opts.dateRangeText || null,
      cacheHit: false,
      modelVersion: MODELS.cluster_naming,
    }
  }

  // Cost capture (real-mode only — cost.ts throws on null pricing)
  let costCents = 0
  if (dualMode) {
    try {
      costCents = centsForCall('cluster_naming', {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })
    } catch {
      // Pricing not yet filled; cost stays 0 + cache write skipped
      costCents = 0
    }
  }

  // Cache write (real-mode only)
  if (dualMode && costCents > 0) {
    await cacheWrite(cacheKey, {
      output: result.output,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costCents,
      region: opts.region,
    })
  }

  // Audit
  await audit({
    event_type: 'ai.gemini.call',
    target_type: 'cluster',
    target_id: null,
    metadata: {
      kind: 'cluster_named',
      region: opts.region,
      cost_cents: costCents,
      latency_ms: result.latencyMs,
      input_hash: inputHash,
    },
  })

  return {
    name: extractNameOrFallback(result.output, opts.dateRangeText),
    cacheHit: false,
    modelVersion: result.modelVersion,
  }
}

/** Per E1.5 §9.4 — empty/generic/word-count-violation falls back to date range. */
export function extractNameOrFallback(modelOutput: string, dateRangeText: string): string | null {
  const cleaned = modelOutput.trim().replace(/^["']|["']$/g, '')
  if (cleaned.length === 0) return dateRangeText || null
  if (GENERIC_NAMES.has(cleaned.toLowerCase())) return dateRangeText || null
  const words = cleaned.split(/\s+/)
  if (words.length < 2 || words.length > 4) return dateRangeText || null
  return cleaned
}

/** Per E1.5 §9.2 — verbatim cluster-naming prompt. */
function buildClusterNamingPrompt(captions: string[], dateRangeText: string): string {
  return `You are naming a Story group on Frontfiles. The group contains photos or
illustrations the creator took or made together — same shoot, same event, same
project.

Below are AI-suggested captions for the ${captions.length} assets in this group, plus the date
range across them.

Captions:
${captions.join('\n')}

Date range: ${dateRangeText}

Suggest a 2-4 word descriptive title for this group.

Constraints — these are not optional:
1. 2-4 words. Not 1, not 5+.
2. Descriptive of the visible subject. No editorialising. No factual claims about
   identified persons or events you cannot derive from the captions alone.
3. If the captions are too generic to differentiate (e.g., "Photos", "Images"),
   reply with the empty string. The system will fall back to the date range.
4. Output ONLY the title, no commentary, no quotes, no markdown.`
}
