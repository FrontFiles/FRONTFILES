import { describe, it, expect } from 'vitest'
import { centsForCall, VERTEX_PRICING } from '../cost'

describe('centsForCall', () => {
  it('throws on null pricing for vision_per_asset (forces verification gate)', () => {
    expect(() =>
      centsForCall('vision_per_asset', { inputTokens: 100, outputTokens: 30, imageCount: 1 }),
    ).toThrow(/Vertex pricing not yet verified for vision_per_asset/)
  })

  it('throws on null pricing for cluster_naming', () => {
    expect(() =>
      centsForCall('cluster_naming', { inputTokens: 100, outputTokens: 30 }),
    ).toThrow(/Vertex pricing not yet verified for cluster_naming/)
  })

  it('throws on null pricing for embedding', () => {
    expect(() => centsForCall('embedding', { inputTokens: 100, outputTokens: 0 })).toThrow(
      /Vertex pricing not yet verified for embedding/,
    )
  })

  it('VERTEX_PRICING table has all three roles defined (with null sentinels)', () => {
    expect(VERTEX_PRICING.vision_per_asset).toBeDefined()
    expect(VERTEX_PRICING.cluster_naming).toBeDefined()
    expect(VERTEX_PRICING.embedding).toBeDefined()
  })

  it('throws on unknown role', () => {
    // @ts-expect-error testing invalid role
    expect(() => centsForCall('not_a_role', { inputTokens: 0, outputTokens: 0 })).toThrow(
      /No pricing defined for model role/,
    )
  })
})
