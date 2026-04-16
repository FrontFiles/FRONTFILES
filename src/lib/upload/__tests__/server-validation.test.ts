import { describe, it, expect } from 'vitest'

import {
  ALLOWED_IMAGE_MIMES,
  MAX_ORIGINAL_BYTES,
  sniffImageMime,
  validateUploadBytes,
} from '../server-validation'

// ── Fixtures ──────────────────────────────────────────────
//
// Minimal valid headers for each accepted format. These are not
// complete images — they are just enough bytes to satisfy the
// magic-byte sniff. The sniff is the contract under test; image
// decode happens later in the pipeline (via sharp).

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
])
const TIFF_LE_HEADER = Buffer.from([0x49, 0x49, 0x2a, 0x00])
const TIFF_BE_HEADER = Buffer.from([0x4d, 0x4d, 0x00, 0x2a])

describe('sniffImageMime', () => {
  it('detects JPEG', () => {
    expect(sniffImageMime(JPEG_HEADER)).toBe('image/jpeg')
  })
  it('detects PNG', () => {
    expect(sniffImageMime(PNG_HEADER)).toBe('image/png')
  })
  it('detects WebP', () => {
    expect(sniffImageMime(WEBP_HEADER)).toBe('image/webp')
  })
  it('detects TIFF little-endian', () => {
    expect(sniffImageMime(TIFF_LE_HEADER)).toBe('image/tiff')
  })
  it('detects TIFF big-endian', () => {
    expect(sniffImageMime(TIFF_BE_HEADER)).toBe('image/tiff')
  })
  it('returns null for unknown magic', () => {
    expect(sniffImageMime(Buffer.from('GIF89a'))).toBeNull()
    expect(sniffImageMime(Buffer.from('%PDF-1.7'))).toBeNull()
    expect(sniffImageMime(Buffer.from([0x00, 0x00]))).toBeNull()
  })
})

describe('validateUploadBytes', () => {
  it('accepts a valid JPEG with matching MIME', () => {
    const result = validateUploadBytes(JPEG_HEADER, 'image/jpeg')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.mime).toBe('image/jpeg')
  })

  it('accepts each whitelisted MIME family', () => {
    const pairs: Array<[Buffer, string]> = [
      [JPEG_HEADER, 'image/jpeg'],
      [PNG_HEADER, 'image/png'],
      [WEBP_HEADER, 'image/webp'],
      [TIFF_LE_HEADER, 'image/tiff'],
    ]
    for (const [bytes, mime] of pairs) {
      const result = validateUploadBytes(bytes, mime)
      expect(result.ok).toBe(true)
    }
  })

  it('rejects empty payload with code=empty', () => {
    const result = validateUploadBytes(Buffer.alloc(0), 'image/jpeg')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('empty')
  })

  it('rejects oversize payload with code=oversize', () => {
    const oversize = Buffer.concat([
      JPEG_HEADER,
      Buffer.alloc(MAX_ORIGINAL_BYTES + 1),
    ])
    const result = validateUploadBytes(oversize, 'image/jpeg')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('oversize')
  })

  it('rejects non-whitelisted MIME with code=mime_not_allowed', () => {
    const result = validateUploadBytes(JPEG_HEADER, 'image/gif')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('mime_not_allowed')
  })

  it('rejects declared MIME that disagrees with sniffed magic', () => {
    const result = validateUploadBytes(PNG_HEADER, 'image/jpeg')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('magic_mismatch')
  })

  it('rejects unknown magic with code=unknown_magic', () => {
    const result = validateUploadBytes(Buffer.from('not-an-image'), 'image/jpeg')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unknown_magic')
  })
})

describe('ALLOWED_IMAGE_MIMES', () => {
  it('is the four image families PR 2 accepts', () => {
    expect([...ALLOWED_IMAGE_MIMES].sort()).toEqual(
      ['image/jpeg', 'image/png', 'image/tiff', 'image/webp'],
    )
  })
})
