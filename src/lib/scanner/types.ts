// ═══════════════════════════════════════════════════════════════
// Frontfiles — Scanner adapter contract (NR-D7b, F1)
//
// Substrate for the AV-scanning pipeline. The pipeline picks up
// pending newsroom_asset_scan_results rows, resolves the
// applicable adapters via getScannerAdapters() (factory in F2),
// and routes the asset bytes through each adapter sequentially.
//
// Three implementations ship in NR-D7b:
//
//   - StubScannerAdapter (F3)        — dev/test/CI default
//   - GcvSafeSearchAdapter (F4)      — image moderation in prod
//   - StubScannerAdapter for malware — placeholder; real malware
//                                       vendor lands in v1.1
//                                       (DIRECTIVE_SEQUENCE.md backlog)
//
// ─── CSAM INVARIANT (load-bearing) ──────────────────────────────
//
// `ScanOutput.flaggedCategories` MUST NEVER contain the string
// 'csam'. PRD §3.2's `csam` enum value is reserved for NR-D17.5's
// atomic detection-plus-NCMEC-reporting pipeline. NR-D7b ships
// generic image moderation (adult/racy/violence/medical) with no
// CSAM-specific classification surface.
//
// TypeScript cannot enforce string-content invariants at compile
// time — the type stays `ReadonlyArray<string>` because narrower
// type unions would force every adapter to enumerate the universe
// of categories at the type level, defeating the open-ended
// flagged_categories shape PRD §3.2 specifies. The invariant is
// enforced AT RUNTIME across five layers:
//
//   1. F1 types.ts    — this comment + ScannerAdapter contract
//   2. F3 stub        — only ever produces 'stub_test_flag' / []
//   3. F4 GCV         — maps {adult, racy, violence, medical} only
//   4. F5 pipeline    — STRIPS 'csam' from any aggregated output
//                       (the load-bearing runtime guard)
//   5. F7 + F8 tests  — synthetic-injection assertions across
//                       both the adapter and the pipeline layer
//
// Adapters that internally produce a CSAM-equivalent label MUST
// drop it from `ScanOutput.flaggedCategories` (with a logged
// warning). The pipeline (F5) re-strips defensively in case an
// adapter forgot.
//
// Spec cross-references:
//   - PRD.md §3.2 (AssetScanResult, flagged_categories shape)
//   - directives/NR-D7b-scan-pipeline.md §F1
//   - src/lib/storage/types.ts (StorageAdapter — pattern mirrored)
// ═══════════════════════════════════════════════════════════════

import type {
  NewsroomAssetKind,
  NewsroomScanResult,
} from '@/lib/db/schema'

// ── Inputs ────────────────────────────────────────────────────

export interface ScanInput {
  assetKind: NewsroomAssetKind
  mimeType: string
  /**
   * The asset bytes. Buffer is the canonical type returned by
   * `StorageAdapter.getBytes()`; `Uint8Array` is the structural
   * superset accepted by Web Crypto, base64 encoders, etc. The
   * pipeline (F5) fetches bytes once and reuses across adapters.
   */
  bytes: Buffer | Uint8Array
  /**
   * The storage reference for adapters that prefer a URI/URL
   * surface over byte upload (e.g. Supabase signed URLs to feed
   * to a vendor that pulls). NR-D7b's GCV adapter uses bytes;
   * future adapters may need this.
   */
  storageRef: string
}

// ── Outputs ───────────────────────────────────────────────────

/**
 * Output shape from a single adapter's scan.
 *
 * `result` is one of `'clean' | 'flagged' | 'error'` —
 * narrower than `NewsroomScanResult` because adapters never
 * leave a row in the `'pending'` state on completion.
 *
 * `flaggedCategories` is a free-form string array (PRD §3.2
 * shape). MUST NEVER contain `'csam'` per the invariant
 * documented at the top of this file.
 *
 * `lastError` is set when `result === 'error'`. Carries the
 * human-readable error text for the admin queue (NR-D17 Part C).
 */
export interface ScanOutput {
  result: Exclude<NewsroomScanResult, 'pending'>
  flaggedCategories: ReadonlyArray<string>
  lastError?: string
}

// ── Adapter interface ─────────────────────────────────────────

export interface ScannerAdapter {
  /** Stable identifier persisted to scan_results.scanner_suite. */
  readonly id: string
  /** Version persisted to scan_results.scanner_version. */
  readonly version: string
  /**
   * Asset kinds this adapter is willing to scan. The pipeline
   * filters by this set before calling `scan()` — adapters never
   * receive ScanInputs with an out-of-set kind.
   */
  readonly applicableKinds: ReadonlySet<NewsroomAssetKind>
  /**
   * Run the scan. Implementations should throw `ScannerError`
   * on classifiable failure modes; the pipeline catches and
   * surfaces them as `result: 'error'`.
   */
  scan(input: ScanInput): Promise<ScanOutput>
}

// ── Driver selection ──────────────────────────────────────────

export type ScannerDriver = 'stub' | 'real'

// ── Errors ────────────────────────────────────────────────────

/**
 * Thrown by adapter implementations on classifiable failure
 * modes. The pipeline catches these and emits a `result: 'error'`
 * scan result with `lastError` populated from `message`.
 *
 * Categories:
 *   - `'config'`     — adapter is misconfigured (401/403, missing key)
 *   - `'transient'`  — vendor unavailable (429, 5xx); retried by next cron
 *   - `'permanent'`  — adapter cannot ever scan this input
 *                      (e.g. unsupported MIME at the vendor's end)
 *
 * In NR-D7b all three categories surface as `result: 'error'` with
 * the same downstream behaviour. NR-D17 (admin override) may
 * differentiate retry-on-error semantics by category in the future.
 */
export class ScannerError extends Error {
  constructor(
    public readonly category: 'config' | 'transient' | 'permanent',
    message: string,
  ) {
    super(message)
    this.name = 'ScannerError'
  }
}
