/**
 * Frontfiles — AI Suggestions adapter selection
 *
 * Returns the active adapter per env state.
 *
 *   FFF_AI_REAL_PIPELINE=true  → vertex-vision adapter (E3 throws
 *                                 NotImplementedError; real impl lands
 *                                 in E3 alongside SDK install)
 *   FFF_AI_REAL_PIPELINE=false → mock-vision adapter (deterministic
 *                                 fixture; tests + dev mode)
 *
 * Default false. The flag is wired in src/lib/env.ts; production
 * cutover is a separate flag flip.
 *
 * SERVER-ONLY.
 */

import { mockVisionAdapter } from './mock-vision'
import { vertexVisionAdapter } from './vertex-vision'
import type { VisionAdapter } from './types'

export function getAdapter(): VisionAdapter {
  // Live-read pattern: read process.env on every call, not at module
  // load. Mirrors the flags getter pattern in src/lib/env.ts so tests
  // that toggle FFF_AI_REAL_PIPELINE inside scopeEnvVars see the
  // current value rather than the captured-at-import one.
  if (process.env.FFF_AI_REAL_PIPELINE === 'true') {
    return vertexVisionAdapter
  }
  return mockVisionAdapter
}
