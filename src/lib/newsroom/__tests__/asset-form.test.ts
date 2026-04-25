// ═══════════════════════════════════════════════════════════════
// Frontfiles — Asset-form helper tests (NR-D7a, F8)
//
// Coverage for both halves of the IP-2 split:
//   - F7a: kindFromMime, extensionForMime, newsroomOriginalPath
//   - F7b: createAssetSchema, updateAssetMetadataSchema
//
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import {
  ASSET_CAPTION_MAX,
  ASSET_MAX_BYTES,
  extensionForMime,
  kindFromMime,
  newsroomOriginalPath,
} from '../asset-form-constants'
import {
  createAssetSchema,
  updateAssetMetadataSchema,
} from '../asset-form'

// ── Pure helpers ──────────────────────────────────────────────

describe('kindFromMime', () => {
  it('maps each accepted MIME to the right kind', () => {
    expect(kindFromMime('image/jpeg')).toBe('image')
    expect(kindFromMime('image/png')).toBe('image')
    expect(kindFromMime('image/webp')).toBe('image')
    expect(kindFromMime('image/gif')).toBe('image')
    expect(kindFromMime('video/mp4')).toBe('video')
    expect(kindFromMime('video/webm')).toBe('video')
    expect(kindFromMime('video/quicktime')).toBe('video')
    expect(kindFromMime('audio/mpeg')).toBe('audio')
    expect(kindFromMime('audio/wav')).toBe('audio')
    expect(kindFromMime('application/pdf')).toBe('document')
    expect(kindFromMime('text/plain')).toBe('text')
    expect(kindFromMime('text/markdown')).toBe('text')
  })

  it('returns null for unaccepted MIMEs', () => {
    expect(kindFromMime('application/zip')).toBeNull()
    expect(kindFromMime('image/svg+xml')).toBeNull()
    expect(kindFromMime('video/x-matroska')).toBeNull()
  })

  it('handles uppercase + whitespace defensively', () => {
    expect(kindFromMime('  Image/JPEG  ')).toBe('image')
    expect(kindFromMime('APPLICATION/PDF')).toBe('document')
  })
})

describe('extensionForMime', () => {
  it('maps each accepted MIME to its canonical extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('image/png')).toBe('png')
    expect(extensionForMime('video/mp4')).toBe('mp4')
    expect(extensionForMime('video/quicktime')).toBe('mov')
    expect(extensionForMime('audio/mpeg')).toBe('mp3')
    expect(extensionForMime('application/pdf')).toBe('pdf')
    expect(extensionForMime('text/markdown')).toBe('md')
  })

  it('returns null for unaccepted MIMEs', () => {
    expect(extensionForMime('application/zip')).toBeNull()
  })

  it('agrees with kindFromMime on the accepted set', () => {
    // Property check: every MIME accepted by kindFromMime must
    // also have a canonical extension. Drift between the two is
    // caught at INSERT time in F5 but better to catch here too.
    const sample = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
      'audio/aac',
      'audio/ogg',
      'application/pdf',
      'text/plain',
      'text/markdown',
    ]
    for (const mime of sample) {
      expect(kindFromMime(mime)).not.toBeNull()
      expect(extensionForMime(mime)).not.toBeNull()
    }
  })
})

describe('newsroomOriginalPath', () => {
  it('produces the canonical path shape', () => {
    expect(newsroomOriginalPath('p1', 'a1', 'jpg')).toBe(
      'newsroom/packs/p1/assets/a1/original.jpg',
    )
  })

  it('preserves the extension argument verbatim', () => {
    expect(newsroomOriginalPath('p', 'a', 'mov')).toBe(
      'newsroom/packs/p/assets/a/original.mov',
    )
  })
})

// ── Schemas ───────────────────────────────────────────────────

const VALID_IMAGE = {
  filename: 'photo.jpg',
  mime_type: 'image/jpeg',
  file_size_bytes: 1024 * 1024,
  checksum_sha256: 'a'.repeat(64),
  kind: 'image',
  width: 1920,
  height: 1080,
}

const VALID_VIDEO = {
  filename: 'clip.mp4',
  mime_type: 'video/mp4',
  file_size_bytes: 50 * 1024 * 1024,
  checksum_sha256: 'b'.repeat(64),
  kind: 'video',
  width: 1280,
  height: 720,
  duration_seconds: 30,
}

