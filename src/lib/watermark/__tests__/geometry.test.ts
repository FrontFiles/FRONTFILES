import { describe, it, expect } from 'vitest'
import { selectTier, computeGeometry, resolveOrientation } from '../geometry'

describe('selectTier', () => {
  it('returns canonical at S=600', () => {
    expect(selectTier(600)).toBe('canonical')
  })
  it('returns canonical at S=1200', () => {
    expect(selectTier(1200)).toBe('canonical')
  })
  it('returns reduced at S=599', () => {
    expect(selectTier(599)).toBe('reduced')
  })
  it('returns reduced at S=380', () => {
    expect(selectTier(380)).toBe('reduced')
  })
  it('returns corner at S=379', () => {
    expect(selectTier(379)).toBe('corner')
  })
  it('returns corner at S=160', () => {
    expect(selectTier(160)).toBe('corner')
  })
  it('returns brand-only at S=159', () => {
    expect(selectTier(159)).toBe('brand-only')
  })
  it('returns brand-only at S=90', () => {
    expect(selectTier(90)).toBe('brand-only')
  })
  it('returns ff-collapse at S=89', () => {
    expect(selectTier(89)).toBe('ff-collapse')
  })
  it('returns ff-collapse at S=60', () => {
    expect(selectTier(60)).toBe('ff-collapse')
  })
  it('returns f-micro at S=59', () => {
    expect(selectTier(59)).toBe('f-micro')
  })
  it('returns f-micro at S=40', () => {
    expect(selectTier(40)).toBe('f-micro')
  })
  it('returns null at S=39', () => {
    expect(selectTier(39)).toBeNull()
  })
  it('returns null at S=0', () => {
    expect(selectTier(0)).toBeNull()
  })
  it('returns null at negative values', () => {
    expect(selectTier(-10)).toBeNull()
  })
})

describe('computeGeometry', () => {
  it('uses shorter dimension for S (landscape)', () => {
    const geo = computeGeometry(1000, 600)
    expect(geo.S).toBe(600)
    expect(geo.tier).toBe('canonical')
  })

  it('uses shorter dimension for S (portrait)', () => {
    const geo = computeGeometry(400, 800)
    expect(geo.S).toBe(400)
    expect(geo.tier).toBe('reduced')
  })

  it('computes bar width with formula clamped 28-52', () => {
    // S=800: 800*0.06=48 -> 48
    const geo800 = computeGeometry(800, 800)
    expect(geo800.barWidth).toBe(48)

    // S=100: 100*0.06=6 -> clamped to 28
    const geo100 = computeGeometry(100, 100)
    expect(geo100.barWidth).toBe(28)

    // S=1200: 1200*0.06=72 -> clamped to 52
    const geo1200 = computeGeometry(1200, 1200)
    expect(geo1200.barWidth).toBe(52)
  })

  it('computes inset with formula clamped 8-24', () => {
    // S=800: 800*0.03=24 -> 24
    const geo800 = computeGeometry(800, 800)
    expect(geo800.inset).toBe(24)

    // S=100: 100*0.03=3 -> clamped to 8
    const geo100 = computeGeometry(100, 100)
    expect(geo100.inset).toBe(8)

    // S=1200: 1200*0.03=36 -> clamped to 24
    const geo1200 = computeGeometry(1200, 1200)
    expect(geo1200.inset).toBe(24)
  })

  it('snaps bar width and inset to whole pixels', () => {
    const geo = computeGeometry(514, 514)
    expect(Number.isInteger(geo.barWidth)).toBe(true)
    expect(Number.isInteger(geo.inset)).toBe(true)
  })

  it('returns null tier below threshold', () => {
    const geo = computeGeometry(30, 20)
    expect(geo.tier).toBeNull()
  })
})

describe('resolveOrientation', () => {
  it('returns vertical for portrait', () => {
    expect(resolveOrientation(400, 600)).toBe('vertical')
  })
  it('returns horizontal for landscape', () => {
    expect(resolveOrientation(800, 600)).toBe('horizontal')
  })
  it('returns vertical for square', () => {
    expect(resolveOrientation(500, 500)).toBe('vertical')
  })
  it('respects explicit override', () => {
    expect(resolveOrientation(800, 600, 'vertical')).toBe('vertical')
    expect(resolveOrientation(400, 600, 'horizontal')).toBe('horizontal')
  })
})
