import { describe, it, expect } from 'vitest'
import { extractNameOrFallback } from '../cluster-naming'

describe('extractNameOrFallback', () => {
  it('returns valid 2-word name', () => {
    expect(extractNameOrFallback('Spring Festival', 'Mar 14, 2026')).toBe(
      'Spring Festival',
    )
  })

  it('returns valid 3-word name', () => {
    expect(extractNameOrFallback('Annual Spring Festival', 'fallback')).toBe(
      'Annual Spring Festival',
    )
  })

  it('returns valid 4-word name', () => {
    expect(
      extractNameOrFallback('The Annual Spring Festival', 'fallback'),
    ).toBe('The Annual Spring Festival')
  })

  it('strips surrounding quotes', () => {
    expect(extractNameOrFallback('"Spring Festival"', 'fallback')).toBe(
      'Spring Festival',
    )
    expect(extractNameOrFallback("'Spring Festival'", 'fallback')).toBe(
      'Spring Festival',
    )
  })

  it('1-word output → date-range fallback', () => {
    expect(extractNameOrFallback('Festival', 'Mar 14, 2026')).toBe(
      'Mar 14, 2026',
    )
  })

  it('5-word output → date-range fallback', () => {
    expect(
      extractNameOrFallback('The Annual Spring City Festival', 'Mar 14, 2026'),
    ).toBe('Mar 14, 2026')
  })

  it('empty output → date-range fallback', () => {
    expect(extractNameOrFallback('', 'Mar 14, 2026')).toBe('Mar 14, 2026')
    expect(extractNameOrFallback('   ', 'Mar 14, 2026')).toBe('Mar 14, 2026')
  })

  it('generic name → date-range fallback', () => {
    for (const generic of ['Photos', 'Images', 'Pictures', 'Group', 'photo', 'IMAGES']) {
      expect(extractNameOrFallback(generic, 'Mar 14, 2026')).toBe('Mar 14, 2026')
    }
  })

  it('returns null when no fallback available', () => {
    expect(extractNameOrFallback('', '')).toBe(null)
    expect(extractNameOrFallback('Photos', '')).toBe(null)
  })
})
