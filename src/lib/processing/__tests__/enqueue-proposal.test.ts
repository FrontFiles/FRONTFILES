import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => true,
}))

import { enqueueAssetProposalRow } from '../enqueue-proposal'

const ASSET = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  mockInsert.mockReset()
})

describe('enqueueAssetProposalRow', () => {
  it('image format → status=pending', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const r = await enqueueAssetProposalRow(ASSET, 'photo')
    expect(r).toEqual({ kind: 'ok', status: 'pending' })
    expect(mockInsert).toHaveBeenCalledWith({
      asset_id: ASSET,
      generation_status: 'pending',
    })
  })

  it('illustration → status=pending', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const r = await enqueueAssetProposalRow(ASSET, 'illustration')
    expect(r).toEqual({ kind: 'ok', status: 'pending' })
  })

  it('non-image format → status=not_applicable', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const r = await enqueueAssetProposalRow(ASSET, 'video')
    expect(r).toEqual({ kind: 'ok', status: 'not_applicable' })
    expect(mockInsert).toHaveBeenCalledWith({
      asset_id: ASSET,
      generation_status: 'not_applicable',
    })
  })

  it('UNIQUE violation (23505) → already_exists (idempotent retry)', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    const r = await enqueueAssetProposalRow(ASSET, 'photo')
    expect(r).toEqual({ kind: 'already_exists' })
  })

  it('non-UNIQUE error → kind=error', async () => {
    mockInsert.mockResolvedValue({
      error: { code: '42501', message: 'permission denied' },
    })
    const r = await enqueueAssetProposalRow(ASSET, 'photo')
    expect(r).toEqual({ kind: 'error', message: 'permission denied' })
  })
})
