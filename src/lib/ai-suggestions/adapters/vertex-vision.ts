/**
 * Frontfiles — Vertex Gemini Vision adapter (E2 STUB)
 *
 * Production adapter shell. The real implementation lands in E3
 * alongside the @google-cloud/vertexai SDK install. Until then, any
 * call here throws NotImplementedError so the production code path
 * cannot silently fall through to a misconfigured state.
 *
 * The E3 directive (src/lib/processing/E3-DIRECTIVE.md) governs the
 * real implementation contract.
 *
 * SERVER-ONLY.
 */

import type { VisionAdapter, AnalyseImageOpts, AnalyseImageResult } from './types'

class NotImplementedError extends Error {
  constructor() {
    super(
      'vertex-vision adapter not yet implemented — lands in E3 alongside the @google-cloud/vertexai SDK install.',
    )
    this.name = 'NotImplementedError'
  }
}

export const vertexVisionAdapter: VisionAdapter = {
  async analyseImage(_opts: AnalyseImageOpts): Promise<AnalyseImageResult> {
    throw new NotImplementedError()
  },
}
