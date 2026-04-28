import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockIs = vi.fn(() => ({ select: mockSelect }))
const mockLt = vi.fn(() => ({ is: mockIs }))
const mockUpdate = vi.fn(() => ({ lt: mockLt }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return {
    ...actual,
    env: { ...actual.env, FFF_PROCESSING_TIMEOUT_SECONDS: '600' },
    isSupabaseEnvPresent: () => true,
  }
})

import { reapStuckClusteringJobs } from '../reaper'

beforeEach(() => {
  mockSelect.mockReset()
})

describe('reapStuckClusteringJobs', () => {
  it('returns empty array when no stuck batches', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    const result = await reapStuckClusteringJobs()
    expect(result).toEqual([])
  })

  it('returns reaped batches with computed stuck duration', async () => {
    const stuckAt = new Date(Date.now() - 800 * 1000).toISOString()
    mockSelect.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          clustering_started_at: stuckAt,
        },
      ],
      error: null,
    })
    const result = await reapStuckClusteringJobs()
    expect(result).toHaveLength(1)
    expect(result[0].batchId).toBe('00000000-0000-0000-0000-000000000001')
    expect(result[0].stuckDurationSeconds).toBeGreaterThan(600)
  })

  it('throws on supabase error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'db down' } })
    await expect(reapStuckClusteringJobs()).rejects.toThrow(
      /reapStuckClusteringJobs failed/,
    )
  })

  it('handles null clustering_started_at defensively (stuck=0)', async () => {
    mockSelect.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          clustering_started_at: null,
        },
      ],
      error: null,
    })
    const result = await reapStuckClusteringJobs()
    expect(result[0].stuckDurationSeconds).toBe(0)
  })

  it('respects timeoutSeconds parameter override', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    await reapStuckClusteringJobs(120)
    expect(mockLt).toHaveBeenCalled()
  })
})
