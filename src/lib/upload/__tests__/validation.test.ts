import { describe, it, expect } from 'vitest'
import { validateFile, detectFormat, formatFileSize } from '../validation'

function makeFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size > 0 ? 1 : 0)
  return new File([buffer], name, { type }) as unknown as File & { size: number }
}

// Override size since File constructor uses buffer length
function makeFileWithSize(name: string, size: number, type: string): File {
  const f = makeFile(name, 1, type)
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('validateFile', () => {
  it('rejects empty files', () => {
    const f = makeFileWithSize('empty.jpg', 0, 'image/jpeg')
    const result = validateFile(f, 'photo')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('file_empty')
  })

  it('accepts valid photo within size limit', () => {
    const f = makeFileWithSize('photo.jpg', 10 * 1024 * 1024, 'image/jpeg')
    const result = validateFile(f, 'photo')
    expect(result.valid).toBe(true)
    expect(result.format).toBe('photo')
  })

  it('rejects photo exceeding 200MB', () => {
    const f = makeFileWithSize('big.jpg', 201 * 1024 * 1024, 'image/jpeg')
    const result = validateFile(f, 'photo')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('file_size_exceeded')
  })

  it('rejects video file declared as photo', () => {
    const f = makeFileWithSize('video.mp4', 1024, 'video/mp4')
    const result = validateFile(f, 'photo')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('unsupported_format')
  })

  it('accepts valid video within 20GB limit', () => {
    const f = makeFileWithSize('clip.mp4', 500 * 1024 * 1024, 'video/mp4')
    const result = validateFile(f, 'video')
    expect(result.valid).toBe(true)
    expect(result.format).toBe('video')
  })

  it('accepts SVG as vector', () => {
    const f = makeFileWithSize('icon.svg', 1024, 'image/svg+xml')
    const result = validateFile(f, 'vector')
    expect(result.valid).toBe(true)
    expect(result.format).toBe('vector')
  })

  it('rejects vector exceeding 100MB', () => {
    const f = makeFileWithSize('huge.svg', 101 * 1024 * 1024, 'image/svg+xml')
    const result = validateFile(f, 'vector')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('file_size_exceeded')
  })
})

describe('detectFormat', () => {
  it('detects photo from image/jpeg', () => {
    expect(detectFormat(makeFile('a.jpg', 1, 'image/jpeg'))).toBe('photo')
  })

  it('detects video from video/mp4', () => {
    expect(detectFormat(makeFile('a.mp4', 1, 'video/mp4'))).toBe('video')
  })

  it('detects audio from audio/mpeg', () => {
    expect(detectFormat(makeFile('a.mp3', 1, 'audio/mpeg'))).toBe('audio')
  })

  it('detects text from application/pdf', () => {
    expect(detectFormat(makeFile('a.pdf', 1, 'application/pdf'))).toBe('text')
  })

  it('detects vector from image/svg+xml', () => {
    expect(detectFormat(makeFile('a.svg', 1, 'image/svg+xml'))).toBe('vector')
  })

  it('returns null for unknown type', () => {
    expect(detectFormat(makeFile('a.xyz', 1, 'application/octet-stream'))).toBe(null)
  })
})

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB')
  })
})
