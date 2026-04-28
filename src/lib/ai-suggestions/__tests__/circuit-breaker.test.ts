import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => false,
}))

import {
  checkCircuitOrFail,
  recordSuccess,
  recordFailure,
  resetCircuitForTest,
  CircuitOpenError,
  _stateForTest,
} from '../circuit-breaker'
import { invalidateSettingsCache } from '../settings'

const PROD_DEFAULTS = {
  daily_cap_cents: 50000,
  monthly_cap_cents: 1000000,
  tag_taxonomy_top_n: 50,
  confidence_floor_caption: 0.3,
  confidence_floor_keywords: 0.3,
  confidence_floor_tags_existing: 0.3,
  confidence_floor_tags_new: 0.75,
  confidence_floor_silhouette: 0.3,
  vision_max_long_edge_px: 1568,
  vision_jpeg_quality: 85,
  circuit_failure_threshold: 5,
  circuit_cooldown_ms: 60000,
}

beforeEach(() => {
  invalidateSettingsCache()
  mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
  resetCircuitForTest('europe-west4')
  resetCircuitForTest('us-central1')
})

afterEach(() => {
  invalidateSettingsCache()
})

describe('circuit-breaker', () => {
  it('5 consecutive failures trip the circuit', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailure('europe-west4', true)
    }
    const state = _stateForTest('europe-west4')!
    expect(state.state).toBe('open')
    expect(state.consecutiveFailures).toBe(5)
  })

  it('checkCircuitOrFail throws when circuit is open within cooldown', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailure('europe-west4', true)
    }
    await expect(checkCircuitOrFail('europe-west4')).rejects.toThrow(CircuitOpenError)
  })

  it('checkCircuitOrFail succeeds when circuit is closed', async () => {
    await expect(checkCircuitOrFail('europe-west4')).resolves.toBeUndefined()
  })

  it('recordSuccess closes the circuit + resets counter', async () => {
    for (let i = 0; i < 5; i++) await recordFailure('europe-west4', true)
    await recordSuccess('europe-west4')
    const state = _stateForTest('europe-west4')!
    expect(state.state).toBe('closed')
    expect(state.consecutiveFailures).toBe(0)
  })

  it('shouldCount=false (permanent error) does not increment', async () => {
    await recordFailure('europe-west4', false)
    const state = _stateForTest('europe-west4')!
    expect(state.consecutiveFailures).toBe(0)
  })

  it('no cross-region fall-through (D8 binding)', async () => {
    for (let i = 0; i < 5; i++) await recordFailure('europe-west4', true)
    expect(_stateForTest('europe-west4')!.state).toBe('open')
    expect(_stateForTest('us-central1')!.state).toBe('closed')
    await expect(checkCircuitOrFail('us-central1')).resolves.toBeUndefined()
  })
})
