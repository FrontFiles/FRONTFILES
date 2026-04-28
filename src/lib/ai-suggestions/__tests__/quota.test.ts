import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockRpc = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom, rpc: mockRpc }),
  isSupabaseConfigured: () => true,
}))

import { checkSpendOrFail, QuotaExceededError } from '../quota'
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
  process.env.NODE_ENV = 'production' // disable dev multiplier for predictable caps
  mockRpc.mockReset()
})

afterEach(() => {
  invalidateSettingsCache()
})

describe('checkSpendOrFail', () => {
  it('passes silently when both caps are under', async () => {
    mockRpc.mockResolvedValueOnce({ data: 100, error: null }) // daily
    mockRpc.mockResolvedValueOnce({ data: 500, error: null }) // monthly
    await expect(checkSpendOrFail()).resolves.toBeUndefined()
  })

  it('throws QuotaExceededError("daily") when daily cap reached', async () => {
    mockRpc.mockResolvedValueOnce({ data: 50000, error: null }) // = cap
    await expect(checkSpendOrFail()).rejects.toThrow(QuotaExceededError)
    await expect(checkSpendOrFail.bind(null)).rejects.toThrow(/daily/)
  })

  it('throws QuotaExceededError("monthly") when monthly cap reached', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 100, error: null }) // daily under
      .mockResolvedValueOnce({ data: 1000000, error: null }) // monthly = cap
    await expect(checkSpendOrFail()).rejects.toThrow(/monthly/)
  })

  it('handles bigint-as-string return from RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: '100', error: null })
    mockRpc.mockResolvedValueOnce({ data: '500', error: null })
    await expect(checkSpendOrFail()).resolves.toBeUndefined()
  })

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc broken' } })
    await expect(checkSpendOrFail()).rejects.toThrow(/sum_ai_cost_cents_since RPC failed/)
  })
})
