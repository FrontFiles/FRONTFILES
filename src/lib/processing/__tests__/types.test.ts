import { describe, it, expect } from 'vitest'
import {
  computeOutputDimensions,
  resolveTemplateFamily,
  shortAssetId,
  IMAGE_DERIVATIVE_SPECS,
  INTRUSION_LEVELS,
} from '../types'

// ══════════════════════════════════════════════
// computeOutputDimensions
// ══════════════════════════════════════════════

describe('computeOutputDimensions', () => {
  describe('short-edge mode', () => {
    it('scales landscape image by short edge', () => {
      const result = computeOutputDimensions(4000, 3000, { sizeMode: 'short-edge', targetPx: 400 })
      expect(result.height).toBe(400)
      expect(result.width).toBe(533) // 4000/3000 * 400 ≈ 533
    })

    it('scales portrait image by short edge', () => {
      const result = computeOutputDimensions(3000, 4000, { sizeMode: 'short-edge', targetPx: 400 })
      expect(result.width).toBe(400)
      expect(result.height).toBe(533)
    })

    it('scales square image correctly', () => {
      const result = computeOutputDimensions(2000, 2000, { sizeMode: 'short-edge', targetPx: 400 })
      expect(result.width).toBe(400)
      expect(result.height).toBe(400)
    })

    it('does not upscale when original is smaller than target', () => {
      const result = computeOutputDimensions(300, 200, { sizeMode: 'short-edge', targetPx: 400 })
      expect(result.width).toBe(300)
      expect(result.height).toBe(200)
    })
  })

  describe('long-edge mode', () => {
    it('scales landscape image by long edge', () => {
      const result = computeOutputDimensions(4000, 3000, { sizeMode: 'long-edge', targetPx: 1600 })
      expect(result.width).toBe(1600)
      expect(result.height).toBe(1200) // 3000/4000 * 1600 = 1200
    })

    it('scales portrait image by long edge', () => {
      const result = computeOutputDimensions(3000, 4000, { sizeMode: 'long-edge', targetPx: 1600 })
      expect(result.height).toBe(1600)
      expect(result.width).toBe(1200)
    })

    it('does not upscale when original is smaller than target', () => {
      const result = computeOutputDimensions(800, 600, { sizeMode: 'long-edge', targetPx: 1600 })
      expect(result.width).toBe(800)
      expect(result.height).toBe(600)
    })
  })

  describe('fixed mode', () => {
    it('returns fixed dimensions for OG image', () => {
      const result = computeOutputDimensions(4000, 3000, { sizeMode: 'fixed', targetPx: 1200, fixedHeight: 630 })
      expect(result.width).toBe(1200)
      expect(result.height).toBe(630)
    })

    it('returns fixed dimensions regardless of original orientation', () => {
      const result = computeOutputDimensions(3000, 4000, { sizeMode: 'fixed', targetPx: 1200, fixedHeight: 630 })
      expect(result.width).toBe(1200)
      expect(result.height).toBe(630)
    })
  })
})

// ══════════════════════════════════════════════
// resolveTemplateFamily
// ══════════════════════════════════════════════

describe('resolveTemplateFamily', () => {
  it('returns portrait for tall images', () => {
    expect(resolveTemplateFamily(1080, 1920)).toBe('portrait')
  })

  it('returns landscape for wide images', () => {
    expect(resolveTemplateFamily(1920, 1080)).toBe('landscape')
  })

  it('returns portrait for square images (h >= w)', () => {
    expect(resolveTemplateFamily(1000, 1000)).toBe('portrait')
  })
})

// ══════════════════════════════════════════════
// shortAssetId
// ══════════════════════════════════════════════

describe('shortAssetId', () => {
  it('strips asset- prefix and takes first 7 chars', () => {
    expect(shortAssetId('asset-abc1234567890')).toBe('abc1234')
  })

  it('handles IDs without prefix', () => {
    expect(shortAssetId('952be73def')).toBe('952be73')
  })

  it('handles short IDs', () => {
    expect(shortAssetId('abc')).toBe('abc')
  })
})

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

describe('IMAGE_DERIVATIVE_SPECS', () => {
  it('has exactly 3 specs', () => {
    expect(IMAGE_DERIVATIVE_SPECS).toHaveLength(3)
  })

  it('thumbnail is not watermarked', () => {
    const thumb = IMAGE_DERIVATIVE_SPECS.find(s => s.role === 'thumbnail')
    expect(thumb).toBeDefined()
    expect(thumb!.watermarked).toBe(false)
  })

  it('watermarked_preview is watermarked', () => {
    const preview = IMAGE_DERIVATIVE_SPECS.find(s => s.role === 'watermarked_preview')
    expect(preview).toBeDefined()
    expect(preview!.watermarked).toBe(true)
  })

  it('og_image is watermarked', () => {
    const og = IMAGE_DERIVATIVE_SPECS.find(s => s.role === 'og_image')
    expect(og).toBeDefined()
    expect(og!.watermarked).toBe(true)
  })
})

describe('INTRUSION_LEVELS', () => {
  it('has exactly 3 levels', () => {
    expect(INTRUSION_LEVELS).toHaveLength(3)
  })

  it('contains light, standard, heavy', () => {
    expect(INTRUSION_LEVELS).toContain('light')
    expect(INTRUSION_LEVELS).toContain('standard')
    expect(INTRUSION_LEVELS).toContain('heavy')
  })
})
