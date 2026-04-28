# E5 — Batch-Scoped Clustering (Class B Implementation)

**Status:** RATIFIED + IMPLEMENTED 2026-04-28 (implementation merged via PR #25). This document landed in `main` via the AI-track status-hygiene PR (2026-04-28); the original directive PR #18 (`feat/ai-e5-directive`, commit `a485db9`) was redundant once #25 squash-merged and is closed in favor of this in-`main` copy. Content unchanged from `a485db9` apart from this status block.
**Date:** 2026-04-28
**Predecessor gates:** E1 v2 ✓ + E1.5 ✓ + E2 directive ✓ + E3 directive ✓ + E4 directive ✓ (all ratified 2026-04-27); E2 + E3 + E4 implementations must ship before E5 implementation begins (E5 reads `asset_embeddings` populated by E3, writes `asset_proposal_clusters` from E2's schema, and reuses E4's worker pattern).
**Governing documents:**
- `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1) §4.3 — Class B pipeline; §8 — sequencing
- `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (E1.5) §9 — cluster naming pipeline; §10 — embedding shape (the input to clustering); §5.1 — silhouette floor; §3 — Vertex client wrapper (reused for `gemini-2.5-pro` cluster naming)
- `src/lib/processing/E2-DIRECTIVE.md` — `asset_proposal_clusters` schema + `asset_proposals.cluster_id` field
- `src/lib/processing/E3-DIRECTIVE.md` — `src/lib/ai/google.ts` wrapper, `cache.ts` (ai_analysis read-through), `circuit-breaker.ts`, `quota.ts`, `models.ts`, `cost.ts`
- `src/lib/processing/E4-DIRECTIVE.md` — worker pattern (dispatcher + reaper + commit-service hook); engine return-shape contract
- `INTEGRATION_READINESS.md` v2 — D6/D7/D8/D9
- `PLATFORM_REVIEWS.md` v2 — D-U2 (clustering ships in v1 as HARD launch gate)
- `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql` — `asset_embeddings(extensions.vector(768))` HNSW cosine; `ai_analysis` cache; `audit_log`
- `supabase/migrations/20260419000001_phase1_upload_batches.sql` — `upload_batches` table + `upload_batch_state` enum

**Objective:** Turn the dormant `asset_proposal_clusters` table E2 created into live cluster proposals — fired after a batch commits, fed by the embeddings E3 writes, named via `gemini-2.5-pro` per E1.5 §9, surfaced (in E6) as a Story-group banner. E5 ships dormant behind `FFF_AI_REAL_PIPELINE=false` (mock cluster output for tests + dev). Production cutover is a separate flag flip.

**Mechanical compared to E1-E3.** No new vendor decisions; no new schema beyond a small RPC for cluster cleanup; no UI. The load-bearing decisions are the trigger semantics (§6) and the HDBSCAN library selection contract (§7).

---

## 1. What E5 is

E5 implements Class B (the batch-scoped clustering job) end-to-end. After E5 ships:

- Every `commitBatch` success fires fire-and-forget `dispatchBatchClusteringForProcessing(batchId)` alongside per-asset proposal dispatch.
- A new clustering engine (`src/lib/ai-suggestions/clustering.ts`) reads embeddings for the batch's assets from `asset_embeddings`, runs HDBSCAN over cosine distance, computes silhouette per cluster, drops sub-floor clusters, names the surviving clusters via `gemini-2.5-pro` (with date-range fallback per E1.5 §9.4).
- Each surviving cluster gets a row in `asset_proposal_clusters` with `proposed_name`, `silhouette_score`, `asset_count`, `model_version`, `region`. Member assets get their `asset_proposals.cluster_id` set.
- Cluster naming results cache in `ai_analysis` per E1.5 §9.5 — a creator re-running the same batch returns cached names without re-billing Vertex.
- Reaper extends to sweep stuck clustering jobs (a new state flag on `asset_proposal_clusters` since the table is the natural home for the in-flight signal).
- An explicit creator "Re-analyze session" surface is available as a callable function — the UI button itself lands in E6.

E5 does **not** ship clustering UI (banner / accept / dismiss / inline rename). E6 owns those surfaces.

The `min_cluster_size`, `silhouette_score` floor confirmation, and embedding-shape regression baseline are **empirical knobs** — gated as verify-at-implementation rather than locked blind, per don't-do-#26 (the warning against composing clustering before real `asset_embeddings` data exists).

---

## 2. Audit findings (current-state read)

| Surface | State | E5 implication |
|---|---|---|
| `upload_batches.state` enum | `'open' \| 'committing' \| 'committed' \| 'cancelled'` per migration `20260419000001` | The `'committing'` value is reachable in the type but not in code (see next row). |
| `transitionToCommitted` in `src/lib/upload/batch-store.ts` | Single conditional UPDATE: `state='open' → 'committed'` directly. The `'committing'` enum value is **never written** by any current code path. | **E1 v2 §4.1 contains a terminology drift.** It names the trigger as "transitions to `'committing'` state" but the actual single-step transition is `open → committed`. E5's trigger (§6) is locked as `commitBatch` success (i.e., the moment `state='committed'` is written) — fire-and-forget, mirroring E4's per-asset hook. **This requires a §5.6-style corrigendum to E1 v2 §4.1**, captured as a small follow-on docs task. |
| `commitBatch` route + service (PR 1.2) | Route gated by `FFF_REAL_UPLOAD=false` default (`isRealUploadEnabled()` returns 503). | E5's clustering hook lives in `commitBatch` service — fires only on successful transition. While `FFF_REAL_UPLOAD=false`, no real commit ever fires; clustering never runs in production. Same dormancy posture as E3/E4. |
| `asset_proposal_clusters` schema (E2) | 11 columns including `batch_id`, `silhouette_score`, `proposed_name`, `model_version`, `region`, accept/dismiss timestamps + mutual-exclusion CHECK | **No new tables for E5.** The table is sufficient. E5 adds rows; no schema change. |
| `asset_proposals.cluster_id` (E2) | NULLable FK to `asset_proposal_clusters(id)` ON DELETE SET NULL | E5 updates this field on member assets after cluster insert. ON DELETE SET NULL means dismissing a cluster (DELETE row, optionally) preserves member proposals. |
| `asset_embeddings` (shipped 2026-04-19) | `(asset_id PK, embedding vector(768), model, model_version, region, created_at, updated_at)` + HNSW cosine | E5 reads this. **HARD prerequisite: E3 must populate it before E5 can run usefully.** Tests use mock embeddings. |
| `ai_analysis` (shipped 2026-04-19) | `(subject_type, subject_id, model, model_version, input_hash, output, token_input, token_output, cost_cents, region, created_at)` + UNIQUE constraint | E5 reuses for cluster-name caching per E1.5 §9.5. Subject type `'cluster'` is a new value — already in CHECK if the CHECK is open-ended (verify in implementation; E2's directive lists `'asset' \| 'cluster' \| 'query' \| 'brief' \| 'post'` in `cache.ts` types but the migration's CHECK constraint must permit it). |
| `audit_log` (shipped 2026-04-19) | Generic system-grain events | E5 writes new events: `ai.gemini.cluster_named`, `ai.clustering.batch_completed`, `ai.clustering.batch_failed`. The "skipped because below silhouette floor" signal is captured in `batch_completed.metadata.below_floor_clusters` rather than as a separate event (per-cluster events for skips would be high-volume / low-signal). |
| `asset_proposal_audit_log` (E2) | Field-grain proposal events; `event_type` includes `'cluster_proposed'`, `'cluster_accepted'`, `'cluster_dismissed'` | E5 writes `cluster_proposed` per surviving cluster (one per cluster, batch-amortized). |
| `src/lib/ai/google.ts` (E3) | Wraps Vertex Gemini Vision + embedding, **does not** currently expose a text-only generation path | E5 needs **`generateText({ prompt, model: 'pro', region })`** for cluster naming. **This is an E5-side extension to `google.ts`** — not a re-spec of CCP 7's broader `generateText`. The narrow signature is locked here (§9.2); CCP 7's wider scope (query understanding, brief generation, etc.) remains future. |
| `src/lib/processing/dispatcher.ts` | Built (PR 4) — `dispatchAssetForProcessing(assetId, storage)` | NOT touched in E5. E5 adds a parallel `src/lib/processing/batch-clustering-dispatcher.ts` mirroring E4's `proposal-dispatcher.ts` shape. |
| `src/lib/processing/reaper.ts` (after E4 extends it) | Built — `reapStuckProcessingRows` + (post-E4) `reapStuckProposalRows` | E5 adds `reapStuckClusteringJobs` parallel to those. |
| `scripts/process-derivatives.ts` (after E4 extends it) | Reaper + per-asset pending loop + (post-E4) per-proposal pending loop | E5 adds a third reaper call + a "stuck batch clustering" recovery loop. (Per-batch claim semantics differ from per-asset; see §10.3.) |
| HDBSCAN Node packages | None currently in `package.json`. Sandbox previously hit a linux-arm64 binding gap during E2 vitest setup — **native bindings are operationally fragile** | E5 selects pure-JS / pure-TS preferred; native-bindings only as a fallback with explicit verification at implementation. §7 names selection criteria + 2-3 candidates + a DIY fallback path. |
| `users.ai_region` (added by E3) | enum `('eu', 'us')`, default `'eu'` | E5 reads it via the batch-creator lookup; routes the cluster-naming `gemini-2.5-pro` call to the matching VertexRegion. |
| Creator "Re-analyze session" UI | Does NOT exist anywhere in the codebase (grep verified) | E5 exposes the callable function (`dispatchBatchClusteringForProcessing(batchId, storage)`); E6 wires the UI button. |

---

## 3. Hard prerequisites

| Prerequisite | Source | E5 handling |
|---|---|---|
| E2 implementation shipped | `asset_proposal_clusters`, `asset_proposals.cluster_id`, `asset_proposal_audit_log`, `ai_pipeline_settings` | E5 writes to these tables; if missing, INSERT fails at runtime |
| E3 implementation shipped | `asset_embeddings` populated by per-asset job; `src/lib/ai/google.ts` wrapper exists with `analyseImage` + `generateEmbedding`; `cache.ts` exists; `circuit-breaker.ts` + `quota.ts` exist; `models.ts` has `cluster_naming = 'gemini-2.5-pro'` pin; `users.ai_region` column exists; `cost.ts` has verified `cluster_naming` pricing | E5 reads all of these. Without E3, embeddings are absent and naming has no client wrapper. |
| E4 implementation shipped | `dispatchAssetProposalForProcessing` pattern; reaper extension; `commit-service.ts` proposal hook; `scripts/process-derivatives.ts` extended for proposal pending loop | E5 mirrors the dispatcher shape and extends reaper + script in parallel additions |
| `ai_analysis.subject_type` permits `'cluster'` | Verify at implementation against the migration's CHECK constraint | If the CHECK constraint hardcodes a list excluding `'cluster'`, E5 ships a small migration adding the value. If the CHECK is open or already includes `'cluster'`, no migration needed. |
| Vertex pricing for `gemini-2.5-pro` verified | E3 ratification gate #5 (cost.ts non-null) | Inherits from E3 — if `cost.ts` ships with `cluster_naming` priced, E5 adds no pricing work |
| HDBSCAN library candidate selected | This directive §7 + implementation-time verification | E5 implementation runs the §7 evaluation and locks the choice in a small follow-on commit; founder ratifies the choice before merge |

If any of these are missing at E5 ship time, E5 cannot merge.

---

## 4. Scope boundary

E5 **does**:
- Add `src/lib/ai-suggestions/clustering.ts` — the engine: fetch embeddings → HDBSCAN → silhouette filter → naming → write
- Add `src/lib/ai-suggestions/cluster-naming.ts` — wraps `gemini-2.5-pro` call + cache + fallback to date range
- Add `src/lib/ai-suggestions/cluster-input.ts` — small helper: normalize embeddings + dates from DB rows; deterministic ordering
- Add `src/lib/processing/batch-clustering-dispatcher.ts` — `dispatchBatchClusteringForProcessing(batchId, storage)` orchestration
- Add `src/lib/processing/enqueue-clustering.ts` — claim helper for the in-flight signal (§10.2)
- Extend `src/lib/ai/google.ts` — add narrow `generateText({ prompt, model: 'pro', region })` (E5 scope only; CCP 7's broader expansion remains future)
- Extend `src/lib/processing/reaper.ts` — `reapStuckClusteringJobs(timeoutSeconds)`
- Extend `src/lib/upload/batch-service.ts` — `commitBatch` success branch fires `dispatchBatchClusteringForProcessing` fire-and-forget
- Extend `scripts/process-derivatives.ts` — third reaper call + stuck-batch recovery loop
- Add the (potentially) small migration for `ai_analysis.subject_type` CHECK constraint if it doesn't already include `'cluster'`
- Add the migration for the in-flight tracking field on `asset_proposal_clusters` (§10.2 design choice)
- Tests: 9-12 new test files; ~50-70 cases

E5 **does not**:
- Add UI (E6) — the cluster banner, accept/dismiss/rename surfaces, the "Re-analyze session" button
- Migrate to a different embedding shape (`multimodalembedding@001` etc.) — v2 enrichment per E1.5 §10.5
- Add per-creator-locale cluster naming — v2 enrichment per E1.5 §13 item 6
- Add `proposal_shown` / `cluster_shown` view-tracking events — v2 enrichment
- Activate `FFF_AI_REAL_PIPELINE` in any deployed env — separate flag flip
- Schedule `scripts/process-derivatives.ts` in production cron — PR 5 territory
- Touch `asset_proposals` schema (only the `cluster_id` field which E2 already shipped)
- Touch derivative pipeline / commit-service per-asset path / E3 engine

---

## 5. Files added / touched / not touched

**Added:**

```
supabase/migrations/<TIMESTAMP>_clustering_in_flight_signal.sql
supabase/migrations/<TIMESTAMP>_ai_analysis_cluster_subject_type.sql  (CONDITIONAL — only if CHECK constraint excludes 'cluster')
supabase/migrations/_rollbacks/<TIMESTAMP>_clustering_in_flight_signal.DOWN.sql
supabase/migrations/_rollbacks/<TIMESTAMP>_ai_analysis_cluster_subject_type.DOWN.sql

src/lib/ai-suggestions/
├── clustering.ts                      # the engine — fetch → HDBSCAN → silhouette → naming → write
├── cluster-naming.ts                  # gemini-2.5-pro call + ai_analysis cache + date-range fallback
├── cluster-input.ts                   # build-input helpers; deterministic embedding ordering
└── __tests__/
    ├── clustering.test.ts             # engine integration with stub HDBSCAN
    ├── cluster-naming.test.ts         # cache hit/miss + fallback behavior
    ├── cluster-input.test.ts          # normalization + ordering
    └── clustering.fixture-batch.test.ts   # reproducibility on a fixed-seed fixture batch

src/lib/processing/
├── batch-clustering-dispatcher.ts     # dispatchBatchClusteringForProcessing
├── enqueue-clustering.ts              # claim helper for in-flight signal
└── __tests__/
    ├── batch-clustering-dispatcher.test.ts
    ├── enqueue-clustering.test.ts
    └── reaper-clustering.test.ts

scripts/
└── manual-test-cluster-batch.ts       # engineer-local QA (claim a batch, run the dispatcher, print clusters)
```

**Touched:**

```
src/lib/ai/google.ts                          # add generateText (narrow E5-scope signature)
src/lib/ai/__tests__/google.test.ts           # extend with generateText contract tests
src/lib/ai-suggestions/settings.ts            # E2 owns; E5 extends EffectiveSettings + reader for cluster_min_size + cluster_min_samples (surfaced from §8.3 ALTER)
src/lib/ai-suggestions/__tests__/settings.test.ts  # extend coverage to new fields
src/lib/processing/reaper.ts                  # add reapStuckClusteringJobs (parallel to existing reapers)
src/lib/processing/__tests__/reaper.test.ts   # extend
src/lib/upload/batch-service.ts               # commitBatch success → dispatch fire-and-forget
src/lib/upload/__tests__/batch-service.test.ts # extend
scripts/process-derivatives.ts                # third reaper + stuck-batch recovery loop
src/lib/processing/AI-PIPELINE-BRIEF.md       # §4.3 + §4.1 corrigendum (terminology: 'committing' → 'committed' on success)
```

**Not touched:**

```
src/lib/ai-suggestions/engine.ts              # E3 owns; E5 doesn't change Class A
src/lib/ai-suggestions/cache.ts               # E3 owns; E5's cluster-naming.ts uses it as-is
src/lib/ai-suggestions/circuit-breaker.ts     # E3 owns; cluster-naming uses it via google.ts wrapper
src/lib/ai-suggestions/quota.ts               # E3 owns; same pre-call check as Class A (cluster naming counts toward platform spend cap)
src/lib/ai-suggestions/cost.ts                # E3 owns + filled with verified pricing; E5's cluster-naming reads MODELS.cluster_naming pricing
src/lib/ai-suggestions/audit.ts               # E2 owns; E5 calls writeAuditEvent for cluster_proposed
src/lib/ai-suggestions/models.ts              # E3 already pins cluster_naming = 'gemini-2.5-pro'
src/lib/ai-suggestions/embedding.ts           # E3 owns; E5 only READS asset_embeddings
src/lib/processing/dispatcher.ts              # PR 4; E5 has its own batch-clustering-dispatcher
src/lib/processing/proposal-dispatcher.ts     # E4 owns
src/lib/processing/enqueue-proposal.ts        # E4 owns
src/lib/processing/enqueue.ts                 # PR 3 derivative enqueue
src/lib/upload/commit-service.ts              # E4 hook stays; E5's hook is in batch-service.ts (different code path: per-asset commit vs per-batch commit)
src/app/                                      # no UI changes in E5
src/lib/env.ts                                # no new flags
```

---

## 6. Trigger semantics — locked

### 6.1 The terminology drift in E1 v2 §4.1

E1 v2 §4.1 says Class B "Fires when (a) a batch transitions to `'committing'` state per `upload_batches`, OR (b) explicit creator action ('Re-analyze this session')."

**Audit-first finding:** the `upload_batches.state` enum permits `'committing'` but no current code path writes that value. `transitionToCommitted` in `batch-store.ts` performs a single conditional UPDATE `state='open' → 'committed'`. There is no two-phase commit and no plan to introduce one. The string `'committing'` appears in `v3-types.ts` to denote the **UI's** local commit-in-flight phase (per `V3State.commit.phase`), which is not the same surface as the **DB's** `upload_batches.state`. The migration's COMMENT explicitly notes this divergence ("DB lifecycle state. Distinct from the UI stage").

### 6.2 The lock

E5's trigger is **`commitBatch` success** — i.e., the moment `transitionToCommitted` returns `kind: 'ok'` from `src/lib/upload/batch-service.ts`. Fired fire-and-forget after the success branch returns. Mirrors E4's per-asset pattern (fire-and-forget after `commit-service.ts` success).

```typescript
// src/lib/upload/batch-service.ts (E5 extension to commitBatch)

export async function commitBatch(req: CommitBatchRequest): Promise<CommitBatchResult> {
  const result = await transitionToCommitted({ batchId: req.batchId, creatorId: req.creatorId })
  switch (result.kind) {
    case 'ok':
      // E5 — fire-and-forget. The dispatcher resolves the batch's
      // creator + region + asset list internally and runs Class B
      // asynchronously. Errors are logged but do NOT roll back the
      // commit (the batch is canonical; the reaper + next worker tick
      // recover from any dispatch-time crash).
      dispatchBatchClusteringForProcessing(result.batch.id, getStorageAdapter()).catch(err => {
        // eslint-disable-next-line no-console
        console.error(
          'commit.dispatch: clustering_dispatch_failed',
          JSON.stringify({
            code: 'clustering_dispatch_failed',
            batch_id: result.batch.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      })
      return { ok: true, batch: result.batch }
    // ... other cases unchanged
  }
}
```

The dispatch fires from `batch-service.ts` (not `commit-service.ts`) because:
- `commit-service.ts` is **per-asset** commit (one row write to `vault_assets` per asset)
- `batch-service.ts` is **per-batch** commit (one row update to `upload_batches`)
- Class B is batch-grain, not asset-grain — the dispatch belongs at the batch boundary

### 6.3 Explicit creator "Re-analyze this session" surface

E5 exposes `dispatchBatchClusteringForProcessing(batchId, storage)` as the callable. The UI button itself lands in E6.

When the creator triggers re-analysis on a batch that already has clusters, the dispatcher's behavior is:
- Existing `asset_proposal_clusters` rows for the batch where `accepted_at IS NULL AND dismissed_at IS NULL` (i.e., still pending creator decision) are **deleted** before re-clustering. Their `cluster_proposed` audit events remain in `asset_proposal_audit_log` (append-only).
- Existing `asset_proposal_clusters` rows where `accepted_at IS NOT NULL` (creator has accepted into a Story group) are **preserved**. Their member `asset_proposals.cluster_id` are also preserved. Re-clustering operates only over members not already in an accepted cluster.
- Existing `asset_proposal_clusters` rows where `dismissed_at IS NOT NULL` are **preserved** (audit trail) but their members are eligible for re-clustering.

Member-level: `asset_proposals.cluster_id IS NULL` for any asset whose only cluster membership was the deleted pending row.

This aligns with E1 v2 §4.1: "creator-accepted clusters are protected (their `accepted_as_story_group_id` is preserved)."

### 6.4 The corrigendum

A small follow-on docs PR updates `AI-PIPELINE-BRIEF.md` v2 §4.1 to replace "transitions to `'committing'` state" with "fires after `commitBatch` succeeds (i.e., `state='committed'` is written)." Same shape as the E2 §5.6 corrigendum already noted in the session-wrap. Separate concern; can ship as part of E5's PR or as a standalone docs PR.

### 6.5 Why not a Postgres trigger on `upload_batches`

Considered and rejected:

| Approach | Pro | Con | Pick |
|---|---|---|---|
| Postgres trigger fires `pg_notify('cluster_batch', batch_id)` on state transition | DB-owned; doesn't depend on application code firing the dispatch | Requires a listener process; introduces a second path of control flow that the reaper doesn't recover from cleanly; couples the worker to a Postgres LISTEN/NOTIFY infrastructure we haven't built | ✗ |
| Inline await of clustering inside `commitBatch` | Simplest control flow; commit blocks until clusters exist | Clustering can take seconds (HDBSCAN over thousands of vectors + 1-N Vertex calls); blocks the commit response indefinitely; opposite of E1 §4.1 "deferred batch analysis" | ✗ |
| Fire-and-forget after `transitionToCommitted` returns ok | Matches E4 per-asset pattern; commit response returns immediately; reaper recovers stuck jobs; no new infrastructure | Requires the in-flight signal (§10.2) so the reaper can identify stuck jobs | ✓ |

---

## 7. HDBSCAN library selection

### 7.1 Selection contract

Under no circumstance lock a specific package in this directive. The library landscape moves; the sandbox's E2 vitest run hit a linux-arm64 binding gap that demonstrates native-binding fragility. Implementation-time selection runs §7.2's evaluation against current npm and locks the choice in a follow-on commit before merge.

The contract this directive locks:

| Property | Required |
|---|---|
| Distance metric | Cosine similarity over 768-dim float arrays |
| Determinism | Same input → same output across runs (seedable RNG; or deterministic-by-construction) |
| Min cluster size | Configurable parameter; default candidate values §7.3 |
| Output | Per-point cluster label (integer; -1 for noise) AND silhouette score per cluster (or per point, aggregated) |
| Native dependencies | Pure JS / pure TS strongly preferred; native bindings only with explicit verification on the target deploy platform (Vercel Node runtime, Linux x64) |
| Bundle / install size | < 5 MB additional in production bundle |
| Maintenance | Last release within 24 months OR vendored implementation Frontfiles maintains |
| Type safety | TypeScript types available OR vendor-able .d.ts |

### 7.2 Evaluation candidates (verify at implementation)

These are starting points for the implementation-time evaluation. Each one's actual current state must be verified at install time — the directive does NOT assert any of these are working today.

**Candidate A — `hdbscan-ts` (pure TypeScript port):**
- Pro if available + maintained: pure TS; no native deps; small footprint
- Verify: actively published; deterministic output; performance on 1k–10k points; cosine distance support (or convert via vector normalization)

**Candidate B — A WASM port of `hdbscan` (e.g., from the Python `hdbscan` library compiled to WASM):**
- Pro if available + maintained: closer to reference behavior of the Python ground-truth; potentially faster
- Con: WASM cold-start cost; deployment-platform compatibility risk (Vercel serverless WASM support varies); binary download bloats bundle

**Candidate C — Vendored DIY implementation:**
- Pro: zero dependency risk; deterministic by construction; ~500-800 LOC of well-understood algorithm
- Con: implementation cost; testing burden; must validate against a reference (e.g., compare cluster labels to Python `hdbscan` on a fixture batch)
- This is the **fallback**: if A and B both fail evaluation, E5 implementation vendors the algorithm under `src/lib/ai-suggestions/hdbscan/` with comprehensive unit tests against fixed-seed reference outputs.

### 7.3 Empirical knobs (verify at implementation, not locked here)

Per don't-do-#26: these are NOT locked in this directive because they require real `asset_embeddings` data populated by E3 to tune. E5 implementation runs a small calibration script over a representative sample of (mocked-but-realistic) batches and proposes values; founder ratifies before merge.

| Knob | Starting candidate | Verify-at-implementation gate |
|---|---|---|
| `min_cluster_size` | `3` (smallest meaningful Story group: a triplet) | Confirm against fixture batch: ≥ 3 prevents trivial 2-asset "clusters" that are usually a/b shots, not stories |
| `min_samples` (HDBSCAN density param) | Default to library's recommendation; commonly `min_cluster_size` | Confirm cluster count is reasonable on the fixture |
| Cosine distance threshold | None (HDBSCAN derives) | Confirm HDBSCAN's natural cluster density on cosine over text-embedding-004 outputs is meaningful |
| Silhouette floor for surfacing | `0.30` from `ai_pipeline_settings.confidence_floor_silhouette` (E2 default) | Confirm that ~half of the fixture clusters survive — too aggressive if 0/N survive; too permissive if all survive |
| Embedding shape regression | `caption + " \| " + tags + " \| " + format` per E1.5 §10.1 | Per E1.5 §10.5: if median silhouette is pathologically low (< 0.20) across 3 representative test batches, surface as a follow-on directive (NOT in E5 — that would be `multimodalembedding@001` migration scope) |

E5 implementation surfaces the calibration results as part of the PR description for founder review. If the empirical results indicate the embedding shape itself is wrong, E5's PR is **not the place to migrate** — that's a v2 enrichment per E1.5 §13 item 7. E5 ships with the chosen knobs even if quality is mediocre, **and** opens a follow-on directive for the migration. The decision to launch on mediocre clusters vs. delay launch behind embedding migration is a founder call (D-U2 lock interaction).

---

## 8. Clustering pipeline

### 8.1 Engine outline

```typescript
/**
 * Frontfiles — Class B (batch clustering) engine
 *
 * Per AI-PIPELINE-BRIEF.md v2 §4.3 + E1.5 §9 + §10.
 *
 * Triggered by batch-clustering-dispatcher.ts (this engine is pure;
 * the dispatcher handles claim + lifecycle + audit + retries).
 *
 * Inputs:
 *   - batchId: identifies the upload_batches row
 *   - creatorId + region: resolved by the dispatcher upstream
 *   - storage: not used here (clustering is over embeddings, not bytes)
 *
 * Output: ClusterResult — array of clusters with name, members, silhouette,
 *         and provenance. The dispatcher persists.
 *
 * SERVER-ONLY.
 */

import { runHdbscan } from './hdbscan'  // wrapped per §7.2 selection
import { silhouettePerCluster } from './hdbscan/silhouette'
import { proposeClusterName } from './cluster-naming'
import { getEffectiveSettings } from './settings'
import { MODELS } from './models'
import { getSupabaseClient } from '@/lib/db/client'
import type { VertexRegion } from './types'
import type { AssetFormat } from '@/lib/upload/v2-types'

export interface ClusterEngineOpts {
  batchId: string
  creatorId: string
  region: VertexRegion
}

export interface ProposedCluster {
  members: Array<{ assetId: string }>
  silhouetteScore: number
  proposedName: string | null
  modelVersion: string
  region: VertexRegion
}

export interface ClusterEngineResult {
  clusters: ProposedCluster[]
  totalAssets: number
  noiseAssets: number
  belowFloorClusters: number    // dropped because silhouette < floor
  cacheHitsForNaming: number
  cacheMissesForNaming: number
}

export async function clusterBatch(opts: ClusterEngineOpts): Promise<ClusterEngineResult> {
  const settings = await getEffectiveSettings()
  const supabase = getSupabaseClient()

  // 1. Load embeddings + per-asset metadata for the batch
  //    (vault_assets ⨝ asset_embeddings ⨝ asset_proposals)
  const rows = await loadBatchEmbeddings(opts.batchId)
  if (rows.length < settings.cluster_min_size /* sourced from settings — see §8.3 */) {
    // Below the minimum cluster size — no clustering; return empty result.
    return emptyResult(rows.length)
  }

  // 2. Run HDBSCAN over the 768-dim cosine distance matrix
  const labels = await runHdbscan({
    vectors: rows.map(r => r.embedding),
    minClusterSize: settings.cluster_min_size,
    metric: 'cosine',
    seed: opts.batchId, // deterministic per batch
  })

  // 3. Group by label; -1 is noise
  const groups = groupByLabel(rows, labels) // returns Map<label, rows[]>
  const noiseAssets = (groups.get(-1) ?? []).length  // capture BEFORE delete
  groups.delete(-1)                                  // drop noise from grouping

  // 4. Compute silhouette per cluster
  const silhouettes = silhouettePerCluster(rows.map(r => r.embedding), labels, /* metric */ 'cosine')

  // 5. Filter by silhouette floor
  const surviving: Array<{ label: number; members: typeof rows; silhouette: number }> = []
  let belowFloor = 0
  for (const [label, members] of groups) {
    const s = silhouettes.get(label) ?? 0
    if (s < settings.confidence_floor_silhouette) {
      belowFloor++
      continue
    }
    surviving.push({ label, members, silhouette: s })
  }

  // 6. Name each surviving cluster (cached via ai_analysis)
  let cacheHits = 0
  let cacheMisses = 0
  const proposed: ProposedCluster[] = []
  for (const cluster of surviving) {
    const naming = await proposeClusterName({
      captions: cluster.members.map(m => m.caption ?? ''),
      capturedAt: cluster.members.map(m => m.capturedAt),
      region: opts.region,
    })
    if (naming.cacheHit) cacheHits++
    else cacheMisses++
    proposed.push({
      members: cluster.members.map(m => ({ assetId: m.assetId })),
      silhouetteScore: cluster.silhouette,
      proposedName: naming.name,
      modelVersion: MODELS.cluster_naming,
      region: opts.region,
    })
  }

  return {
    clusters: proposed,
    totalAssets: rows.length,
    noiseAssets,
    belowFloorClusters: belowFloor,
    cacheHitsForNaming: cacheHits,
    cacheMissesForNaming: cacheMisses,
  }
}
```

### 8.2 Loading the input

```sql
-- Used by loadBatchEmbeddings(batchId)
-- Service-role only.

SELECT va.id           AS asset_id,
       ae.embedding    AS embedding,
       va.captured_at  AS captured_at,
       ap.caption      AS caption,
       va.format       AS format
FROM vault_assets va
JOIN asset_embeddings ae ON ae.asset_id = va.id
LEFT JOIN asset_proposals ap ON ap.asset_id = va.id
WHERE va.batch_id = $1
  AND ae.embedding IS NOT NULL
  -- Exclude assets already in an accepted cluster (per §6.3 re-cluster behavior)
  AND NOT EXISTS (
    SELECT 1 FROM asset_proposals ap2
    JOIN asset_proposal_clusters apc ON apc.id = ap2.cluster_id
    WHERE ap2.asset_id = va.id
      AND apc.accepted_at IS NOT NULL
  )
ORDER BY va.created_at ASC, va.id ASC  -- deterministic ordering for HDBSCAN reproducibility
```

Deterministic ordering matters: HDBSCAN's MST construction is order-stable in well-implemented libraries, but to guarantee reproducibility across runs we sort by `created_at` ASC + `id` ASC. The library candidate evaluation in §7.2 must verify this.

### 8.3 New settings fields needed

`ai_pipeline_settings` (E2) does not currently include `cluster_min_size`. E5 ships a small ALTER:

```sql
-- supabase/migrations/<TIMESTAMP>_ai_pipeline_settings_clustering_fields.sql

ALTER TABLE ai_pipeline_settings
  ADD COLUMN cluster_min_size INTEGER NOT NULL DEFAULT 3
    CHECK (cluster_min_size >= 2),
  ADD COLUMN cluster_min_samples INTEGER
    -- NULL = library defaults to min_cluster_size; explicit value overrides
    CHECK (cluster_min_samples IS NULL OR cluster_min_samples >= 1);
```

No down-migration drops because dropping the columns post-rollback would leave settings reads broken. Instead, the rollback removes the columns and the rolled-back-to E2 defaults take effect.

These are the only schema additions E5 makes to the `ai_pipeline_settings` table.

### 8.4 Why not all-pairs cosine distance precomputation

For batches up to ~2,000 assets (per UX-BRIEF v3 §3 Q2), the all-pairs distance matrix is 2,000 × 2,000 × 8 bytes = 32 MB — uncomfortable in a serverless function. HDBSCAN libraries that work over a vector array directly (computing distances internally with optimizations) are preferred. The §7.2 evaluation requires the chosen library NOT require precomputed distance matrices for batches up to 2,000 vectors.

If the library requires precomputation: fall back to vendored DIY (Candidate C) which can stream pairwise distances without materializing the full matrix.

---

## 9. Cluster naming

### 9.1 The Vertex call

Per E1.5 §9. `gemini-2.5-pro` text-only generation against the prompt template in E1.5 §9.2. **No image input** — naming is a function of captions + dates only.

### 9.2 `google.ts` extension (narrow E5 scope)

```typescript
// src/lib/ai/google.ts (E5 extension; does NOT touch existing analyseImage / generateEmbedding)

export interface GenerateTextOpts {
  prompt: string
  model: 'pro'                  // 'flash' could be added later for query-understanding (CCP 7); locked to 'pro' for E5
  region: VertexRegion
  responseSchema?: object       // optional: if naming wants structured output
}

export interface GenerateTextResult {
  output: string                // the model's text response
  modelVersion: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

export async function generateText(opts: GenerateTextOpts): Promise<GenerateTextResult>
```

The signature deliberately constrains `model: 'pro'` (only). CCP 7's broader scope (`'flash'` for query understanding etc.) remains a future expansion and is not pre-locked here. Rationale: each model role needs its own bump policy + regression sample (per E1.5 §3.1) — adding more roles in the same signature without that regression discipline risks silent quality drift.

### 9.3 `cluster-naming.ts`

```typescript
/**
 * Frontfiles — Cluster name proposal
 *
 * Per E1.5 §9. Reads cache via ai_analysis; calls gemini-2.5-pro on miss;
 * falls back to date range on empty/generic response.
 *
 * SERVER-ONLY.
 */

import { generateText } from '@/lib/ai/google'
import { cacheRead, cacheWrite, buildInputHash } from './cache'
import { MODELS } from './models'
import { centsForCall } from './cost'
import { audit } from '@/lib/logger'
import { checkCircuitOrFail, recordSuccess, recordFailure } from './circuit-breaker'
import { checkSpendOrFail } from './quota'
import type { VertexRegion } from './types'

const GENERIC_NAMES = new Set([
  'photos', 'images', 'pictures', 'group', 'stuff',
  'photo', 'image', 'picture', 'asset', 'assets', 'media',
])

export interface ProposeClusterNameOpts {
  captions: string[]
  capturedAt: Array<Date | null>
  region: VertexRegion
}

export interface ProposeClusterNameResult {
  name: string | null  // null = no name proposed (UI falls back to date range)
  cacheHit: boolean
  modelVersion: string
}

export async function proposeClusterName(
  opts: ProposeClusterNameOpts,
): Promise<ProposeClusterNameResult> {
  const sortedCaptions = [...opts.captions].sort()  // deterministic input hash
  const dateRange = formatDateRange(opts.capturedAt)
  const prompt = buildClusterNamingPrompt(sortedCaptions, dateRange)
  const inputHash = buildInputHash([sortedCaptions.join('\n'), dateRange])

  const cacheKey = {
    subjectType: 'cluster' as const,
    subjectId: null,                          // cluster-grain naming is reusable across re-runs of the same input
    model: MODELS.cluster_naming,
    modelVersion: MODELS.cluster_naming,
    inputHash,
  }

  // Cache read
  const cached = await cacheRead(cacheKey)
  if (cached) {
    return {
      name: extractNameOrFallback(cached.output as string, dateRange),
      cacheHit: true,
      modelVersion: cached.modelVersion,
    }
  }

  // Pre-flight checks (mirror E3 engine.ts steps)
  await checkCircuitOrFail(opts.region)
  await checkSpendOrFail()

  // Vertex call
  let result
  try {
    result = await generateText({ prompt, model: 'pro', region: opts.region })
    await recordSuccess(opts.region)
  } catch (err) {
    const shouldCount = !(err as Error).name?.includes('Permanent')
    await recordFailure(opts.region, shouldCount)
    throw err
  }

  const costCents = centsForCall('cluster_naming', {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  })

  // Cache write (per E1.5 §9.5)
  await cacheWrite(cacheKey, {
    output: result.output,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costCents,
    region: opts.region,
  })

  // Audit
  await audit({
    event_type: 'ai.gemini.cluster_named',
    target_type: 'cluster',
    target_id: null,
    metadata: {
      region: opts.region,
      cost_cents: costCents,
      latency_ms: result.latencyMs,
      input_hash: inputHash,
    },
  })

  return {
    name: extractNameOrFallback(result.output, dateRange),
    cacheHit: false,
    modelVersion: result.modelVersion,
  }
}

function extractNameOrFallback(modelOutput: string, dateRange: string): string | null {
  const cleaned = modelOutput.trim().replace(/^["']|["']$/g, '')
  if (cleaned.length === 0) return dateRange  // fall back per E1.5 §9.4
  if (GENERIC_NAMES.has(cleaned.toLowerCase())) return dateRange
  // Word count gate per E1.5 §9.2 constraint #1 (2-4 words)
  const words = cleaned.split(/\s+/)
  if (words.length < 2 || words.length > 4) return dateRange
  return cleaned
}

function buildClusterNamingPrompt(captions: string[], dateRange: string): string {
  // Verbatim per E1.5 §9.2
  return `You are naming a Story group on Frontfiles. The group contains photos or
illustrations the creator took or made together — same shoot, same event, same
project.

Below are AI-suggested captions for the ${captions.length} assets in this group, plus the date
range across them.

Captions:
${captions.join('\n')}

Date range: ${dateRange}

Suggest a 2-4 word descriptive title for this group.

Constraints — these are not optional:
1. 2-4 words. Not 1, not 5+.
2. Descriptive of the visible subject. No editorialising. No factual claims about
   identified persons or events you cannot derive from the captions alone.
3. If the captions are too generic to differentiate (e.g., "Photos", "Images"),
   reply with the empty string. The system will fall back to the date range.
4. Output ONLY the title, no commentary, no quotes, no markdown.`
}

function formatDateRange(capturedAt: Array<Date | null>): string {
  // Per E1.5 §9.3
  // ... (implementation detail per E1.5)
}
```

### 9.4 Naming-call cost amortization

Per E1.5 §9.6: ~$0.0001-$0.0003 per cluster. For a 100-asset batch with ~10 clusters: ~$0.001-$0.003. Cache hits on re-cluster bring this to zero. The cost capture flows into `ai_analysis.cost_cents` and counts toward the platform spend cap (§14 honors the same `checkSpendOrFail` E3 added).

### 9.5 What if naming itself fails?

If the Vertex call throws after retry (circuit-open or persistent error), the cluster's `proposed_name` is set to the date-range fallback. The cluster IS still surfaced — naming failure does not invalidate the clustering. Audit event `ai.gemini.cluster_named` carries the failure detail.

---

## 10. Worker integration

### 10.1 The dispatcher

```typescript
/**
 * Frontfiles — Batch Clustering Dispatcher (Class B worker entry)
 *
 * Per AI-PIPELINE-BRIEF.md v2 §4.3 + E1.5 §9.
 *
 * Called from:
 *   - batch-service.ts commitBatch success branch (fire-and-forget)
 *   - scripts/process-derivatives.ts (loop over claimed-stuck batches)
 *   - E6 "Re-analyze session" creator action (callable from API route)
 *
 * Lifecycle:
 *   1. Claim the batch (transition some signal to indicate clustering in flight)
 *   2. Look up creator + region
 *   3. Delete pending (un-accepted, un-dismissed) clusters for the batch (re-cluster behavior)
 *   4. Call the engine (clusterBatch)
 *   5. Persist surviving clusters + update asset_proposals.cluster_id
 *   6. Write cluster_proposed audit events
 *   7. Release the claim
 *   8. On exception: log + release claim; reaper picks up if still stuck
 *
 * SERVER-ONLY.
 */

import type { StorageAdapter as LowLevelStorage } from '@/lib/storage'
import { getSupabaseClient } from '@/lib/db/client'
import { clusterBatch } from '@/lib/ai-suggestions/clustering'
import { writeAuditEvent } from '@/lib/ai-suggestions/audit'
import { audit } from '@/lib/logger'
import type { UserAiRegion, VertexRegion } from '@/lib/ai-suggestions/types'

const REGION_MAP: Record<UserAiRegion, VertexRegion> = {
  eu: 'europe-west4',
  us: 'us-central1',
}

export async function dispatchBatchClusteringForProcessing(
  batchId: string,
  _storage: LowLevelStorage,  // unused; clustering reads embeddings, not bytes
): Promise<void> {
  const supabase = getSupabaseClient()

  // 1. Claim the batch (atomic — see §10.2)
  const claim = await claimBatchForClustering(batchId)
  if (!claim.ok) {
    // Either already in flight (legitimate concurrent call) or batch not found
    return
  }

  const { creatorId, aiRegion } = claim
  const vertexRegion = REGION_MAP[aiRegion]

  try {
    // 2. Delete pending clusters for re-cluster (per §6.3)
    await deletePendingClustersForBatch(batchId)

    // 3. Run the engine
    const result = await clusterBatch({ batchId, creatorId, region: vertexRegion })

    // 4. Persist
    for (const cluster of result.clusters) {
      const { data: row } = await supabase
        .from('asset_proposal_clusters')
        .insert({
          creator_id: creatorId,
          batch_id: batchId,
          proposed_name: cluster.proposedName,
          asset_count: cluster.members.length,
          silhouette_score: cluster.silhouetteScore,
          model_version: cluster.modelVersion,
          region: vertexRegion,
        })
        .select('id')
        .single()

      const clusterId = (row as { id: string }).id

      // Update member assets' cluster_id
      const memberIds = cluster.members.map(m => m.assetId)
      await supabase
        .from('asset_proposals')
        .update({
          cluster_id: clusterId,
          cluster_confidence: cluster.silhouetteScore,
        })
        .in('asset_id', memberIds)

      // Audit per cluster (one event per cluster, batch-amortized)
      // For each member, write a per-asset cluster_proposed event so the trail is queryable per-asset.
      for (const memberId of memberIds) {
        await writeAuditEvent({
          asset_id: memberId,
          creator_id: creatorId,
          event_type: 'cluster_proposed',
          cluster_id: clusterId,
          surface: 'system',
          after_value: {
            cluster_id: clusterId,
            silhouette_score: cluster.silhouetteScore,
            proposed_name: cluster.proposedName,
          },
        })
      }
    }

    // 5. System-grain audit
    await audit({
      event_type: 'ai.clustering.batch_completed',
      target_type: 'upload_batch',
      target_id: batchId,
      metadata: {
        cluster_count: result.clusters.length,
        total_assets: result.totalAssets,
        noise_assets: result.noiseAssets,
        below_floor_clusters: result.belowFloorClusters,
        cache_hits_for_naming: result.cacheHitsForNaming,
        cache_misses_for_naming: result.cacheMissesForNaming,
      },
    })
  } catch (err) {
    // Log + release claim; reaper handles long-stuck cases
    const errorMessage = err instanceof Error ? err.message : String(err)
    await audit({
      event_type: 'ai.clustering.batch_failed',
      target_type: 'upload_batch',
      target_id: batchId,
      metadata: { error: errorMessage },
    })
    // No retry-once: clustering is batch-grain; per-batch retry is a creator
    // action (Re-analyze) or a reaper sweep
  } finally {
    await releaseBatchClusteringClaim(batchId)
  }
}
```

### 10.2 The in-flight signal

Class A (per-asset) uses `asset_proposals.generation_status` as the in-flight signal. Class B needs an analogous signal at the batch grain. Three design options were evaluated:

| Approach | Pro | Con | Pick |
|---|---|---|---|
| Add `clustering_status` enum column to `upload_batches` | Reuses an existing table; symmetric to per-asset pattern | Cross-pillar coupling — `upload_batches` is the commit-contract table, polluting it with clustering-pillar state mixes concerns; enum migrations on hot tables are expensive | ✗ |
| Separate `batch_clustering_jobs` table tracking in-flight + completed-at | Clean separation; easy to add fields later (cost-cents, latency, etc.) | Yet another table; a single batch row is a 1:1 lifecycle that fits in a column | ✗ |
| Add `clustering_status` enum + `clustering_started_at` columns to `asset_proposal_clusters` AND a row-per-batch sentinel pattern | Co-locates with the table that already represents "what clustering produced for this batch" | Sentinel rows are a quiet anti-pattern; require everywhere to filter `WHERE proposed_name IS NOT NULL` | ✗ |
| Add `clustering_started_at TIMESTAMPTZ NULL` + `clustering_completed_at TIMESTAMPTZ NULL` directly on `upload_batches` | Cheap migration; reaper sweeps `WHERE clustering_started_at IS NOT NULL AND clustering_completed_at IS NULL AND clustering_started_at < cutoff`; doesn't pollute commit contract because these are the proper grain (batch-level lifecycle) | Slight `upload_batches` schema growth | ✓ |

E5 picks the fourth option — minimal schema, lifecycle-aligned, clean reaper semantics.

```sql
-- supabase/migrations/<TIMESTAMP>_clustering_in_flight_signal.sql

ALTER TABLE upload_batches
  ADD COLUMN clustering_started_at TIMESTAMPTZ,
  ADD COLUMN clustering_completed_at TIMESTAMPTZ,
  ADD COLUMN clustering_error TEXT,
  ADD CONSTRAINT clustering_lifecycle_consistent CHECK (
    -- completed_at requires started_at (can't complete without starting)
    clustering_completed_at IS NULL OR clustering_started_at IS NOT NULL
  );

-- Reaper-friendly partial index: only currently-in-flight rows
CREATE INDEX upload_batches_clustering_in_flight_idx
  ON upload_batches (clustering_started_at)
  WHERE clustering_started_at IS NOT NULL AND clustering_completed_at IS NULL;

COMMENT ON COLUMN upload_batches.clustering_started_at IS
  'E5: timestamp the Class B clustering job claimed this batch. NULL = not started OR completed (paired with clustering_completed_at).';
COMMENT ON COLUMN upload_batches.clustering_completed_at IS
  'E5: timestamp the Class B clustering job released the batch. Set on both success and failure (failure sets clustering_error). Independent of upload_batches.state — clustering can run on already-committed batches via Re-analyze action.';
```

```sql
-- _rollbacks/<TIMESTAMP>_clustering_in_flight_signal.DOWN.sql

ALTER TABLE upload_batches
  DROP CONSTRAINT IF EXISTS clustering_lifecycle_consistent,
  DROP COLUMN IF EXISTS clustering_started_at,
  DROP COLUMN IF EXISTS clustering_completed_at,
  DROP COLUMN IF EXISTS clustering_error;

DROP INDEX IF EXISTS upload_batches_clustering_in_flight_idx;
```

The claim function:

```typescript
async function claimBatchForClustering(
  batchId: string,
): Promise<{ ok: true; creatorId: string; aiRegion: UserAiRegion } | { ok: false }> {
  const supabase = getSupabaseClient()

  // CAS-style claim: clustering_started_at IS NULL → set; otherwise no-op
  const { data: claim } = await supabase
    .from('upload_batches')
    .update({
      clustering_started_at: new Date().toISOString(),
      clustering_completed_at: null,
      clustering_error: null,
    })
    .eq('id', batchId)
    .is('clustering_started_at', null)  // CAS condition
    .select('id, creator_id')
    .maybeSingle()

  if (!claim) return { ok: false }

  // Look up creator's ai_region
  const { data: user } = await supabase
    .from('users')
    .select('ai_region')
    .eq('id', (claim as { creator_id: string }).creator_id)
    .single()

  return {
    ok: true,
    creatorId: (claim as { creator_id: string }).creator_id,
    aiRegion: ((user as { ai_region: UserAiRegion } | null)?.ai_region) ?? 'eu',
  }
}

async function releaseBatchClusteringClaim(batchId: string): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase
    .from('upload_batches')
    .update({ clustering_completed_at: new Date().toISOString() })
    .eq('id', batchId)
}
```

For the "Re-analyze" path: the dispatcher first **clears** the existing claim by setting `clustering_started_at = NULL` AND `clustering_completed_at = NULL` (allowed because the action is creator-initiated and idempotent). This makes the CAS claim succeed. A small `resetBatchClusteringClaim(batchId, creatorId)` helper handles this; only the batch's own creator can reset.

### 10.3 Reaper extension

```typescript
// In src/lib/processing/reaper.ts (additive)

export interface ReapedClusteringJob {
  batchId: string
  stuckDurationSeconds: number
}

export async function reapStuckClusteringJobs(
  timeoutSeconds?: number,
): Promise<ReapedClusteringJob[]> {
  const effectiveTimeout = timeoutSeconds ?? readTimeoutFromEnv()
  if (!isSupabaseEnvPresent()) return []

  const client = getSupabaseClient()
  const cutoffIso = new Date(Date.now() - effectiveTimeout * 1000).toISOString()

  // Reset stuck claims so the next worker tick can re-claim
  const { data, error } = await client
    .from('upload_batches')
    .update({
      clustering_started_at: null,
      clustering_error: 'reaper_timeout',
    })
    .lt('clustering_started_at', cutoffIso)
    .is('clustering_completed_at', null)
    .select('id, clustering_started_at')

  if (error) {
    throw new Error(`reaper: reapStuckClusteringJobs failed (${error.message ?? 'unknown'})`)
  }

  const rows = (data ?? []) as Array<{ id: string; clustering_started_at: string | null }>
  const now = Date.now()
  return rows.map(r => {
    const stuckMs = r.clustering_started_at
      ? now - new Date(r.clustering_started_at).getTime()
      : 0
    const reapedRow: ReapedClusteringJob = {
      batchId: r.id,
      stuckDurationSeconds: Math.round(stuckMs / 1000),
    }
    logResetClustering(reapedRow)
    return reapedRow
  })
}
```

Reuses `FFF_PROCESSING_TIMEOUT_SECONDS` (default 600s) per E4's pattern. No new env var.

### 10.4 `scripts/process-derivatives.ts` extension

```typescript
async function main(): Promise<void> {
  // Existing: derivative + proposal reapers
  const reapedDerivatives = await reapStuckProcessingRows()
  const reapedProposals = await reapStuckProposalRows()
  // E5 addition:
  const reapedClustering = await reapStuckClusteringJobs()
  console.info(
    `process-derivatives: reapers reset — derivatives=${reapedDerivatives.length} proposals=${reapedProposals.length} clustering=${reapedClustering.length}`,
  )

  // ... existing derivative + proposal pending loops ...

  // E5 addition: stuck-batch recovery loop
  // The reaper resets clustering_started_at to NULL; we now find batches
  // that were JUST reaped (clustering_error='reaper_timeout') OR batches
  // that committed but never had clustering started (e.g., dispatch from
  // commit-service crashed before claim) and dispatch them.
  const pendingClusterBatches = await findBatchesNeedingClustering()
  let dispatchedClustering = 0
  let failedClustering = 0
  for (const batch of pendingClusterBatches) {
    try {
      await dispatchBatchClusteringForProcessing(batch.id, storage)
      dispatchedClustering++
    } catch (err) {
      failedClustering++
      console.error('process-derivatives: clustering_dispatch_failed', JSON.stringify({ batch_id: batch.id, error: err instanceof Error ? err.message : String(err) }))
    }
  }

  console.info(
    `process-derivatives: complete — derivatives=${dispatchedDerivatives}/${failedDerivatives} proposals=${dispatchedProposals}/${failedProposals} clustering=${dispatchedClustering}/${failedClustering}`,
  )
}

async function findBatchesNeedingClustering(): Promise<Array<{ id: string }>> {
  if (!isSupabaseConfigured()) return []
  const client = getSupabaseClient()
  // Definition: state='committed' AND clustering_completed_at IS NULL AND clustering_started_at IS NULL
  // (Batches that committed but haven't been clustered yet — either dispatch crashed or reaper reset them)
  const { data, error } = await client
    .from('upload_batches')
    .select('id')
    .eq('state', 'committed')
    .is('clustering_started_at', null)
    .is('clustering_completed_at', null)
    .order('committed_at', { ascending: true })
    .limit(50)  // bounded sweep per script invocation
  if (error) {
    throw new Error(`process-derivatives: findBatchesNeedingClustering failed (${error.message})`)
  }
  return ((data ?? []) as Array<{ id: string }>).map(r => ({ id: r.id }))
}
```

The 50-batch limit per script invocation prevents one-script-runs-forever pathology. Subsequent runs pick up the next 50.

---

## 11. Tests

### 11.1 Coverage matrix

| File | Coverage |
|---|---|
| `clustering.test.ts` | Engine integration with stub HDBSCAN: empty input → empty result; below-min-cluster-size input → empty; well-formed clusters survive silhouette; below-floor clusters dropped; naming cache hits/misses counted |
| `clustering.fixture-batch.test.ts` | Reproducibility: same fixture batch → same cluster labels across runs; deterministic ordering verified |
| `cluster-naming.test.ts` | Cache hit returns cached name; cache miss calls Vertex; empty/generic response → date range fallback; word-count gate enforced (1 word, 5+ words → date range); permanent error doesn't trip circuit |
| `cluster-input.test.ts` | Embedding ordering deterministic; metadata loading shape correct; assets in accepted clusters excluded from re-cluster |
| `batch-clustering-dispatcher.test.ts` | claim succeeds → process → release; concurrent claim fails (CAS); engine throws → claim released + error stamped; pending clusters deleted on re-cluster; accepted clusters preserved; cluster_proposed audit written per member |
| `enqueue-clustering.test.ts` | claim + release + reset semantics; only batch's creator can reset |
| `reaper-clustering.test.ts` | stuck batch (started_at past cutoff, completed_at null) → reset; non-stuck untouched; mock-mode []; supabase error throws |
| `google.test.ts` (extend) | generateText respects model='pro' constraint; region routing per call; ADC auth surfaces clear error; ADC missing in real-mode → typed error |
| `reaper.test.ts` (extend) | reapStuckClusteringJobs added without breaking existing tests |
| `batch-service.test.ts` (extend) | commitBatch success fires dispatchBatchClusteringForProcessing fire-and-forget; commit response returns immediately; dispatch error logged but doesn't fail commit |

### 11.2 Test infrastructure

- HDBSCAN library is dynamically imported only in real-mode; tests stub via `vi.mock('./hdbscan', ...)` returning canned cluster labels per fixture
- Mock supabase client provides `asset_embeddings`, `asset_proposal_clusters`, `asset_proposals`, `upload_batches`, `users` query stubs
- Vertex `generateText` stubbed via `vi.mock('@/lib/ai/google', ...)` returning canned cluster names per test case
- `scopeEnvVars` for `FFF_AI_REAL_PIPELINE` per-test toggle
- Fixture batch: ~20 assets across 3 clusters with known caption clusters embedded as deterministic 768-dim vectors (small handful of dimensions varied; rest zeroed) so HDBSCAN deterministically separates them in tests

### 11.3 Test count target

9-12 new test files; ~50-70 cases. Bounded.

### 11.4 Empirical-knob calibration script (NOT a test; engineer-run)

```bash
bun run scripts/manual-test-cluster-batch.ts <batch-id>
```

Prints:
- HDBSCAN cluster count
- Per-cluster size + silhouette
- Per-cluster proposed name + cache hit/miss
- Total cost (cents) for naming
- Total wall time

Run on representative fixture batches at implementation time; results inform the founder ratification of `min_cluster_size` and silhouette floor (per §7.3).

---

## 12. Verification gates

Before merge:

```bash
# 1. tsc clean
npx tsc --noEmit 2>&1 | grep -cE "error TS"
# Expected: 0 (post PR #16 baseline) + however many inherited from E2/E3/E4 if those introduced any

# 2. vitest green
bun run test 2>&1 | tail -10
# Expected: previous baseline + ~50-70 new cases all passing

# 3. Migrations apply cleanly
supabase db reset
supabase db push
psql "$DATABASE_URL" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='upload_batches' AND column_name LIKE 'clustering_%';
"
# Expected: 3 rows (clustering_started_at, clustering_completed_at, clustering_error)

psql "$DATABASE_URL" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_pipeline_settings' AND column_name LIKE 'cluster_%';
"
# Expected: 2 rows (cluster_min_size, cluster_min_samples)

# 4. ai_analysis CHECK constraint permits 'cluster' subject_type
psql "$DATABASE_URL" -c "
  INSERT INTO ai_analysis (subject_type, subject_id, model, model_version, region, input_hash, output)
  VALUES ('cluster', NULL, 'gemini-2.5-pro', 'gemini-2.5-pro', 'europe-west4', 'test_hash', '{}');
"
# Expected: success (1 row inserted; if CHECK rejects, the conditional migration was needed and is missing)

# 5. Build green
bun run build 2>&1 | tail -5
# Expected: build exits 0; no new client routes; HDBSCAN library NOT in client bundle

# 6. HDBSCAN library present in dependencies
cat package.json | grep -i hdbscan
# Expected: 1 line (the chosen library) OR vendored code under src/lib/ai-suggestions/hdbscan/

# 7. Empirical-knob calibration ran + values ratified
# (Manifest: PR description includes the calibration script output;
#  founder approves min_cluster_size + silhouette_floor at review)

# 8. Engineer-local smoke test
GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json \
GOOGLE_CLOUD_PROJECT_ID=frontfiles-prod \
FFF_AI_REAL_PIPELINE=true \
bun run scripts/manual-test-cluster-batch.ts <test-batch-id>
# Expected: prints cluster count + names + cost > 0; ai_analysis 'cluster' rows created;
# upload_batches.clustering_started_at + completed_at set; asset_proposal_clusters rows present;
# asset_proposals.cluster_id populated for members

# 9. Rollback works (both new migrations)
psql "$DATABASE_URL" -f supabase/migrations/_rollbacks/<TIMESTAMP>_clustering_in_flight_signal.DOWN.sql
psql "$DATABASE_URL" -c "\d upload_batches" | grep -c clustering
# Expected: 0
# Then re-apply forward

# 10. No regressions in E1-E4 work
bun run test src/lib/ai-suggestions/__tests__/ src/lib/processing/__tests__/ src/lib/upload/__tests__/ 2>&1 | tail -5
# Expected: all green
```

---

## 13. Approval gate

Founder reviews PR before merge. Specifically verify:

| Item | Approved means |
|---|---|
| E2 + E3 + E4 implementations are merged | E5 hard-prerequisites met |
| Migration filenames use ship-date timestamps | Not 2026-04-28 if ship is later |
| HDBSCAN library choice | Founder-ratified at review based on the §7.2 evaluation; pinned in `package.json` to a specific minor (no `^`) |
| `min_cluster_size` + silhouette floor | Founder-ratified based on §11.4 calibration script output |
| Trigger fires from `batch-service.ts` (NOT a Postgres trigger, NOT inline-await) | Per §6.5 design lock |
| Re-cluster behavior preserves accepted clusters | Per §6.3 |
| `gemini-2.5-pro` cost in `cost.ts` is non-null | Inherited from E3; double-check |
| AI-PIPELINE-BRIEF v2 §4.1 corrigendum prepared | Either inline in this PR or as a follow-on docs PR |
| `ai_analysis` CHECK constraint permits `'cluster'` | Conditional migration shipped if needed |
| All 10 verification gates green | Including the engineer-local smoke test |

Founder's options:
1. **Approve + merge** — only E6 (UI integration) remains in the AI architecture track
2. **Approve with corrections** — name the diff
3. **Revise** — substantive concern
4. **Reject** — would mean E1 v2 / E1.5 / E2 / E3 / E4 was wrong, not E5

---

## 14. Don't-do list

1. **Don't lock the HDBSCAN library in this directive.** The choice is implementation-time per §7.2 evaluation. The directive's contract is the selection criteria, not a specific package name.
2. **Don't ship `min_cluster_size` or silhouette floor without §11.4 calibration.** These values must be empirically validated against representative data before merge — per don't-do-#26 (the warning against composing clustering before real `asset_embeddings` data exists, mitigated here by gating the empirical knobs).
3. **Don't use a Postgres trigger to fire clustering.** Per §6.5: fire-and-forget from `batch-service.ts` is the locked pattern.
4. **Don't await clustering inside `commitBatch`.** Per §6.5: fire-and-forget. Awaiting blocks the commit response.
5. **Don't write to `vault_assets.tags` or `vault_assets.story_group_id` directly from clustering.** The cluster proposal is creator-reviewable. Acceptance copies the cluster into a Story group (E6); cluster's existence on `asset_proposal_clusters` is the proposal layer.
6. **Don't migrate to `multimodalembedding@001` here.** Per E1.5 §10.5: that's a v2 enrichment if quality demands it; surfaced as a follow-on directive, not E5 scope.
7. **Don't add per-creator-locale cluster naming.** Per E1.5 §13 item 6: v2 enrichment.
8. **Don't introduce a new worker process.** E5 reuses the existing `scripts/process-derivatives.ts` script; one process, three job types (derivatives + per-asset proposals + cluster proposals).
9. **Don't bypass the `ai_analysis` cache for cluster naming.** Per E1.5 §9.5: cache hits make re-cluster free.
10. **Don't bypass `users.ai_region` routing.** D8 binding. The `gemini-2.5-pro` call routes through the creator's region just like `gemini-2.5-flash`.
11. **Don't merge E5 before E2 + E3 + E4 ship.** E5 imports from E3's `google.ts` + cache + circuit-breaker + quota; E5 reuses E4's reaper pattern; E5 writes to E2's clusters table. Hard gate.
12. **Don't activate `FFF_AI_REAL_PIPELINE` in any deployed env.** Ships dormant. Production cutover is a separate flag flip after E6.
13. **Don't expand `google.ts.generateText` beyond `model: 'pro'` here.** CCP 7's broader scope (`'flash'` for query understanding etc.) is a future expansion with its own bump policy + regression sample. E5 stays narrow.
14. **Don't surface clusters with `silhouette_score < 0.30`.** Per E1.5 §5.1. Below-floor clusters are recorded in metadata but not inserted into `asset_proposal_clusters`.
15. **Don't auto-accept any cluster.** Per E1 v2 §4.6 + §7.1. Cluster acceptance is creator action via E6.
16. **Don't ship without the `clustering_lifecycle_consistent` CHECK constraint.** It prevents the broken state where `completed_at IS NOT NULL` but `started_at IS NULL`.
17. **Don't reset clustering claim from anywhere except the Re-analyze path.** Generic resets risk concurrent re-clustering races.

---

## 15. Out of scope (deferred to later directives)

| Concern | Lands in |
|---|---|
| UI: cluster banner in upload flow + vault | E6 |
| UI: cluster accept/dismiss/rename inline | E6 |
| UI: "Re-analyze this session" creator button | E6 |
| API routes for cluster accept/dismiss/rename | E6 |
| Story group creation on cluster accept (writes to `vault_assets.story_group_id` or equivalent) | E6 (and the underlying Story-group schema, which is its own pillar) |
| Per-creator-locale cluster naming | v2 enrichment per E1.5 §13 item 6 |
| `multimodalembedding@001` (1408-dim) migration if cluster quality is mediocre | v2 enrichment per E1.5 §10.5 (separate directive) |
| `cluster_shown` view-tracking event | v2 enrichment |
| In-process LRU cache for cluster naming | v2 enrichment (already covered by `ai_analysis` cache) |
| Creator-per-cluster opt-out / cluster suppression preferences | v2 enrichment / E6 |
| Cron scheduling of `scripts/process-derivatives.ts` in production | PR 5 / staging cutover |
| `generateText` for query understanding / brief generation | CCP 7 expansion |
| Vision-API OCR / safe-search / landmarks (separate from Gemini Vision) | CCP 9 / v2 enrichment |

---

## 16. References

- E1 v2: `src/lib/processing/AI-PIPELINE-BRIEF.md` (note: §4.1 corrigendum needed per §6.4)
- E1.5: `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` §9 (cluster naming) + §10 (embedding shape) + §5.1 (silhouette floor)
- E2: `src/lib/processing/E2-DIRECTIVE.md` (asset_proposal_clusters schema + asset_proposals.cluster_id)
- E3: `src/lib/processing/E3-DIRECTIVE.md` (google.ts + cache + circuit + quota + cost + models)
- E4: `src/lib/processing/E4-DIRECTIVE.md` (worker pattern + reaper + dispatch hook)
- INTEGRATION_READINESS.md v2 — D6/D7/D8/D9
- PLATFORM_REVIEWS.md v2 — D-U2 (clustering ships in v1 as HARD launch gate)
- Shipped infra: `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql` (asset_embeddings + ai_analysis + audit_log) + `20260419000001_phase1_upload_batches.sql` (upload_batches + state enum)
- Worker pattern precedent: `src/lib/processing/PR-4-PLAN.md` + `dispatcher.ts` + `reaper.ts`
- Commit hook precedent: `src/lib/upload/batch-service.ts` + `src/lib/upload/batch-store.ts`
- HDBSCAN reference (Python ground-truth for fixture-batch validation): https://hdbscan.readthedocs.io
- Vertex pricing source: cloud.google.com/vertex-ai/generative-ai/pricing (verify quarterly)
- Vertex models catalog: cloud.google.com/vertex-ai/generative-ai/docs/models
- Trust language: `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`

---

End of E5 directive.
