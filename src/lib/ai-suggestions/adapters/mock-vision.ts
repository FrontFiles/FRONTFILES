/**
 * Frontfiles — Mock Vision adapter (test + dev mode)
 *
 * Deterministic fixture per format. Used by:
 *   - E2 + E3 unit + integration tests
 *   - Dev-mode dual-mode operation when FFF_AI_REAL_PIPELINE is false
 *     and credentials aren't configured
 *
 * Returns a stable VisionResponse + stub token counts so cost-capture
 * tests have predictable values.
 *
 * SERVER-ONLY (matches the production adapter's scope).
 */

import type { VisionResponse } from '../schema'
import type {
  VisionAdapter,
  AnalyseImageOpts,
  AnalyseImageResult,
} from './types'
import type { AssetFormat } from '@/lib/upload/types'

const STUB_INPUT_TOKENS = 100
const STUB_OUTPUT_TOKENS = 30
const STUB_MODEL_VERSION = 'mock-gemini-2.5-flash'

const FIXTURE_BY_FORMAT: Record<AssetFormat, VisionResponse> = {
  photo: {
    caption: 'Mock caption for photo asset',
    caption_confidence: 0.85,
    keywords: ['mock', 'photo', 'fixture'],
    keywords_confidence: 0.8,
    tags: [],
    tags_confidence: 0.75,
    new_tags_with_confidence: [],
  },
  illustration: {
    caption: 'Mock caption for illustration asset',
    caption_confidence: 0.85,
    keywords: ['mock', 'illustration', 'fixture'],
    keywords_confidence: 0.8,
    tags: [],
    tags_confidence: 0.75,
    new_tags_with_confidence: [],
  },
  infographic: {
    caption: 'Mock caption for infographic asset',
    caption_confidence: 0.85,
    keywords: ['mock', 'infographic', 'fixture'],
    keywords_confidence: 0.8,
    tags: [],
    tags_confidence: 0.75,
    new_tags_with_confidence: [],
  },
  vector: {
    caption: 'Mock caption for vector asset',
    caption_confidence: 0.85,
    keywords: ['mock', 'vector', 'fixture'],
    keywords_confidence: 0.8,
    tags: [],
    tags_confidence: 0.75,
    new_tags_with_confidence: [],
  },
  // Non-image formats are not in v1 scope per AI-PIPELINE-BRIEF v2 §4.2.
  // The engine should gate on format BEFORE calling the adapter; if it
  // ever reaches the mock with these, return the photo fixture (defensive).
  video: {
    caption: 'Mock caption (video — should not reach the AI adapter in v1)',
    caption_confidence: 0,
    keywords: ['mock', 'video', 'unsupported'],
    keywords_confidence: 0,
    tags: [],
    tags_confidence: 0,
    new_tags_with_confidence: [],
  },
  audio: {
    caption: 'Mock caption (audio — should not reach the AI adapter in v1)',
    caption_confidence: 0,
    keywords: ['mock', 'audio', 'unsupported'],
    keywords_confidence: 0,
    tags: [],
    tags_confidence: 0,
    new_tags_with_confidence: [],
  },
  text: {
    caption: 'Mock caption (text — should not reach the AI adapter in v1)',
    caption_confidence: 0,
    keywords: ['mock', 'text', 'unsupported'],
    keywords_confidence: 0,
    tags: [],
    tags_confidence: 0,
    new_tags_with_confidence: [],
  },
}

export const mockVisionAdapter: VisionAdapter = {
  async analyseImage(opts: AnalyseImageOpts): Promise<AnalyseImageResult> {
    const response = FIXTURE_BY_FORMAT[opts.format] ?? FIXTURE_BY_FORMAT.photo
    return {
      response,
      inputTokens: STUB_INPUT_TOKENS,
      outputTokens: STUB_OUTPUT_TOKENS,
      modelVersion: STUB_MODEL_VERSION,
    }
  },
}
