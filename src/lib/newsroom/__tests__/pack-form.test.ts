// ═══════════════════════════════════════════════════════════════
// Frontfiles — Pack-form helpers tests (NR-D6b, F8)
//
// Coverage for both halves of the IP-1 split:
//   - F7a: slugify() + SLUG_FORMAT (pack-form-constants.ts)
//   - F7b: createPackSchema, updatePackSchema (pack-form.ts)
//
// Both files are imported here. Vitest runs server-side, so the
// 'server-only' marker on F7b doesn't block the import.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import {
  PACK_SLUG_MAX,
  SLUG_FORMAT,
  slugify,
} from '../pack-form-constants'
import { createPackSchema, updatePackSchema } from '../pack-form'

const VALID_PAYLOAD = {
  title: 'Q3 product launch',
  subtitle: 'For embargoed press',
  description: 'Press kit for the Q3 launch — images, fact sheet, contacts.',
  credit_line: 'Photo: Acme',
  licence_class: 'press_release_verbatim',
  slug: 'q3-product-launch',
}

describe('slugify', () => {
  it('lowercases and hyphenates a simple title', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips combining marks via NFKD normalisation', () => {
    expect(slugify('São Paulo & Co.')).toBe('sao-paulo-co')
  })

  it('trims surrounding whitespace and collapses inner runs', () => {
    expect(slugify('   spaces   ')).toBe('spaces')
    expect(slugify('multiple   spaces   here')).toBe('multiple-spaces-here')
  })

  it('falls back to "pack" when the input is all symbols', () => {
    expect(slugify('!!@@##')).toBe('pack')
  })

  it('truncates a 100-char title to PACK_SLUG_MAX (60)', () => {
    const long = 'a'.repeat(100)
    const result = slugify(long)
    expect(result.length).toBeLessThanOrEqual(PACK_SLUG_MAX)
    expect(result).toMatch(SLUG_FORMAT)
  })

  it('is idempotent on already-slug-shaped input', () => {
    expect(slugify('valid-slug')).toBe('valid-slug')
    expect(slugify(slugify('Hello World'))).toBe('hello-world')
  })

  it('output always satisfies SLUG_FORMAT (property check)', () => {
    const samples = [
      'Hello World',
      'São Paulo & Co.',
      '!!@@##',
      'a'.repeat(100),
      'foo--bar', // doubled hyphens collapse
      '-leading-and-trailing-',
      'CamelCase Title',
      '中文 mixed 한글',
      'q3-product-launch',
    ]
    for (const s of samples) {
      const out = slugify(s)
      expect(out).toMatch(SLUG_FORMAT)
    }
  })
})

describe('createPackSchema', () => {
  it('accepts a valid full payload', () => {
    const r = createPackSchema.safeParse(VALID_PAYLOAD)
    expect(r.success).toBe(true)
  })

  it('rejects missing title', () => {
    const { title: _t, ...rest } = VALID_PAYLOAD
    void _t
    const r = createPackSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects empty title', () => {
    const r = createPackSchema.safeParse({ ...VALID_PAYLOAD, title: '' })
    expect(r.success).toBe(false)
  })

  it('rejects missing description', () => {
    const { description: _d, ...rest } = VALID_PAYLOAD
    void _d
    const r = createPackSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects invalid licence_class', () => {
    const r = createPackSchema.safeParse({
      ...VALID_PAYLOAD,
      licence_class: 'editorial_extended', // not in enum
    })
    expect(r.success).toBe(false)
  })

  it('rejects slug that exceeds PACK_SLUG_MAX', () => {
    const r = createPackSchema.safeParse({
      ...VALID_PAYLOAD,
      slug: 'a'.repeat(PACK_SLUG_MAX + 1),
    })
    expect(r.success).toBe(false)
  })

  it('rejects slug with bad format (uppercase)', () => {
    const r = createPackSchema.safeParse({
      ...VALID_PAYLOAD,
      slug: 'BadSlug',
    })
    expect(r.success).toBe(false)
  })

  it('rejects slug with leading hyphen', () => {
    const r = createPackSchema.safeParse({
      ...VALID_PAYLOAD,
      slug: '-leading',
    })
    expect(r.success).toBe(false)
  })

  it('accepts subtitle as null', () => {
    const r = createPackSchema.safeParse({ ...VALID_PAYLOAD, subtitle: null })
    expect(r.success).toBe(true)
  })

  it('accepts all 5 valid licence_class values', () => {
    const valid = [
      'press_release_verbatim',
      'editorial_use_only',
      'promotional_use',
      'cc_attribution',
      'cc_public_domain',
    ]
    for (const v of valid) {
      const r = createPackSchema.safeParse({
        ...VALID_PAYLOAD,
        licence_class: v,
      })
      expect(r.success).toBe(true)
    }
  })
})

describe('updatePackSchema', () => {
  it('rejects an empty object (refine)', () => {
    const r = updatePackSchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it('accepts a single-field update', () => {
    const r = updatePackSchema.safeParse({ title: 'Updated title' })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid field even when partial', () => {
    const r = updatePackSchema.safeParse({ slug: 'BadSlug' })
    expect(r.success).toBe(false)
  })

  it('accepts a multi-field update', () => {
    const r = updatePackSchema.safeParse({
      title: 'New title',
      description: 'New description',
    })
    expect(r.success).toBe(true)
  })
})
