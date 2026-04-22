/**
 * Frontfiles — pricing.ts unit tests (P4 concern 4A.2 Part A)
 *
 * Banker's rounding, sum-invariance, and currency display coverage.
 */

import { describe, expect, it } from 'vitest'

import {
  feeBreakdown,
  formatCurrency,
  netToCreator,
  platformFeeAmount,
} from '@/lib/offer/pricing'

describe('netToCreator', () => {
  it('computes exact amounts at integer-cent precision', () => {
    // 10000 * (10000 - 1500) / 10000 = 8500.00
    expect(netToCreator(10000, 1500)).toBe(8500)
  })

  it('handles 0 bps (creator keeps everything)', () => {
    expect(netToCreator(10000, 0)).toBe(10000)
  })

  it('handles 10000 bps (creator keeps nothing)', () => {
    expect(netToCreator(10000, 10000)).toBe(0)
  })

  it("applies banker's rounding at half-cent edges", () => {
    // Construct a case where the cents-space value is exactly .5.
    // grossFee = 12345.67, bps = 1234 →
    //   netInCents = 1234567 * (10000 - 1234) / 10000
    //             = 1234567 * 8766 / 10000
    //             = 10823564.322  (not .5, pick a cleaner case below)
    //
    // Use a constructed-exact-half case:
    //   100 * (10000 - 1) / 10000 = 99.99
    //   0.05 * 10 = 0.5 exactly in cents → 0 cents after round-half-even.
    // We verify the implementation's branch by feeding 0.5-in-cents
    // values through roundHalfEven and asserting the tied-to-even
    // behaviour:
    //   grossFee = 0.05, bps = 0 → netInCents = 5.0 → rounds to 5 (odd → odd)
    //   Actually 5 is odd; round-half-even on 0.5 → 0 (even); on 1.5 → 2.
    // Exercise this directly against netToCreator:
    //   grossFee = 0.005, bps = 0 → netInCents = 0.5 → round-half-even → 0.
    expect(netToCreator(0.005, 0)).toBe(0)
    //   grossFee = 0.015, bps = 0 → netInCents = 1.5 → round-half-even → 2.
    expect(netToCreator(0.015, 0)).toBe(0.02)
  })
})

describe('platformFeeAmount + netToCreator sum invariance', () => {
  const cases: ReadonlyArray<[number, number]> = [
    [10000, 1500],
    [12345.67, 1234],
    [999.99, 2500],
    [0.01, 500],
    [100000, 0],
    [100, 10000],
  ]
  for (const [gross, bps] of cases) {
    it(`gross=${gross} bps=${bps} → fee + net === gross`, () => {
      const net = netToCreator(gross, bps)
      const fee = platformFeeAmount(gross, bps)
      // Compare in cent-space to avoid float noise.
      expect(Math.round((net + fee) * 100)).toBe(Math.round(gross * 100))
    })
  }
})

describe('formatCurrency', () => {
  // Intl.NumberFormat output varies by runtime locale (e.g. "€8,500.00"
  // vs "8.500,00 €" vs "8 500,00 €"). Normalise to digits-only and
  // check for currency code / symbol separately so the assertions
  // hold across platforms.
  function digitsOnly(s: string): string {
    return s.replace(/\D/g, '')
  }

  it('formats a EUR value', () => {
    const s = formatCurrency(8500, 'EUR')
    expect(digitsOnly(s)).toContain('850000')
    expect(s.toLowerCase()).toMatch(/eur|€/)
  })

  it('formats a USD value', () => {
    const s = formatCurrency(100, 'USD')
    expect(digitsOnly(s)).toContain('10000')
    expect(s.toLowerCase()).toMatch(/usd|\$/)
  })

  it('formats a GBP value', () => {
    const s = formatCurrency(50, 'GBP')
    expect(digitsOnly(s)).toContain('5000')
    expect(s.toLowerCase()).toMatch(/gbp|£/)
  })

  it('rejects a non-3-letter currency code', () => {
    expect(() => formatCurrency(100, 'EU')).toThrow()
    expect(() => formatCurrency(100, 'EURO')).toThrow()
  })
})

describe('feeBreakdown', () => {
  it('returns numeric + display fields that sum to gross', () => {
    const b = feeBreakdown(12345.67, 1500, 'EUR')
    expect(Math.round((b.netToCreator + b.platformFee) * 100)).toBe(
      Math.round(b.gross * 100),
    )
    expect(b.currency).toBe('EUR')
    expect(typeof b.displayGross).toBe('string')
    expect(typeof b.displayPlatformFee).toBe('string')
    expect(typeof b.displayNetToCreator).toBe('string')
  })
})
