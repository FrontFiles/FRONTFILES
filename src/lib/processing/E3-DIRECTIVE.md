# E3 — Per-Asset Vertex Gemini Vision Job (Class A Implementation)

**Status:** RATIFIED 2026-04-27 + IMPLEMENTED via PR #23 (2026-04-28). Production cutover (`FFF_AI_REAL_PIPELINE=true`) gated on §18 verification gates that require founder action — Vertex pricing fill in `cost.ts`, `@google-cloud/vertexai` SDK shape verification in `google.ts`, GCP service account + Vertex AI User role. Status block updated in the AI-track status-hygiene PR (2026-04-28); directive body unchanged.
**Date:** 2026-04-27
**Predecessor gates:** E1 v2 ✓ + E1.5 ✓ + E2 directive ✓ (ratified 2026-04-27); E2 implementation must ship before E3 implementation begins (E3 reads `asset_proposals` schema E2 creates)
**Governing documents:**
- `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1) — vendor, scope, schema, trust posture
- `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (E1.5) — model pins, prompts, ceilings, image strategy, region failover
- `src/lib/processing/E2-DIRECTIVE.md` — schema + service skeleton (mock adapter; production adapter stub)
- `INTEGRATION_READINESS.md` v2 D1–D12 — D6/D7/D8/D9 binding
- `CLAUDE_CODE_PROMPT_SEQUENCE.md` CCP 7 — Vertex AI wrapper specification (E3 absorbs the subset of CCP 7 needed for the AI suggestion pipeline; CCP 7's broader scope — `generateText` for query understanding etc. — remains a future expansion)

**Objective:** Turn the dormant E2 skeleton into live Vertex Gemini Vision calls, with cache read-through, embedding write, image preparation, cost capture, region routing, and circuit-breaker semantics. Code lands behind `FFF_AI_REAL_PIPELINE=false` (default) — production cutover is a separate flag flip.

---

## 1. What E3 is

E3 implements Class A (the per-asset job) end-to-end. After E3 ships:

- Real `gemini-2.5-flash` calls produce caption / keywords / tags
- Real `text-embedding-004` calls write to shipped `asset_embeddings`
- Real `ai_analysis` cache read-through layer (CCP 3 schema)
- Real region routing per D8 via `users.ai_region` (column added by E3)
- Real cost capture per call into `ai_analysis.cost_cents` and `asset_proposals.generation_cost_cents`
- Real circuit-breaker per region (5 consecutive failures → 60s cooldown)

E3 does NOT activate the worker (E4 wires `dispatcher.ts` and `commit-service.ts`). E3 does NOT ship the UI (E6). E3 does NOT do clustering (E5). The code is exercise-able only through tests + manual invocation until E4 lands.

E3 absorbs three concerns that nominally live in adjacent tracks:
1. **`users.ai_region` column** — INTEGRATION_READINESS Phase 4.B.5a ("creator-residency field on users table before any Vertex AI call"). E3 ships the migration as part of its scope.
2. **`src/lib/ai/google.ts` Vertex client wrapper** — CCP 7 §1 names this file. E3 builds a focused subset (`getClient(region)` + `analyseImage` + `generateEmbedding`) covering the AI-suggestions pipeline's needs. CCP 7 expands later with `generateText` for non-vision use cases without touching what E3 built.
3. **Vertex pricing constants** — E1.5 §7.1 left these as `null` placeholders. E3 verifies and fills them against the live Vertex pricing page at ship time.

Each is named explicitly so the directive doesn't propagate scope creep silently.

---

## 2. Audit findings (current-state read)

| Surface | State | E3 implication |
|---|---|---|
| `package.json` | No Vertex AI SDK installed | E3 adds the SDK package(s) |
| `src/lib/env.ts` | `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `VERTEX_AI_LOCATION` declared as optional | E3 references these; no schema change needed |
| `src/lib/ai/` | Does not exist | E3 creates this directory + `google.ts` |
| `src/lib/ai-suggestions/` | E2 skeleton in place: engine, schema, types, audit, settings, models, adapters/mock-vision, adapters/vertex-vision (stub) | E3 implements `vertex-vision.ts` for real; updates `engine.ts` to add cache + embedding; adds `cache.ts` + `image-prep.ts` + `cost.ts` |
| `users.ai_region` column | Does NOT exist (verified by grep against source) | E3 adds the migration (= Phase 4.B.5a) |
| `asset_embeddings` table | Shipped 2026-04-19 — `vector(768)` HNSW cosine | Reused as-is; embedding writes go here |
| `ai_analysis` table | Shipped 2026-04-19 — read-through cache shape | Reused as-is; cache reads/writes go here |
| `audit_log` table | Shipped 2026-04-19 — system-grain events | E3 writes `ai.gemini.call`, `ai.gemini.cache_hit`, `ai.gemini.circuit_open`, `ai.gemini.quota_exceeded` |
| Storage bridge (`src/lib/processing/storage-bridge.ts`) | Built (PR 4) — `findOriginalStorageRef + readOriginal` pattern | E3 reuses this pattern to fetch original bytes |
| Sharp library | Already in dependencies + used in `src/lib/processing/resize.ts` | E3 reuses for in-memory image-prep |
| `dispatcher.ts`, `commit-service.ts`, `reaper.ts`, `scripts/process-derivatives.ts` | Built (PR 4) — handle derivative jobs only | NOT touched in E3. E4 extends them for proposal jobs. |
| `FFF_REAL_UPLOAD` flag | Default false; gates real upload commit path | E3 follows the same pattern with new flag `FFF_AI_REAL_PIPELINE` |

---

## 3. Hard prerequisites

| Prerequisite | Source | E3 handling |
|---|---|---|
| E2 schema migration shipped | E2 directive | E3 reads `asset_proposals`, `asset_proposal_clusters`, `asset_proposal_audit_log`, `ai_pipeline_settings` tables. If E2 hasn't merged, E3 cannot ship. |
| Vertex AI SDK installable in the build | npm registry + `package.json` | E3 adds the SDK; `bun install` must succeed. SDK package selection in §6.1. |
| GCP project + service account with Vertex AI User role | Manual (per H2 in CLAUDE_CODE_PROMPT_SEQUENCE.md) | E3 documents the requirement; if the service-account JSON is not at `GOOGLE_APPLICATION_CREDENTIALS`, real-mode calls fail with a clear error message; mock-mode tests still pass. |
| `users.ai_region` column | This directive (absorbed Phase 4.B.5a) | E3 ships the migration |
| Verified Vertex pricing as of E3 ship date | Vertex docs | E3 implementation step verifies + fills `cost.ts` |

---

## 4. Scope boundary

E3 **does**:
- Install Vertex AI Node.js SDK package(s) (§6.1)
- Add migration for `users.ai_region` column with default `'eu'` for new users
- Create `src/lib/ai/google.ts` — Vertex client wrapper (focused on AI-suggestions needs)
- Implement `src/lib/ai-suggestions/adapters/vertex-vision.ts` — real adapter using `google.ts`
- Add `src/lib/ai-suggestions/cache.ts` — `ai_analysis` read-through layer
- Add `src/lib/ai-suggestions/image-prep.ts` — Sharp-based in-memory resize per E1.5 §6
- Add `src/lib/ai-suggestions/embedding.ts` — text-embedding-004 wrapper + asset_embeddings upsert
- Add `src/lib/ai-suggestions/cost.ts` — Vertex pricing table (verified at ship) + `centsForCall(modelRole, inputTokens, outputTokens)`
- Add `src/lib/ai-suggestions/circuit-breaker.ts` — per-region state machine
- Add `src/lib/ai-suggestions/quota.ts` — pre-call spend-cap check
- Update `src/lib/ai-suggestions/engine.ts` — orchestrate cache → image-prep → adapter → embedding → cost capture
- Update `src/lib/ai-suggestions/models.ts` — replace `VERIFY_AT_E2_SHIP` with verified version strings
- Update `src/lib/ai-suggestions/adapters/index.ts` — env-flag gate (`FFF_AI_REAL_PIPELINE`) selects real vs mock
- Add `FFF_AI_REAL_PIPELINE` to `src/lib/env.ts` schema
- Tests (15-20 new test files; mock-mode integration + unit per module)

E3 **does not**:
- Activate worker dispatch (E4)
- Activate reaper for `asset_proposals` (E4)
- Add UI (E6)
- Implement clustering (E5)
- Onboarding UI for `ai_region` selection — column exists with default; UI capture lands separately (CCP 7 / Phase 4.B onboarding work)
- Touch `dispatcher.ts`, `reaper.ts`, `commit-service.ts`, `scripts/process-derivatives.ts` (all E4)
- Add `generateText` to `google.ts` (CCP 7 expansion)
- Add `analyseImage` for non-Gemini use cases like Vision API OCR (CCP 9 / v2 enrichment)
- Flip `FFF_AI_REAL_PIPELINE` in any deployed environment
- Migrate any production data

---

## 5. Files added / touched / not touched

**Added:**

```
supabase/migrations/<TIMESTAMP>_users_ai_region_column.sql
supabase/migrations/<TIMESTAMP>_ai_quota_rpc.sql
supabase/migrations/_rollbacks/<TIMESTAMP>_users_ai_region_column.DOWN.sql
supabase/migrations/_rollbacks/<TIMESTAMP>_ai_quota_rpc.DOWN.sql

src/lib/ai/
├── google.ts                  # Vertex client wrapper (focused subset)
└── __tests__/
    └── google.test.ts         # mock-mode tests of the wrapper contract

src/lib/ai-suggestions/
├── cache.ts                   # ai_analysis read-through layer
├── image-prep.ts              # Sharp resize for Vertex Vision input
├── embedding.ts               # text-embedding-004 + asset_embeddings upsert
├── cost.ts                    # verified Vertex pricing + centsForCall()
├── circuit-breaker.ts         # per-region failure state machine
├── quota.ts                   # pre-call spend-cap check
├── prompt-builder.ts          # per-format prompt text + JSON-Schema for Vertex responseSchema
├── caption-guard.ts           # defensive caption truncation (≤ 200 chars at word boundary)
└── __tests__/
    ├── cache.test.ts
    ├── image-prep.test.ts
    ├── embedding.test.ts
    ├── cost.test.ts
    ├── circuit-breaker.test.ts
    ├── quota.test.ts
    ├── prompt-builder.test.ts
    ├── caption-guard.test.ts
    └── engine.real-flow.test.ts  # integration: full Class A under mock-Vertex

scripts/
└── manual-test-vertex-call.ts  # engineer-local QA script (not CI)
```

**Touched:**

```
src/lib/ai-suggestions/engine.ts           # orchestrate cache → adapter → embedding (E2 contract changes — return type widens)
src/lib/ai-suggestions/adapters/index.ts   # add FFF_AI_REAL_PIPELINE gate
src/lib/ai-suggestions/adapters/vertex-vision.ts  # real implementation (was stub)
src/lib/ai-suggestions/adapters/types.ts   # AnalyseImageResult widens to include token counts
src/lib/ai-suggestions/adapters/mock-vision.ts    # match new AnalyseImageResult shape (deterministic stub token counts)
src/lib/ai-suggestions/models.ts           # verified version strings (was VERIFY_AT_E2_SHIP)
src/lib/ai-suggestions/__tests__/engine.mock-flow.test.ts  # E2's mock-flow test updated for new return shape + new orchestration path
src/lib/env.ts                             # add FFF_AI_REAL_PIPELINE flag
.env.example                               # document FFF_AI_REAL_PIPELINE
package.json                               # add Vertex SDK dependency (pinned)
```

**Not touched:**

```
src/lib/processing/dispatcher.ts           # E4
src/lib/processing/reaper.ts               # E4
src/lib/upload/commit-service.ts           # E4
scripts/process-derivatives.ts             # E4
src/lib/ai-suggestions/audit.ts            # already correct from E2
src/lib/ai-suggestions/settings.ts         # already correct from E2
src/lib/ai-suggestions/schema.ts           # already correct from E2
src/lib/ai-suggestions/types.ts            # already correct from E2
src/lib/ai-suggestions/adapters/mock-vision.ts  # already correct from E2
supabase/migrations/20260419110000_phase1_vector_cache_audit.sql  # shipped, reused
```

---

## 6. Vertex SDK install

### 6.1 SDK package selection

The Vertex AI Node.js SDK landscape has two relevant packages:

| Package | Use |
|---|---|
| `@google-cloud/vertexai` | Unified Vertex AI Gemini SDK; handles `generateContent` for vision + text |
| `@google-cloud/aiplatform` | Lower-level Vertex AI platform SDK; has dedicated embedding client |

E3 implementation step:
1. Verify `@google-cloud/vertexai` covers Gemini 2.5 Vision content generation against the current Vertex docs as of E3 ship date.
2. If `@google-cloud/vertexai` covers embeddings (text-embedding-004), use it alone.
3. If embeddings require `@google-cloud/aiplatform`, install both.
4. Pin SDK versions to a specific minor in `package.json` (no `^`); document the pin in the install commit.

The directive does NOT lock the exact SDK package set — package landscape evolves. The contract this directive locks is:
- Authentication via Application Default Credentials (ADC) reading from `GOOGLE_APPLICATION_CREDENTIALS`
- Project ID from `env.GOOGLE_CLOUD_PROJECT_ID`
- Region passed per call (resolved upstream from `users.ai_region`)
- Server-side only — never imported into client bundles

### 6.2 Server-side enforcement

`src/lib/ai/google.ts` MUST be marked server-only via the existing repo pattern. Three guards:

1. File header comment: `SERVER-ONLY. Never import from a client component.`
2. No `'use client'` directive (server modules don't have one)
3. The Next.js module graph normally enforces this, but the file MUST not be re-exported from any module that a client component imports

E3's tests verify the import graph by spot-checking that no `src/app/**/page.tsx` or component imports `@/lib/ai/google` directly.

---

## 7. `users.ai_region` migration

### 7.1 Filename + content

`supabase/migrations/<TIMESTAMP>_users_ai_region_column.sql`:

```sql
-- ════════════════════════════════════════════════════════════════
-- Migration — Add users.ai_region (Phase 4.B.5a, absorbed into E3)
--
-- Per INTEGRATION_READINESS.md D8 + Phase 4.B.5a:
-- "Creator-residency field on users table before any Vertex AI call"
-- Required by E3 (per-asset Vertex Gemini Vision job).
--
-- Default 'eu' for all existing rows + new rows. CCP 7 / Phase 4.B
-- onboarding work captures the user's actual residency at signup
-- and updates this column. Until then, all calls route to
-- europe-west4.
-- ════════════════════════════════════════════════════════════════

CREATE TYPE user_ai_region AS ENUM ('eu', 'us');

ALTER TABLE users
  ADD COLUMN ai_region user_ai_region NOT NULL DEFAULT 'eu';

COMMENT ON COLUMN users.ai_region IS
  'High-level AI processing residency per D8. eu → europe-west4, us → us-central1. Default eu for all existing + new rows; onboarding (CCP 7 / Phase 4.B) captures actual residency.';
```

Rollback at `_rollbacks/<TIMESTAMP>_users_ai_region_column.DOWN.sql`:

```sql
ALTER TABLE users DROP COLUMN IF EXISTS ai_region;
DROP TYPE IF EXISTS user_ai_region;
```

### 7.2 Verification

```bash
psql "$DATABASE_URL" -c "
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'ai_region';
"
# Expected: 1 row, ai_region, USER-DEFINED, NO, 'eu'::user_ai_region

psql "$DATABASE_URL" -c "SELECT count(*) FROM users WHERE ai_region != 'eu';"
# Expected: 0 (all existing users defaulted to 'eu')
```

---

## 8. `src/lib/ai/google.ts` — Vertex client wrapper

### 8.1 Public API

```typescript
/**
 * Frontfiles — Vertex AI Client Wrapper (focused subset for AI suggestions)
 *
 * Per CCP 7 §1 — this file's broader scope (generateText for query
 * understanding, etc.) lives in a future expansion. E3 implements only
 * what the AI suggestion pipeline needs: analyseImage + generateEmbedding.
 *
 * SERVER-ONLY. Never import from a client component.
 *
 * AUTHENTICATION: Application Default Credentials via
 * GOOGLE_APPLICATION_CREDENTIALS env var. Service account requires
 * Vertex AI User role (per H2 in CLAUDE_CODE_PROMPT_SEQUENCE.md).
 *
 * REGION ROUTING: per D8. Each call accepts a VertexRegion explicitly;
 * resolution from users.ai_region happens upstream (not in this module).
 *
 * NO CACHE LAYER HERE: cache.ts wraps this module. Caller is responsible
 * for cache lookup before calling analyseImage or generateEmbedding.
 *
 * NO CIRCUIT BREAKER HERE: circuit-breaker.ts wraps this module. Caller
 * checks circuit state before calling.
 */

import type { VertexRegion } from '@/lib/ai-suggestions/types'

export interface AnalyseImageOpts {
  imageBytes: Buffer
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp'
  prompt: string
  responseSchema: object        // Zod-mirror of VisionResponseSchema
  model: 'flash' | 'pro'        // 'flash' = gemini-2.5-flash; 'pro' = gemini-2.5-pro
  region: VertexRegion
}

export interface AnalyseImageResult {
  output: unknown               // structured JSON; caller validates via Zod
  modelVersion: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

export interface GenerateEmbeddingOpts {
  text: string
  region: VertexRegion
}

export interface GenerateEmbeddingResult {
  embedding: number[]           // 768-dim per text-embedding-004
  modelVersion: string
  inputTokens: number
  latencyMs: number
}

export async function analyseImage(opts: AnalyseImageOpts): Promise<AnalyseImageResult>
export async function generateEmbedding(opts: GenerateEmbeddingOpts): Promise<GenerateEmbeddingResult>
```

### 8.2 Implementation requirements

- Lazy SDK initialization: SDK is `import()`-ed dynamically on first call (avoids paying the load cost in bundle / cold start when ai-suggestions never runs)
- Per-region client cache: `Map<VertexRegion, Client>` so repeat calls in same region reuse the connection
- Map `VertexRegion` to Vertex's location string: `europe-west4` and `us-central1` are already the actual location strings — direct pass-through
- Project ID from `env.GOOGLE_CLOUD_PROJECT_ID`; throw a clear error if unset and `FFF_AI_REAL_PIPELINE=true`
- Auth: ADC via `GOOGLE_APPLICATION_CREDENTIALS`; throw a clear error if file path doesn't resolve and real-mode is selected
- Both functions emit pino logs (per `src/lib/logger.ts` convention) on success + failure

### 8.3 Error handling contract

| Error class | Behavior |
|---|---|
| Auth failure (missing JSON, invalid creds) | Throws `VertexAuthError` with the underlying message; circuit breaker counts as a failure |
| Quota exceeded (Vertex-side, e.g. RateLimitExceeded) | Throws `VertexQuotaError`; circuit breaker counts as a failure; caller can decide to retry-once at outer layer |
| Permanent error (malformed request, schema rejection) | Throws `VertexPermanentError`; circuit breaker does NOT count this; caller marks proposal `failed` immediately |
| Transient error (5xx, network, timeout) | Throws `VertexTransientError`; circuit breaker counts as a failure |
| Empty/invalid response (parsing fails) | Throws `VertexResponseError`; circuit breaker counts as a failure |

The error class names + the count-vs-don't-count classification are part of the contract — the circuit breaker module reads this to decide whether to increment.

---

## 9. `image-prep.ts`

```typescript
/**
 * Frontfiles — AI suggestions image preparation
 *
 * Per E1.5 §6: source = original (NOT watermarked_preview, which has the
 * Frontfiles bar baked in and would contaminate Gemini Vision input).
 *
 * Resizes in-memory to long-edge per ai_pipeline_settings.vision_max_long_edge_px
 * (default 1568px). JPEG quality from settings.
 *
 * Returns inline mode for ≤ 4 MiB; signed-URL mode otherwise. The caller
 * wires the chosen mode into the Vertex request. (For E3 v1, signed-URL
 * mode is unlikely to be hit at long-edge 1568 + JPEG q85 — most assets
 * compress well under 4 MiB. Fallback path included for safety.)
 *
 * Reuses Sharp (already in dependencies).
 */

import sharp from 'sharp'
import { getEffectiveSettings } from './settings'

const MAX_INLINE_BYTES = 4 * 1024 * 1024  // 4 MiB Vertex inline limit

export interface PreparedImage {
  bytes: Buffer
  mime: 'image/jpeg'
  mode: 'inline' | 'signed_url'
}

export async function prepareForVision(
  originalBytes: Buffer,
): Promise<PreparedImage> {
  const settings = await getEffectiveSettings()
  const resized = await sharp(originalBytes)
    .rotate()                              // honor EXIF rotation
    .resize(settings.vision_max_long_edge_px, settings.vision_max_long_edge_px, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: settings.vision_jpeg_quality, mozjpeg: true })
    .toBuffer()

  return {
    bytes: resized,
    mime: 'image/jpeg',
    mode: resized.byteLength <= MAX_INLINE_BYTES ? 'inline' : 'signed_url',
  }
}
```

Tests:
- Resize a fixture image larger than 1568px → output ≤ 1568 long edge, inline mode
- Resize a small image (e.g., 200×200) → output unchanged dimensions (no upscaling), inline mode
- Resize a high-res fixture that compresses to > 4 MiB → signed_url mode (synthetic test using a uncompressible noise image)
- EXIF rotation honored (fixture with rotated EXIF → output is upright)
- Original watermarked preview NOT used (test that the function only touches the bytes it's given)

---

## 10. `cache.ts` — `ai_analysis` read-through

```typescript
/**
 * Frontfiles — AI analysis read-through cache (per CCP 3 schema)
 *
 * Cache key matches ai_analysis UNIQUE constraint:
 *   (subject_type, COALESCE(subject_id, sentinel), model, model_version, input_hash)
 *
 * Hit → return cached output JSONB; emit audit_log 'ai.gemini.cache_hit'
 * Miss → callable returns null; caller invokes Vertex; cache writes the
 *        result via cacheWrite() afterward
 *
 * SERVER-ONLY.
 */

import crypto from 'node:crypto'
import { getSupabaseClient } from '@/lib/db/client'
import { audit } from '@/lib/logger'  // existing logger writes audit_log

const SENTINEL_UUID = '00000000-0000-0000-0000-000000000000'

export interface CacheKey {
  subjectType: 'asset' | 'cluster' | 'query' | 'brief' | 'post'
  subjectId: string | null      // null for 'query' type
  model: string                 // e.g., 'gemini-2.5-flash'
  modelVersion: string          // e.g., 'gemini-2.5-flash-002'
  inputHash: string             // sha256 of normalized input
}

export interface CacheEntry {
  output: unknown
  inputTokens: number | null
  outputTokens: number | null
  costCents: number | null
  modelVersion: string
}

export async function cacheRead(key: CacheKey): Promise<CacheEntry | null> {
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase
    .from('ai_analysis')
    .select('output, token_input, token_output, cost_cents, model_version')
    .eq('subject_type', key.subjectType)
    .eq('subject_id', key.subjectId ?? SENTINEL_UUID)
    .eq('model', key.model)
    .eq('model_version', key.modelVersion)
    .eq('input_hash', key.inputHash)
    .maybeSingle()

  if (error) {
    // Cache lookups failing should NOT block the call — log and return null
    // (force the cache miss path, which calls Vertex). Logging via pino.
    console.error(JSON.stringify({ code: 'cache_read_error', error: error.message, key }))
    return null
  }

  if (!data) return null

  // Audit the hit
  await audit({
    event_type: 'ai.gemini.cache_hit',
    target_type: key.subjectType,
    target_id: key.subjectId,
    metadata: { model: key.model, model_version: key.modelVersion },
  })

  return {
    output: data.output,
    inputTokens: data.token_input,
    outputTokens: data.token_output,
    costCents: data.cost_cents,
    modelVersion: data.model_version,
  }
}

export async function cacheWrite(
  key: CacheKey,
  entry: { output: unknown; inputTokens: number; outputTokens: number; costCents: number; region: string },
): Promise<void> {
  const supabase = await getSupabaseClient()
  const { error } = await supabase
    .from('ai_analysis')
    .insert({
      subject_type: key.subjectType,
      subject_id: key.subjectId,
      model: key.model,
      model_version: key.modelVersion,
      region: entry.region,
      input_hash: key.inputHash,
      output: entry.output,
      token_input: entry.inputTokens,
      token_output: entry.outputTokens,
      cost_cents: entry.costCents,
    })
  if (error) {
    // Cache writes failing should NOT block the call — log and continue.
    console.error(JSON.stringify({ code: 'cache_write_error', error: error.message, key }))
  }
}

export function buildInputHash(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('\x00')).digest('hex')
}
```

Tests:
- Cache hit returns shaped entry; emits audit event
- Cache miss returns null
- Cache write succeeds round-trip
- `buildInputHash` is deterministic (same input → same hash; different input → different hash)
- Cache lookup errors are logged but return null (don't propagate)

---

## 11. `embedding.ts` — text-embedding-004 + asset_embeddings upsert

```typescript
/**
 * Frontfiles — Embedding generation + storage
 *
 * Per E1 v2 §3 E3 + E1.5 §10:
 *   embedding input = caption + " | " + tags.join(", ") + " | " + format
 *   model = text-embedding-004 (768-dim, D7 lock)
 *   storage = asset_embeddings (shipped 2026-04-19)
 *   region = matches Vertex call region (D8 binding; write region == read region)
 *
 * Upserts on asset_id (one row per asset).
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient } from '@/lib/db/client'
import { generateEmbedding as vertexEmbedding } from '@/lib/ai/google'
import { MODELS } from './models'
import type { VisionResponse, VertexRegion } from './types'
import type { AssetFormat } from '@/lib/upload/v2-types'

export function buildEmbeddingInput(
  caption: string,
  tags: string[],
  format: AssetFormat,
): string {
  const tagsStr = tags.length > 0 ? tags.join(', ') : '(no tags)'
  return `${caption} | ${tagsStr} | ${format}`
}

export interface UpsertEmbeddingOpts {
  assetId: string
  visionResponse: VisionResponse
  format: AssetFormat
  region: VertexRegion
}

export async function generateAndUpsertEmbedding(
  opts: UpsertEmbeddingOpts,
): Promise<{ inputTokens: number; latencyMs: number }> {
  const text = buildEmbeddingInput(
    opts.visionResponse.caption,
    opts.visionResponse.tags,
    opts.format,
  )

  const result = await vertexEmbedding({ text, region: opts.region })

  const supabase = await getSupabaseClient()
  const { error } = await supabase
    .from('asset_embeddings')
    .upsert({
      asset_id: opts.assetId,
      embedding: result.embedding,                  // pgvector accepts number[]
      model: MODELS.embedding,
      model_version: result.modelVersion,
      region: opts.region,
      updated_at: new Date().toISOString(),
    })
  if (error) {
    throw new Error(`Failed to upsert asset_embedding for ${opts.assetId}: ${error.message}`)
  }

  return { inputTokens: result.inputTokens, latencyMs: result.latencyMs }
}
```

Tests:
- `buildEmbeddingInput` formats correctly across the 4 image formats
- `buildEmbeddingInput` handles empty tags gracefully
- `generateAndUpsertEmbedding` upserts the row correctly (mock-mode: stub `vertexEmbedding` returns deterministic 768-element array)
- Region in upsert matches passed region (D8 verification)
- Upsert overwrites existing row (same asset_id → row updated, not duplicated)

---

## 12. `cost.ts` — verified Vertex pricing

E3 implementation step: visit `cloud.google.com/vertex-ai/generative-ai/pricing` and replace the placeholders in this file with current values. Add a header comment noting the verification date + URL.

```typescript
/**
 * Frontfiles — Vertex AI cost calculation
 *
 * Pricing constants verified against cloud.google.com/vertex-ai/generative-ai/pricing
 * on <DATE> by <ENGINEER>. Re-verify quarterly per E1.5 §3.1 bump policy.
 *
 * If pricing has changed since verification, update the constants and the
 * date comment. Out-of-date pricing → cost capture is wrong → spend cap
 * decisions are wrong → real cost may exceed configured ceiling silently.
 */

