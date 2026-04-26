// ═══════════════════════════════════════════════════════════════
// Frontfiles — Scanner module entry point (NR-D7b, F2)
//
// Public surface of the AV-scanning substrate. Re-exports the
// adapter contract (F1), each implementation (F3, F4), and
// provides the `getScannerAdapters()` factory that reads env to
// select the active set.
//
// Mirrors the storage-module shape at `src/lib/storage/index.ts`.
// Same pattern: types/contract in `types.ts`, implementations in
// sibling files, factory selects via env.
//
// ─── DRIVER SELECTION ──────────────────────────────────────────
//
//   Image moderation
//   ----------------
//   GCV when SCANNER_GCV_PROJECT_ID + SCANNER_GCV_API_KEY are
//   both set. Otherwise stub (image-kind only). Production sets
//   both env vars; dev/test/CI runs without and gets the stub.
//
//   Malware
//   -------
//   Always stub in v1. Real malware vendor (Cloudmersive / ClamAV /
//   etc.) deferred to v1.1 per DIRECTIVE_SEQUENCE.md backlog
//   2026-04-25. The stub covers all five asset kinds so every
//   asset goes through both an image-moderation and a malware
//   adapter slot — keeps the pipeline shape uniform across
//   future vendor swaps.
//
//   Adapter ordering is deterministic: image moderation first,
//   then malware. F5's pipeline preserves this order when
//   composing scanner_suite (e.g. 'gcv_safesearch_v1+malware_stub_v1').
//
// Spec cross-references:
//   - directives/NR-D7b-scan-pipeline.md §F2
//   - src/lib/storage/index.ts (factory pattern mirrored)
// ═══════════════════════════════════════════════════════════════

import { GcvSafeSearchAdapter } from './gcv-safesearch-adapter'
import { StubScannerAdapter } from './stub-adapter'
import type { ScannerAdapter } from './types'

// ── Re-exports (public surface) ────────────────────────────────

export type {
  ScanInput,
  ScanOutput,
  ScannerAdapter,
  ScannerDriver,
} from './types'
export { ScannerError } from './types'
export { StubScannerAdapter } from './stub-adapter'
export { GcvSafeSearchAdapter } from './gcv-safesearch-adapter'

// ── Factory ────────────────────────────────────────────────────

const STUB_DELAY_DEFAULT_MS = 5000

/**
 * Resolve the active set of scanner adapters from env config.
 * Server-only.
 *
 * Reads `process.env` directly (not the parsed `env` snapshot)
 * so test-time `vi.stubEnv` calls and runtime env mutations are
 * honoured per-call. Mirrors `resolveStorageDriver()` in
 * `src/lib/storage/index.ts` (CCP Pattern-a Option 2b — no
 * module-load cache). Zod still validates at boot for fail-fast
 * on malformed deploys; this function applies trim + parse at
 * read time so test liveness works.
 *
 * Returns the adapters in deterministic order (image-moderation
 * before malware). The pipeline preserves this order when
 * composing the persisted `scanner_suite` string.
 */
export function getScannerAdapters(): ReadonlyArray<ScannerAdapter> {
  const adapters: ScannerAdapter[] = []

  // Live env read — vi.stubEnv-friendly + matches storage-adapter pattern.
  const gcvProjectId = process.env.SCANNER_GCV_PROJECT_ID?.trim() || ''
  const gcvApiKey = process.env.SCANNER_GCV_API_KEY?.trim() || ''
  const rawDelay = process.env.SCANNER_STUB_DELAY_MS?.trim()
  const stubDelayMs = rawDelay
    ? Math.max(0, Number.parseInt(rawDelay, 10) || 0)
    : STUB_DELAY_DEFAULT_MS

  // ── Image moderation ──
  if (gcvProjectId.length > 0 && gcvApiKey.length > 0) {
    adapters.push(
      new GcvSafeSearchAdapter({
        apiKey: gcvApiKey,
        projectId: gcvProjectId,
      }),
    )
  } else {
    adapters.push(
      new StubScannerAdapter({
        id: 'image_moderation_stub_v1',
        kinds: new Set(['image']),
        delayMs: stubDelayMs,
      }),
    )
  }

  // ── Malware ──
  // Always stub in v1. Covers all five kinds so every asset
  // produces a uniform two-row scan_result composition. The
  // real malware vendor lands behind this same factory in v1.1.
  adapters.push(
    new StubScannerAdapter({
      id: 'malware_stub_v1',
      kinds: new Set(['image', 'video', 'audio', 'document', 'text']),
      delayMs: stubDelayMs,
    }),
  )

  return adapters
}
