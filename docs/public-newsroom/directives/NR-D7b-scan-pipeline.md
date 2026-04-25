# NR-D7b — AV Scanning Pipeline

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D7a (`8960094`) — asset upload + storage + metadata UI
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~10 new + 2 modified files; route count delta +1 (109 → 110)

---

## 1. Why this directive

NR-D7a ships Asset rows in `pending` scan state with sentinel `scanner_suite='unscanned'` / `scanner_version='0.0.0'`. NR-D7b lights up the scanner pipeline that flips those rows to `clean` / `flagged` / `error`, unlocking the `draft → scheduled` transition (PRD §3.3 publish precondition #4).

**Locked scope (per dispatch ratification):**

- **Adapter pattern** — `getScannerAdapter()` mirrors `getStorageAdapter()`. Stub default for dev/test/CI; real adapters fire when env keys present.
- **Image moderation** — Google Cloud Vision SafeSearch via REST. Maps GCV labels (`adult`, `racy`, `violence`, `medical`, `spoof`) to `flagged_categories`.
- **Malware** — Stub adapter (always returns clean). Real malware vendor selection deferred to v1.1 / launch-hardening (logged in DIRECTIVE_SEQUENCE.md backlog 2026-04-25).
- **Worker** — Vercel Cron, 1-min polling, idempotent batch processing. Picks up `pending` scan_results, runs applicable adapters, writes back via service-role.
- **UI updates** — Client polling (5s interval) on the assets page; auto-stops when no `pending` rows remain. Replaces NR-D7a's static "Scanning…" indicator with live state transitions.

**Out of scope (deferred):**

- **CSAM-specific detection** — atomic with NCMEC reporting in **NR-D17.5** (pre-NR-G5 gate). NR-D7b code paths explicitly never produce `flagged_categories: ['csam']`. PRD §3.2's `csam` enum value is reserved for NR-D17.5.
- Real malware vendor (Cloudmersive / ClamAV / etc.) — v1.1 backlog
- Supabase Realtime subscriptions for UI updates — v1.1 polish
- Per-vendor rate-limit handling (GCV's free-tier quotas are not approached at closed-beta volume) — v1.1 if needed
- Retry-with-backoff for transient errors — v1: simple "error" state with manual retry via admin override (NR-D17 Part C)

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | §3.2 AssetScanResult (line 315), §3.3 transition preconditions (line 576), §5.1 P7 per-Asset row states (lines 858–865, verbatim) |
| Storage adapter precedent | `src/lib/storage/index.ts` + `types.ts` | Pattern to mirror — same factory shape, same env-driven selection |
| Scan results table | `supabase/migrations/20260425000002_*` | `newsroom_asset_scan_results` schema (line 110); `scanner_suite`, `scanner_version`, `result`, `flagged_categories`, `last_error`, `scanned_at` columns |
| Existing schema.ts | `src/lib/db/schema.ts` | `NewsroomAssetRow` (line 681), `NewsroomScanResult` (710), `NewsroomAssetScanResultRow` (729), `NewsroomAssetKind` (627) |
| NR-D7a sentinels | `src/app/api/.../packs/[packSlug]/assets/route.ts` | F5 step 9 — `scanner_suite='unscanned'`, `scanner_version='0.0.0'` overwritten by this directive's worker |
| NR-D7a UI | `src/app/.../assets/_components/asset-row.tsx` | 4-state matrix already implemented in F4; NR-D7b lights up the latent branches via the poller |

PRD §5.1 P7 is verbatim authority for per-Asset row state copy ("Scanning…", "Flagged for review", "Scan error"). PRD §3.2 is verbatim authority for `flagged_categories` shape — but with the documented NR-D7b restriction: **never `['csam']`**.

---

## 3. AUDIT FIRST — MANDATORY

### Pre-audit findings (verified during drafting)

- (P1) **Storage adapter factory** at `src/lib/storage/index.ts:72` is the pattern to mirror exactly. Two adapters (fs / supabase) selected via env. NR-D7b's `getScannerAdapter()` follows the same shape.
- (P2) **`newsroom_asset_scan_results` table** has `scanner_suite TEXT NOT NULL`, `scanner_version TEXT NOT NULL`, `result newsroom_scan_result NOT NULL DEFAULT 'pending'`, `flagged_categories TEXT[] NOT NULL DEFAULT '{}'`, `last_error TEXT NULL`, `scanned_at timestamptz NULL`. Service-role UPDATE permitted; verify RLS posture in audit (a).
- (P3) **NR-D7a sentinel values** are inserted at upload time. Worker overwrites with real adapter identity on scan completion.
- (P4) **No existing scanner module in the codebase.** New `src/lib/scanner/` directory is net-new.

### Audit checks to run

#### (a) `newsroom_asset_scan_results` RLS posture
- Confirm UPDATE policy permits service-role writes. Worker uses service-role.
- Confirm SELECT policy lets the assets page read scan_results joined to assets (NR-D7a F1 already does this read; verify the worker's writes don't conflict).

#### (b) Storage adapter — `getBytes` confirmation
- The pipeline needs to download the uploaded file from storage to feed to GCV (REST API requires bytes or a public URL). Confirm `StorageAdapter.getBytes(storageRef)` exists and returns a `Uint8Array` or `Buffer`.
- If the adapter only exposes `signedGetUrl()` (analogous to NR-D7a's IP-1 signedPutUrl), F4 GCV adapter calls GCV's image-URI endpoint instead of byte upload — surface as IP if so.

#### (c) Vercel cron precedent
- Read `vercel.json` (if present) to confirm the cron declaration syntax used by the project.
- If `vercel.json` doesn't exist, F12 creates it. If it exists with other crons, F12 is an EDIT that appends.
- Confirm the auth header pattern for cron endpoints — typically `x-vercel-cron-secret` or a Vercel-injected header. Surface as IP if the project uses a custom auth check.

#### (d) GCV SafeSearch — auth method
- Two options: API key (simple, less secure, fine for closed beta) or service-account JSON (more secure, required for some operations).
- Confirm which the project supports via existing GCV usage (grep for `googleapis.com` or `google-cloud`). If no precedent, default to API key for v1 simplicity.

#### (e) `vercel.json` cron-frequency limits
- Free tier: max 2 cron jobs, daily frequency only. Pro tier: 40 jobs, 1-minute granularity.
- If project is on Free, **HALT and surface as IP** — 1-min polling isn't available. Fallback: 1-hour polling (acceptable v1 with degraded UX).

#### (f) Schema.ts row-type completeness
- Already verified at drafting: `NewsroomScanResult`, `NewsroomAssetScanResultRow`, `NewsroomAssetKind` all exported.
- No schema.ts edit expected.

#### (g) Test fixture for GCV adapter
- Real GCV calls in CI would require API credentials and create cost/quota friction. F7's GCV adapter test must use a fetch mock — confirm the project's test mock pattern (vitest's `vi.mock` or msw or equivalent). Mirror the existing pattern.

### Audit deliverable

After running checks (a)–(g), report:
- Findings table.
- IPs requiring sign-off.
- Locked file list.

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| F1 | `src/lib/scanner/types.ts` | NEW — `ScannerAdapter` interface, `ScanInput` / `ScanOutput` types, `ScannerError` | ~80 |
| F2 | `src/lib/scanner/index.ts` | NEW — `getScannerAdapter()` factory + re-exports | ~70 |
| F3 | `src/lib/scanner/stub-adapter.ts` | NEW — `StubScannerAdapter`: configurable delay, admin-override flag for forced flag state in tests | ~100 |
| F4 | `src/lib/scanner/gcv-safesearch-adapter.ts` | NEW — `GcvSafeSearchAdapter`: REST call to `/v1/images:annotate`, label mapping, error classification | ~180 |
| F5 | `src/lib/newsroom/scan-pipeline.ts` | NEW — pure orchestration: applies applicable adapters to an Asset, aggregates results, returns scan_result update payload | ~140 |
| F6 | `src/lib/scanner/__tests__/scanner.test.ts` | NEW — vitest cases: factory selection, stub adapter behaviour, label mapping | ~160 |
| F7 | `src/lib/scanner/__tests__/gcv-safesearch-adapter.test.ts` | NEW — vitest cases with fetch mocks: each label combination, error states | ~140 |
| F8 | `src/lib/newsroom/__tests__/scan-pipeline.test.ts` | NEW — vitest cases: multi-adapter aggregation, flagged_categories merge, scanner_suite composition, never-csam invariant | ~150 |
| F9 | `src/app/api/cron/newsroom-scan/route.ts` | NEW — Vercel Cron endpoint: cron-secret check → fetch pending batch → apply pipeline → write back via service-role | ~250 |
| F10 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/assets/_components/scan-poller.tsx` | NEW — `'use client'` 5s polling component; `router.refresh()` when state changes; auto-stops on no pending | ~100 |
| F11 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/assets/page.tsx` | EDIT — mount `<ScanPoller>` when any asset has pending scan_result | +10 / -2 |
| F12 | `src/lib/env.ts` | EDIT — add `SCANNER_GCV_PROJECT_ID` (optional), `SCANNER_GCV_API_KEY` (optional), `SCANNER_STUB_DELAY_MS` (optional, default 5000), `SCANNER_CRON_SECRET` (required in prod) | +30 |
| F13 | `vercel.json` | EDIT (or NEW) — declare `/api/cron/newsroom-scan` cron at `*/1 * * * *` (or `0 * * * *` if Free tier per audit (e)) | +5 |

Totals: 11 NEW + 2 EDIT = 13 conceptual deliverables; +1 route (`/api/cron/newsroom-scan`); 109 → 110.

Note: 13 deliverables is heavier than the 10-target. The expansion comes from clean test split (F6/F7/F8 = 3 test files for 3 logical units). Consolidating tests into one file would save 2 deliverables but make the test file 450+ lines — worse trade-off.

---

## 5. F-specs

### F1 — `src/lib/scanner/types.ts` (NEW)

```ts
import type { NewsroomAssetKind, NewsroomScanResult } from '@/lib/db/schema'

export interface ScanInput {
  assetKind: NewsroomAssetKind
  mimeType: string
  bytes: Uint8Array  // or Buffer; align with StorageAdapter.getBytes() return
  storageRef: string  // for adapter implementations that prefer URIs over bytes
}

export interface ScanOutput {
  result: Exclude<NewsroomScanResult, 'pending'>  // 'clean' | 'flagged' | 'error'
  flaggedCategories: ReadonlyArray<string>  // NEVER includes 'csam' — see §1
  lastError?: string
}

export interface ScannerAdapter {
  readonly id: string         // e.g. 'gcv_safesearch_v1', 'stub_v1'
  readonly version: string    // e.g. '1.0.0'
  readonly applicableKinds: ReadonlySet<NewsroomAssetKind>
  scan(input: ScanInput): Promise<ScanOutput>
}

export type ScannerDriver = 'stub' | 'real'

export class ScannerError extends Error {
  constructor(public readonly category: 'config' | 'transient' | 'permanent', message: string) {
    super(message)
    this.name = 'ScannerError'
  }
}
```

**Key invariant (enforced by F1's TypeScript types AND F8's tests):** `ScanOutput.flaggedCategories` never contains the string `'csam'`. Adapter implementations that internally produce a CSAM-equivalent label MUST drop it from the output array (with a logged warning). The `'csam'` value is reserved for NR-D17.5's atomic detection+reporting pipeline.

### F2 — `src/lib/scanner/index.ts` (NEW)

```ts
import { env } from '@/lib/env'

import { GcvSafeSearchAdapter } from './gcv-safesearch-adapter'
import { StubScannerAdapter } from './stub-adapter'
import type { ScannerAdapter, ScannerDriver } from './types'

export type { ScannerAdapter, ScanInput, ScanOutput, ScannerDriver } from './types'
export { ScannerError } from './types'
export { StubScannerAdapter } from './stub-adapter'
export { GcvSafeSearchAdapter } from './gcv-safesearch-adapter'

/**
 * Resolve the configured scanner driver. Default `'stub'` when env keys
 * are absent (dev / test / CI). Returns the active set of adapters.
 *
 * Image moderation: GCV when SCANNER_GCV_PROJECT_ID + SCANNER_GCV_API_KEY
 * are both set, else stub.
 *
 * Malware: always stub in v1 (real malware scanning deferred to v1.1 per
 * DIRECTIVE_SEQUENCE.md backlog).
 */
export function getScannerAdapters(): ReadonlyArray<ScannerAdapter> {
  const adapters: ScannerAdapter[] = []

  // Image moderation
  if (env.SCANNER_GCV_PROJECT_ID && env.SCANNER_GCV_API_KEY) {
    adapters.push(new GcvSafeSearchAdapter({
      apiKey: env.SCANNER_GCV_API_KEY,
      projectId: env.SCANNER_GCV_PROJECT_ID,
    }))
  } else {
    adapters.push(new StubScannerAdapter({
      id: 'image_moderation_stub_v1',
      kinds: new Set(['image']),
      delayMs: env.SCANNER_STUB_DELAY_MS ?? 5000,
    }))
  }

  // Malware (stub in v1; real adapter added in v1.1)
  adapters.push(new StubScannerAdapter({
    id: 'malware_stub_v1',
    kinds: new Set(['image', 'video', 'audio', 'document', 'text']),
    delayMs: env.SCANNER_STUB_DELAY_MS ?? 5000,
  }))

  return adapters
}
```

### F3 — `src/lib/scanner/stub-adapter.ts` (NEW)

```ts
export interface StubScannerAdapterOptions {
  id: string
  kinds: ReadonlySet<NewsroomAssetKind>
  delayMs: number
  // Test-only: force a flag result for synthetic test inputs whose
  // mimeType matches this regex. Default undefined (always returns clean).
  flagOnMimeRegex?: RegExp
}

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
      await new Promise(r => setTimeout(r, this.delayMs))
    }
    if (this.flagOnMimeRegex?.test(input.mimeType)) {
      return { result: 'flagged', flaggedCategories: ['stub_test_flag'] }
    }
    return { result: 'clean', flaggedCategories: [] }
  }
}
```

### F4 — `src/lib/scanner/gcv-safesearch-adapter.ts` (NEW)

REST call to `https://vision.googleapis.com/v1/images:annotate?key={apiKey}` with body:

```json
{
  "requests": [{
    "image": { "content": "<base64-bytes>" },
    "features": [{ "type": "SAFE_SEARCH_DETECTION" }]
  }]
}
```

Response: `{ responses: [{ safeSearchAnnotation: { adult, spoof, medical, violence, racy } }] }` — each label is `'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY'`.

**Threshold mapping:**
- `LIKELY` or `VERY_LIKELY` → flag the category
- `POSSIBLE` and below → ignore (noise; would over-flag at scale)

**Category mapping (PRD §3.2 + safety carve-out):**

| GCV label | NR-D7b `flagged_categories` value |
|---|---|
| `adult` (LIKELY+) | `'adult'` |
| `racy` (LIKELY+) | `'racy'` |
| `violence` (LIKELY+) | `'violence'` |
| `medical` (LIKELY+) | `'medical'` |
| `spoof` (LIKELY+) | (ignore — not a content-safety concern) |

**CSAM safety:** GCV does not produce a `csam` label. No code path in F4 produces `'csam'` in `flaggedCategories`. F8's tests assert this invariant.

**Error classification:**
- 401/403 → `ScannerError('config', ...)` — bubbles to pipeline as `result: 'error'` with `lastError` set
- 429/5xx → `ScannerError('transient', ...)` — same surface (retried via cron next tick)
- 400 (e.g. unsupported MIME) → `ScannerError('permanent', ...)` — same surface

`applicableKinds: new Set(['image'])` — only fires on image assets.

### F5 — `src/lib/newsroom/scan-pipeline.ts` (NEW)

Pure orchestrator. No I/O of its own — adapters do I/O, pipeline composes their results.

```ts
export interface PipelineInput {
  asset: { kind: NewsroomAssetKind; mime_type: string; storage_url: string }
  adapters: ReadonlyArray<ScannerAdapter>
  fetchBytes: (storageRef: string) => Promise<Uint8Array>  // injected; in worker, calls storage adapter
}

export interface PipelineOutput {
  result: NewsroomScanResult  // 'clean' | 'flagged' | 'error'
  flaggedCategories: ReadonlyArray<string>
  scannerSuite: string  // composed: 'gcv_safesearch_v1+malware_stub_v1'
  scannerVersion: string  // composed: '1.0.0+1.0.0'
  lastError?: string
}

export async function runScanPipeline(input: PipelineInput): Promise<PipelineOutput> {
  // 1. Filter adapters to those applicable to this asset kind
  // 2. Fetch bytes once via fetchBytes()
  // 3. Run each applicable adapter sequentially
  // 4. Aggregate:
  //    - any 'error' → result='error', last error wins, but include flaggedCategories from successful adapters
  //    - any 'flagged' → result='flagged', merge all flaggedCategories arrays (deduped)
  //    - all 'clean' → result='clean', flaggedCategories=[]
  // 5. Compose scanner_suite as 'id1+id2+...' (sorted for determinism)
  // 6. Compose scanner_version as 'v1+v2+...' (matched 1:1 with suite order)
  // 7. STRIP 'csam' from flaggedCategories defensively (invariant from F1)
  // 8. Return PipelineOutput
}
```

### F6 — `src/lib/scanner/__tests__/scanner.test.ts` (NEW)

- Factory `getScannerAdapters()`:
  - Returns 2 stub adapters when no env keys
  - Returns 1 GCV + 1 malware-stub when GCV keys set
  - Adapter ordering deterministic (image-moderation first, malware second)
- `StubScannerAdapter`:
  - Returns `clean` by default
  - Returns `flagged` when `flagOnMimeRegex` matches
  - Respects `delayMs=0` (no setTimeout call)
  - `applicableKinds` filtering (caller filters; adapter doesn't refuse)

### F7 — `src/lib/scanner/__tests__/gcv-safesearch-adapter.test.ts` (NEW)

Mock `fetch` via vitest's `vi.stubGlobal`. Cases:
- All `VERY_UNLIKELY` → result `clean`, categories `[]`
- `adult: LIKELY` → result `flagged`, categories `['adult']`
- `adult: VERY_LIKELY, violence: LIKELY` → categories `['adult', 'violence']`
- `racy: POSSIBLE` → ignored (below threshold)
- `spoof: VERY_LIKELY` → ignored (mapped to `null`)
- 401 response → ScannerError('config')
- 429 → ScannerError('transient')
- Malformed JSON → ScannerError('permanent')
- **Critical invariant test:** even if GCV response somehow includes a `csam` label (synthetic injection), the adapter's output `flaggedCategories` does NOT include `'csam'`. (Defence-in-depth — GCV doesn't actually produce this label, but the test fences against future schema changes.)

### F8 — `src/lib/newsroom/__tests__/scan-pipeline.test.ts` (NEW)

- Single adapter clean → result clean
- Single adapter flagged → result flagged with categories
- Two adapters one clean one flagged → result flagged with merged categories
- One adapter errors → result error with last error
- Adapter not applicable to asset kind → skipped (image-only adapter on a video asset)
- Scanner suite composition: deterministic ordering (alpha by id)
- **Critical invariant test:** if any adapter's output includes `'csam'` (synthetic injection), pipeline strips it before returning. The output's `flaggedCategories` never contains `'csam'`.
- All-stub case (no real adapters): result clean after configured delay

### F9 — `src/app/api/cron/newsroom-scan/route.ts` (NEW)

```ts
export const runtime = 'nodejs'

export async function GET(request: Request) {
  // 1. Auth check: Vercel Cron sends 'authorization: Bearer <SCANNER_CRON_SECRET>'.
  //    Reject if missing or mismatched.
  // 2. Service-role client.
  // 3. Fetch up to BATCH_SIZE (10) pending scan_results JOIN newsroom_assets:
  //    SELECT s.*, a.* FROM newsroom_asset_scan_results s
  //    JOIN newsroom_assets a ON a.id = s.asset_id
  //    WHERE s.result = 'pending'
  //    ORDER BY s.created_at ASC
  //    LIMIT 10
  // 4. For each row:
  //    a. Run runScanPipeline({ asset, adapters: getScannerAdapters(), fetchBytes: storage.getBytes })
  //    b. UPDATE newsroom_asset_scan_results SET
  //         result = pipelineOutput.result,
  //         flagged_categories = pipelineOutput.flaggedCategories,
  //         scanner_suite = pipelineOutput.scannerSuite,
  //         scanner_version = pipelineOutput.scannerVersion,
  //         last_error = pipelineOutput.lastError ?? null,
  //         scanned_at = now()
  //       WHERE id = row.scan_result.id AND result = 'pending'  -- defensive idempotency
  //    c. Log per-asset outcome (asset_id, result, categories) to pino
  // 5. Return { processed: N, results: [{assetId, result}, ...] }
  // 6. Errors per asset are caught and logged; do NOT abort the batch
}
```

Cron secret pattern: read from `env.SCANNER_CRON_SECRET`. In dev (no env set), the route returns 401 — manual testing requires setting the env locally and curling with the Bearer header.

### F10 — `scan-poller.tsx` (NEW, `'use client'`)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ScanPollerProps {
  hasPending: boolean         // initial state from server render
  pollIntervalMs?: number     // default 5000
  maxAttempts?: number        // safety cap, default 60 (= 5 minutes)
}

export function ScanPoller({ hasPending, pollIntervalMs = 5000, maxAttempts = 60 }: ScanPollerProps) {
  const router = useRouter()
  const [active, setActive] = useState(hasPending)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (!active) return
    if (attempts >= maxAttempts) {
      // Stop polling after cap; user can refresh manually
      setActive(false)
      return
    }
    const t = setTimeout(() => {
      router.refresh()
      setAttempts(a => a + 1)
    }, pollIntervalMs)
    return () => clearTimeout(t)
  }, [active, attempts, pollIntervalMs, maxAttempts, router])

  // The component itself renders nothing visible — just owns the polling lifecycle.
  // Server re-render via router.refresh() updates the AssetRow scan-state badges.
  return null
}
```

The "auto-stop when no pending" detection happens via server re-render: when the page re-fetches and finds no pending rows, F11 doesn't render the poller next time.

### F11 — `assets/page.tsx` (EDIT)

Locate the existing JSX for the assets list. After fetching scan_results, compute `hasPending = scanResults.some(s => s.result === 'pending')`. If true, mount `<ScanPoller hasPending={hasPending} />` once near the bottom of the page. The poller is render-less; placement is not visually meaningful.

### F12 — `src/lib/env.ts` (EDIT)

Add:
```ts
SCANNER_GCV_PROJECT_ID: z.string().min(1).optional(),
SCANNER_GCV_API_KEY: z.string().min(1).optional(),
SCANNER_STUB_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
SCANNER_CRON_SECRET: z.string().min(32).optional(),  // required in production; dev allows missing
```

`SCANNER_CRON_SECRET` requires 32+ chars (HMAC-grade). Docs cite `openssl rand -base64 48` per NR-D5b-i precedent. Add to `.env.example` with a placeholder.

### F13 — `vercel.json` (EDIT or NEW)

```json
{
  "crons": [
    { "path": "/api/cron/newsroom-scan", "schedule": "*/1 * * * *" }
  ]
}
```

Audit (e) gates the schedule string. If on Free tier, fall back to `"0 * * * *"` (hourly). Founder accepts the degraded UX in that case.

If `vercel.json` exists with other crons or config, F13 is an EDIT that appends to the `crons` array (preserve existing entries).

---

## 6. New env vars

`SCANNER_GCV_PROJECT_ID`, `SCANNER_GCV_API_KEY`, `SCANNER_STUB_DELAY_MS`, `SCANNER_CRON_SECRET`.

All four added to `.env.example` with placeholder values + comments. Dev workflow: set `SCANNER_CRON_SECRET` only (others optional, stub adapters fire). Production workflow: set all four.

---

## 7. VERIFY block

1. `bun run typecheck` exit 0.
2. `bunx vitest run src/lib/scanner/__tests__/` — all cases green.
3. `bunx vitest run src/lib/newsroom/__tests__/scan-pipeline.test.ts` — green.
4. `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full scanner + newsroom suite green; prior 190/190 still passing.
5. `bun run build` exit 0; route count 109 → 110 (+1 for `/api/cron/newsroom-scan`).
6. **Bounce dev server.**
7. Curl smoke: `GET /api/cron/newsroom-scan` (no auth) → 401. `GET /api/cron/newsroom-scan` with `Authorization: Bearer ${SCANNER_CRON_SECRET}` → 200 with `{ ok: true, processed: 0 }` (no pending rows in fresh DB).
8. Visual smoke deferred (fixture-dependence).
9. Scope diff: `git status --porcelain` shows exactly 13 paths (2M + 11??).

---

## 8. Exit report mandate

Save to `docs/audits/NR-D7b-scan-pipeline-EXIT-REPORT.md`. Standard sections. Founder ratifies.

---

## 9. Standing carry-forward checks

- Audit-first IP discipline; HALT before composing.
- Service-role for newsroom_asset_scan_results writes (worker only).
- Mirror `getStorageAdapter()` factory shape for `getScannerAdapters()`.
- `runtime = 'nodejs'` on F9.
- PRD §5.1 P7 verbatim for per-Asset row state copy.
- **CSAM invariant** — no code path produces `flagged_categories: ['csam']` in NR-D7b. Defence in F1 types, F4 mapping, F5 pipeline strip, F8 test, F7 test.
- Tight per-directive commits; selective add of exactly 15 paths total (13 deliverables + directive + exit report). No `git add -A`.
- Cron secret in production; dev allows missing for local testing.
- New env vars added to `.env.example` with comments documenting closed-beta defaults.

---

## 10. Predecessor sequence

NR-D1 → NR-D2 family → NR-D3 → NR-D4 (Phase NR-1)
→ NR-D5a → NR-D5b-i → NR-D5b-ii → governance merge → NR-D6a → NR-D6b → NR-D7a (`8960094`)
→ **NR-D7b — this directive**
→ NR-D8 (embargo configuration)
→ NR-D9 (rights warranty + publish + state machine RPC)
→ NR-G2 phase gate
→ Phase NR-3 ... NR-D17 → **NR-D17.5** (CSAM detection + NCMEC reporting, atomic) → NR-D21 → NR-G5

---

End of NR-D7b directive.
