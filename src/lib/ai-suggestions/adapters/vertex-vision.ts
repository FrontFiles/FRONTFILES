/**
 * Frontfiles — Vertex Gemini Vision adapter (E3 real implementation)
 *
 * Per E3-DIRECTIVE.md §15.
 *
 * Translates the engine's adapter contract into the @/lib/ai/google.ts
 * Vertex client wrapper. The wrapper handles SDK loading, region routing,
 * auth, and typed errors; this adapter just builds the prompt + schema
 * and unwraps the response into the engine's expected shape.
 *
 * SERVER-ONLY.
 */

import { analyseImage as vertexAnalyseImage } from '@/lib/ai/google'
import { buildPrompt, VISION_RESPONSE_JSON_SCHEMA } from '../prompt-builder'
import type { VisionAdapter, AnalyseImageOpts, AnalyseImageResult } from './types'
import type { VisionResponse } from '../schema'

export const vertexVisionAdapter: VisionAdapter = {
  async analyseImage(opts: AnalyseImageOpts): Promise<AnalyseImageResult> {
    const prompt = buildPrompt(opts.format, opts.taxonomyTopN)

    const result = await vertexAnalyseImage({
      imageBytes: opts.imageBytes,
      imageMime: opts.imageMime,
      prompt,
      responseSchema: VISION_RESPONSE_JSON_SCHEMA,
      model: 'flash',
      region: opts.region,
    })

    // The wrapper returns parsed JSON as `output: unknown` — caller
    // validates via Zod (engine.ts step 7). Adapter returns the raw
    // shape; engine owns validation + filtering.
    return {
      response: result.output as VisionResponse,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      modelVersion: result.modelVersion,
    }
  },
}
