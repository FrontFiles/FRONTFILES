// ═══════════════════════════════════════════════════════════════
// Frontfiles — Newsroom scan pipeline (NR-D7b, F5)
//
// Pure orchestrator. Composes one or more `ScannerAdapter`
// instances over an asset's bytes and returns the aggregated
// scan result the worker writes back to
// `newsroom_asset_scan_results`.
//
// "Pure" here means: no I/O of its own. Adapter scans + the
// byte fetch are injected. Tests in F8 inject mocked adapters
// + a synthetic `fetchBytes` to cover aggregation logic without
// touching the network.
//
// ─── AGGREGATION RULES ─────────────────────────────────────────
//
//   any adapter throws ScannerError → result = 'error'
//                                      lastError = first error message
//                                      flaggedCategories = merge of
//                                         successful adapters' categories
//   else any flagged → result = 'flagged'
//                       flaggedCategories = deduped merge across all
//   else → result = 'clean'
//           flaggedCategories = []
//
// scanner_suite is the '+'-joined sorted-by-id list of all
// applicable adapter ids. scanner_version is the matched 1:1
// '+'-joined list of versions (preserving the same adapter order
// as the suite).
//
// ─── CSAM INVARIANT (F5 layer — load-bearing) ──────────────────
//
// Step 7 in the body strips `'csam'` from the final
// `flaggedCategories` array. This is the load-bearing runtime
// guard: even if every other layer (F1 documentation, F3 stub,
// F4 GCV mapping, future adapters) somehow regresses and emits
// `'csam'`, this filter catches it before the pipeline returns.
// F8's tests assert the strip operates correctly under synthetic
// injection.
//
// Spec cross-references:
//   - directives/NR-D7b-scan-pipeline.md §F5
//   - src/lib/scanner/types.ts (F1 — invariant declaration)
// ═══════════════════════════════════════════════════════════════

import type {
  NewsroomAssetKind,
  NewsroomScanResult,
} from '@/lib/db/schema'
import {
  ScannerError,
  type ScanOutput,
  type ScannerAdapter,
} from '@/lib/scanner'

// ── Types ──────────────────────────────────────────────────────

export interface PipelineAssetSnapshot {
  kind: NewsroomAssetKind
  mime_type: string
  storage_url: string
}

export interface PipelineInput {
  asset: PipelineAssetSnapshot
  adapters: ReadonlyArray<ScannerAdapter>
  /**
   * Injected byte fetcher. In the worker (F9), this is bound to
   * `getStorageAdapter().getBytes`. Tests pass a synthetic fn.
   */
  fetchBytes: (storageRef: string) => Promise<Buffer | Uint8Array>
}

export interface PipelineOutput {
  result: NewsroomScanResult
  flaggedCategories: ReadonlyArray<string>
  scannerSuite: string
  scannerVersion: string
  lastError?: string
}

// Reserved CSAM token — this is the string that must NEVER
// appear in the final flagged_categories array. PRD §3.2's
// `csam` enum value is reserved for NR-D17.5's atomic
// detection-plus-NCMEC-reporting pipeline.
const RESERVED_CSAM_TOKEN = 'csam'

// ── Pipeline ───────────────────────────────────────────────────

export async function runScanPipeline(
  input: PipelineInput,
): Promise<PipelineOutput> {
  // 1. Filter to adapters applicable to this asset's kind, then
  //    sort by id for deterministic suite/version composition.
  const applicable = input.adapters
    .filter((a) => a.applicableKinds.has(input.asset.kind))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))

  const scannerSuite = applicable.map((a) => a.id).join('+')
  const scannerVersion = applicable.map((a) => a.version).join('+')

  // 2. Fetch bytes once (only if at least one adapter is going
  //    to use them). Pure short-circuit when no adapters are
  //    applicable — avoids an unnecessary storage round-trip.
  let bytes: Buffer | Uint8Array | null = null
  if (applicable.length > 0) {
    bytes = await input.fetchBytes(input.asset.storage_url)
  }

  // 3. Run each applicable adapter sequentially. Sequential
  //    rather than parallel: simpler reasoning, avoids hitting
  //    multiple vendors at once on the same asset, and the
  //    closed-beta volume doesn't benefit from concurrency.
  let aggregateResult: NewsroomScanResult = 'clean'
  const flaggedSet = new Set<string>()
  let firstError: string | undefined

  for (const adapter of applicable) {
    try {
      const out: ScanOutput = await adapter.scan({
        assetKind: input.asset.kind,
        mimeType: input.asset.mime_type,
        bytes: bytes ?? new Uint8Array(),
        storageRef: input.asset.storage_url,
      })
      // Merge any flagged categories from this adapter regardless of
      // whether the adapter declared 'flagged' or 'error' — partial
      // results are still useful signal for the admin queue.
      for (const cat of out.flaggedCategories) {
        flaggedSet.add(cat)
      }
      if (out.result === 'error') {
        aggregateResult = 'error'
        if (!firstError && out.lastError) firstError = out.lastError
      } else if (out.result === 'flagged' && aggregateResult !== 'error') {
        aggregateResult = 'flagged'
      }
    } catch (err) {
      // Adapter threw — most commonly a ScannerError but we accept
      // any throwable. First-error-wins semantics for lastError.
      aggregateResult = 'error'
      const message =
        err instanceof ScannerError
          ? `${err.category}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      if (!firstError) firstError = message
    }
  }

  // 4. CSAM strip (load-bearing defence-in-depth — F5 layer).
  //    See file header for the full invariant story.
  flaggedSet.delete(RESERVED_CSAM_TOKEN)

  const flaggedCategories = Array.from(flaggedSet).sort()

  // 5. If aggregate is 'clean' but we collected categories from
  //    adapters that errored, we shouldn't claim 'clean' — but
  //    we also shouldn't claim 'flagged' on the error path. The
  //    error path keeps result='error' and surfaces categories
  //    informationally.
  return {
    result: aggregateResult,
    flaggedCategories,
    scannerSuite,
    scannerVersion,
    lastError: firstError,
  }
}
