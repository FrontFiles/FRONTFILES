/**
 * Frontfiles — AI Suggestions adapter types
 *
 * Vendor-agnostic adapter contract. Both the production
 * vertex-vision adapter and the mock adapter implement this shape.
 *
 * Token counts on AnalyseImageResult are required so the engine
 * (E3 update) can compute cost without depending on the underlying
 * SDK shape.
 */

import type { VisionResponse } from '../schema'
import type { EffectiveSettings } from '../settings'
import type { VertexRegion } from '../types'
import type { AssetFormat } from '@/lib/upload/types'

export interface AnalyseImageOpts {
  imageBytes: Buffer
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp'
  format: AssetFormat
  region: VertexRegion
  taxonomyTopN: string[]
  settings: EffectiveSettings
}

export interface AnalyseImageResult {
  response: VisionResponse
  inputTokens: number
  outputTokens: number
  modelVersion: string
}

export interface VisionAdapter {
  analyseImage(opts: AnalyseImageOpts): Promise<AnalyseImageResult>
}
