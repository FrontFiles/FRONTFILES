import { describe, it, expect, beforeEach } from 'vitest'

import {
  VertexAuthError,
  VertexQuotaError,
  VertexPermanentError,
  VertexTransientError,
  VertexResponseError,
  _resetClientCacheForTest,
} from '../google'

beforeEach(() => {
  _resetClientCacheForTest()
})

describe('typed error classes (per §8.3)', () => {
  it('VertexAuthError has the right name + message prefix', () => {
    const e = new VertexAuthError('missing creds')
    expect(e.name).toBe('VertexAuthError')
    expect(e.message).toContain('missing creds')
  })

  it('VertexQuotaError', () => {
    expect(new VertexQuotaError('429').name).toBe('VertexQuotaError')
  })

  it('VertexPermanentError — circuit-breaker checks .name.includes("Permanent")', () => {
    const e = new VertexPermanentError('400 invalid')
    expect(e.name).toBe('VertexPermanentError')
    expect(e.name.includes('Permanent')).toBe(true)
  })

  it('VertexTransientError', () => {
    expect(new VertexTransientError('5xx').name).toBe('VertexTransientError')
  })

  it('VertexResponseError — caller produces this on parse failures', () => {
    expect(new VertexResponseError('bad json').name).toBe('VertexResponseError')
  })
})

describe('environment guards', () => {
  it('analyseImage throws VertexAuthError without GOOGLE_CLOUD_PROJECT_ID', async () => {
    const orig = process.env.GOOGLE_CLOUD_PROJECT_ID
    delete process.env.GOOGLE_CLOUD_PROJECT_ID
    try {
      const { analyseImage } = await import('../google')
      await expect(
        analyseImage({
          imageBytes: Buffer.from([0]),
          imageMime: 'image/jpeg',
          prompt: 'x',
          responseSchema: {},
          model: 'flash',
          region: 'europe-west4',
        }),
      ).rejects.toThrow(VertexAuthError)
    } finally {
      if (orig) process.env.GOOGLE_CLOUD_PROJECT_ID = orig
    }
  })
})
