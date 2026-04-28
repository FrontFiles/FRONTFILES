import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSingle = vi.fn()
// Production chain: .from('users').select('ai_region').eq('id', creatorId).single()
// 4 levels — eq() returns single() directly, no extra select() in between.
const mockEqUserId = vi.fn(() => ({ single: mockSingle }))
const mockSelectUsers = vi.fn(() => ({ eq: mockEqUserId }))

const mockIs = vi.fn(() => ({ select: mockSelect }))
const mockEqId = vi.fn(() => ({ is: mockIs, select: mockSelect, eq: mockEqId, maybeSingle: mockMaybeSingle }))
const mockUpdate = vi.fn(() => ({ eq: mockEqId }))
const mockSelectLookup = vi.fn(() => ({ eq: mockEqId, maybeSingle: mockMaybeSingle }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'users') return { select: mockSelectUsers }
  if (table === 'upload_batches') return { update: mockUpdate, select: mockSelectLookup }
  return { update: mockUpdate, select: mockSelectLookup }
})

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => true,
}))

import {
  claimBatchForClustering,
  releaseBatchClusteringClaim,
  resetBatchClusteringClaim,
} from '../enqueue-clustering'

const BATCH = '00000000-0000-0000-0000-000000000001'
const CREATOR = '00000000-0000-0000-0000-000000000002'

beforeEach(() => {
  mockMaybeSingle.mockReset()
  mockSingle.mockReset()
  mockUpdate.mockClear()
})

describe('claimBatchForClustering', () => {
  it('CAS succeeds → returns ok with creator + region', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: BATCH, creator_id: CREATOR },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({ data: { ai_region: 'us' }, error: null })

    const result = await claimBatchForClustering(BATCH)
    expect(result).toEqual({ ok: true, creatorId: CREATOR, aiRegion: 'us' })
  })

  it('defaults aiRegion to eu when user row missing', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: BATCH, creator_id: CREATOR },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await claimBatchForClustering(BATCH)
    expect(result).toEqual({ ok: true, creatorId: CREATOR, aiRegion: 'eu' })
  })

  it('CAS fails (already in flight) → already_in_flight', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: BATCH, clustering_started_at: '2026-04-28T00:00:00Z' },
      error: null,
    })
    const result = await claimBatchForClustering(BATCH)
    expect(result).toEqual({ ok: false, reason: 'already_in_flight' })
  })

  it('batch not found → not_found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await claimBatchForClustering(BATCH)
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('releaseBatchClusteringClaim', () => {
  it('runs without error on success path', async () => {
    await expect(releaseBatchClusteringClaim(BATCH)).resolves.toBeUndefined()
  })

  it('runs without error on failure path with errorMessage', async () => {
    await expect(
      releaseBatchClusteringClaim(BATCH, 'engine threw'),
    ).resolves.toBeUndefined()
  })
})

describe('resetBatchClusteringClaim', () => {
  it('returns ok=true when batch + creator match', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: BATCH }, error: null })
    const result = await resetBatchClusteringClaim(BATCH, CREATOR)
    expect(result).toEqual({ ok: true })
  })

  it('returns ok=false when no row matches (wrong creator OR not found)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const result = await resetBatchClusteringClaim(BATCH, CREATOR)
    expect(result).toEqual({ ok: false })
  })
})
