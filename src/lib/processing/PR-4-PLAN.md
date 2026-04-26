# PR 4 — Implementation Plan

**Status:** DRAFT — awaiting founder ratification, **specifically on IP-1 (architecture choice)** before any implementation directive composes
**Date:** 2026-04-26
**Predecessor:** PR 3 shipped (commit-service enqueues 3 pending derivative rows on commit)
**Governing documents:** `src/lib/processing/ARCHITECTURE-BRIEF.md`, `src/lib/processing/IMPLEMENTATION-PLAN.md` §PR 4
**Audit basis:** Direct read of `dispatcher.ts`, `pipeline.ts`, `resize.ts`, `types.ts`, `profiles.ts`, `watermark-compositor.ts` — performed during this composition pass

**Objective:** **Activate and harden derivative processing orchestration against the canonical `asset_media` queue contract.** PR 4 is NOT about inventing resize/watermark logic — that exists. PR 4 is about orchestration, integration, recovery, and policy correctness: wiring the existing per-row processor into a production-safe execution loop, fixing the missing-profile policy bug, bridging the two storage adapter shapes, implementing the persistence adapter, and adding crash recovery. The transformation primitives (resize, watermark composite, profile loader) are reused unchanged.

**Scope:** Activate the dormant processing pipeline so pending `asset_media` rows get processed into ready derivatives. Worker / dispatcher selection + status transitions + reaper + per-role profile gating. Dormant behind `FFF_REAL_UPLOAD=false` (script not scheduled until PR 5 staging cutover).

---

## 1. Audit findings (before scope)

The processing module is significantly more built than the IMPLEMENTATION-PLAN.md suggested. Key existing pieces:

| File | What's there | Status |
|---|---|---|
| `pipeline.ts` | `processDerivative(job, storage, mediaRows, allowDraft)` — full per-row lifecycle (mark processing → read original → resize → watermark → write → update ready/failed) | Built; tests pass |
| `dispatcher.ts` | `dispatchDerivativeProcessing` (single asset), `dispatchBatch`, `dispatchBackfill` — fire-and-forget `Promise.all` per asset | Built; not invoked anywhere yet |
| `types.ts` | `IMAGE_DERIVATIVE_SPECS` constant (same 3 roles PR 3 enqueues), `WatermarkIntrusionLevel`, `ProcessingJob`, `ProcessingResult`, helper functions | Built; tests pass |
| `resize.ts`, `watermark-compositor.ts`, `profiles.ts` | Pure transformation logic + profile loader | Built; tests pass |

**The major architectural finding:** the existing pipeline + dispatcher implement a **push-based** model. The original IMPLEMENTATION-PLAN.md §PR 4 prescribes a **pull-based** worker (FOR UPDATE SKIP LOCKED). These are different architectures; the plan vs code drift is real.

**Behavioral findings:**