import type { ModelRole } from './models'

// VERIFY THESE NUMBERS AT E3 IMPLEMENTATION TIME.
// Format: cents per 1M tokens for input/output; cents per image for image input.
export const VERTEX_PRICING = {
  vision_per_asset: {
    // gemini-2.5-flash
    input_per_1m_tokens_cents: null as number | null,   // CONFIRM AT E3
    output_per_1m_tokens_cents: null as number | null,  // CONFIRM AT E3
    image_per_unit_cents: null as number | null,        // CONFIRM AT E3
  },
  cluster_naming: {
    // gemini-2.5-pro
    input_per_1m_tokens_cents: null as number | null,
    output_per_1m_tokens_cents: null as number | null,
    image_per_unit_cents: null as number | null,
  },
  embedding: {
    // text-embedding-004
    input_per_1m_tokens_cents: null as number | null,
  },
} as const

export interface CallTokens {
  inputTokens: number
  outputTokens: number
  imageCount?: number  // for vision calls
}

export function centsForCall(role: ModelRole, tokens: CallTokens): number {
  const pricing = VERTEX_PRICING[role]
  if (!pricing) {
    throw new Error(`No pricing defined for model role: ${role}`)
  }
  const input = pricing.input_per_1m_tokens_cents
  const output = 'output_per_1m_tokens_cents' in pricing ? pricing.output_per_1m_tokens_cents : 0
  const imagePer = 'image_per_unit_cents' in pricing ? pricing.image_per_unit_cents : 0

  if (input === null || output === null || imagePer === null) {
    throw new Error(`Vertex pricing not yet verified for ${role}; replace nulls in cost.ts before merge`)
  }

  const inputCost = (tokens.inputTokens / 1_000_000) * input
  const outputCost = (tokens.outputTokens / 1_000_000) * output
  const imageCost = (tokens.imageCount ?? 0) * imagePer

  return Math.ceil(inputCost + outputCost + imageCost)  // round up to nearest cent
}
```

The throw-on-null guards force E3 implementation to fill the values before any production call. The unit test verifies the throw fires when nulls remain.

---

## 13. `circuit-breaker.ts`

Per E1.5 §11. Stateful per-region; in-memory only (no DB persistence — circuit state is per-process and short-lived).

```typescript
import type { VertexRegion } from './types'
import { getEffectiveSettings } from './settings'
import { audit } from '@/lib/logger'

