import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockEq2 = vi.fn(() => ({
  eq: mockEq2,
  maybeSingle: mockMaybeSingle,
}))
const mockSelect = vi.fn(() => ({ eq: mockEq2 }))
const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => true,
}))

import { cacheRead, cacheWrite, buildInputHash } from '../cache'

beforeEach(() => {
  mockMaybeSingle.mockReset()
  mockInsert.mockReset()
})

describe('buildInputHash', () => {
  it('is deterministic — same input produces same hash', () => {
    expect(buildInputHash(['photo', 'tag1,tag2', 'abc'])).toBe(
      buildInputHash(['photo', 'tag1,tag2', 'abc']),
    )
  })

  it('different input produces different hash', () => {
    expect(buildInputHash(['photo', 'a'])).not.toBe(buildInputHash(['photo', 'b']))
  })

  it('order matters — array order affects hash', () => {
    expect(buildInputHash(['a', 'b'])).not.toBe(buildInputHash(['b', 'a']))
  })
})

describe('cacheRead', () => {
  const KEY = {
    subjectType: 'asset' as const,
    subjectId: '00000000-0000-0000-0000-000000000001',
    model: 'gemini-2.5-flash',
    modelVersion: 'gemini-2.5-flash',
    inputHash: 'deadbeef',
  }

  it('returns null on miss', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await cacheRead(KEY)).toBeNull()
  })

  it('returns shaped entry on hit', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        output: { caption: 'x' },
        token_input: 100,
        token_output: 30,
        cost_cents: 5,
        model_version: 'gemini-2.5-flash',
      },
      error: null,
    })
    const entry = await cacheRead(KEY)
    expect(entry).not.toBeNull()
    expect(entry!.inputTokens).toBe(100)
    expect(entry!.outputTokens).toBe(30)
    expect(entry!.costCents).toBe(5)
    expect(entry!.modelVersion).toBe('gemini-2.5-flash')
  })

  it('returns null on lookup error (does not propagate)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await cacheRead(KEY)).toBeNull()
  })
})

describe('cacheWrite', () => {
  it('inserts a row with correct shape', async () => {
    mockInsert.mockResolvedValue({ error: null })
    await cacheWrite(
      {
        subjectType: 'asset',
        subjectId: '00000000-0000-0000-0000-000000000001',
        model: 'gemini-2.5-flash',
        modelVersion: 'gemini-2.5-flash',
        inputHash: 'deadbeef',
      },
      {
        output: { foo: 'bar' },
        inputTokens: 100,
        outputTokens: 30,
        costCents: 5,
        region: 'europe-west4',
      },
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        subject_type: 'asset',
        subject_id: '00000000-0000-0000-0000-000000000001',
        model: 'gemini-2.5-flash',
        token_input: 100,
        cost_cents: 5,
      }),
    )
  })

  it('logs but does not throw on insert error', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'boom' } })
    await expect(
      cacheWrite(
        {
          subjectType: 'asset',
          subjectId: null,
          model: 'm',
          modelVersion: 'v',
          inputHash: 'h',
        },
        { output: {}, inputTokens: 0, outputTokens: 0, costCents: 0, region: 'us-central1' },
      ),
    ).resolves.toBeUndefined()
  })
})
