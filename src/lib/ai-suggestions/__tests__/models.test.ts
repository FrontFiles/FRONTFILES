import { describe, it, expect } from 'vitest'
import { MODELS, type ModelRole } from '../models'

describe('MODELS constants', () => {
  it('has all three required roles', () => {
    const roles: ModelRole[] = [
      'vision_per_asset',
      'cluster_naming',
      'embedding',
    ]
    for (const role of roles) {
      expect(MODELS[role]).toBeTypeOf('string')
      expect(MODELS[role].length).toBeGreaterThan(0)
    }
  })

  it('vision_per_asset references the gemini family', () => {
    expect(MODELS.vision_per_asset).toMatch(/gemini/i)
  })

  it('cluster_naming references the gemini family', () => {
    expect(MODELS.cluster_naming).toMatch(/gemini/i)
  })

  it('embedding is text-embedding-004 per D7 lock', () => {
    expect(MODELS.embedding).toBe('text-embedding-004')
  })

  it('vision and cluster models are distinct (flash vs pro tier separation)', () => {
    expect(MODELS.vision_per_asset).not.toBe(MODELS.cluster_naming)
  })
})
