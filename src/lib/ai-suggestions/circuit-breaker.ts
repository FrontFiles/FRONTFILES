/**
 * Frontfiles — Per-region Vertex circuit breaker
 *
 * Per E1.5 §11 + E3-DIRECTIVE.md §13.
 *
 * Stateful per-region; in-memory only (no DB persistence — circuit state is
 * per-process and short-lived). Tripping behavior:
 *
 *   N consecutive failures → state = 'open', stamp openedAt
 *   Open + < cooldown_ms elapsed → checkCircuitOrFail throws CircuitOpenError
 *   Open + ≥ cooldown_ms elapsed → next call probes (passes the check); the
 *                                  probe's success/failure determines new state
 *
 * Permanent errors (VertexPermanentError) do NOT contribute to the failure
 * counter — caller passes shouldCount=false for those.
 *
 * D8 binding: NO cross-region fall-through. Calls to one region's open
 * circuit never route to the other region.
 *
 * SERVER-ONLY.
 */

import { audit } from '@/lib/logger'
import { getEffectiveSettings } from './settings'
import type { VertexRegion } from './types'

interface CircuitState {
  consecutiveFailures: number
  state: 'closed' | 'open'
  openedAt: number | null
}

const states: Map<VertexRegion, CircuitState> = new Map([
  ['europe-west4', { consecutiveFailures: 0, state: 'closed', openedAt: null }],
  ['us-central1', { consecutiveFailures: 0, state: 'closed', openedAt: null }],
])

export class CircuitOpenError extends Error {
  constructor(public readonly region: VertexRegion) {
    super(`Circuit open for region ${region}`)
    this.name = 'CircuitOpenError'
  }
}

/**
 * Pre-call check. Throws CircuitOpenError if the circuit is open and still
 * within its cool-down. Returns silently otherwise (call may proceed).
 */
export async function checkCircuitOrFail(region: VertexRegion): Promise<void> {
  const s = states.get(region)
  if (!s || s.state === 'closed') return

  const settings = await getEffectiveSettings()
  const elapsed = Date.now() - (s.openedAt ?? 0)
  if (elapsed < settings.circuit_cooldown_ms) {
    throw new CircuitOpenError(region)
  }
  // Cool-down elapsed; allow the next call as a probe. State stays 'open'
  // until we see the result via recordSuccess / recordFailure.
}

/** Record a successful Vertex call for this region. Resets the counter; closes the circuit if open. */
export async function recordSuccess(region: VertexRegion): Promise<void> {
  const s = states.get(region)
  if (!s) return
  if (s.state === 'open' || s.consecutiveFailures > 0) {
    s.state = 'closed'
    s.consecutiveFailures = 0
    s.openedAt = null
    await audit({
      event_type: 'ai.gemini.circuit_close',
      target_type: 'vertex_region',
      target_id: region,
    })
  }
}

/** Record a failed Vertex call. shouldCount=false for permanent errors. */
export async function recordFailure(region: VertexRegion, shouldCount: boolean): Promise<void> {
  if (!shouldCount) return
  const s = states.get(region)
  if (!s) return

  const settings = await getEffectiveSettings()
  s.consecutiveFailures += 1
  if (
    s.consecutiveFailures >= settings.circuit_failure_threshold &&
    s.state === 'closed'
  ) {
    s.state = 'open'
    s.openedAt = Date.now()
    await audit({
      event_type: 'ai.gemini.circuit_open',
      target_type: 'vertex_region',
      target_id: region,
      metadata: { consecutive_failures: s.consecutiveFailures },
    })
  }
}

/** Test-only: reset a region's circuit state. */
export function resetCircuitForTest(region: VertexRegion): void {
  states.set(region, { consecutiveFailures: 0, state: 'closed', openedAt: null })
}

/** Test-only: read current state. */
export function _stateForTest(region: VertexRegion): Readonly<CircuitState> | null {
  return states.get(region) ?? null
}