interface CircuitState {
  consecutiveFailures: number
  state: 'closed' | 'open'
  openedAt: number | null
}

const states: Map<VertexRegion, CircuitState> = new Map([
  ['europe-west4', { consecutiveFailures: 0, state: 'closed', openedAt: null }],
  ['us-central1',  { consecutiveFailures: 0, state: 'closed', openedAt: null }],
])

export class CircuitOpenError extends Error {
  constructor(public region: VertexRegion) {
    super(`Circuit open for region ${region}`)
  }
}

export async function checkCircuitOrFail(region: VertexRegion): Promise<void> {
  const settings = await getEffectiveSettings()
  const s = states.get(region)!
  if (s.state === 'closed') return

  // open — check cool-down
  const now = Date.now()
  const elapsed = now - (s.openedAt ?? 0)
  if (elapsed < settings.circuit_cooldown_ms) {
    throw new CircuitOpenError(region)
  }
  // cool-down elapsed; transition to half-open (the next call probes)
  // We do NOT proactively close — the probe call's success/failure determines state
}

export async function recordSuccess(region: VertexRegion): Promise<void> {
  const s = states.get(region)!
  if (s.state === 'open' || s.consecutiveFailures > 0) {
    s.state = 'closed'
    s.consecutiveFailures = 0
    s.openedAt = null
    await audit({
      event_type: 'ai.gemini.circuit_close',
      target_type: 'vertex_region',
      target_id: region,
    })
  }
}

