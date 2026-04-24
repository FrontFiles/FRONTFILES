/**
 * Frontfiles — embed-snippet.ts unit tests (NR-D4, T2)
 *
 * Covers structure (PRD §5.3 J4 template), TDM meta presence/
 * absence per licence class (§2.7), HTML escaping of user-
 * authored fields, the PRD §2.6 canonical 2-sentence trademark
 * notice, and correction-notice date formatting.
 */

import { describe, expect, it } from 'vitest'

import { generateEmbedSnippet } from '@/lib/newsroom/embed-snippet'

const BASE = {
  renditionUrl: 'https://cdn.example.com/r/1.jpg',
  altText: 'Nike Air Max 2026 prototype on a studio backdrop',
  creditLine: 'Nike',
  packCanonicalUrl: 'https://newsroom.frontfiles.com/nike/am-2026',
  organizationName: 'Nike, Inc.',
} as const

describe('generateEmbedSnippet — structure (PRD §5.3 J4)', () => {
  it('renders <figure> with <img>, <figcaption>, licence link', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'editorial_use_only',
    })

    expect(s).toMatch(/^<figure>/)
    expect(s).toMatch(/<\/figure>$/)
    expect(s).toContain('<img src="https://cdn.example.com/r/1.jpg"')
    expect(s).toContain('<figcaption>')
    expect(s).toContain('</figcaption>')
    expect(s).toContain(
      '<a href="https://newsroom.frontfiles.com/nike/am-2026">',
    )
    // licence link (editorial_use_only → FF-EDU-1.0)
    expect(s).toContain(
      '<a href="https://frontfiles.com/licences/editorial-use-only/1.0">FF-EDU-1.0</a>',
    )
  })
})

describe('generateEmbedSnippet — TDM meta tags (PRD §2.7)', () => {
  it('press_release_verbatim (FF-*): TDM meta present', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'press_release_verbatim',
    })
    expect(s).toContain('<meta name="tdm-reservation" content="1">')
    expect(s).toContain(
      '<meta name="tdm-policy" content="https://frontfiles.com/licences/press-release-verbatim/1.0#tdm">',
    )
  })

  it('editorial_use_only (FF-*): TDM meta present', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'editorial_use_only',
    })
    expect(s).toContain('<meta name="tdm-reservation" content="1">')
    expect(s).toContain(
      '<meta name="tdm-policy" content="https://frontfiles.com/licences/editorial-use-only/1.0#tdm">',
    )
  })

  it('promotional_use (FF-*): TDM meta present', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'promotional_use',
    })
    expect(s).toContain('<meta name="tdm-reservation" content="1">')
    expect(s).toContain(
      '<meta name="tdm-policy" content="https://frontfiles.com/licences/promotional-use/1.0#tdm">',
    )
  })

  it('cc_attribution: TDM meta ABSENT (ai_training_permitted=true)', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'cc_attribution',
    })
    expect(s).not.toContain('tdm-reservation')
    expect(s).not.toContain('tdm-policy')
  })

  it('cc_public_domain: TDM meta ABSENT (ai_training_permitted=true)', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'cc_public_domain',
    })
    expect(s).not.toContain('tdm-reservation')
    expect(s).not.toContain('tdm-policy')
  })
})

describe('generateEmbedSnippet — HTML escaping', () => {
  it('escapes credit line special chars (& " \' < >)', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      creditLine: 'Photo: "Ana" & Co <Press>',
      licenceClass: 'editorial_use_only',
    })

    // Raw dangerous chars must not survive in the rendered output.
    expect(s).not.toContain('"Ana"')
    expect(s).not.toContain('<Press>')
    expect(s).not.toContain('& Co')
    expect(s).toContain('Photo: &quot;Ana&quot; &amp; Co &lt;Press&gt;')
  })

  it('escapes organization name', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      organizationName: 'Acme & Sons',
      licenceClass: 'editorial_use_only',
    })
    expect(s).toContain('Acme &amp; Sons')
    expect(s).not.toContain('Acme & Sons</a>')
  })

  it('escapes alt text inside the attribute', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      altText: 'Shot of "Ana" with <camera>',
      licenceClass: 'editorial_use_only',
    })
    expect(s).toContain(
      'alt="Shot of &quot;Ana&quot; with &lt;camera&gt;"',
    )
  })
})

describe('generateEmbedSnippet — trademark notice (PRD §2.6)', () => {
  it('isTrademarkAsset=true: renders the full 2-sentence notice', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'promotional_use',
      isTrademarkAsset: true,
    })
    expect(s).toContain('<small class="trademark-notice">')
    // Sentence 1: retention clause with credit line.
    expect(s).toContain('Trademark and brand rights retained by Nike.')
    // Sentence 2: load-bearing legal disclaimer.
    expect(s).toContain(
      'The licence above does not grant trademark rights.',
    )
  })

  it('isTrademarkAsset=true: escapes credit line inside the notice', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      creditLine: 'A&B',
      licenceClass: 'promotional_use',
      isTrademarkAsset: true,
    })
    expect(s).toContain('Trademark and brand rights retained by A&amp;B.')
  })

  it('isTrademarkAsset=false: neither sentence is present', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'promotional_use',
      isTrademarkAsset: false,
    })
    expect(s).not.toContain('trademark-notice')
    expect(s).not.toContain('Trademark and brand rights retained by')
    expect(s).not.toContain(
      'The licence above does not grant trademark rights.',
    )
  })

  it('isTrademarkAsset omitted: neither sentence is present', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'promotional_use',
    })
    expect(s).not.toContain('trademark-notice')
    expect(s).not.toContain('Trademark and brand rights retained by')
    expect(s).not.toContain(
      'The licence above does not grant trademark rights.',
    )
  })
})

describe('generateEmbedSnippet — correction notice', () => {
  it('lastCorrectedAt full ISO timestamp → date-only YYYY-MM-DD', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'editorial_use_only',
      lastCorrectedAt: '2026-03-15T10:00:00Z',
    })
    expect(s).toContain(
      '<small class="correction-notice">Last corrected: 2026-03-15</small>',
    )
  })

  it('lastCorrectedAt already date-only works unchanged', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'editorial_use_only',
      lastCorrectedAt: '2026-03-15',
    })
    expect(s).toContain(
      '<small class="correction-notice">Last corrected: 2026-03-15</small>',
    )
  })

  it('lastCorrectedAt omitted → no correction notice', () => {
    const s = generateEmbedSnippet({
      ...BASE,
      licenceClass: 'editorial_use_only',
    })
    expect(s).not.toContain('correction-notice')
    expect(s).not.toContain('Last corrected:')
  })
})
