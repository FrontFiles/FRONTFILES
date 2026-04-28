# E4 — AI Pipeline Worker Integration

**Status:** RATIFIED 2026-04-27 + IMPLEMENTED via PR #24 (2026-04-28). Status block updated in the AI-track status-hygiene PR (2026-04-28); directive body unchanged.
**Date:** 2026-04-27
**Predecessor gates:** E1 v2 ✓ + E1.5 ✓ + E2 directive ✓ + E3 directive ✓ (all ratified 2026-04-27); E2 + E3 implementation must ship before E4 implementation begins (E4 wires the engine E3 makes live).
**Governing documents:**
- `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1) §4.5 — trigger and worker integration contract
- `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (E1.5) §3.2 — engine return contract (`GenerateProposalResult` after E3)
- `src/lib/processing/E2-DIRECTIVE.md` — schema + skeleton (asset_proposals table + audit helpers)
- `src/lib/processing/E3-DIRECTIVE.md` — real Vertex calls + engine orchestration
- `src/lib/processing/PR-4-PLAN.md` — Path B worker pattern (the model E4 mirrors for asset_proposals)

**Objective:** Wire the AI suggestion pipeline into the worker infrastructure PR 4 already shipped. After E4: every committed asset gets a `pending` row in `asset_proposals` (enqueue → similar to PR 3), the dispatcher fires `dispatchAssetProposalForProcessing`, the worker reads the row + bytes + taxonomy, calls the engine (E3), updates the row to `ready` (or `failed` after retry), and writes the `proposal_generated` audit event. Reaper covers stuck proposals. Script claims them alongside derivatives.

**Mechanical compared to E1-E3.** No new vendor decisions; no new schema; no UI. Pure orchestration — wires existing pieces.

---

## 1. What E4 is

E4 takes the engine E3 makes live (`generateAssetProposal`) and wraps it in the same worker pattern PR 4 uses for derivatives. Three new pieces of orchestration:

1. **Enqueue helper** — `enqueueAssetProposalRow(assetId)` — inserts a `pending` row in `asset_proposals` after asset commit. Mirrors PR 3's `enqueueDerivativeRows` for `asset_media`.
2. **Dispatcher entry** — `dispatchAssetProposalForProcessing(assetId, storage)` — looks up asset format + creator's `ai_region` + creator's tag taxonomy, fetches original bytes, runs the engine, persists the result. Mirrors `dispatchAssetForProcessing` for derivatives.
3. **Reaper extension** — `reapStuckProposalRows(timeoutSeconds)` — sweeps stuck `asset_proposals` rows, parallel to `reapStuckProcessingRows` for `asset_media`.

Plus three small wirings:

4. **commit-service.ts hook** — fire-and-forget `dispatchAssetProposalForProcessing` alongside the existing derivative dispatch.
5. **scripts/process-derivatives.ts extension** — second reaper call + second pending-asset query + second dispatch loop.
6. **Worker-level state transitions** — `pending → processing → ready | failed` with `retry_count` increment per E1 v2 §3 E5 (one retry then status='failed').

E4 ships **dormant** in the same way E3 does: behind `FFF_AI_REAL_PIPELINE=false` (default), the dispatcher's engine call goes to the mock adapter; the worker still writes ready rows with mock-fixture data. Production cutover (real Vertex) is a separate flag flip after credentials + Vertex SDK are in place.

---

## 2. Audit findings (current-state read)

