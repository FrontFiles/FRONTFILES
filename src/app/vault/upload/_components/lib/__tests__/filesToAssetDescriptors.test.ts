/**
 * Frontfiles Upload V4 — filesToAssetDescriptors tests (D2.7 §6.2)
 *
 * Pure-helper tests per IPD7-12 = (b). Covers the format-detection
 * mapping (IPD7-4) and the thumbnailRef object-URL generation gating
 * (IPD7-5).
 *
 * Vitest's node environment lacks URL.createObjectURL — we stub it via
 * vi.stubGlobal so the helper's safe-create returns a deterministic
 * blob URL string.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { filesToAssetDescriptors } from '../filesToAssetDescriptors'

// Node test env doesn't have URL.createObjectURL. Stub it so the helper
// path that creates a thumbnail URL returns a deterministic string.
beforeAll(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (_file: Blob) => 'blob:test-stub',
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function makeFile(name: string, type: string, size = 100): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('filesToAssetDescriptors', () => {
  it('returns an empty array for an empty input', () => {
    expect(filesToAssetDescriptors([])).toEqual([])
  })

  it('detects photo format from image/jpeg + sets thumbnailRef to a blob URL', () => {
    const file = makeFile('hero.jpg', 'image/jpeg')
    const [d] = filesToAssetDescriptors([file])
    expect(d.format).toBe('photo')
    expect(d.thumbnailRef).toBe('blob:test-stub')
    expect(d.filename).toBe('hero.jpg')
    expect(d.fileSize).toBe(100)
    expect(d.file).toBe(file)
  })

  it('detects video format from video/mp4 + thumbnailRef stays null', () => {
    const [d] = filesToAssetDescriptors([makeFile('clip.mp4', 'video/mp4')])
    expect(d.format).toBe('video')
    expect(d.thumbnailRef).toBeNull()
  })

  it('detects audio format from audio/mpeg', () => {
    const [d] = filesToAssetDescriptors([makeFile('rally.mp3', 'audio/mpeg')])
    expect(d.format).toBe('audio')
    expect(d.thumbnailRef).toBeNull()
  })

  it('detects vector format from image/svg+xml (overrides image/* → photo)', () => {
    const [d] = filesToAssetDescriptors([makeFile('logo.svg', 'image/svg+xml')])
    expect(d.format).toBe('vector')
    // Vectors are renderable images but the helper gates blob URL on
    // 'photo' only — vectors render as text/code in browsers anyway.
    expect(d.thumbnailRef).toBeNull()
  })

  it('returns null format for an unknown extension + empty MIME', () => {
    const [d] = filesToAssetDescriptors([makeFile('thing.xyz', '')])
    expect(d.format).toBeNull()
    expect(d.thumbnailRef).toBeNull()
  })
})