export async function recordFailure(
  region: VertexRegion,
  shouldCount: boolean,
): Promise<void> {
  if (!shouldCount) return  // permanent errors don't trip the breaker
  const settings = await getEffectiveSettings()
  const s = states.get(region)!
  s.consecutiveFailures += 1
  if (s.consecutiveFailures >= settings.circuit_failure_threshold && s.state === 'closed') {
    s.state = 'open'
    s.openedAt = Date.now()
    await audit({
      event_type: 'ai.gemini.circuit_open',
      target_type: 'vertex_region',
      target_id: region,
      metadata: { consecutive_failures: s.consecutiveFailures },
    })
  }
}

// For tests
export function resetCircuitForTest(region: VertexRegion): void {
  states.set(region, { consecutiveFailures: 0, state: 'closed', openedAt: null })
}
```

Tests:
- 5 consecutive failures → state = 'open'; sixth call throws CircuitOpenError
- After cooldown, next call probes (passes circuit check); if probe succeeds, breaker closes
- If probe fails, breaker re-opens with fresh timer
- Successes reset counter; recordSuccess is a no-op when already closed + counter at 0
- Permanent errors don't increment (shouldCount=false)
- No cross-region fall-through (D8 verification: opening EU doesn't affect US state, calls to US still work)

---

## 14. `quota.ts` — pre-call spend cap check

```typescript
import { getSupabaseClient } from '@/lib/db/client'
import { getEffectiveSettings } from './settings'

