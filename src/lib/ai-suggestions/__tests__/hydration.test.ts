import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingleUser = vi.fn()
const mockEqUser = vi.fn(() => ({ maybeSingle: mockMaybeSingleUser }))
const mockSelectUser = vi.fn(() => ({ eq: mockEqUser }))

const mockEqAsset = vi.fn()
const mockSelectAsset = vi.fn(() => ({ eq: mockEqAsset }))

const mockInProp = vi.fn()
const mockSelectProp = vi.fn(() => ({ in: mockInProp, eq: vi.fn(() => ({ in: mockInProp })) }))

const mockIsCluster2 = vi.fn()
const mockIsCluster1 = vi.fn(() => ({ is: mockIsCluster2 }))
const mockEqCluster = vi.fn(() => ({ is: mockIsCluster1 }))
const mockSelectCluster = vi.fn(() => ({ eq: mockEqCluster }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'users') return { select: mockSelectUser }
  if (table === 'vault_assets') return { select: mockSelectAsset }
  if (table === 'asset_proposals') return { select: mockSelectProp }
  if (table === 'asset_proposal_clusters') return { select: mockSelectCluster }
  return { select: vi.fn() }
})

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => true,
}))

import { hydrateBatchAiProposals } from '../hydration'

const BATCH = '00000000-0000-0000-0000-000000000001'
const CREATOR = '00000000-0000-0000-0000-000000000002'

beforeEach(() => {
  mockMaybeSingleUser.mockReset()
  mockEqAsset.mockReset()
  mockInProp.mockReset()
  mockIsCluster2.mockReset()
})

describe('hydrateBatchAiProposals', () => {
  it('opted-out creator → empty arrays + optedOut=true', async () => {
    mockMaybeSingleUser.mockResolvedValue({
      data: { ai_suggestions_opt_out: true },
      error: null,
    })
    const result = await hydrateBatchAiProposals(BATCH, CREATOR)
    expect(result).toEqual({ proposals: [], clusters: [], optedOut: true })
  })

  it('empty batch → empty arrays + optedOut=false', async () => {
    mockMaybeSingleUser.mockResolvedValue({
      data: { ai_suggestions_opt_out: false },
      error: null,
    })
    mockEqAsset.mockResolvedValue({ data: [], error: null })
    const result = await hydrateBatchAiProposals(BATCH, CREATOR)
    expect(result).toEqual({ proposals: [], clusters: [], optedOut: false })
  })

  it('synthesizes asset rationale on low confidence', async () => {
    mockMaybeSingleUser.mockResolvedValue({
      data: { ai_suggestions_opt_out: false },
      error: null,
    })
    mockEqAsset.mockResolvedValue({
      data: [{ id: '00000000-0000-0000-0000-000000000010' }],
      error: null,
    })
    mockInProp.mockResolvedValueOnce({
      data: [
        {
          asset_id: '00000000-0000-0000-0000-000000000010',
          generation_status: 'ready',
          caption: 'A scene',
          caption_confidence: 0.4,
          keywords: ['a', 'b', 'c'],
          keywords_confidence: 0.9,
          tags: ['x'],
          tags_confidence: 0.3,
          cluster_id: null,
          cluster_confidence: null,
        },
      ],
      error: null,
    })
    mockIsCluster2.mockResolvedValue({ data: [], error: null })

    const result = await hydrateBatchAiProposals(BATCH, CREATOR)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0].rationale).toContain('caption')
    expect(result.proposals[0].rationale).toContain('tags')
    expect(result.proposals[0].rationale).not.toContain('keywords')
  })

  it('high-confidence proposal → null rationale', async () => {
    mockMaybeSingleUser.mockResolvedValue({
      data: { ai_suggestions_opt_out: false },
      error: null,
    })
    mockEqAsset.mockResolvedValue({
      data: [{ id: '00000000-0000-0000-0000-000000000010' }],
      error: null,
    })
    mockInProp.mockResolvedValueOnce({
      data: [
        {
          asset_id: '00000000-0000-0000-0000-000000000010',
          generation_status: 'ready',
          caption: 'A scene',
          caption_confidence: 0.9,
          keywords: ['a', 'b', 'c'],
          keywords_confidence: 0.9,
          tags: ['x'],
          tags_confidence: 0.9,
          cluster_id: null,
          cluster_confidence: null,
        },
      ],
      error: null,
    })
    mockIsCluster2.mockResolvedValue({ data: [], error: null })

    const result = await hydrateBatchAiProposals(BATCH, CREATOR)
    expect(result.proposals[0].rationale).toBeNull()
  })

  it('pending proposal → null rationale', async () => {
    mockMaybeSingleUser.mockResolvedValue({
      data: { ai_suggestions_opt_out: false },
      error: null,
    })
    mockEqAsset.mockResolvedValue({
      data: [{ id: '00000000-0000-0000-0000-000000000010' }],
      error: null,
    })
    mockInProp.mockResolvedValueOnce({
      data: [
        {
          asset_id: '00000000-0000-0000-0000-000000000010',
          generation_status: 'pending',
          caption: null,
          caption_confidence: null,
          keywords: null,
          keywords_confidence: null,
          tags: null,
          tags_confidence: null,
          cluster_id: null,
          cluster_confidence: null,
        },
      ],
      error: null,
    })
    mockIsCluster2.mockResolvedValue({ data: [], error: null })

    const result = await hydrateBatchAiProposals(BATCH, CREATOR)
    expect(result.proposals[0].rationale).toBeNull()
    expect(result.proposals[0].generation_status).toBe('pending')
  })
})
