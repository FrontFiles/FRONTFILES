// ═══════════════════════════════════════════════════════════════
// Frontfiles — Scanner factory + stub adapter tests (NR-D7b, F6)
//
// Coverage:
//   - getScannerAdapters() factory selection (env-driven)
//   - StubScannerAdapter clean / flag / delay behaviour
//
// Env stubbing: vi.stubEnv mutates process.env for the test
// duration; afterEach unstubs. The factory reads from `env`
// (which reads process.env via getter at call time per CCP
// Pattern-a Option 2b), so stubEnv affects subsequent calls.
// ═══════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GcvSafeSearchAdapter,
  StubScannerAdapter,
  getScannerAdapters,
} from '../index'

describe('getScannerAdapters', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 2 stub adapters when no GCV env keys are set', () => {
    vi.stubEnv('SCANNER_GCV_PROJECT_ID', '')
    vi.stubEnv('SCANNER_GCV_API_KEY', '')
    vi.stubEnv('SCANNER_STUB_DELAY_MS', '0')
    const adapters = getScannerAdapters()
    expect(adapters).toHaveLength(2)
    expect(adapters[0]).toBeInstanceOf(StubScannerAdapter)
    expect(adapters[1]).toBeInstanceOf(StubScannerAdapter)
    expect(adapters[0]!.id).toBe('image_moderation_stub_v1')
    expect(adapters[1]!.id).toBe('malware_stub_v1')
  })

  it('returns GCV + malware-stub when GCV keys are set', () => {
    vi.stubEnv('SCANNER_GCV_PROJECT_ID', 'test-project')
    vi.stubEnv('SCANNER_GCV_API_KEY', 'test-key')
    vi.stubEnv('SCANNER_STUB_DELAY_MS', '0')
    const adapters = getScannerAdapters()
    expect(adapters).toHaveLength(2)
    expect(adapters[0]).toBeInstanceOf(GcvSafeSearchAdapter)
    expect(adapters[0]!.id).toBe('gcv_safesearch_v1')
    expect(adapters[1]).toBeInstanceOf(StubScannerAdapter)
    expect(adapters[1]!.id).toBe('malware_stub_v1')
  })

  it('preserves deterministic adapter ordering (image first, malware second)', () => {
    vi.stubEnv('SCANNER_GCV_PROJECT_ID', '')
    vi.stubEnv('SCANNER_GCV_API_KEY', '')
    vi.stubEnv('SCANNER_STUB_DELAY_MS', '0')
    const a = getScannerAdapters()
    const b = getScannerAdapters()
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id))
    expect(a[0]!.id).toContain('image')
    expect(a[1]!.id).toContain('malware')
  })

  it('falls back to stub for image moderation when only one GCV var is set', () => {
    vi.stubEnv('SCANNER_GCV_PROJECT_ID', 'test-project')
    vi.stubEnv('SCANNER_GCV_API_KEY', '')
    vi.stubEnv('SCANNER_STUB_DELAY_MS', '0')
    const adapters = getScannerAdapters()
    expect(adapters[0]).toBeInstanceOf(StubScannerAdapter)
  })
})

describe('StubScannerAdapter', () => {
  const baseInput = {
    assetKind: 'image' as const,
    mimeType: 'image/jpeg',
    bytes: new Uint8Array([1, 2, 3]),
    storageRef: 'newsroom/packs/p/assets/a/original.jpg',
  }

  it('returns clean by default', async () => {
    const adapter = new StubScannerAdapter({
      id: 'test',
      kinds: new Set(['image']),
      delayMs: 0,
    })
    const out = await adapter.scan(baseInput)
    expect(out.result).toBe('clean')
    expect(out.flaggedCategories).toEqual([])
  })

  it('returns flagged when flagOnMimeRegex matches', async () => {
    const adapter = new StubScannerAdapter({
      id: 'test',
      kinds: new Set(['image']),
      delayMs: 0,
      flagOnMimeRegex: /image\/jpeg/,
    })
    const out = await adapter.scan(baseInput)
    expect(out.result).toBe('flagged')
    expect(out.flaggedCategories).toEqual(['stub_test_flag'])
  })

  it('flagged category is NEVER \'csam\' (CSAM invariant)', async () => {
    const adapter = new StubScannerAdapter({
      id: 'test',
      kinds: new Set(['image']),
      delayMs: 0,
      flagOnMimeRegex: /.*/,
    })
    const out = await adapter.scan(baseInput)
    expect(out.flaggedCategories).not.toContain('csam')
  })

  it('respects delayMs=0 (no setTimeout call)', async () => {
    const adapter = new StubScannerAdapter({
      id: 'test',
      kinds: new Set(['image']),
      delayMs: 0,
    })
    const start = Date.now()
    await adapter.scan(baseInput)
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('exposes applicableKinds for the pipeline to filter on', () => {
    const adapter = new StubScannerAdapter({
      id: 'test',
      kinds: new Set(['video', 'audio']),
      delayMs: 0,
    })
    expect(adapter.applicableKinds.has('video')).toBe(true)
    expect(adapter.applicableKinds.has('audio')).toBe(true)
    expect(adapter.applicableKinds.has('image')).toBe(false)
  })
})