export class QuotaExceededError extends Error {
  constructor(public scope: 'daily' | 'monthly') {
    super(`platform_quota_exceeded_${scope}`)
  }
}

export async function checkSpendOrFail(): Promise<void> {
  const settings = await getEffectiveSettings()
  const supabase = await getSupabaseClient()

  // Daily check
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { data: dailyData } = await supabase.rpc('sum_ai_cost_cents_since', {
    since: startOfDay.toISOString(),
  })
  const dailyCents = (dailyData as number) ?? 0
  if (dailyCents >= settings.daily_cap_cents) {
    throw new QuotaExceededError('daily')
  }

  // Monthly check
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  const { data: monthlyData } = await supabase.rpc('sum_ai_cost_cents_since', {
    since: startOfMonth.toISOString(),
  })
  const monthlyCents = (monthlyData as number) ?? 0
  if (monthlyCents >= settings.monthly_cap_cents) {
    throw new QuotaExceededError('monthly')
  }
}
```

The `sum_ai_cost_cents_since(since timestamptz)` RPC is added by E3 in a small migration alongside the users.ai_region migration:

```sql
-- supabase/migrations/<TIMESTAMP>_ai_quota_rpc.sql

CREATE OR REPLACE FUNCTION sum_ai_cost_cents_since(since timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_cents), 0)::bigint
  FROM ai_analysis
  WHERE created_at >= since AND cost_cents IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION sum_ai_cost_cents_since(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sum_ai_cost_cents_since(timestamptz) TO service_role;
```

`SECURITY DEFINER` is needed because `ai_analysis` is RLS service-role-only; the function runs with the definer's privileges so the worker can call it via service role. `REVOKE ALL` then explicit `GRANT TO service_role` makes the access boundary explicit.

Tests:
- Pre-day under cap → no throw
- At cap → QuotaExceededError('daily')
- Over cap → QuotaExceededError('daily')
- Same for monthly

---

## 14.5 `prompt-builder.ts` + `caption-guard.ts`

Two small modules that the real adapter and engine consume.

### 14.5.1 `prompt-builder.ts`

Builds the per-format prompt text and the JSON-Schema `responseSchema` Vertex Gemini requires, both per E1.5 §4.

```typescript
/**
 * Frontfiles — AI-suggestions prompt builder
 *
 * Builds (a) the per-format prompt text per E1.5 §4 and (b) the
 * JSON-Schema responseSchema per E1.5 §4.3. The real vertex-vision
 * adapter calls these to assemble the Vertex Gemini request.
 *
 * Shared preamble + per-format instruction block + taxonomy injection.
 * Locked-text source: E1.5 §4. Changes to prompt text are bump-policy
 * decisions (E1.5 §3.1) — regression sample (§12.4) reruns on prompt
 * changes the same way it does on model bumps.
 */

import type { AssetFormat } from '@/lib/upload/v2-types'

const SHARED_PREAMBLE = (taxonomyTopN: string[], format: AssetFormat) => `
You are providing AI-suggested metadata for an editorial asset on Frontfiles, a
professional platform for journalists, creators, editors, and publishers.

The creator will review every suggestion. Be specific but conservative. If you
are uncertain, lower your confidence score for that field.

Constraints — these are not optional:
1. Do not assert factual claims about identified persons, locations, or events
   that you cannot derive from the image alone. No naming people. No location
   identification beyond what is visually unambiguous.
2. Do not include intent, motive, or context not visually present.
3. Do not use authoritative or certifying language. Output describes what is
   visible, not what is true.
4. Caption: maximum 200 characters. Do not exceed.
5. Output ONLY valid JSON matching the provided schema. No commentary, no
   markdown, no preface.

Existing creator taxonomy (preferred tag vocabulary, ordered by usage):
${taxonomyTopN.length > 0 ? taxonomyTopN.join(', ') : '(none — creator has no prior tags; suggest new tags above 0.75 confidence)'}

Asset format: ${format}
`.trim()

const PHOTO_BLOCK = `
For a photograph, generate:
- caption: a description of what is visible — subject, setting, action, mood.
  Plain descriptive prose. Avoid editorialising.
- keywords: 3-8 words/phrases capturing visual concepts (subject, setting,
  light, mood, composition).
- tags: choose primarily from the creator's existing taxonomy above. Suggest
  a new tag only if no existing tag fits AND your confidence is at least 0.75.
`.trim()

const ILLUSTRATION_BLOCK = `... (per E1.5 §4.2; see E1.5 for full text)`
const INFOGRAPHIC_BLOCK = `... (per E1.5 §4.2; see E1.5 for full text)`
const VECTOR_BLOCK = `... (per E1.5 §4.2; see E1.5 for full text)`

const FORMAT_BLOCKS: Record<AssetFormat, string> = {
  photo: PHOTO_BLOCK,
  illustration: ILLUSTRATION_BLOCK,
  infographic: INFOGRAPHIC_BLOCK,
  vector: VECTOR_BLOCK,
}

export function buildPrompt(format: AssetFormat, taxonomyTopN: string[]): string {
  return `${SHARED_PREAMBLE(taxonomyTopN, format)}\n\n${FORMAT_BLOCKS[format]}`
}

// JSON-Schema for Vertex's responseSchema parameter. Mirrors the Zod
// VisionResponseSchema (schema.ts) so adapter-side response validation
// against Zod always succeeds when Gemini honors this schema.
export const VISION_RESPONSE_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    caption: { type: 'STRING' },
    caption_confidence: { type: 'NUMBER' },
    keywords: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 3, maxItems: 8 },
    keywords_confidence: { type: 'NUMBER' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    tags_confidence: { type: 'NUMBER' },
    new_tags_with_confidence: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tag: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['tag', 'confidence'],
      },
    },
  },
  required: [
    'caption', 'caption_confidence',
    'keywords', 'keywords_confidence',
    'tags', 'tags_confidence',
  ],
} as const
```

The implementer fills in ILLUSTRATION/INFOGRAPHIC/VECTOR blocks verbatim from E1.5 §4.2. Tests verify each block contains the format-specific keywords (e.g., illustration block mentions "watercolor"; infographic block mentions "chart").

### 14.5.2 `caption-guard.ts`

Defensive truncation per E1.5 §4.4.

```typescript
/**
 * Frontfiles — Defensive caption truncation
 *
 * Per E1.5 §4.4. Gemini structured output usually respects the 200-char
 * cap, but the cap is binding (DB CHECK constraint). If Gemini exceeds,
 * truncate at last word boundary ≤ 197 chars + "...". Logs a soft signal
 * via audit_log so prompt refinement can correlate.
 */

