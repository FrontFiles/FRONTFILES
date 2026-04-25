// ═══════════════════════════════════════════════════════════════
// Frontfiles — Google Cloud Vision SafeSearch adapter (NR-D7b, F4)
//
// Image moderation via GCV SafeSearch. POSTs base64-encoded image
// bytes to https://vision.googleapis.com/v1/images:annotate and
// maps the {adult, racy, violence, medical, spoof} likelihood
// labels into the project's `flagged_categories` shape.
//
// THRESHOLD: only `'LIKELY'` or `'VERY_LIKELY'` flag the
// category. `'POSSIBLE'` and below are ignored — they
// over-trigger at scale and degrade the signal-to-noise ratio
// admins see in the review queue. NR-D17's admin queue may add
// a "review POSSIBLE" surface in v1.1; for v1, threshold is
// LIKELY+.
//
// SPOOF: GCV's `spoof` label flags doctored images
// (memes / face-swaps / etc.). Not a content-safety concern in
// the press/newsroom context — a doctored image is editorial
// signal, not a moderation flag. Mapping is intentionally
// `ignored`.
//
// ─── CSAM INVARIANT (F4 layer) ─────────────────────────────────
//
// GCV SafeSearch does NOT return a `csam` label — its API
// surface is fixed at the five labels above. F4 maps only those
// five into `flagged_categories`. No code path in this file
// produces the string `'csam'`.
//
// Defence-in-depth: F5's pipeline strips `'csam'` from any
// adapter's output as a final guard. F7's tests assert this
// adapter's output never contains `'csam'` even under synthetic
// injection — see test file for the full assertion.
//
// Spec cross-references:
//   - directives/NR-D7b-scan-pipeline.md §F4
//   - https://cloud.google.com/vision/docs/detecting-safe-search
//   - src/lib/scanner/types.ts (F1 — contract + CSAM invariant)
// ═══════════════════════════════════════════════════════════════

import type { NewsroomAssetKind } from '@/lib/db/schema'

import {
  ScannerError,
  type ScanInput,
  type ScanOutput,
  type ScannerAdapter,
} from './types'

const GCV_ENDPOINT =
  'https://vision.googleapis.com/v1/images:annotate'

// Likelihood values returned by GCV SafeSearch — order matters
// for "LIKELY+" comparison.
type GcvLikelihood =
  | 'UNKNOWN'
  | 'VERY_UNLIKELY'
  | 'UNLIKELY'
  | 'POSSIBLE'
  | 'LIKELY'
  | 'VERY_LIKELY'

const FLAGGING_LIKELIHOODS: ReadonlySet<GcvLikelihood> = new Set([
  'LIKELY',
  'VERY_LIKELY',
])

interface GcvSafeSearchAnnotation {
  adult?: GcvLikelihood
  racy?: GcvLikelihood
  violence?: GcvLikelihood
  medical?: GcvLikelihood
  spoof?: GcvLikelihood
}

interface GcvAnnotateResponse {
  responses?: ReadonlyArray<{
    safeSearchAnnotation?: GcvSafeSearchAnnotation
    error?: { code: number; message: string }
  }>
}

export interface GcvSafeSearchAdapterOptions {
  apiKey: string
  /**
   * GCV project ID. Required by GCV billing routing even though
   * SafeSearch detection itself doesn't read it. Stored for
   * provenance / future logging.
   */
  projectId: string
}

export class GcvSafeSearchAdapter implements ScannerAdapter {
  readonly id = 'gcv_safesearch_v1'
  readonly version = '1.0.0'
  readonly applicableKinds: ReadonlySet<NewsroomAssetKind> = new Set([
    'image',
  ])

  private readonly apiKey: string
  // projectId is captured for completeness / future use; v1 only
  // needs the API key in the URL.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly projectId: string

  constructor(opts: GcvSafeSearchAdapterOptions) {
    if (!opts.apiKey || opts.apiKey.length === 0) {
      throw new ScannerError(
        'config',
        'GcvSafeSearchAdapter: apiKey is required',
      )
    }
    if (!opts.projectId || opts.projectId.length === 0) {
      throw new ScannerError(
        'config',
        'GcvSafeSearchAdapter: projectId is required',
      )
    }
    this.apiKey = opts.apiKey
    this.projectId = opts.projectId
  }

  async scan(input: ScanInput): Promise<ScanOutput> {
    const base64 = Buffer.from(input.bytes).toString('base64')

    const url = `${GCV_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`
    const body = JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        },
      ],
    })

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    } catch (err) {
      // Network-level failure (DNS, connection reset, etc.) — treat
      // as transient. The cron worker will retry next tick.
      const message = err instanceof Error ? err.message : String(err)
      throw new ScannerError(
        'transient',
        `GCV fetch failed: ${message}`,
      )
    }

    if (!response.ok) {
      // Classify by HTTP status so the pipeline surfaces a
      // meaningful `lastError`. The pipeline currently treats all
      // three categories as `result: 'error'`; NR-D17 may
      // differentiate retry semantics later.
      if (response.status === 401 || response.status === 403) {
        throw new ScannerError(
          'config',
          `GCV auth failed (HTTP ${response.status})`,
        )
      }
      if (response.status === 429 || response.status >= 500) {
        throw new ScannerError(
          'transient',
          `GCV vendor unavailable (HTTP ${response.status})`,
        )
      }
      throw new ScannerError(
        'permanent',
        `GCV rejected request (HTTP ${response.status})`,
      )
    }

    let payload: GcvAnnotateResponse
    try {
      payload = (await response.json()) as GcvAnnotateResponse
    } catch {
      throw new ScannerError('permanent', 'GCV returned malformed JSON')
    }

    const first = payload.responses?.[0]
    if (!first) {
      throw new ScannerError(
        'permanent',
        'GCV response missing responses[0]',
      )
    }
    if (first.error) {
      // GCV occasionally returns 200 with a per-request error in the
      // response body (e.g. unsupported MIME at the vendor's end).
      throw new ScannerError(
        'permanent',
        `GCV per-request error: ${first.error.message}`,
      )
    }

    const annotation = first.safeSearchAnnotation ?? {}
    const flagged: string[] = []

    if (
      annotation.adult &&
      FLAGGING_LIKELIHOODS.has(annotation.adult)
    ) {
      flagged.push('adult')
    }
    if (annotation.racy && FLAGGING_LIKELIHOODS.has(annotation.racy)) {
      flagged.push('racy')
    }
    if (
      annotation.violence &&
      FLAGGING_LIKELIHOODS.has(annotation.violence)
    ) {
      flagged.push('violence')
    }
    if (
      annotation.medical &&
      FLAGGING_LIKELIHOODS.has(annotation.medical)
    ) {
      flagged.push('medical')
    }
    // `spoof` is not a content-safety concern; intentionally ignored.

    // ── CSAM defence-in-depth (this layer) ──
    // GCV doesn't produce a `csam` label; this filter is a fence
    // against future schema changes or response anomalies. The
    // pipeline (F5) strips again as a final guard.
    const sanitised = flagged.filter((c) => c !== 'csam')

    return {
      result: sanitised.length > 0 ? 'flagged' : 'clean',
      flaggedCategories: sanitised,
    }
  }
}
