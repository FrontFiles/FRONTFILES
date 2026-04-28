/**
 * Frontfiles — Vertex AI cost calculation
 *
 * Per E3-DIRECTIVE.md §12.
 *
 * VERIFICATION REQUIRED BEFORE MERGE: founder must visit
 *   cloud.google.com/vertex-ai/generative-ai/pricing
 * and replace the null placeholders below with verified-current values.
 * Verification gate #5 in E3 §18 enforces this (no null on merge).
 *
 * Re-verify quarterly per E1.5 §3.1 bump policy. Out-of-date pricing →
 * cost capture is wrong → spend cap decisions are wrong → real cost
 * may exceed configured ceiling silently.
 *
 * SERVER-ONLY.
 */

import type { ModelRole } from './models'

// Pricing constants. Verify at E3 ship + on each quarterly recalibration.
// Source: cloud.google.com/vertex-ai/generative-ai/pricing
// Verified: <DATE> by <ENGINEER> — replace before merge.
//
// Format: cents per 1M tokens for input/output; cents per image for image input.
export const VERTEX_PRICING = {
  vision_per_asset: {
    // gemini-2.5-flash
    input_per_1m_tokens_cents: null as number | null,
    output_per_1m_tokens_cents: null as number | null,
    image_per_unit_cents: null as number | null,
  },
  cluster_naming: {
    // gemini-2.5-pro
    input_per_1m_tokens_cents: null as number | null,
    output_per_1m_tokens_cents: null as number | null,
    image_per_unit_cents: null as number | null,
  },
  embedding: {
    // text-embedding-004
    input_per_1m_tokens_cents: null as number | null,
  },
} as const

export interface CallTokens {
  inputTokens: number
  outputTokens: number
  /** For vision calls; defaults to 0 if absent. */
  imageCount?: number
}

/**
 * Compute cost in cents for a single Vertex call.
 *
 * @throws {Error} if pricing has not been verified (any null) for this role.
 *                 Forces verification gate #5 to pass before production calls.
 */
export function centsForCall(role: ModelRole, tokens: CallTokens): number {
  const pricing = VERTEX_PRICING[role as keyof typeof VERTEX_PRICING]
  if (!pricing) {
    throw new Error(`No pricing defined for model role: ${role}`)
  }

  const input = pricing.input_per_1m_tokens_cents
  const output =
    'output_per_1m_tokens_cents' in pricing ? pricing.output_per_1m_tokens_cents : 0
  const imagePer =
    'image_per_unit_cents' in pricing ? pricing.image_per_unit_cents : 0

  if (input === null || output === null || imagePer === null) {
    throw new Error(
      `Vertex pricing not yet verified for ${role}; replace nulls in src/lib/ai-suggestions/cost.ts before merging E3 (verification gate #5).`,
    )
  }

  const inputCost = (tokens.inputTokens / 1_000_000) * input
  const outputCost = (tokens.outputTokens / 1_000_000) * output
  const imageCost = (tokens.imageCount ?? 0) * imagePer

  // Round up to nearest cent — captures fractional costs that aggregate.
  return Math.ceil(inputCost + outputCost + imageCost)
}