import { audit } from '@/lib/logger'

const CAP = 200
const TRUNCATE_TARGET = 197  // leaves room for "..."

export async function guardCaption(caption: string, assetId: string): Promise<string> {
  if (caption.length <= CAP) return caption

  // Truncate at last whitespace ≤ TRUNCATE_TARGET
  const slice = caption.slice(0, TRUNCATE_TARGET)
  const lastSpace = slice.lastIndexOf(' ')
  const truncated = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '...'

  await audit({
    event_type: 'ai.gemini.caption_truncated',
    target_type: 'asset',
    target_id: assetId,
    metadata: {
      original_length: caption.length,
      truncated_length: truncated.length,
    },
  })

  return truncated
}
```

Tests:
- Caption ≤ 200 → returned unchanged, no audit
- Caption > 200 → truncated at word boundary, ends with "...", length ≤ 200
- Caption > 200 with no spaces in first 197 chars → hard-cut at 197 + "..."
- audit event fired with original + truncated lengths

---

## 15. `engine.ts` orchestration update

E2 left the engine as a thin pass-through to the adapter. E3 expands it to full Class A:

```typescript
// E3 update — full orchestration

import { prepareForVision } from './image-prep'
import { cacheRead, cacheWrite, buildInputHash } from './cache'
import { generateAndUpsertEmbedding } from './embedding'
import { centsForCall } from './cost'
import { checkSpendOrFail } from './quota'
import { checkCircuitOrFail, recordSuccess, recordFailure } from './circuit-breaker'
import { audit } from '@/lib/logger'
import { MODELS } from './models'
import { getAdapter } from './adapters'
import { getEffectiveSettings } from './settings'
import { VisionResponseSchema } from './schema'
import type { VisionResponse, VertexRegion } from './types'
import type { AssetFormat } from '@/lib/upload/v2-types'

export interface GenerateProposalOpts {
  assetId: string
  creatorId: string
  format: AssetFormat
  originalBytes: Buffer        // raw bytes from storage bridge
  region: VertexRegion
  taxonomyTopN: string[]
}

export interface GenerateProposalResult {
  visionResponse: VisionResponse
  modelVersion: string
  costCents: number
  latencyMs: number
  cacheHit: boolean
  region: VertexRegion
}

