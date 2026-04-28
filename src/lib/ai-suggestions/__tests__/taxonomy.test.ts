import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNot = vi.fn()
const mockEq = vi.fn(() => ({ not: mockNot }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => true,
}))

import { fetchCreatorTagTaxonomy } from '../taxonomy'

beforeEach(() => {
  mockNot.mockReset()
})

const CREATOR = '00000000-0000-0000-0000-000000000001'

describe('fetchCreatorTagTaxonomy', () => {
  it('returns empty when creator has no assets', async () => {
    mockNot.mockResolvedValue({ data: [], error: null })
    expect(await fetchCreatorTagTaxonomy(CREATOR, 50)).toEqual([])
  })

  it('returns empty when creator has assets but no tags', async () => {
    mockNot.mockResolvedValue({ data: [{ tags: null }], error: null })
    expect(await fetchCreatorTagTaxonomy(CREATOR, 50)).toEqual([])
  })

  it('returns top-N by count DESC with alphabetical tie-break', async () => {
    mockNot.mockResolvedValue({
      data: [
        { tags: ['urban', 'bike', 'evening'] },
        { tags: ['urban', 'bike', 'morning'] },
        { tags: ['urban', 'street', 'morning'] },
      ],
      error: null,
    })
    const result = await fetchCreatorTagTaxonomy(CREATOR, 5)
    // urban=3, bike=2, morning=2, evening=1, street=1
    // tie-break: bike < morning (alpha); evening < street (alpha)
    expect(result).toEqual(['urban', 'bike', 'morning', 'evening', 'street'])
  })

  it('limits to topN', async () => {
    mockNot.mockResolvedValue({
      data: [{ tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }],
      error: null,
    })
    const result = await fetchCreatorTagTaxonomy(CREATOR, 3)
    expect(result.length).toBe(3)
  })

  it('throws on supabase error', async () => {
    mockNot.mockResolvedValue({ data: null, error: { message: 'connection lost' } })
    await expect(fetchCreatorTagTaxonomy(CREATOR, 50)).rejects.toThrow(/connection lost/)
  })
})
