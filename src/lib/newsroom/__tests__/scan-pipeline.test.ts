// ═══════════════════════════════════════════════════════════════
// Frontfiles — Scan-pipeline tests (NR-D7b, F8)
//
// Pure unit tests for the orchestrator. Mocked adapters +
// synthetic fetchBytes — no real I/O, no real scanner calls.
//
// Coverage focus areas:
//   - Single / multi adapter aggregation
//   - error / flagged / clean precedence
//   - scanner_suite + scanner_version composition
//   - Asset-kind filtering
//   - CSAM invariant — synthetic injection asserts the pipeline
//     strips 'csam' from any aggregated flagged_categories
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import type { NewsroomAssetKind } from '@/lib/db/schema'
import type { ScanInput, ScanOutput, ScannerAdapter } from '@/lib/scanner'
import { ScannerError } from '@/lib/scanner'
import { runScanPipeline } from '../scan-pipeline'

// ── Test helpers ──────────────────────────────────────────────

function makeAdapter(spec: {
  id: string
  version?: string
  kinds?: ReadonlySet<NewsroomAssetKind>
  scan: (input: ScanInput) => Promise<ScanOutput>
}): ScannerAdapter {
  return {
    id: spec.id,
    version: spec.version ?? '1.0.0',
    applicableKinds:
      spec.kinds ?? new Set<NewsroomAssetKind>(['image']),
    scan: spec.scan,
  }
}

const ASSET = {
  kind: 'image' as const,
  mime_type: 'image/jpeg',
  storage_url: 'newsroom/packs/p/assets/a/original.jpg',
}

const fetchBytes = async () => new Uint8Array([1, 2, 3])

// ── Aggregation rules ─────────────────────────────────────────