export async function generateAssetProposal(
  opts: GenerateProposalOpts,
): Promise<GenerateProposalResult> {
  // 1. Pre-checks: circuit + quota
  await checkCircuitOrFail(opts.region)
  await checkSpendOrFail()

  // 2. Image prep
  const prepared = await prepareForVision(opts.originalBytes)

  // 3. Build cache key
  const imageSha = require('node:crypto').createHash('sha256').update(prepared.bytes).digest('hex')
  const cacheKey = {
    subjectType: 'asset' as const,
    subjectId: opts.assetId,
    model: MODELS.vision_per_asset,
    modelVersion: MODELS.vision_per_asset,  // pin string is the version per §3.1
    inputHash: buildInputHash([
      opts.format,
      opts.taxonomyTopN.join(','),
      imageSha,
    ]),
  }

  // 4. Cache read
  const cached = await cacheRead(cacheKey)
  if (cached) {
    const visionResponse = VisionResponseSchema.parse(cached.output)
    // Still run embedding write — the embedding may not exist yet
    // (cache hit on Vision doesn't imply prior embedding write)
    await generateAndUpsertEmbedding({
      assetId: opts.assetId,
      visionResponse,
      format: opts.format,
      region: opts.region,
    })
    return {
      visionResponse,
      modelVersion: cached.modelVersion,
      costCents: 0,                 // cache hit costs nothing
      latencyMs: 0,
      cacheHit: true,
      region: opts.region,
    }
  }

  // 5. Cache miss — call Vertex
  const adapter = getAdapter()
  const start = Date.now()
  let result
  try {
    result = await adapter.analyseImage({
      imageBytes: prepared.bytes,
      imageMime: prepared.mime,
      format: opts.format,
      region: opts.region,
      taxonomyTopN: opts.taxonomyTopN,
      settings: await getEffectiveSettings(),
    })
    await recordSuccess(opts.region)
  } catch (err) {
    // Classification of err → shouldCount happens inside circuit-breaker
    // based on the error class (VertexPermanentError doesn't count)
    const shouldCount = !(err as Error).name?.includes('Permanent')
    await recordFailure(opts.region, shouldCount)
    throw err
  }
  const latencyMs = Date.now() - start

  // 6. Defensive caption truncation (per E1.5 §4.4) BEFORE Zod validation
  // (Zod's .max(200) on caption would throw otherwise; truncation is the
  // policy, not rejection)
  const rawResponse = result as { response: VisionResponse; inputTokens: number; outputTokens: number; modelVersion: string }
  rawResponse.response.caption = await guardCaption(rawResponse.response.caption, opts.assetId)

  // 7. Validate via Zod (now that caption is within bounds)
  const visionResponse = VisionResponseSchema.parse(rawResponse.response)

  // 8. Filter new tags by 0.75 confidence floor (per E1.5 §5.1)
  // (this filtering already happens in the adapter for cleanliness; double-check at engine level)
  const settings = await getEffectiveSettings()
  visionResponse.tags = [
    ...visionResponse.tags,
    ...(visionResponse.new_tags_with_confidence ?? [])
      .filter(t => t.confidence >= settings.confidence_floor_tags_new)
      .map(t => t.tag),
  ]

  // 9. Cost capture (token counts come from adapter via inputTokens/outputTokens
  // properties on the result — adapter must surface these)
  const inputTokens = (result as any).inputTokens ?? 0
  const outputTokens = (result as any).outputTokens ?? 0
  const costCents = centsForCall('vision_per_asset', { inputTokens, outputTokens, imageCount: 1 })

  // 10. Cache write
  await cacheWrite(cacheKey, {
    output: visionResponse,
    inputTokens,
    outputTokens,
    costCents,
    region: opts.region,
  })

  // 11. Embedding write
  await generateAndUpsertEmbedding({
    assetId: opts.assetId,
    visionResponse,
    format: opts.format,
    region: opts.region,
  })

  // 12. Audit log
  await audit({
    event_type: 'ai.gemini.call',
    target_type: 'asset',
    target_id: opts.assetId,
    metadata: { region: opts.region, cost_cents: costCents, latency_ms: latencyMs },
  })

  return {
    visionResponse,
    modelVersion: MODELS.vision_per_asset,
    costCents,
    latencyMs,
    cacheHit: false,
    region: opts.region,
  }
}
```

**Note on token counts in the adapter result:** The current `VisionAdapter.analyseImage` interface from E2 returns `VisionResponse` only (no token counts). E3 must extend the adapter contract to surface `inputTokens` + `outputTokens`. Update `adapters/types.ts`:

```typescript
export interface AnalyseImageResult {
  response: VisionResponse
  inputTokens: number
  outputTokens: number
  modelVersion: string
}

export interface VisionAdapter {
  analyseImage(opts: AnalyseImageOpts): Promise<AnalyseImageResult>
}
```

Both `mock-vision.ts` and `vertex-vision.ts` adapters update accordingly. The mock returns deterministic stub token counts (e.g., `inputTokens: 100, outputTokens: 30`) so cost-capture tests have predictable values.

---

## 16. `FFF_AI_REAL_PIPELINE` env flag

Add to `src/lib/env.ts`:

```typescript
FFF_AI_REAL_PIPELINE: z
  .enum(['true', 'false'])
  .default('false')
  .describe('Gates real Vertex AI calls in the AI suggestion pipeline. `false` → mock adapter is selected regardless of NODE_ENV. `true` → real Vertex adapter; requires GOOGLE_APPLICATION_CREDENTIALS + GOOGLE_CLOUD_PROJECT_ID. Default false; flip true at PR-5-equivalent cutover.'),
```

Add to `flags`:

```typescript
get aiRealPipeline(): boolean {
  return process.env.FFF_AI_REAL_PIPELINE === 'true'
},
```

Add to `.env.example`:

```bash
# Gates real Vertex AI calls. Default false (mock adapter active).
# Set true only when GOOGLE_APPLICATION_CREDENTIALS + GOOGLE_CLOUD_PROJECT_ID
# are configured AND your GCP project has Vertex AI enabled.
FFF_AI_REAL_PIPELINE=false
```

Update `adapters/index.ts` to read this flag:

```typescript
export function getAdapter(): VisionAdapter {
  if (flags.aiRealPipeline) {
    return vertexVisionAdapter
  }
  return mockVisionAdapter
}
```

(The E2 directive had a temp inline check; this replaces it.)

---

## 17. Tests

### 17.1 Coverage matrix

| File | Coverage |
|---|---|
| `__tests__/google.test.ts` | Lazy SDK init only happens on first call; per-region client cache works; ADC error surfaces clearly; project-id missing → clear error |
| `__tests__/cache.test.ts` | hit / miss / write / hash determinism / lookup-error tolerance |
| `__tests__/image-prep.test.ts` | resize behaviors; EXIF rotation; inline vs signed_url mode |
| `__tests__/embedding.test.ts` | input formatting; upsert correctness; region capture |
| `__tests__/cost.test.ts` | centsForCall correctness; throws on null pricing; rounds up cents |
| `__tests__/circuit-breaker.test.ts` | trip / cool-down / probe / reset; permanent errors don't count; no cross-region fall-through |
| `__tests__/quota.test.ts` | under/at/over cap; daily and monthly |
| `__tests__/engine.real-flow.test.ts` | end-to-end with mock vertex adapter: cache miss → call → embedding write → cache write → audit log; cache hit path; circuit-open path |

### 17.2 Test infrastructure

- All tests use mock adapter (real Vertex calls require credentials not in CI)
- Vertex SDK module is dynamically imported in real-mode only; tests stay in mock-mode so SDK is never loaded → tests run without `GOOGLE_APPLICATION_CREDENTIALS`
- Use `scopeEnvVars` for FFF_AI_REAL_PIPELINE per-test toggle
- Mock supabase client provides `ai_analysis` and `asset_embeddings` query stubs

### 17.3 Manual integration test (NOT CI; engineer-run)

After install + with valid credentials configured locally:

```bash
FFF_AI_REAL_PIPELINE=true bun run scripts/manual-test-vertex-call.ts <asset-id>
```

A small ad-hoc script that:
1. Reads original bytes for the given asset
2. Calls `generateAssetProposal` with the asset's format + creator's ai_region
3. Prints the structured response + cost + latency

This script is committed to `scripts/` as part of E3 for repeatable manual QA. NOT exercised in CI.

---

## 18. Verification gates

Before merge:

```bash
# 1. tsc clean
npx tsc --noEmit 2>&1 | grep -cE "error TS"
# Expected: 8 (pre-existing baseline; no new errors)

