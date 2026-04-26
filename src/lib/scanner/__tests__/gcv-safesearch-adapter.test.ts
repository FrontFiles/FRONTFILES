// ═══════════════════════════════════════════════════════════════
// Frontfiles — GCV SafeSearch adapter tests (NR-D7b, F7)
//
// Mocks `fetch` via vi.stubGlobal. Covers:
//   - Each likelihood label combination
//   - Threshold (LIKELY+) vs noise (POSSIBLE-)
//   - Error classification (config / transient / permanent)
//   - CSAM invariant — synthetic injection asserts the adapter
//     never produces 'csam' even if the response contains it
//
// No live GCV calls — this is a pure unit test against the
// mocked fetch surface. Real-call smoke is deferred to
// fixture-dependent runtime smoke (same posture as upstream
// directives).
// ═══════════════════════════════════════════════════════════════

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { ScannerError } from '../types'
import { GcvSafeSearchAdapter } from '../gcv-safesearch-adapter'

const baseInput = {
  assetKind: 'image' as const,
  mimeType: 'image/jpeg',
  bytes: new Uint8Array([1, 2, 3, 4]),
  storageRef: 'newsroom/packs/p/assets/a/original.jpg',
}

function mockFetchResponse(
  status: number,
  body: unknown,
): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response) as unknown as typeof fetch
}

function mockFetchMalformed(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.reject(new Error('not json')),
  } as Response) as unknown as typeof fetch
}

function mockFetchNetworkError(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error('connection reset'))
}

const ADAPTER = new GcvSafeSearchAdapter({
  apiKey: 'test-key',
  projectId: 'test-project',
})

describe('GcvSafeSearchAdapter — label mapping', () => {
  beforeEach(() => {})
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns clean when all labels are VERY_UNLIKELY', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [
          {
            safeSearchAnnotation: {
              adult: 'VERY_UNLIKELY',
              racy: 'VERY_UNLIKELY',
              violence: 'VERY_UNLIKELY',
              medical: 'VERY_UNLIKELY',
              spoof: 'VERY_UNLIKELY',
            },
          },
        ],
      }),
    )
    const out = await ADAPTER.scan(baseInput)
    expect(out.result).toBe('clean')
    expect(out.flaggedCategories).toEqual([])
  })

  it('flags adult at LIKELY', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [{ safeSearchAnnotation: { adult: 'LIKELY' } }],
      }),
    )
    const out = await ADAPTER.scan(baseInput)
    expect(out.result).toBe('flagged')
    expect(out.flaggedCategories).toEqual(['adult'])
  })

  it('flags adult+violence when both VERY_LIKELY', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [
          {
            safeSearchAnnotation: {
              adult: 'VERY_LIKELY',
              violence: 'LIKELY',
            },
          },
        ],
      }),
    )
    const out = await ADAPTER.scan(baseInput)
    expect(out.result).toBe('flagged')
    expect(out.flaggedCategories).toContain('adult')
    expect(out.flaggedCategories).toContain('violence')
  })

  it('ignores POSSIBLE (below threshold)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [{ safeSearchAnnotation: { racy: 'POSSIBLE' } }],
      }),
    )
    const out = await ADAPTER.scan(baseInput)
    expect(out.result).toBe('clean')
    expect(out.flaggedCategories).toEqual([])
  })

  it('ignores spoof even at VERY_LIKELY (not a content-safety concern)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [{ safeSearchAnnotation: { spoof: 'VERY_LIKELY' } }],
      }),
    )
    const out = await ADAPTER.scan(baseInput)
    expect(out.result).toBe('clean')
    expect(out.flaggedCategories).toEqual([])
  })

  it('flags medical and racy independently', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [
          {
            safeSearchAnnotation: {
              medical: 'LIKELY',
              racy: 'VERY_LIKELY',
            },
          },
        ],
      }),
    )
    const out = await ADAPTER.scan(baseInput)
    expect(out.result).toBe('flagged')
    expect(out.flaggedCategories).toContain('medical')
    expect(out.flaggedCategories).toContain('racy')
  })
})

describe('GcvSafeSearchAdapter — error classification', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('classifies HTTP 401 as ScannerError(config)', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(401, {}))
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'config',
    })
  })

  it('classifies HTTP 403 as ScannerError(config)', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(403, {}))
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'config',
    })
  })

  it('classifies HTTP 429 as ScannerError(transient)', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(429, {}))
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'transient',
    })
  })

  it('classifies HTTP 503 as ScannerError(transient)', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(503, {}))
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'transient',
    })
  })

  it('classifies HTTP 400 as ScannerError(permanent)', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(400, {}))
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'permanent',
    })
  })

  it('classifies network failure as ScannerError(transient)', async () => {
    vi.stubGlobal('fetch', mockFetchNetworkError())
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'transient',
    })
  })

  it('classifies malformed JSON as ScannerError(permanent)', async () => {
    vi.stubGlobal('fetch', mockFetchMalformed())
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'permanent',
    })
  })

  it('surfaces per-request errors as ScannerError(permanent)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [
          { error: { code: 3, message: 'Bad image data' } },
        ],
      }),
    )
    await expect(ADAPTER.scan(baseInput)).rejects.toMatchObject({
      name: 'ScannerError',
      category: 'permanent',
    })
  })
})

describe('GcvSafeSearchAdapter — CSAM invariant (defence-in-depth)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("never produces 'csam' even under synthetic injection", async () => {
    // Synthetic: a hypothetical future GCV schema change adds a
    // `csam` label to the response. The adapter's mapping table
    // ignores it; the post-mapping filter strips it as a fence.
    // This test guards against accidental regressions in either
    // layer.
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        responses: [
          {
            safeSearchAnnotation: {
              adult: 'LIKELY',
              // This is the synthetic injection — not a real GCV
              // field, but TypeScript permits it via the response
              // type's open-shape modelling.
              csam: 'VERY_LIKELY',
            },
          },
        ],
      }),
    )
    const out = await ADAPTER.scan(baseInput)
    expect(out.flaggedCategories).not.toContain('csam')
    // The legitimate adult flag should still pass through.
    expect(out.flaggedCategories).toContain('adult')
  })
})

describe('GcvSafeSearchAdapter — construction guards', () => {
  it('throws on missing apiKey', () => {
    expect(
      () =>
        new GcvSafeSearchAdapter({
          apiKey: '',
          projectId: 'p',
        }),
    ).toThrow(/apiKey is required/)
  })

  it('throws on missing projectId', () => {
    expect(
      () =>
        new GcvSafeSearchAdapter({
          apiKey: 'k',
          projectId: '',
        }),
    ).toThrow(/projectId is required/)
  })

  it('exposes correct id/version/applicableKinds', () => {
    const adapter = new GcvSafeSearchAdapter({
      apiKey: 'k',
      projectId: 'p',
    })
    expect(adapter.id).toBe('gcv_safesearch_v1')
    expect(adapter.version).toBe('1.0.0')
    expect(adapter.applicableKinds.has('image')).toBe(true)
    expect(adapter.applicableKinds.has('video')).toBe(false)
  })

  it('config-error from constructor is a ScannerError', () => {
    try {
      new GcvSafeSearchAdapter({ apiKey: '', projectId: 'p' })
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ScannerError)
      expect((err as ScannerError).category).toBe('config')
    }
  })
})