describe('runScanPipeline — single-adapter cases', () => {
  it('returns clean when the only adapter returns clean', async () => {
    const adapters = [
      makeAdapter({
        id: 'one',
        scan: async () => ({ result: 'clean', flaggedCategories: [] }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('clean')
    expect(out.flaggedCategories).toEqual([])
    expect(out.scannerSuite).toBe('one')
    expect(out.scannerVersion).toBe('1.0.0')
  })

  it('returns flagged with categories when adapter flags', async () => {
    const adapters = [
      makeAdapter({
        id: 'one',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['adult'],
        }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('flagged')
    expect(out.flaggedCategories).toEqual(['adult'])
  })

  it('returns error with lastError when adapter throws ScannerError', async () => {
    const adapters = [
      makeAdapter({
        id: 'one',
        scan: async () => {
          throw new ScannerError('config', 'no api key')
        },
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('error')
    expect(out.lastError).toContain('no api key')
  })

  it('returns error when adapter throws a generic Error', async () => {
    const adapters = [
      makeAdapter({
        id: 'one',
        scan: async () => {
          throw new Error('boom')
        },
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('error')
    expect(out.lastError).toBe('boom')
  })
})

describe('runScanPipeline — multi-adapter aggregation', () => {
  it('merges flagged categories across adapters', async () => {
    const adapters = [
      makeAdapter({
        id: 'a-img',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['adult'],
        }),
      }),
      makeAdapter({
        id: 'b-img',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['violence'],
        }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('flagged')
    expect(out.flaggedCategories).toEqual(['adult', 'violence'])
  })

  it('deduplicates overlapping categories', async () => {
    const adapters = [
      makeAdapter({
        id: 'a',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['adult', 'violence'],
        }),
      }),
      makeAdapter({
        id: 'b',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['adult', 'medical'],
        }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.flaggedCategories).toEqual(['adult', 'medical', 'violence'])
  })

  it('error wins over flagged when one adapter errors', async () => {
    const adapters = [
      makeAdapter({
        id: 'a',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['adult'],
        }),
      }),
      makeAdapter({
        id: 'b',
        scan: async () => {
          throw new ScannerError('transient', 'rate limit')
        },
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('error')
    expect(out.flaggedCategories).toContain('adult')
    expect(out.lastError).toContain('rate limit')
  })

  it('first-error-wins for lastError', async () => {
    const adapters = [
      makeAdapter({
        id: 'a',
        scan: async () => {
          throw new Error('first')
        },
      }),
      makeAdapter({
        id: 'b',
        scan: async () => {
          throw new Error('second')
        },
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.lastError).toBe('first')
  })

  it('all-clean returns clean with empty categories', async () => {
    const adapters = [
      makeAdapter({
        id: 'a',
        scan: async () => ({ result: 'clean', flaggedCategories: [] }),
      }),
      makeAdapter({
        id: 'b',
        scan: async () => ({ result: 'clean', flaggedCategories: [] }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('clean')
    expect(out.flaggedCategories).toEqual([])
  })
})

describe('runScanPipeline — applicableKinds filtering', () => {
  it('skips adapters whose applicableKinds does not include the asset kind', async () => {
    let videoAdapterCalled = false
    const adapters = [
      makeAdapter({
        id: 'image-only',
        kinds: new Set(['image']),
        scan: async () => ({ result: 'clean', flaggedCategories: [] }),
      }),
      makeAdapter({
        id: 'video-only',
        kinds: new Set(['video']),
        scan: async () => {
          videoAdapterCalled = true
          return { result: 'clean', flaggedCategories: [] }
        },
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(videoAdapterCalled).toBe(false)
    expect(out.scannerSuite).toBe('image-only')
  })

  it('returns clean with empty suite when no adapters apply', async () => {
    const adapters = [
      makeAdapter({
        id: 'video-only',
        kinds: new Set(['video']),
        scan: async () => ({ result: 'clean', flaggedCategories: [] }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.result).toBe('clean')
    expect(out.scannerSuite).toBe('')
    expect(out.scannerVersion).toBe('')
  })
})

describe('runScanPipeline — scanner_suite/version composition', () => {
  it('orders by adapter id alphabetically (deterministic)', async () => {
    const adapters = [
      makeAdapter({
        id: 'z-late',
        version: '2.0.0',
        scan: async () => ({ result: 'clean', flaggedCategories: [] }),
      }),
      makeAdapter({
        id: 'a-early',
        version: '1.0.0',
        scan: async () => ({ result: 'clean', flaggedCategories: [] }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.scannerSuite).toBe('a-early+z-late')
    expect(out.scannerVersion).toBe('1.0.0+2.0.0')
  })
})

describe('runScanPipeline — CSAM invariant (load-bearing strip)', () => {
  it("strips 'csam' from any adapter's flagged_categories before returning", async () => {
    // Synthetic injection: an adapter (hypothetically; no real
    // adapter does this in NR-D7b) returns 'csam' as a category.
    // The pipeline's strip step removes it before returning.
    const adapters = [
      makeAdapter({
        id: 'rogue',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['adult', 'csam', 'violence'],
        }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.flaggedCategories).not.toContain('csam')
    expect(out.flaggedCategories).toContain('adult')
    expect(out.flaggedCategories).toContain('violence')
  })

  it("strips 'csam' even when it's the only category an adapter flagged", async () => {
    // Edge case: an adapter flags ONLY 'csam'. After strip, the
    // category set is empty — but the result MUST stay 'flagged'
    // because the adapter declared it. The pipeline doesn't
    // demote 'flagged' → 'clean' on empty-after-strip; that
    // would lose a meaningful signal. Instead, the row stays
    // flagged with empty flaggedCategories, which the admin
    // queue surfaces as "flagged with no categories" — anomalous
    // and worth investigating.
    const adapters = [
      makeAdapter({
        id: 'rogue',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['csam'],
        }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.flaggedCategories).not.toContain('csam')
    expect(out.flaggedCategories).toEqual([])
    expect(out.result).toBe('flagged')
  })

  it("strips 'csam' across multi-adapter merges", async () => {
    const adapters = [
      makeAdapter({
        id: 'a',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['adult', 'csam'],
        }),
      }),
      makeAdapter({
        id: 'b',
        scan: async () => ({
          result: 'flagged',
          flaggedCategories: ['csam', 'violence'],
        }),
      }),
    ]
    const out = await runScanPipeline({ asset: ASSET, adapters, fetchBytes })
    expect(out.flaggedCategories).not.toContain('csam')
    expect(out.flaggedCategories).toEqual(['adult', 'violence'])
  })
})
