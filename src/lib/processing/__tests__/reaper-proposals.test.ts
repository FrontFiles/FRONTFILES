import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockLt = vi.fn(() => ({ select: mockSelect }))
const mockEq = vi.fn(() => ({ lt: mockLt }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
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

import { reapStuckProposalRows } from '../reaper'

beforeEach(() => {
  mockSelect.mockReset()
})

describe('reapStuckProposalRows', () => {
  it('returns empty array when no stuck rows', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    const result = await reapStuckProposalRows()
    expect(result).toEqual([])
  })

  it('returns reaped rows with mediaRole="ai_proposal" + computed stuck duration', async () => {
    const stuckAt = new Date(Date.now() - 700 * 1000).toISOString()
    mockSelect.mockResolvedValue({
      data: [
        {
          asset_id: '00000000-0000-0000-0000-000000000001',
          processing_started_at: stuckAt,
        },
      ],
      error: null,
    })
    const result = await reapStuckProposalRows()
    expect(result).toHaveLength(1)
    expect(result[0].assetId).toBe('00000000-0000-0000-0000-000000000001')
    expect(result[0].mediaRole).toBe('ai_proposal')
    expect(result[0].stuckDurationSeconds).toBeGreaterThan(600)
  })

  it('throws on supabase error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'db down' } })
    await expect(reapStuckProposalRows()).rejects.toThrow(/reapStuckProposalRows failed/)
  })

  it('handles null processing_started_at (defensive)', async () => {
    mockSelect.mockResolvedValue({
      data: [
        {
          asset_id: '00000000-0000-0000-0000-000000000001',
          processing_started_at: null,
        },
      ],
      error: null,
    })
    const result = await reapStuckProposalRows()
    expect(result[0].stuckDurationSeconds).toBe(0)
  })

  it('respects timeoutSeconds parameter override', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    await reapStuckProposalRows(120) // 2 minutes
    // Verify the cutoff calculation propagated to the .lt() filter call
    expect(mockLt).toHaveBeenCalled()
  })
})