- **Pending-row creation overlap.** `dispatcher.ts:82` calls `mediaRows.updateMediaRow(..., { status: 'pending' })` for each derivative — same intent as PR 3's `enqueueDerivativeRows`. If both run, the dispatcher's call is redundant (and may fail if asset_media's UPDATE behavior differs from INSERT). PR 4 must reconcile.
- **Profile-gating mismatch.** `pipeline.ts:111-113` throws `Error('No watermark profile found...')` when no approved profile exists, then catches at line 164 and marks `failed`. The plan prescribes **stay-pending** for missing profiles (so approval flips them live without manual reset). Current code violates this.
- **`StorageAdapter` interface mismatch.** `pipeline.ts:36-41` defines its own `StorageAdapter` (`readOriginal`, `writeDerivative`) — different from `src/lib/storage/types.ts` (`putOriginal`, `putDerivative`, `getBytes`, `exists`, `delete`). PR 4 needs a bridge.
- **`MediaRowAdapter` has no real implementation.** Interface is defined; no Supabase-backed implementation; no mock implementation visible in the audit.
- **No reaper.** Stuck-processing rows have nothing to recover them. Both Path A and Path B need this.

---

## 2. The architectural decision (IP-1) — load-bearing

**This decision must be made before any further plan or code composes.**

### Path A — Pull-based worker (per IMPLEMENTATION-PLAN.md §PR 4)

Build a new `worker.ts` that polls `asset_media` for `generation_status = 'pending'` rows, claims them via `FOR UPDATE SKIP LOCKED` + atomic CAS to `'processing'`, runs `processDerivative` per row, transitions to `'ready'` / `'failed'`. Run via `scripts/process-derivatives.ts` (CLI / cron / long-lived process).

**Pros:**
- Matches the original IMPLEMENTATION-PLAN.md prescription
- Scales horizontally — N worker processes can claim disjoint rows
- Worker process can run separately from the Next.js server
- Picks up any pending row regardless of how it was created (PR 3's enqueue or backfill or other)
- More robust to crashes (reaper resets stuck rows for re-claim)

**Cons:**
- Existing `dispatcher.ts` becomes mostly dead code (`processDerivative` is reused; the dispatcher orchestration layer is replaced)
- Bigger PR scope (~10-12 files)
- Adds operational concern (worker process lifecycle, scheduling)
- Requires CAS logic in code path (selecting + transitioning pending → processing atomically)

### Path B — Push-based dispatcher (existing code, activate)

Wire `commit-service.ts` to invoke `dispatchDerivativeProcessing` after enqueue. The existing fire-and-forget `Promise.all` does the work synchronously-async in the same Node process. Add a reaper that runs on a separate cadence to recover stuck-processing rows from crashes.

**Pros:**
- Reuses existing dispatcher + pipeline code
- Smaller PR scope (~6-8 files)
- Simpler operational model (no separate worker process)
- Lower implementation risk

**Cons (sharpened per reviewer feedback 2026-04-26):**
- **Couples dispatch durability to the request/commit host lifecycle.** If the Node process serving the commit dies before `Promise.all` completes, the in-flight processing dies with it. There is no separate process holding the work.
- **Crash recovery becomes a second mechanism rather than being inherent in queue claiming.** Path A's claim-then-process pattern means a crashed worker leaves a row in `processing` that the next worker can detect and re-claim via the same FOR UPDATE SKIP LOCKED path. Path B has no claim step; the reaper is a separate fallback layer that exists specifically to clean up after crashes. Two mechanisms instead of one unified one.
- **Retry semantics need extra care because work issuance and work claiming are not unified.** When the dispatcher fires `Promise.all`, it doesn't write any "I claimed this row" marker — it just calls `processDerivative` which immediately UPDATEs to `processing`. If two dispatches race for the same asset (e.g., commit retry + reaper sweep), both try to process. UNIQUE on (asset_id, media_role) protects the final write but doesn't prevent wasted CPU. Path A's CAS prevents that race upfront.
- **Single Next.js server constraint** — can't scale horizontally without refactor (subset of the durability point above).
- **Dispatcher creates pending rows itself** (`dispatcher.ts:82`); overlaps with PR 3's enqueue. Need to refactor dispatcher to skip the pending-row creation and just process existing rows.
- **Doesn't pick up arbitrary pending rows** (e.g., from backfill) — only those it dispatched itself, unless we also add a sweeper that runs on a cadence.

### Recommendation (architectural)

**My recommendation: Path B for v1, with Path A as a v2 evolution.**

Reasoning:
- The existing dispatcher is good code that's well-tested. Throwing it out for a from-scratch worker is wasteful when Path B activates the existing investment.
- FF's current volume per UX-BRIEF v3 doesn't require horizontal scaling. Bimodal session sizes (1–5 + 20+) fit comfortably in a single Node process.
- Reaper is needed either way (for crash recovery in Path B; for stuck-claim recovery in Path A).
- Path A can be added later without throwing out Path B work — `processDerivative` is reused either way; the only difference is the orchestration layer above it.
- Smaller PR ships sooner; PR 5 cutover unblocked sooner.

**However — this is your architectural call.** CLAUDE.md item 10 ("Favor architecture before implementation") makes this exactly the kind of decision that needs explicit founder ratification, not a default I bake in. Confirm Path A or Path B before this plan continues to §3+.

If Path A: the plan below changes substantially in §4 (worker module replaces dispatcher activation), §6 (CAS-driven selection), §7 (script runs as long-lived process or cron). I'll revise.

If Path B: the plan below stands as-written.

---

## 3. Scope boundary (assumes Path B; revise if Path A)

PR 4 **does**:
- Add `src/lib/processing/storage-bridge.ts` — adapt `src/lib/storage` adapter to `pipeline.ts`'s `StorageAdapter` interface
- Add `src/lib/processing/media-row-adapter.ts` — implement `MediaRowAdapter` with Supabase + mock dual-mode
- Add `src/lib/processing/reaper.ts` — sweep stuck-processing rows back to pending
- Add `scripts/process-derivatives.ts` — CLI entry that runs the reaper then dispatches any leftover pending rows (catches gaps from crashed dispatches)
- Touch `src/lib/processing/dispatcher.ts` — remove the pending-row creation step (PR 3's enqueue.ts handles that); keep the Promise.all processing
- Touch `src/lib/processing/pipeline.ts` — distinguish "missing profile (stay pending)" from "actual error (mark failed)" per the plan's per-role gating
- Touch `src/lib/upload/commit-service.ts` — fire-and-forget `dispatchDerivativeProcessing` after enqueue (NOT awaited; logs structured error if dispatch throws synchronously)
- Add tests for storage-bridge, media-row-adapter, reaper, and the dispatch hook

PR 4 **does not**:
- Activate the script in cron / production (PR 5)
- Flip `FFF_REAL_UPLOAD` (PR 5)
- Touch the route handler
- Touch storage adapter source signatures
- Touch the delivery resolver
- Add new derivative roles (audit IP-2 from PR 3 holds: 3 roles, no `detail_preview`)
- Migrate the schema (no new columns; CHECK constraint from PR 3 already in place)

---

## 4. Files to add / touch / not touched (Path B)

### 4.1 Add (5)

| Path | Purpose | Lines (est.) |
|---|---|---|
| `supabase/migrations/<next-ts>_asset_media_processing_started_at.sql` | Add `processing_started_at timestamptz` column (default NULL). Required by the reaper's stuck-row query. Reversible rollback. **Per IP-3 resolution above** — column was missing from current schema. | ~25 |
| `src/lib/processing/storage-bridge.ts` | Adapter from `src/lib/storage` (low-level: putOriginal/putDerivative/getBytes/exists/delete) to `pipeline.ts`'s `StorageAdapter` (high-level: readOriginal/writeDerivative). Resolves the storage_ref via `asset_media` lookup for `readOriginal`. | ~60 |
| `src/lib/processing/media-row-adapter.ts` | Real Supabase implementation of `MediaRowAdapter.updateMediaRow` (UPDATE asset_media SET status, storage_ref, ...) + mock implementation for tests + `__testing` surface. Stamps `processing_started_at = now()` on pending→processing; clears on processing→ready/failed/pending. | ~140 |
| `src/lib/processing/reaper.ts` | `reapStuckProcessingRows(timeoutSeconds)` — UPDATE asset_media SET status='pending', processing_started_at=NULL WHERE status='processing' AND processing_started_at < now() - interval. One structured log line per reset. | ~80 |
| `scripts/process-derivatives.ts` | CLI entry. Runs reaper, then queries pending rows for any asset, dispatches batch. Used by ops / cron. | ~60 |

### 4.2 Touch (3)

| Path | Change |
|---|---|
| `src/lib/processing/dispatcher.ts` | Remove the `mediaRows.updateMediaRow({ status: 'pending' })` loop at lines 81-83 — PR 3's `enqueueDerivativeRows` handles pending-row creation now. The dispatcher's job becomes purely "process existing pending rows for this asset." Same applies to `dispatchBackfill` lines 158-160. |
| `src/lib/processing/pipeline.ts` | Refactor the catch block at line 164 to distinguish two failure classes: (a) "missing approved profile" → set status back to `'pending'` so future approval re-enables; (b) "actual processing error" → set status to `'failed'`. This requires the `getApprovedProfile` call at line 109 to return a typed reason instead of throwing. |
| `src/lib/upload/commit-service.ts` | After PR 3's enqueue hook, fire `dispatchDerivativeProcessing` (fire-and-forget). Read `intrusion_level` + creator name from the request or look them up. **IP-2** below handles the data-source decision. |

### 4.3 Not touched

- `src/lib/processing/{resize,watermark-compositor,profiles,types}.ts` — pure logic; no changes needed
- `src/lib/processing/enqueue.ts` (PR 3) — owned by PR 3; reused as-is
- `src/lib/storage/**` — no signature changes
- `src/app/api/upload/route.ts` — no changes
- `src/lib/upload/upload-store.ts`, `commit-service.ts` (already touched once for dispatch hook only)
- All migrations — no schema changes
- The `asset_media.processing_started_at` column — **wait, this needs verification.** PR 4's reaper requires this column. If it doesn't exist, PR 4 needs a small migration to add it.

**Audit gap (caught here):** `processing_started_at` column on `asset_media` may not exist. The IMPLEMENTATION-PLAN.md §PR 4 step 1 says "Stamp `processing_started_at = now()` on the same UPDATE [transitioning pending→processing]." But I don't see this column in the migration I read for PR 3 (`20260413230002_vault_asset_tables.sql:162-198`). Need to verify before composition; if missing, PR 4 needs a migration.

---

## 5. Failure-mode handling (per-role profile gating)

Per IMPLEMENTATION-PLAN.md §PR 4 step 3 — distinguish:

| Failure class | Current behavior | Plan-prescribed behavior |
|---|---|---|
| `thumbnail` — no profile needed | (n/a — thumbnail is unwatermarked) | Same — completes without checking profile |
| `watermarked_preview` / `og_image` — missing approved profile | Throws → marked `'failed'` | **Stay `'pending'`**; logged once. Re-eligible the moment a profile is approved. |
| `watermarked_preview` / `og_image` — actual processing error (sharp throws, storage write fails, etc.) | Marked `'failed'` | Same — `'failed'` with the error message |
| Original missing for asset | Throws → marked `'failed'` | Marked `'failed'` (asset can't be processed without source) |

**Refactor approach:** instead of `getApprovedProfile` returning `null` and the calling code throwing, have it return a typed result:
- `{ kind: 'ok'; profile: WatermarkProfile }`
- `{ kind: 'no_approved_profile'; level, family }` — caller maps to stay-pending
- `{ kind: 'lookup_failed'; error }` — caller maps to `failed`

Then `processDerivative` switches on the kind. Stay-pending is the only place we `UPDATE` back to pending instead of moving forward.

---

## 6. Reaper

`reapStuckProcessingRows(timeoutSeconds = 600)`:

```sql
UPDATE asset_media
SET generation_status = 'pending',
    processing_started_at = NULL
WHERE generation_status = 'processing'
  AND processing_started_at < now() - interval '<timeoutSeconds> seconds'
RETURNING asset_id, media_role, processing_started_at;
```

For each returned row, log:

```json
{
  "code": "stuck_processing_reset",
  "asset_id": "...",
  "media_role": "...",
  "stuck_duration_seconds": <int>
}
```

Configurable via `FFF_PROCESSING_TIMEOUT_SECONDS` (default 600). Runs at the start of every `process-derivatives.ts` invocation, before any new dispatch.

In Path B, the script invokes the reaper + then sweeps unhandled pending rows. Reaper handles the rare "Node crashed mid-processing" case.

---

## 7. Storage bridge

The pipeline's `StorageAdapter` interface (`readOriginal(assetId)` / `writeDerivative(assetId, role, buffer, contentType)`) doesn't match `src/lib/storage`'s adapter (`putOriginal({assetId, filename, bytes, contentType})` / `putDerivative({assetId, role, bytes, contentType})` / `getBytes(storageRef)`).

`storage-bridge.ts` translates:

```typescript
export function makePipelineStorageAdapter(
  storage: StorageAdapter,           // from src/lib/storage
  mediaRowLookup: MediaRowAdapter,   // for resolving original storage_ref
): PipelineStorageAdapter {           // pipeline's StorageAdapter shape
  return {
    async readOriginal(assetId) {
      // 1. Look up the 'original' asset_media row → storage_ref
      // 2. Call storage.getBytes(storage_ref)
    },
    async writeDerivative(assetId, role, buffer, contentType) {
      const ref = await storage.putDerivative({ assetId, role, bytes: buffer, contentType })
      return ref
    },
  }
}
```

This keeps the pipeline interface stable while routing through the production storage adapter.

---

## 8. Tests

Per the per-PR plan estimate, the new test surface is substantial:

| Test file | Purpose | Tests (est.) |
|---|---|---|
| `src/lib/processing/__tests__/storage-bridge.test.ts` | Bridge correctness; readOriginal looks up storage_ref then calls getBytes; writeDerivative passes through | 4 |
| `src/lib/processing/__tests__/media-row-adapter.test.ts` | Mock + real (against test DB) implementations of updateMediaRow; status transitions; storage_ref / dimensions / size persist | 6 |
| `src/lib/processing/__tests__/reaper.test.ts` | Stuck row gets reset; non-stuck row left alone; structured log per reset; configurable timeout | 4 |
| `src/lib/processing/__tests__/pipeline.test.ts` (extend) | Per-role profile gating: thumbnail completes without profile, watermarked_preview stays pending if no profile, og_image fails on actual error | 3 (new) |
| `src/lib/upload/__tests__/commit-service.test.ts` (extend) | Dispatch hook fires after enqueue; failure logs but doesn't roll back commit | 2 (new) |

Plus: a small CLI integration test for `scripts/process-derivatives.ts` (probably end-to-end against fs adapter + mock store).

Total: ~20 new tests. Comparable to PR 1.3.

---

## 9. Open IPs (load-bearing — IP-1 must resolve before composition continues)

### IP-1 — Push-based (Path B) vs pull-based (Path A) — **REQUIRES FOUNDER RATIFICATION**

See §2 above. Recommendation: Path B for v1; Path A as v2 evolution. This plan's §3-§8 assumes Path B; rewriting for Path A is non-trivial.

### IP-2 — Source of `intrusion_level` + creator name in commit-service dispatch

The dispatcher needs `intrusionLevel` + `creatorName` per asset. Two options:

- (a) Pass them via the `CommitUploadRequest` (extend the route to accept them). Cost: route surface grows; requires client to know creator's display_name (it does anyway).
- (b) Look them up server-side after the commit (one SELECT against vault_assets + users join). Cost: extra DB round-trip on every commit.

**Recommendation: (b).** The commit path already touches the DB (insertDraftAndOriginal); one more SELECT is negligible. Keeps the route surface clean. The lookup is idempotent and cacheable.

### IP-3 — Schema: does `asset_media.processing_started_at` already exist?

**RESOLVED 2026-04-26: column does NOT exist.** Verified by grep against `supabase/migrations/`. The `processing_started_at` token appears only in `IMPLEMENTATION-PLAN.md` and this plan; no migration creates the column. Cumulative ALTER history on `asset_media` (initial create + watermark_profile_version + original_sha256 + RLS + PR 3's nullable + CHECK) — no `processing_started_at` anywhere.

**Resolution:** PR 4 adds one small migration: `ALTER TABLE asset_media ADD COLUMN processing_started_at timestamptz`. Default NULL. Not indexed (reaper query is rare and uses `generation_status='processing'` as primary filter; the timestamp is a secondary check on a small filtered set).

The MediaRowAdapter's update logic stamps `processing_started_at = now()` when transitioning `pending → processing`; clears it (sets to NULL) when transitioning back to `pending` (reaper) or forward to `ready` / `failed`.

**Net scope impact:** +1 migration file, +~25 lines (ALTER + comment + rollback block). Total file count §4.1 grows from 4 to 5.

### IP-4 — Dispatcher hook in commit-service: synchronous-async vs deferred

Two ways to fire dispatch from commit-service:

- (a) `void dispatchDerivativeProcessing(...)` — fire-and-forget; don't await. Errors logged via `.catch()` already in the existing dispatcher.
- (b) `setImmediate(() => dispatchDerivativeProcessing(...))` — defer to next tick so commit returns even faster.

Recommendation: (a). Negligible difference; (a) is simpler.

### IP-5 — Where does the `MediaRowAdapter` mock live?

The mock implementation is needed for tests. Two locations:

- (a) Inside `media-row-adapter.ts` behind `__testing` (matches dispatch + upload-store pattern)
- (b) In a separate `__tests__/helpers.ts` file

Recommendation: (a). Consistency with the codebase's existing dual-mode pattern.

### IP-6 — `scripts/process-derivatives.ts` shape

Two patterns:

- (a) Run-once script (CLI invocation; reaper + dispatch leftover pendings + exit). Cron schedules invocations.
- (b) Long-lived process (poll loop with sleep).

Recommendation: (a). Simpler. Cron / Vercel Scheduled Functions / Supabase pg_cron handles scheduling. (b) introduces process supervision concerns.

### IP-7 — Profile-version stamping on watermarked rows

Per the brief, watermarked derivatives stamp `watermark_profile_version` at write time. The current pipeline does this at line 150. Verify the Supabase MediaRowAdapter writes this field correctly.

This is more an implementation note than an IP — the pipeline already produces the value; the adapter just needs to persist it. Flagging for completeness.

---

## 10. What this PR does NOT introduce

- No flag flip (still `FFF_REAL_UPLOAD=false` by default)
- No production worker scheduling (script must be invoked manually or via PR 5+ cron setup)
- No new derivative roles
- No changes to the pipeline's transformation logic (resize, watermark composition stay byte-equivalent)
- No replacement of the existing `processDerivative` function — it's reused
- No removal of the dispatcher's `dispatchBackfill` function — kept for PR 6 backfill use
- No CHECK constraint changes beyond PR 3's
- No new env vars except `FFF_PROCESSING_TIMEOUT_SECONDS` (default 600)

---

## 11. Approval gate (TWO STAGES)

**Stage 1 — IP-1 ratification.** Founder confirms Path A or Path B. If Path B, this plan stands. If Path A, plan is rewritten substantially in §3-§8.

**Stage 2 — Plan ratification.** After IP-1, founder reviews the resulting plan (this doc revised if Path A) and ratifies the remaining IPs (2-7) and the scope/files.

After both stages: PR 4 composes as a single-pass implementation directive. Estimated 10-12 files touched, ~600-800 lines including tests, possibly 1 migration if IP-3 finds `processing_started_at` missing.

After PR 4 ships: PR 5 (cutover) is unblocked from the backend side. Phase D D1 (PR 5) still requires Phase C (UI), Phase E (AI pipeline), Phase F (price engine v1) per `UX-BRIEF.md` v3 §6.

---

## 12. References

- Architecture brief: `src/lib/processing/ARCHITECTURE-BRIEF.md`
- Implementation plan: `src/lib/processing/IMPLEMENTATION-PLAN.md` §PR 4
- Per-PR predecessors: `src/lib/upload/PR-1.1-PLAN.md`, `src/lib/upload/PR-1.2-PLAN.md`, `src/lib/processing/PR-2-PLAN.md`, `src/lib/upload/PR-1.3-PLAN.md`, `src/lib/processing/PR-3-PLAN.md`
- Audit basis (this composition): `src/lib/processing/{dispatcher,pipeline,types,resize,profiles,watermark-compositor}.ts`
- UX brief (governs upload rebuild): `docs/upload/UX-BRIEF.md` v3
- BP/Watermark audit (related concerns): `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md`

---

End of PR 4 implementation plan.