const VALID_AUDIO = {
  filename: 'voice.mp3',
  mime_type: 'audio/mpeg',
  file_size_bytes: 5 * 1024 * 1024,
  checksum_sha256: 'c'.repeat(64),
  kind: 'audio',
  duration_seconds: 60,
}

describe('createAssetSchema', () => {
  it('accepts a valid image payload', () => {
    expect(createAssetSchema.safeParse(VALID_IMAGE).success).toBe(true)
  })

  it('accepts a valid video payload', () => {
    expect(createAssetSchema.safeParse(VALID_VIDEO).success).toBe(true)
  })

  it('accepts a valid audio payload', () => {
    expect(createAssetSchema.safeParse(VALID_AUDIO).success).toBe(true)
  })

  it('rejects an image without width', () => {
    const { width: _w, ...rest } = VALID_IMAGE
    void _w
    expect(createAssetSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects an image without height', () => {
    const { height: _h, ...rest } = VALID_IMAGE
    void _h
    expect(createAssetSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a video without duration', () => {
    const { duration_seconds: _d, ...rest } = VALID_VIDEO
    void _d
    expect(createAssetSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects an audio without duration', () => {
    const { duration_seconds: _d, ...rest } = VALID_AUDIO
    void _d
    expect(createAssetSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects oversized files (> ASSET_MAX_BYTES)', () => {
    const oversize = {
      ...VALID_IMAGE,
      file_size_bytes: ASSET_MAX_BYTES + 1,
    }
    expect(createAssetSchema.safeParse(oversize).success).toBe(false)
  })

  it('accepts files at exactly ASSET_MAX_BYTES', () => {
    const max = { ...VALID_IMAGE, file_size_bytes: ASSET_MAX_BYTES }
    expect(createAssetSchema.safeParse(max).success).toBe(true)
  })

  it('rejects bad checksum format (not 64 hex chars)', () => {
    const bad1 = { ...VALID_IMAGE, checksum_sha256: 'too-short' }
    const bad2 = { ...VALID_IMAGE, checksum_sha256: 'A'.repeat(64) }
    const bad3 = { ...VALID_IMAGE, checksum_sha256: 'g'.repeat(64) }
    expect(createAssetSchema.safeParse(bad1).success).toBe(false)
    expect(createAssetSchema.safeParse(bad2).success).toBe(false)
    expect(createAssetSchema.safeParse(bad3).success).toBe(false)
  })

  it('rejects an unaccepted kind', () => {
    const bad = { ...VALID_IMAGE, kind: 'archive' }
    expect(createAssetSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative file sizes', () => {
    const bad = { ...VALID_IMAGE, file_size_bytes: -1 }
    expect(createAssetSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts document/text without dimensions', () => {
    const doc = {
      filename: 'press.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 200 * 1024,
      checksum_sha256: 'd'.repeat(64),
      kind: 'document',
    }
    expect(createAssetSchema.safeParse(doc).success).toBe(true)
  })
})

describe('updateAssetMetadataSchema', () => {
  it('rejects an empty object', () => {
    expect(updateAssetMetadataSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a single-field caption update', () => {
    expect(
      updateAssetMetadataSchema.safeParse({ caption: 'hi' }).success,
    ).toBe(true)
  })

  it('accepts an alt_text-only update', () => {
    expect(
      updateAssetMetadataSchema.safeParse({ alt_text: 'a logo' }).success,
    ).toBe(true)
  })

  it('accepts an is_trademark_asset-only update', () => {
    expect(
      updateAssetMetadataSchema.safeParse({ is_trademark_asset: true })
        .success,
    ).toBe(true)
  })

  it('accepts caption set to null (clear)', () => {
    expect(
      updateAssetMetadataSchema.safeParse({ caption: null }).success,
    ).toBe(true)
  })

  it('rejects caption longer than ASSET_CAPTION_MAX', () => {
    const long = 'x'.repeat(ASSET_CAPTION_MAX + 1)
    expect(
      updateAssetMetadataSchema.safeParse({ caption: long }).success,
    ).toBe(false)
  })

  it('accepts a multi-field update', () => {
    expect(
      updateAssetMetadataSchema.safeParse({
        caption: 'caption',
        alt_text: 'alt',
        is_trademark_asset: false,
      }).success,
    ).toBe(true)
  })
})