| Surface | State | E4 implication |
|---|---|---|
| `src/lib/processing/dispatcher.ts` `dispatchAssetForProcessing` | Built (PR 4). Looks up asset metadata, calls `dispatchDerivativeProcessing`. Returns immediately on `asset_not_found` (logs structured error). | E4 adds parallel `dispatchAssetProposalForProcessing` mirroring this shape. |
| `src/lib/processing/reaper.ts` `reapStuckProcessingRows` | Built (PR 4). Updates `asset_media` rows where `generation_status='processing'` and `processing_started_at < cutoff`. Mock-mode + real-mode branches. | E4 adds parallel `reapStuckProposalRows` against `asset_proposals`. Reuses `FFF_PROCESSING_TIMEOUT_SECONDS` env var. |
| `src/lib/processing/enqueue.ts` `enqueueDerivativeRows` | Built (PR 3). Inserts 3 pending `asset_media` rows on commit. | E4 adds `enqueueAssetProposalRow` — single row insert (one proposal per asset). Idempotent via UNIQUE on `asset_id`. |
| `src/lib/upload/commit-service.ts` line 279 | Fires `dispatchAssetForProcessing` fire-and-forget after `enqueueDerivativeRows`. | E4 adds parallel `enqueueAssetProposalRow` + `dispatchAssetProposalForProcessing` next to it. |
| `scripts/process-derivatives.ts` | CLI: reaper → findPendingAssets (asset_media only) → dispatch loop. | E4 extends: second reaper call, second findPendingProposalAssets query, second dispatch loop (or merged single loop dispatching both kinds — see §9 design choice). |
| `src/lib/ai-suggestions/engine.ts` (E2) | Returns `Promise<VisionResponse>`. | E3 widens return to richer `GenerateProposalResult` (token counts + cost + cache-hit + region) AND widens input opts to take `originalBytes` (raw) + `taxonomyTopN`. The engine handles image-prep internally per E3 §15 step 2. E4 worker reads the wider shape and passes raw bytes — does NOT pre-resize. **E4 implementation prerequisite: E3 ships first.** |
| `users.ai_region` column | Added by E3 migration. | E4 reads it via the asset-lookup query (extends `lookupAssetForDispatch` to also return creator's region). |
| Creator tag taxonomy fetch | Not yet implemented. | E4 adds a small helper `fetchCreatorTagTaxonomy(creatorId, topN): string[]` per E1.5 §8.1 SQL. Lives in `src/lib/ai-suggestions/taxonomy.ts`. |
| Image prep | Added by E3 (`src/lib/ai-suggestions/image-prep.ts`); called by the engine internally. | E4 does NOT call image-prep directly — the engine handles it. E4 just fetches original bytes via the storage bridge and passes them through. |

---

## 3. Hard prerequisites

| Prerequisite | Source | E4 handling |
|---|---|---|
| E2 implementation shipped | `asset_proposals`, `asset_proposal_clusters`, `asset_proposal_audit_log`, `ai_pipeline_settings` migrations applied | E4 reads these tables; if missing, INSERTs fail at runtime |
| E3 implementation shipped | engine.ts returns wider `GenerateProposalResult`; image-prep.ts exists; users.ai_region column exists; google.ts wrapper exists | E4 reads engine's wider return; calls `prepareForVision` from E3; reads `users.ai_region`; the engine internally calls google.ts |
| `audit` function from `@/lib/logger` | Already shipped | E4 imports for system-grain events (`ai.gemini.proposal_dispatched`) |
| `writeAuditEvent` from `src/lib/ai-suggestions/audit.ts` | Shipped in E2 | E4 calls for field-grain events (`proposal_generated`) |

If E2 or E3 hasn't shipped at E4 ship time, E4 cannot merge. E4 directive composes against the assumption both are in place; E4 implementation is gated.

---

## 4. Scope boundary

E4 **does**:
- Add `src/lib/processing/enqueue-proposal.ts` — `enqueueAssetProposalRow(assetId)` (idempotent insert)
- Add `src/lib/ai-suggestions/taxonomy.ts` — `fetchCreatorTagTaxonomy(creatorId, topN): Promise<string[]>` per E1.5 §8.1
- Add `src/lib/processing/proposal-dispatcher.ts` — `dispatchAssetProposalForProcessing(assetId, storage)` orchestrating lookup + image-prep + engine call + row update + audit event
- Touch `src/lib/processing/reaper.ts` — add `reapStuckProposalRows(timeoutSeconds)` parallel to existing reaper
- Touch `src/lib/upload/commit-service.ts` — fire `enqueueAssetProposalRow` + `dispatchAssetProposalForProcessing` after the existing derivative dispatch
- Touch `scripts/process-derivatives.ts` — second reaper call + second findPendingProposalAssets query + second dispatch loop
- Tests for each new module + integration tests for the worker flow under mock-mode

E4 **does not**:
- Touch the engine (E3 owns `generateAssetProposal`)
- Touch image-prep (E3 owns `prepareForVision`)
- Touch the cache (E3 owns `cache.ts`)
- Touch the embedding write (E3 owns `embedding.ts`)
- Touch the Vertex client (CCP 7 / E3 own `google.ts`)
- Touch the schema (E2 owns the migrations)
- Touch the UI (E6)
- Add clustering trigger (E5)
- Activate `FFF_AI_REAL_PIPELINE` in any env (separate flag flip)
- Schedule `scripts/process-derivatives.ts` in production cron (PR 5 territory)
- Add new env vars (reuses `FFF_PROCESSING_TIMEOUT_SECONDS` from PR 4 for reaper timeout)

---

## 5. Files added / touched / not touched

**Added:**

```
src/lib/processing/
├── enqueue-proposal.ts             # enqueueAssetProposalRow
├── proposal-dispatcher.ts          # dispatchAssetProposalForProcessing
└── __tests__/
    ├── enqueue-proposal.test.ts
    ├── proposal-dispatcher.test.ts
    └── reaper-proposals.test.ts

src/lib/ai-suggestions/
├── taxonomy.ts                     # fetchCreatorTagTaxonomy
└── __tests__/
    └── taxonomy.test.ts
```

**Touched:**

```
src/lib/processing/reaper.ts             # add reapStuckProposalRows + small refactor for shared cutoff calc
src/lib/upload/commit-service.ts         # add enqueueAssetProposalRow + dispatchAssetProposalForProcessing fire-and-forget after derivatives
scripts/process-derivatives.ts           # second reaper call + second pending-asset query + second dispatch loop
```

**Not touched:**

```
src/lib/ai-suggestions/engine.ts         # E3 owns the wider return contract; E4 just reads it
src/lib/ai-suggestions/image-prep.ts     # E3 owns
src/lib/ai-suggestions/cache.ts          # E3 owns
src/lib/ai-suggestions/embedding.ts      # E3 owns
src/lib/ai-suggestions/audit.ts          # E2 owns; E4 calls writeAuditEvent
src/lib/ai-suggestions/settings.ts       # E2 owns
src/lib/ai/google.ts                     # CCP 7 / E3 own
src/lib/processing/dispatcher.ts         # E4 has its own proposal-dispatcher; the existing dispatcher stays derivative-focused
src/lib/processing/enqueue.ts            # PR 3's derivative enqueue stays as-is
supabase/migrations/                     # no new migrations in E4
src/app/                                 # no UI changes in E4
src/lib/env.ts                           # no new flags in E4
```

---

## 6. `enqueue-proposal.ts`

```typescript
/**
 * Frontfiles — Enqueue helper for asset_proposals
 *
 * Mirrors src/lib/processing/enqueue.ts (PR 3 derivative enqueue) but
 * for the AI proposal layer. Inserts a 'pending' row in asset_proposals
 * for the given asset. Idempotent via the UNIQUE (asset_id) constraint.
 *
 * Called from commit-service.ts on every asset commit, before the
 * dispatcher fires.
 *
 * Format gate: only image formats (photo/illustration/infographic/vector)
 * trigger an enqueue. Non-image formats get a 'not_applicable' row so
 * the audit trail is complete; they don't go through the worker.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient } from '@/lib/db/client'
import type { AssetFormat } from '@/lib/upload/types'

const IMAGE_FORMATS: ReadonlySet<AssetFormat> = new Set([
  'photo',
  'illustration',
  'infographic',
  'vector',
])

export type EnqueueProposalResult =
  | { kind: 'ok'; status: 'pending' }
  | { kind: 'ok'; status: 'not_applicable' }
  | { kind: 'already_exists' }
  | { kind: 'error'; message: string }

export async function enqueueAssetProposalRow(
  assetId: string,
  format: AssetFormat,
): Promise<EnqueueProposalResult> {
  const supabase = getSupabaseClient()
  const status = IMAGE_FORMATS.has(format) ? 'pending' : 'not_applicable'

  const { error } = await supabase
    .from('asset_proposals')
    .insert({
      asset_id: assetId,
      generation_status: status,
    })

  if (error) {
    // UNIQUE violation = already exists. Treat as ok (idempotent retry).
    if (error.code === '23505' /* unique_violation */) {
      return { kind: 'already_exists' }
    }
    return { kind: 'error', message: error.message }
  }

  return { kind: 'ok', status }
}
```

Tests:
- Image format inserts 'pending' row
- Non-image format inserts 'not_applicable' row
- Duplicate insert (UNIQUE violation) returns `already_exists`, doesn't throw
- Non-UNIQUE error propagates as `{ kind: 'error' }`

---

## 7. `taxonomy.ts`

```typescript
/**
 * Frontfiles — Creator tag taxonomy fetch
 *
 * Per E1.5 §8.1: top-N tags by usage from creator's vault_assets.tags
 * column, with alphabetical tie-break for determinism (cache-friendly).
 *
 * Used by the worker to inject creator's existing vocabulary into the
 * Gemini prompt so suggested tags prefer existing taxonomy over new ones.
 *
 * NOT cached across invocations (creator may add tags between runs;
 * staleness is more harmful than the small repeated cost). Future
 * optimization: in-process LRU with 60s TTL — v2 enrichment.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient } from '@/lib/db/client'

export async function fetchCreatorTagTaxonomy(
  creatorId: string,
  topN: number,
): Promise<string[]> {
  const supabase = getSupabaseClient()
  // unnest(tags) + GROUP BY tag ORDER BY count DESC, tag ASC LIMIT N
  // No RPC needed — Supabase's rpc/sql features OR a small materialized
  // helper RPC. Simplest: fetch raw rows and aggregate in app. For
  // creators with ~thousands of assets, this is fast.
  const { data, error } = await supabase
    .from('vault_assets')
    .select('tags')
    .eq('creator_id', creatorId)
    .not('tags', 'is', null)

  if (error) {
    throw new Error(
      `fetchCreatorTagTaxonomy failed for creator ${creatorId}: ${error.message}`,
    )
  }

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ tags: string[] | null }>) {
    if (!row.tags) continue
    for (const tag of row.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1] // count DESC
      return a[0].localeCompare(b[0])         // alphabetical ASC tie-break
    })
    .slice(0, topN)
    .map(([tag]) => tag)
}
```

**Performance note:** This fetches all `tags` arrays for a creator every call. For creators with many assets, consider a server-side aggregation RPC. v2 enrichment if it surfaces as a hot path.

Tests:
- Empty result → empty array
- < N tags → all of them, sorted by count DESC + alphabetical ASC
- ≥ N tags → top N
- Tie-break alphabetical (deterministic)
- Throws on supabase error

---

## 8. `proposal-dispatcher.ts`

The orchestration point. Wraps the engine call in the worker envelope.

```typescript
/**
 * Frontfiles — AI Proposal Dispatcher (Class A worker entry)
 *
 * Per AI-PIPELINE-BRIEF.md v2 §4.2 + E1.5 §3.2.
 *
 * Called from:
 *   - commit-service.ts (fire-and-forget on asset commit)
 *   - scripts/process-derivatives.ts (loop over pending asset_proposals rows)
 *
 * Lifecycle:
 *   pending → processing (CAS-style claim)
 *   → fetch asset metadata + creator's ai_region + tag taxonomy
 *   → fetch original bytes via storage bridge
 *   → image-prep (resize per E1.5 §6)
 *   → engine.generateAssetProposal (E3)
 *   → UPDATE asset_proposals SET generation_status='ready', + fields
 *   → write proposal_generated audit event
 *   → on exception: increment retry_count; <1 → back to pending; ≥1 → 'failed'
 *
 * SERVER-ONLY.
 */

import type { StorageAdapter as LowLevelStorage } from '@/lib/storage'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import { generateAssetProposal } from '@/lib/ai-suggestions/engine'
import { fetchCreatorTagTaxonomy } from '@/lib/ai-suggestions/taxonomy'
import { writeAuditEvent } from '@/lib/ai-suggestions/audit'
import { getEffectiveSettings } from '@/lib/ai-suggestions/settings'
import type { AssetFormat } from '@/lib/upload/types'
import type { UserAiRegion, VertexRegion } from '@/lib/ai-suggestions/types'
import { findOriginalStorageRef } from './media-row-adapter'

interface ProposalDispatchLookup {
  format: AssetFormat
  creatorId: string
  aiRegion: UserAiRegion
}

const REGION_MAP: Record<UserAiRegion, VertexRegion> = {
  eu: 'europe-west4',
  us: 'us-central1',
}

export async function dispatchAssetProposalForProcessing(
  assetId: string,
  storage: LowLevelStorage,
): Promise<void> {
  const supabase = getSupabaseClient()

  // 1. Atomic claim: pending → processing (only if currently pending)
  const claim = await supabase
    .from('asset_proposals')
    .update({
      generation_status: 'processing',
      processing_started_at: new Date().toISOString(),
    })
    .eq('asset_id', assetId)
    .eq('generation_status', 'pending')  // CAS — fails if status changed
    .select('asset_id, retry_count')
    .single()

  if (claim.error || !claim.data) {
    // Either asset not found, or already processing/ready/failed.
    // No-op (idempotent).
    return
  }

  const retryCount = claim.data.retry_count

  try {
    // 2. Lookup asset format + creator + region
    const lookup = await lookupAssetForProposalDispatch(assetId)
    if (!lookup) {
      throw new Error('asset_not_found')
    }

    // 3. Image-format gate (defensive — enqueue should have set
    //    'not_applicable' for non-image formats, but double-check)
    if (!isImageFormat(lookup.format)) {
      await supabase
        .from('asset_proposals')
        .update({
          generation_status: 'not_applicable',
          processing_started_at: null,
          error: `format ${lookup.format} not supported in v1`,
        })
        .eq('asset_id', assetId)
      return
    }

    // 4. Fetch original bytes (engine handles image-prep internally per E3 §15)
    const storageRef = await findOriginalStorageRef(assetId)
    if (!storageRef) {
      throw new Error('original_not_found')
    }
    const originalBytes = await storage.getBytes(storageRef)

    // 5. Tag taxonomy injection
    const settings = await getEffectiveSettings()
    const taxonomyTopN = await fetchCreatorTagTaxonomy(
      lookup.creatorId,
      settings.tag_taxonomy_top_n,
    )

    // 6. Resolve VertexRegion from UserAiRegion
    const vertexRegion = REGION_MAP[lookup.aiRegion]

    // 7. Engine call — E3's signature takes raw originalBytes + taxonomy;
    //    engine internally calls prepareForVision + cache + Vertex + embedding
    //    + cost capture. Returns rich GenerateProposalResult.
    const result = await generateAssetProposal({
      assetId,
      creatorId: lookup.creatorId,
      format: lookup.format,
      originalBytes,
      region: vertexRegion,
      taxonomyTopN,
    })

    // 8. Read the rich shape (E3 contract):
    //    { visionResponse, modelVersion, costCents, latencyMs, cacheHit, region }
    const { visionResponse, modelVersion, costCents, latencyMs } = result

    // 9. UPDATE asset_proposals to 'ready' with the engine result fields
    await supabase
      .from('asset_proposals')
      .update({
        generation_status: 'ready',
        processing_started_at: null,
        caption: visionResponse.caption,
        caption_confidence: visionResponse.caption_confidence,
        keywords: visionResponse.keywords,
        keywords_confidence: visionResponse.keywords_confidence,
        tags: visionResponse.tags,
        tags_confidence: visionResponse.tags_confidence,
        model_version: modelVersion,
        generation_cost_cents: costCents,
        generation_latency_ms: latencyMs,
        region: vertexRegion,
        error: null,
      })
      .eq('asset_id', assetId)

    // 10. Write field-grain audit event
    await writeAuditEvent({
      asset_id: assetId,
      creator_id: lookup.creatorId,
      event_type: 'proposal_generated',
      surface: 'system',
      after_value: {
        caption: visionResponse.caption,
        keywords: visionResponse.keywords,
        tags: visionResponse.tags,
      },
    })
  } catch (err) {
    // Retry-once policy per E1 v2 §3 E5
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (retryCount < 1) {
      // Reset to pending; next worker tick will retry
      await supabase
        .from('asset_proposals')
        .update({
          generation_status: 'pending',
          processing_started_at: null,
          retry_count: retryCount + 1,
          error: errorMessage,
        })
        .eq('asset_id', assetId)
    } else {
      // Mark failed
      await supabase
        .from('asset_proposals')
        .update({
          generation_status: 'failed',
          processing_started_at: null,
          retry_count: retryCount + 1,
          error: errorMessage,
        })
        .eq('asset_id', assetId)
    }
  }
}

function isImageFormat(format: AssetFormat): boolean {
  return ['photo', 'illustration', 'infographic', 'vector'].includes(format)
}

async function lookupAssetForProposalDispatch(
  assetId: string,
): Promise<ProposalDispatchLookup | null> {
  if (!isSupabaseConfigured()) {
    return {
      format: 'photo',
      creatorId: '00000000-0000-0000-0000-000000000001',
      aiRegion: 'eu',
    }
  }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('vault_assets')
    .select('format, creator_id, users!inner(ai_region)')
    .eq('id', assetId)
    .maybeSingle()
  if (error || !data) return null

  const row = data as {
    format: AssetFormat
    creator_id: string
    users: { ai_region: UserAiRegion } | Array<{ ai_region: UserAiRegion }> | null
  }
  const usersRow = Array.isArray(row.users) ? row.users[0] : row.users
  return {
    format: row.format,
    creatorId: row.creator_id,
    aiRegion: usersRow?.ai_region ?? 'eu',
  }
}
```

**Note on E2 vs E3 engine return shapes:** the cast in step 9 acknowledges that E2's engine returns `VisionResponse` directly while E3 widens to `{ visionResponse, costCents, latencyMs, ... }`. E4 implementation cannot run end-to-end until E3 ships. The cast becomes a clean typed access at that point. The directive surfaces this dependency rather than hiding it.

Tests:
- pending → processing → ready happy path (mock engine returns fixture)
- format = 'video' → status='not_applicable', no engine call
- engine throws → retry_count=0 → back to pending, retry_count=1
- engine throws + retry_count=1 → status='failed', retry_count=2
- asset_not_found → status='failed' (after retry path)
- audit event written on success
- region resolution: eu → europe-west4; us → us-central1

---

## 9. `reaper.ts` extension

Add `reapStuckProposalRows(timeoutSeconds)` parallel to `reapStuckProcessingRows`. Same shape (UPDATE ... RETURNING; mock-mode + real-mode branches; logging) but operates on `asset_proposals` instead of `asset_media`.

Two design choices considered:

| Approach | Pro | Con | Pick |
|---|---|---|---|
| Refactor to a generic `reapStuckRows(table, timeoutSeconds)` that takes a table name | One reaper, two callers | Generic table-name strings are a SQL injection vector if mishandled; less typed | ✗ |
| Add parallel `reapStuckProposalRows` function with hardcoded table name | Typed; symmetric to existing | Slightly more code | ✓ |

E4 picks parallel function. Clean, typed, mirrors the existing pattern, no SQL-injection surface.

```typescript
// Inside src/lib/processing/reaper.ts (extension; existing function unchanged)

export async function reapStuckProposalRows(
  timeoutSeconds?: number,
): Promise<ReapedRow[]> {
  const effectiveTimeout = timeoutSeconds ?? readTimeoutFromEnv()
  if (!isSupabaseEnvPresent()) {
    return []  // mock-mode: tests of the proposal-dispatcher don't exercise the reaper end-to-end
  }
  return reapStuckProposalRowsReal(effectiveTimeout)
}

async function reapStuckProposalRowsReal(
  timeoutSeconds: number,
): Promise<ReapedRow[]> {
  const client = getSupabaseClient()
  const cutoffIso = new Date(Date.now() - timeoutSeconds * 1000).toISOString()
  const { data, error } = await client
    .from('asset_proposals')
    .update({
      generation_status: 'pending',
      processing_started_at: null,
    })
    .eq('generation_status', 'processing')
    .lt('processing_started_at', cutoffIso)
    .select('asset_id, processing_started_at')
  if (error) {
    throw new Error(
      `reaper: reapStuckProposalRows failed (${error.message ?? 'unknown'})`,
    )
  }
  const rows = (data ?? []) as Array<{ asset_id: string; processing_started_at: string | null }>
  const now = Date.now()
  return rows.map(r => {
    const stuckMs = r.processing_started_at
      ? now - new Date(r.processing_started_at).getTime()
      : 0
    const reapedRow: ReapedRow = {
      assetId: r.asset_id,
      mediaRole: 'ai_proposal',  // synthetic — proposals don't have media_role
      stuckDurationSeconds: Math.round(stuckMs / 1000),
    }
    logReset(reapedRow)
    return reapedRow
  })
}
```

The synthetic `mediaRole: 'ai_proposal'` lets the existing `ReapedRow` type carry both kinds without restructuring. Logged output makes the kind visible (`media_role: 'ai_proposal'`).

Tests:
- Stuck proposal row past timeout → reset to pending; row returned with stuck_duration_seconds populated
- Non-stuck row not touched
- Mock-mode returns []
- Supabase error throws

---

## 10. `commit-service.ts` hook

After the existing derivative dispatch (line 279), add:

```typescript
// Existing (PR 4):
dispatchAssetForProcessing(assetId, deps.adapter).catch(err => {
  // existing error log
})

// E4 addition (parallel; fire-and-forget):
enqueueAssetProposalRow(assetId, format).then(result => {
  if (result.kind === 'error') {
    console.error(
      'commit.enqueue: proposal_enqueue_failed',
      JSON.stringify({
        code: 'proposal_enqueue_failed',
        asset_id: assetId,
        error: result.message,
      }),
    )
    return
  }
  // Only dispatch if a 'pending' row was actually created (skip
  // 'not_applicable' for non-image formats and 'already_exists' for
  // idempotent retries — those rows are processed by the next
  // scripts/process-derivatives.ts run if needed).
  if (result.kind === 'ok' && result.status === 'pending') {
    dispatchAssetProposalForProcessing(assetId, deps.adapter).catch(err => {
      console.error(
        'commit.dispatch: proposal_dispatch_failed',
        JSON.stringify({
          code: 'proposal_dispatch_failed',
          asset_id: assetId,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    })
  }
})
```

The `format` is the same `format` already passed to the existing derivative dispatch (PR 4 lookup). E4 reuses the in-scope variable.

Tests:
- Image-format commit → enqueue + dispatch fired
- Non-image-format commit → enqueue (with not_applicable status) but no dispatch
- Existing pending row (idempotent retry) → no double-dispatch
- Enqueue error → logged, doesn't break commit

---

## 11. `scripts/process-derivatives.ts` extension

Add a second reaper call + second pending-asset query + second dispatch loop. Keep the script's overall shape — sequential operations, run-once, exit code semantics unchanged.

```typescript
async function main(): Promise<void> {
  // 1a. Reaper for derivatives (existing)
  const reapedDerivatives = await reapStuckProcessingRows()
  console.info(`process-derivatives: derivative reaper reset ${reapedDerivatives.length} stuck row(s)`)

  // 1b. Reaper for proposals (E4 addition)
  const reapedProposals = await reapStuckProposalRows()
  console.info(`process-derivatives: proposal reaper reset ${reapedProposals.length} stuck row(s)`)

  // 2a. Find pending derivative assets (existing)
  const pendingDerivatives = await findPendingAssets()
  // 2b. Find pending proposal assets (E4 addition)
  const pendingProposals = await findPendingProposalAssets()

  console.info(
    `process-derivatives: pending — derivatives=${pendingDerivatives.length} proposals=${pendingProposals.length}`,
  )

  if (pendingDerivatives.length === 0 && pendingProposals.length === 0) return

  // 3. Dispatch loops
  const storage = getStorageAdapter()
  let dispatchedDerivatives = 0
  let failedDerivatives = 0
  for (const asset of pendingDerivatives) {
    try {
      await dispatchAssetForProcessing(asset.assetId, storage)
      dispatchedDerivatives++
    } catch (err) {
      failedDerivatives++
      console.error('process-derivatives: derivative_dispatch_failed', JSON.stringify({ ... }))
    }
  }

  let dispatchedProposals = 0
  let failedProposals = 0
  for (const asset of pendingProposals) {
    try {
      await dispatchAssetProposalForProcessing(asset.assetId, storage)
      dispatchedProposals++
    } catch (err) {
      failedProposals++
      console.error('process-derivatives: proposal_dispatch_failed', JSON.stringify({ ... }))
    }
  }

  console.info(
    `process-derivatives: complete — derivatives=${dispatchedDerivatives}/${failedDerivatives} proposals=${dispatchedProposals}/${failedProposals}`,
  )
}

async function findPendingProposalAssets(): Promise<Array<{ assetId: string }>> {
  if (!isSupabaseConfigured()) return []
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('asset_proposals')
    .select('asset_id')
    .eq('generation_status', 'pending')
  if (error) {
    throw new Error(`process-derivatives: findPendingProposalAssets failed (${error.message})`)
  }
  return ((data ?? []) as Array<{ asset_id: string }>).map(r => ({ assetId: r.asset_id }))
}
```

**Sequential, not parallel** — derivative dispatch then proposal dispatch — matches PR 4's "sequential per-asset, concurrent within an asset" pattern. Both kinds of work share the same Vercel function / cron invocation; the script doesn't run for hours.

If the script's runtime budget becomes a concern (e.g., 10,000 pending rows take longer than the cron window), the future evolution is per-kind cron splits or BullMQ-per-job-type — out of scope for E4.

Tests:
- Both reapers called
- Both pending queries called
- Mock-mode returns empty for both → script exits cleanly without dispatch
- One side empty + other has work → only the non-empty side dispatches

---

## 12. Tests

### 12.1 Coverage matrix

| File | Coverage |
|---|---|
| `__tests__/enqueue-proposal.test.ts` | image format → 'pending'; non-image → 'not_applicable'; UNIQUE conflict → 'already_exists'; supabase error → 'error' |
| `src/lib/ai-suggestions/__tests__/taxonomy.test.ts` | top-N selection; alphabetical tie-break; empty result; supabase error |
| `__tests__/proposal-dispatcher.test.ts` | happy path mock-mode (pending → processing → ready); video format → not_applicable + no engine call; engine throws + retry_count=0 → back to pending; engine throws + retry_count=1 → failed; asset_not_found → failed; region resolution; audit event written |
| `__tests__/reaper-proposals.test.ts` | stuck row reset to pending; non-stuck untouched; mock-mode []; supabase error throws |
| `src/lib/upload/__tests__/commit-service.test.ts` (extend) | proposal enqueue + dispatch fired alongside derivative; non-image format only enqueues, no dispatch; idempotent retry doesn't double-dispatch |
| `src/lib/processing/__tests__/reaper.test.ts` (extend) | both reapers exposed; reapStuckProposalRows tested separately |

### 12.2 Test infrastructure

- Continue using `vi.mock('@/lib/db/client')` pattern from E2 tests
- Engine integration: tests stub `generateAssetProposal` directly via `vi.mock('@/lib/ai-suggestions/engine')` to control return value per test case
- For `vi.stubEnv('NODE_ENV', ...)` use the same pattern as E2's settings tests
- `scopeEnvVars` for FFF_PROCESSING_TIMEOUT_SECONDS toggle in reaper tests

### 12.3 Test count target

5 new test files (4 fully new + 2 extensions of existing). ~30-40 cases total. Bounded.

---

## 13. Verification gates

Before merge:

```bash
# 1. tsc clean
npx tsc --noEmit 2>&1 | grep -cE "error TS"
# Expected: 8 (pre-existing baseline; no new errors)

# 2. vitest green
bun run test 2>&1 | tail -10
# Expected: previous baseline + ~30-40 new cases all passing

# 3. End-to-end mock-mode flow
# (Tested via the integration test in proposal-dispatcher.test.ts —
#  no separate manual step needed for E4)

# 4. Existing PR 4 derivative tests still pass
bun run test src/lib/processing/__tests__/ 2>&1 | tail -5
bun run test src/lib/upload/__tests__/commit-service.test.ts 2>&1 | tail -5
# Expected: no regressions

# 5. Build green
bun run build 2>&1 | tail -5
# Expected: build exits 0; route count unchanged (no new routes)

# 6. Engineer-local script smoke (optional manual; not CI)
# After E2 + E3 + E4 land + with Supabase env configured locally:
bun run scripts/process-derivatives.ts
# Expected: prints derivative + proposal status summary; exits 0 if no pending rows
```

---

## 14. Approval gate

Founder reviews PR before merge. Specifically verify:

| Item | Approved means |
|---|---|
| E2 + E3 implementations are merged | E4 hard-prerequisites met |
| Reaper extension uses parallel function (not generic table param) | Per §9 design choice |
| commit-service hook fires fire-and-forget (does NOT await) | Same pattern as PR 4 derivative dispatch |
| Worker retry-once policy honored | retry_count=0 → back to pending; retry_count=1 → 'failed' |
| Region mapping `eu → europe-west4`, `us → us-central1` correct | Per E1 v2 §3 E2 |
| Audit event `proposal_generated` written on success | Field-grain via writeAuditEvent |
| Format gate present (defensive) | Non-image formats marked 'not_applicable' if they slip past enqueue gate |
| All 6 verification gates green | Including no regressions in existing PR 4 tests |

Founder's options:
1. **Approve + merge** — E5 directive composes next (clustering)
2. **Approve with corrections** — name the diff
3. **Revise** — substantive concern
4. **Reject** — would mean E1 v2 / E1.5 / E2 / E3 was wrong, not E4

---

## 15. Don't-do list

1. **Don't touch the engine.** E3 owns `generateAssetProposal`. E4 reads its return; doesn't modify it.
2. **Don't bypass the CAS-style claim.** The `pending → processing` UPDATE checks `generation_status='pending'` in the WHERE clause. If two workers race, only one wins the claim; the other no-ops. Don't replace this with a sequential SELECT-then-UPDATE (race window).
3. **Don't await the proposal dispatch from commit-service.** Fire-and-forget per the existing PR 4 pattern. Awaiting blocks the commit response.
4. **Don't add a new env var for the proposal reaper timeout.** Reuse `FFF_PROCESSING_TIMEOUT_SECONDS` from PR 4.
5. **Don't activate `FFF_AI_REAL_PIPELINE` in any deployed env.** Ships dormant. Production cutover is a separate flag flip.
6. **Don't change the existing PR 4 derivative path.** E4 is additive; the existing dispatcher / reaper / script flow for derivatives stays unchanged.
7. **Don't write to vault_assets.{title, description, tags} in the worker.** The worker writes to asset_proposals only. Acceptance into vault_assets is creator-driven (E6).
8. **Don't add UI hooks here.** E6 owns proposal surfacing.
9. **Don't add cluster trigger here.** E5 owns Class B clustering (different trigger semantics: batch 'committing' transition, not per-asset).
10. **Don't merge E4 before E2 + E3 ship.** E4 imports from E3's expanded engine.ts + image-prep.ts; until E3 lands, the imports fail. Hard gate.
11. **Don't add retry attempts beyond 1.** Per E1 v2 §3 E5: one retry then 'failed'. The creator can manually regenerate via the UI (E6).
12. **Don't schedule scripts/process-derivatives.ts in production cron in this PR.** PR 5 / staging cutover territory.

---

## 16. Out of scope (deferred to later directives)

| Concern | Lands in |
|---|---|
| Class B clustering job + cluster naming | E5 |
| UI: proposal surfacing in upload flow | E6 |
| UI: proposal surfacing in vault asset edit | E6 |
| API routes for proposal accept/dismiss/regenerate | E6 |
| Per-creator opt-out persistence | E6 |
| Founder admin: Regenerate-quota-recovered-assets tool | E6 |
| `proposal_shown` view-tracking event | v2 enrichment |
| In-process LRU cache for taxonomy | v2 enrichment |
| Server-side aggregation RPC for tag taxonomy | v2 enrichment |
| Cron scheduling of scripts/process-derivatives.ts | PR 5 |

---

## 17. References

- E1 v2: `src/lib/processing/AI-PIPELINE-BRIEF.md`
- E1.5: `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md`
- E2: `src/lib/processing/E2-DIRECTIVE.md`
- E3: `src/lib/processing/E3-DIRECTIVE.md`
- PR 4 worker pattern: `src/lib/processing/PR-4-PLAN.md` + `dispatcher.ts` + `reaper.ts`
- PR 3 enqueue pattern: `src/lib/processing/enqueue.ts`
- commit-service hook precedent: `src/lib/upload/commit-service.ts` line 279
- Script template: `scripts/process-derivatives.ts`
- Logger audit helper: `src/lib/logger.ts` `audit(event)`

---

End of E4 directive.
