/**
 * Frontfiles — canonical-url.ts unit tests (NR-D4, T6)
 *
 * Covers the two exported base-URL constants and the three URL
 * builders. Slug shape is caller's concern; these tests only
 * assert string concatenation.
 */

import { describe, expect, it } from 'vitest'

import {
  newsroomOrgUrl,
  NEWSROOM_BASE_URL,
  packCanonicalUrl,
  RECEIPT_BASE_URL,
  receiptUrl,
} from '@/lib/newsroom/canonical-url'

describe('NEWSROOM_BASE_URL / RECEIPT_BASE_URL constants', () => {
  it('NEWSROOM_BASE_URL is the newsroom subdomain root', () => {
    expect(NEWSROOM_BASE_URL).toBe('https://newsroom.frontfiles.com')
  })

  it('RECEIPT_BASE_URL is the public receipts path', () => {
    expect(RECEIPT_BASE_URL).toBe('https://frontfiles.com/receipts')
  })
})

describe('packCanonicalUrl', () => {
  it('joins org + pack slug under the newsroom root', () => {
    expect(packCanonicalUrl('acme', 'launch-2026')).toBe(
      'https://newsroom.frontfiles.com/acme/launch-2026',
    )
  })

  it('does not validate slugs (caller concern)', () => {
    // Caller is responsible for slug shape; helper just concatenates.
    expect(packCanonicalUrl('ACME', 'Launch 2026')).toBe(
      'https://newsroom.frontfiles.com/ACME/Launch 2026',
    )
  })
})

describe('newsroomOrgUrl', () => {
  it('joins org slug under the newsroom root', () => {
    expect(newsroomOrgUrl('acme')).toBe(
      'https://newsroom.frontfiles.com/acme',
    )
  })
})

describe('receiptUrl', () => {
  it('joins receipt id under the receipts base', () => {
    expect(receiptUrl('abc-123')).toBe(
      'https://frontfiles.com/receipts/abc-123',
    )
  })
})