# 2. vitest green
bun run test 2>&1 | tail -10
# Expected: all suites pass; +15-20 new test files

# 3. Migrations apply cleanly
supabase db reset
supabase db push
psql "$DATABASE_URL" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='users' AND column_name='ai_region';
"
# Expected: 1 row

psql "$DATABASE_URL" -c "
  SELECT proname FROM pg_proc WHERE proname='sum_ai_cost_cents_since';
"
# Expected: 1 row

# 4. Build green (FFF_AI_REAL_PIPELINE=false default)
bun run build 2>&1 | tail -5
# Expected: build exits 0; no Vertex SDK loaded in client bundle (verify by
# inspecting .next/build manifest or by checking bundle-size diff)

# 5. cost.ts pricing constants verified
grep -c "null as number | null" src/lib/ai-suggestions/cost.ts
# Expected: 0 (every null replaced with verified value before merge)

# 6. Real-mode smoke test (engineer-local; not CI)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json \
GOOGLE_CLOUD_PROJECT_ID=frontfiles-prod \
FFF_AI_REAL_PIPELINE=true \
bun run scripts/manual-test-vertex-call.ts <test-asset-id>
# Expected: prints valid VisionResponse JSON + cost > 0 + latency > 0
# Expected: ai_analysis row created; asset_embeddings row upserted; audit_log row appended

# 7. Rollback works
psql "$DATABASE_URL" -f supabase/migrations/_rollbacks/<TIMESTAMP>_users_ai_region_column.DOWN.sql
psql "$DATABASE_URL" -c "\d users" | grep -c ai_region
# Expected: 0
# Then re-apply forward
```

---

## 19. Approval gate

Founder reviews PR before merge:

| Item | Approved means |
|---|---|
| Migration filename uses ship-date timestamp | Not 2026-04-27 if ship is later |
| Vertex SDK package selection | `@google-cloud/vertexai` (or amended at install time per current docs); pinned to specific version |
| Pricing constants in `cost.ts` are NOT null | Verified-current values + verification-date comment + URL |
| Model pin strings in `models.ts` are NOT `VERIFY_AT_E3_SHIP` | Replaced with current Vertex stable strings |
| `users.ai_region` migration creates column with default `'eu'` | Existing rows defaulted; new rows default to `'eu'` |
| `FFF_AI_REAL_PIPELINE=false` default | Default false in env schema + .env.example |
| All 8 verification gates green | Including the engineer-local Vertex smoke test |
| RLS on existing tables not changed | `ai_analysis`, `asset_embeddings` still service-role-only |

Founder's options:
1. **Approve + merge** — E4 directive composes next (worker integration)
2. **Approve with corrections** — name the diff
3. **Revise** — substantive concern
4. **Reject** — would mean E1 v2 / E1.5 / E2 was wrong

---

## 20. Don't-do list

1. **Don't activate FFF_AI_REAL_PIPELINE in any deployed env.** PR ships dormant. Production cutover is a separate flag flip after E4-E6 land.
2. **Don't import `@/lib/ai/google` from a client component.** Server-side only. Verify by spot-checking `src/app/**/page.tsx` and components don't reach it.
3. **Don't extend the cache to skip RLS.** ai_analysis stays service-role-only; the cache module uses the service-role client.
4. **Don't add `analyseImage` for non-Gemini Vision use cases** (e.g., Vision API OCR, landmark detection). Those are CCP 9 / v2 enrichment.
5. **Don't add `generateText` to `google.ts`.** That's CCP 7's broader scope; future expansion. E3's `google.ts` has only the methods the AI suggestion pipeline needs.
6. **Don't add cross-region fall-through.** D8 binding. If creator's region is open, calls hold pending; never route to the other region.
7. **Don't bypass the cache for repeatable queries.** Even if the cache lookup fails (logged + returned null), the cache write still happens after a successful Vertex call.
8. **Don't fetch `original` from `watermarked_preview`.** Watermarked preview has the bar baked in; image-prep MUST use `original` bytes via the storage bridge.
9. **Don't hardcode `1568px` in image-prep.** It comes from `ai_pipeline_settings.vision_max_long_edge_px`; settings table is the source of truth.
10. **Don't ship null pricing values in `cost.ts`.** Verification gate #5 enforces this.
11. **Don't create a `worker.ts`.** E3 ships the orchestration as a callable function (`generateAssetProposal`); E4 wires the worker invocation around it.
12. **Don't write to `vault_assets.{title, description, tags}`.** E3 writes to `asset_proposals` (the proposal layer); creator-acceptance copies to `vault_assets` in E6.
13. **Don't break existing tests.** Pass count must be ≥ E2 baseline.

---

## 21. Out of scope (deferred to later directives)

| Concern | Lands in |
|---|---|
| Worker dispatch hook (commit-service → engine) | E4 |
| Reaper extension for asset_proposals | E4 |
| `scripts/process-derivatives.ts` extension | E4 |
| Class B clustering (HDBSCAN + cluster naming) | E5 |
| UI surfaces (proposal display, accept/regenerate) | E6 |
| API routes for proposal accept/dismiss | E6 |
| Onboarding UI for ai_region capture | CCP 7 / Phase 4.B onboarding |
| Vertex `generateText` for query understanding | CCP 7 expansion |
| Vision API OCR / safe-search / landmarks | CCP 9 / v2 enrichment |
| Multimodal embedding (`multimodalembedding@001`) fallback | v2 if quality demands |
| `proposal_shown` view-tracking event | v2 |
| Per-creator opt-out persistence | E6 |

---

## 22. References

- E1 v2: `src/lib/processing/AI-PIPELINE-BRIEF.md`
- E1.5: `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md`
- E2: `src/lib/processing/E2-DIRECTIVE.md`
- INTEGRATION_READINESS.md v2 — D6/D7/D8/D9 + Phase 4.B.5a
- CLAUDE_CODE_PROMPT_SEQUENCE.md — CCP 7 (broader Vertex wrapper)
- Shipped infra: `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql`
- Storage bridge precedent: `src/lib/processing/storage-bridge.ts`
- Dispatcher pattern precedent: `src/lib/processing/dispatcher.ts`
- Vertex pricing source: cloud.google.com/vertex-ai/generative-ai/pricing (verify quarterly)
- Vertex models catalog: cloud.google.com/vertex-ai/generative-ai/docs/models

---

End of E3 directive.
