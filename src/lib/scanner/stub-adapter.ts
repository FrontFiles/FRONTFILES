// ═══════════════════════════════════════════════════════════════
// Frontfiles — Stub scanner adapter (NR-D7b, F3)
//
// Default scanner for dev / test / CI. Configurable delay
// (simulates real vendor latency) and an optional MIME-regex
// hook for synthetic-flag tests. Always reports `'clean'` unless
// `flagOnMimeRegex` is supplied and matches.
//
// CSAM invariant: only ever produces `flaggedCategories:
// ['stub_test_flag']` (when configured to flag) or `[]`
// (otherwise). NEVER `'csam'`. See F1 types.ts header for the
// full defence-in-depth picture.
//
// Spec cross-references:
//   - directives/NR-D7b-scan-pipeline.md §F3
//   - src/lib/scanner/types.ts (F1 — contract)
// ═══════════════════════════════════════════════════════════════

import type { NewsroomAssetKind } from '@/lib/db/schema'

import type {
  ScanInput,
  ScanOutput,
  ScannerAdapter,
} from './types'

export interface StubScannerAdapterOptions {
  /** Stable adapter id persisted to scan_results.scanner_suite. */
  id: string
  /** Asset kinds this stub instance is willing to "scan". */
  kinds: ReadonlySet<NewsroomAssetKind>
  /** Synthetic latency in ms. 0 disables the wait. */
  delayMs: number
  /**
   * Test-only hook: when this regex matches the input MIME, the
   * stub returns `flagged` with category `'stub_test_flag'`.
   * Production callers should leave this undefined — real flags
   * come from real adapters.
   */
  flagOnMimeRegex?: RegExp
}

const STUB_FLAG_CATEGORY = 'stub_test_flag'

export class StubScannerAdapter implements ScannerAdapter {
  readonly id: string
  readonly version = '1.0.0'
  readonly applicableKinds: ReadonlySet<NewsroomAssetKind>

  private readonly delayMs: number
  private readonly flagOnMimeRegex?: RegExp

  constructor(opts: StubScannerAdapterOptions) {
    this.id = opts.id
    this.applicableKinds = opts.kinds
    this.delayMs = opts.delayMs
    this.flagOnMimeRegex = opts.flagOnMimeRegex
  }

  async scan(input: ScanInput): Promise<ScanOutput> {
    if (this.delayMs > 0) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.delayMs),
      )
    }
    if (this.flagOnMimeRegex?.test(input.mimeType)) {
      return {
        result: 'flagged',
        flaggedCategories: [STUB_FLAG_CATEGORY],
      }
    }
    return {
      result: 'clean',
      flaggedCategories: [],
    }
  }
}
