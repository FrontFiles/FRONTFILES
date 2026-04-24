/**
 * Frontfiles — receipt-terms.ts unit tests (NR-D4, T3)
 *
 * Covers per-class composition (FF-* classes emit the no-modify
 * and AI-not-permitted clauses; CC classes don't), trademark
 * clause (PRD §2.6 canonical 2-sentence form), and credit-line
 * interpolation.
 */

import { describe, expect, it } from 'vitest'

import { generateReceiptTerms } from '@/lib/newsroom/receipt-terms'

describe('generateReceiptTerms — FF-* classes (non-trademark)', () => {
  it('press_release_verbatim: 4 sentences (label, credit, no-alter, no-AI)', () => {
    const out = generateReceiptTerms({
      licenceClass: 'press_release_verbatim',
      creditLine: 'Nike',
    })
    expect(out).toBe(
      'Press release (verbatim). Credit: Nike. Do not alter the asset. AI training not permitted by this source.',
    )
  })

  it('editorial_use_only: 4 sentences', () => {
    const out = generateReceiptTerms({
      licenceClass: 'editorial_use_only',
      creditLine: 'Nike',
    })
    expect(out).toBe(
      'Editorial use only. Credit: Nike. Do not alter the asset. AI training not permitted by this source.',
    )
  })

  it('promotional_use: 4 sentences', () => {
    const out = generateReceiptTerms({
      licenceClass: 'promotional_use',
      creditLine: 'Nike',
    })
    expect(out).toBe(
      'Promotional use. Credit: Nike. Do not alter the asset. AI training not permitted by this source.',
    )
  })
})

describe('generateReceiptTerms — CC classes (non-trademark)', () => {
  it('cc_public_domain: 2 sentences (no alter/AI clauses)', () => {
    const out = generateReceiptTerms({
      licenceClass: 'cc_public_domain',
      creditLine: 'CERN',
    })
    expect(out).toBe('CC0 Public Domain. Credit: CERN.')
    expect(out).not.toContain('Do not alter')
    expect(out).not.toContain('AI training')
  })

  it('cc_attribution: 2 sentences (no alter/AI clauses)', () => {
    const out = generateReceiptTerms({
      licenceClass: 'cc_attribution',
      creditLine: 'Alice Rivers',
    })
    expect(out).toBe('CC Attribution 4.0. Credit: Alice Rivers.')
    expect(out).not.toContain('Do not alter')
    expect(out).not.toContain('AI training')
  })
})

describe('generateReceiptTerms — trademark overlay (PRD §2.6)', () => {
  it('cc_public_domain + trademark: appends 2-sentence notice', () => {
    const out = generateReceiptTerms({
      licenceClass: 'cc_public_domain',
      creditLine: 'CERN',
      isTrademarkAsset: true,
    })
    expect(out).toBe(
      'CC0 Public Domain. Credit: CERN. Trademark and brand rights retained by CERN. The licence above does not grant trademark rights.',
    )
  })

  it('press_release_verbatim + trademark: all five clauses in order', () => {
    const out = generateReceiptTerms({
      licenceClass: 'press_release_verbatim',
      creditLine: 'Nike',
      isTrademarkAsset: true,
    })
    expect(out).toBe(
      'Press release (verbatim). Credit: Nike. Do not alter the asset. AI training not permitted by this source. Trademark and brand rights retained by Nike. The licence above does not grant trademark rights.',
    )
  })

  it('isTrademarkAsset=false: no trademark clause', () => {
    const out = generateReceiptTerms({
      licenceClass: 'promotional_use',
      creditLine: 'Nike',
      isTrademarkAsset: false,
    })
    expect(out).not.toContain('Trademark and brand rights retained by')
    expect(out).not.toContain(
      'The licence above does not grant trademark rights.',
    )
  })
})

describe('generateReceiptTerms — credit-line interpolation', () => {
  it('accepts credit line with special chars (plain text, no HTML escape)', () => {
    const out = generateReceiptTerms({
      licenceClass: 'cc_attribution',
      creditLine: 'Photo: "Ana" & Co <Press>',
    })
    // Plain-text output: do NOT HTML-escape here.
    expect(out).toBe(
      'CC Attribution 4.0. Credit: Photo: "Ana" & Co <Press>.',
    )
  })
})
