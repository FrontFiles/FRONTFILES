// Path contract — pinned against ARCHITECTURE-BRIEF §4.1.
// Each row in the table corresponds to a row in the brief's
// "Storage contract" table. Drift between the brief and the
// code surfaces here.

import { describe, it, expect } from 'vitest'

import {
  originalPath,
  derivativePath,
  validateStorageRef,
} from '../paths'
import { StorageRefError } from '../types'

describe('originalPath', () => {
  it('preserves the source filename per brief §4.2 rule 2', () => {
    expect(originalPath('a1b2c3d4', 'IMG_4521.jpeg')).toBe(
      'originals/a1b2c3d4/IMG_4521.jpeg',
    )
  })

  it('accepts filenames with spaces and parentheses', () => {
    expect(originalPath('abc', 'My Photo (1).jpg')).toBe(
      'originals/abc/My Photo (1).jpg',
    )
  })

  it('rejects traversal in filename', () => {
    expect(() => originalPath('abc', '../../etc/passwd')).toThrow(StorageRefError)
  })

  it('rejects slashes in filename', () => {
    expect(() => originalPath('abc', 'nested/file.jpg')).toThrow(StorageRefError)
  })

  it('rejects empty filename', () => {
    expect(() => originalPath('abc', '')).toThrow(StorageRefError)
  })

  it('rejects empty assetId', () => {
    expect(() => originalPath('', 'file.jpg')).toThrow(StorageRefError)
  })

  it('rejects slashes in assetId', () => {
    expect(() => originalPath('a/b', 'file.jpg')).toThrow(StorageRefError)
  })

  it('rejects dot-dot assetId', () => {
    expect(() => originalPath('..', 'file.jpg')).toThrow(StorageRefError)
  })
})

describe('derivativePath — brief §4.1 table', () => {
  const assetId = 'a1b2c3d4'

  const cases: ReadonlyArray<{
    role: 'thumbnail' | 'watermarked_preview' | 'og_image'
    expected: string
  }> = [
    { role: 'thumbnail', expected: 'derivatives/a1b2c3d4/thumbnail.jpg' },
    { role: 'watermarked_preview', expected: 'derivatives/a1b2c3d4/watermarked_preview.jpg' },
    { role: 'og_image', expected: 'derivatives/a1b2c3d4/og_image.jpg' },
  ]

  for (const { role, expected } of cases) {
    it(`builds the ${role} path`, () => {
      expect(derivativePath(assetId, role)).toBe(expected)
    })
  }

  it('rejects unknown role (typed error)', () => {
    expect(() =>
      // Force an invalid role to exercise the runtime guard.
      derivativePath(assetId, 'detail_preview' as never),
    ).toThrow(StorageRefError)
  })

  it('rejects empty assetId', () => {
    expect(() => derivativePath('', 'thumbnail')).toThrow(StorageRefError)
  })
})

describe('validateStorageRef — rejection cases (PR 1 exit criterion §4)', () => {
  it('rejects empty string', () => {
    expect(() => validateStorageRef('')).toThrow(StorageRefError)
  })

  it('rejects absolute path', () => {
    expect(() => validateStorageRef('/etc/passwd')).toThrow(StorageRefError)
  })

  it('rejects traversal via ..', () => {
    expect(() =>
      validateStorageRef('originals/abc/../../etc/passwd'),
    ).toThrow(StorageRefError)
  })

  it('rejects traversal via .', () => {
    expect(() => validateStorageRef('originals/./abc/file.jpg')).toThrow(
      StorageRefError,
    )
  })

  it('rejects backslash (Windows-style separator)', () => {
    expect(() => validateStorageRef('originals\\abc\\file.jpg')).toThrow(
      StorageRefError,
    )
  })

  it('rejects NUL byte', () => {
    expect(() => validateStorageRef('originals/abc/\0.jpg')).toThrow(
      StorageRefError,
    )
  })

  it('rejects empty segment (double slash)', () => {
    expect(() => validateStorageRef('originals//abc/file.jpg')).toThrow(
      StorageRefError,
    )
  })

  it('rejects trailing slash', () => {
    expect(() => validateStorageRef('originals/abc/')).toThrow(StorageRefError)
  })

  it('carries the typed error code', () => {
    try {
      validateStorageRef('/abs')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(StorageRefError)
      expect((err as StorageRefError).code).toBe('absolute')
    }
  })

  it('accepts a well-formed original ref', () => {
    expect(() =>
      validateStorageRef('originals/a1b2c3d4/IMG_4521.jpeg'),
    ).not.toThrow()
  })

  it('accepts a well-formed derivative ref', () => {
    expect(() =>
      validateStorageRef('derivatives/a1b2c3d4/thumbnail.jpg'),
    ).not.toThrow()
  })
})
