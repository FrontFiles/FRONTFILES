// ═══════════════════════════════════════════════════════════════
// money-display — pure-helper tests (§R6-pure / §F10)
//
// 4 test cases per §F10: buyer-view × {EUR, USD}, creator-view ×
// {EUR, USD}. Full-string equality assertions per Prompt 3 dispatch
// (§F3 contract) — the money line is short + unambiguous, so
// substring asserts would mask whitespace / punctuation drift.
//
// IP-D (D-1b) ratification binds the buyer-view shape: `gross_fee`
// renders on both sides of the final separator (single-rate v1,
// per ECONOMIC_FLOW_v1 L91).
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import { formatGrossFee } from '@/lib/offer/money-display'

describe('formatGrossFee — buyer view (IP-D (D-1b) single-rate v1)', () => {
  it('EUR: 1,000.00 gross at 2000 bps renders the buyer line with repeated gross value', () => {
    const result = formatGrossFee(1000, 'EUR', 2000, 'buyer')
    expect(result).toBe(
      '1,000.00 EUR · platform fee 20% · you pay 1,000.00 EUR',
    )
  })

  it('USD: 500.00 gross at 1500 bps renders the buyer line with repeated gross value', () => {
    const result = formatGrossFee(500, 'USD', 1500, 'buyer')
    expect(result).toBe(
      '500.00 USD · platform fee 15% · you pay 500.00 USD',
    )
  })
})

describe('formatGrossFee — creator view (net = gross × (10000 − bps) / 10000)', () => {
  it('EUR: 1,000.00 gross at 2000 bps (Direct 80/20) renders "you receive 800.00 EUR"', () => {
    // 1000 × (10000 − 2000) / 10000 = 800.00
    const result = formatGrossFee(1000, 'EUR', 2000, 'creator')
    expect(result).toBe(
      '1,000.00 EUR · platform fee 20% · you receive 800.00 EUR',
    )
  })

  it('USD: 500.00 gross at 1500 bps (§F16 default) renders "you receive 425.00 USD"', () => {
    // 500 × (10000 − 1500) / 10000 = 425.00
    const result = formatGrossFee(500, 'USD', 1500, 'creator')
    expect(result).toBe(
      '500.00 USD · platform fee 15% · you receive 425.00 USD',
    )
  })
})
