import { describe, it, expect } from 'vitest'
import { formatDateRange } from '../cluster-input'

describe('formatDateRange', () => {
  it('empty array → empty string', () => {
    expect(formatDateRange([])).toBe('')
  })

  it('all-null array → empty string', () => {
    expect(formatDateRange([null, null])).toBe('')
  })

  it('single date → "Mon DD, YYYY"', () => {
    expect(formatDateRange([new Date('2026-03-14T12:00:00Z')])).toBe(
      'Mar 14, 2026',
    )
  })

  it('two dates same day → single-date format', () => {
    expect(
      formatDateRange([
        new Date('2026-03-14T08:00:00Z'),
        new Date('2026-03-14T20:00:00Z'),
      ]),
    ).toBe('Mar 14, 2026')
  })

  it('two dates same month → "DD–DD Mon YYYY"', () => {
    expect(
      formatDateRange([
        new Date('2026-03-14T12:00:00Z'),
        new Date('2026-03-16T12:00:00Z'),
      ]),
    ).toBe('14–16 Mar 2026')
  })

  it('different months → full range', () => {
    expect(
      formatDateRange([
        new Date('2026-03-14T12:00:00Z'),
        new Date('2026-04-02T12:00:00Z'),
      ]),
    ).toBe('Mar 14, 2026 – Apr 2, 2026')
  })

  it('mixed null + valid → ignores null', () => {
    expect(
      formatDateRange([null, new Date('2026-03-14T12:00:00Z'), null]),
    ).toBe('Mar 14, 2026')
  })

  it('out-of-order dates are sorted', () => {
    expect(
      formatDateRange([
        new Date('2026-03-16T12:00:00Z'),
        new Date('2026-03-14T12:00:00Z'),
      ]),
    ).toBe('14–16 Mar 2026')
  })
})
