import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: () => ({ insert: vi.fn() }) }),
  isSupabaseConfigured: () => false,
}))

import { guardCaption } from '../caption-guard'

const ASSET = '00000000-0000-0000-0000-000000000001'

describe('guardCaption', () => {
  it('returns short caption unchanged', async () => {
    const c = 'A short caption.'
    expect(await guardCaption(c, ASSET)).toBe(c)
  })

  it('returns 200-char caption unchanged (boundary)', async () => {
    const c = 'a'.repeat(200)
    expect(await guardCaption(c, ASSET)).toBe(c)
  })

  it('truncates over-200 caption at word boundary + adds "..."', async () => {
    const c =
      'word '.repeat(50) + 'word' // 250+ chars; spaces present
    const result = await guardCaption(c, ASSET)
    expect(result.length).toBeLessThanOrEqual(200)
    expect(result.endsWith('...')).toBe(true)
    expect(result).not.toContain('   ') // no triple-spaces from cut mid-space
  })

  it('hard-cuts at 197 + "..." when no whitespace in first 197 chars', async () => {
    const c = 'a'.repeat(250) // no spaces
    const result = await guardCaption(c, ASSET)
    expect(result.length).toBeLessThanOrEqual(200)
    expect(result.endsWith('...')).toBe(true)
  })
})
