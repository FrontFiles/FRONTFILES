# Upload PR 3 — Pre-Composition Audit

**Date:** 2026-04-26
**Author:** B1 audit pass per UX-BRIEF.md v3 §6 + don't-do #10
**Scope:** Audit-first read of `commit-service.ts` + PR-1.1-PLAN.md + PR-1.2-PLAN.md + PR-2-PLAN.md to confirm what PR 3 (derivative row enqueue) needs to add vs. what's already wired.
**Output:** findings + IPs + scope estimate; resolves IP-1 + IP-2 with founder ratification (locked below).
**Reads underlying:** `src/lib/upload/commit-service.ts` (full body), `src/lib/upload/PR-1.1-PLAN.md`, `src/lib/upload/PR-1.2-PLAN.md`, `src/lib/processing/PR-2-PLAN.md`, `src/lib/processing/IMPLEMENTATION-PLAN.md` §PR 3, `src/lib/processing/ARCHITECTURE-BRIEF.md` §7

---

## 1. Findings

| Question | Answer |
|---|---|
| Does `commit-service.ts` enqueue derivative rows today? | **No.** Flow stops at `insertDraftAndOriginal` returning `kind: 'ok'` (line 211–214). Returns `{ ok: true, outcome: 'created', assetId }` — no call to any processing module, no derivative row insert. |
| Does `src/lib/processing/enqueue.ts` exist? | **No.** Confirmed via glob. PR 3 must create it. |
| What processing scaffolding already exists? | `dispatcher.ts`, `pipeline.ts`, `resize.ts`, `watermark-compositor.ts`, `profiles.ts`, `types.ts`, plus tests for pipeline/profiles/types. **No `worker.ts`, no `enqueue.ts`, no `backfill.ts`** — those are PR 3 / PR 4 / PR 6 respectively. |
| Is the `asset_media` UNIQUE `(asset_id, media_role)` already in place? | **Yes** for the UNIQUE constraint, **but see correction below.** Per `PR-2-PLAN.md` §10, the UNIQUE landed in `20260413230002_vault_asset_tables.sql` (PR 1 substrate). However, the same migration declares `storage_ref` and `content_type` as **NOT NULL** (lines 166-167), which is incompatible with the architecture brief's prescription that pending rows have `storage_ref=NULL`. PR 3 needs a small migration to relax these constraints (see correction note below this table). |
| Which `upload_commit` RPC overload is `commit-service.ts` currently calling? | **15-arg.** Per `PR-1.1-PLAN.md` §1: "PR 2's `upload-store.ts:165` continues to call the 15-arg `upload_commit` and is unaffected." |

## 2. Audit-revealed sequencing tension

PR 1.1 + PR 1.2 (shipped 2026-04-17) added significant infrastructure not reflected in the original `IMPLEMENTATION-PLAN.md`:

- `upload_batches` table + `batch_id` column on `vault_assets`
- `upload_batch_state` enum, `duplicate_status` enum
- 5 new `vault_assets` columns: `proposal_snapshot`, `extracted_metadata`, `metadata_source`, `duplicate_status`, `duplicate_of_id`
- 21-arg `upload_commit` RPC overload (15-arg preserved as separate overload)
- `/api/v2/batch` create + commit routes (dormant behind same `FFF_REAL_UPLOAD` flag)

**A planned PR 1.3** (per `PR-1.2-PLAN.md` §1 and §8 "Gate for PR 1.3 is green") is queued but not shipped. Its scope: "make legacy `/api/upload` batch-aware, wire 21-arg RPC, drop 15-arg overload." No `PR-1.3-PLAN.md` exists yet.

PR 1.3 must land before PR 3 (per IP-1 below) to avoid double-write of derivative enqueue logic.

---

## 3. Interface points — RESOLVED

All five IPs resolved. PR-3-PLAN.md composition is unblocked once PR 1.3 ships.

| IP | Resolution | Status |
|---|---|---|
| **IP-1: PR 1.3 vs PR 3 sequencing** | **PR 1.3 first, then PR 3.** Avoids double-write. PR 1.3 is the bigger refactor (~10–15 files); PR 3 is small (~4 files) and slots cleanly into the post-1.3 batch-aware commit path. | LOCKED 2026-04-26 |
| **IP-2: `detail_preview` merge timing** | **Merged with `watermarked_preview` — enqueue 3 roles** (`thumbnail` + `watermarked_preview` + `og_image`). Defer the lightbox-distinct-derivative split until the lightbox surface needs distinct dimensions/quality. Resolves `ARCHITECTURE-BRIEF.md` §7 open decision #4 in favor of merge. | LOCKED 2026-04-26 |
| **IP-3: Where derivative enqueue plugs into commit path** | **Option (a) — separate insert call AFTER `insertDraftAndOriginal` returns `ok`.** Matches `IMPLEMENTATION-PLAN.md` §PR 3 text. Non-atomic with original commit; backfill (PR 6) is the safety net for the rare gap. Avoids scope-creep into another RPC migration. | LOCKED (audit recommendation) |
| **IP-4: Batch awareness in derivative enqueue** | **No `batch_id` on `asset_media` rows.** Derivative processing is per-asset, not per-batch. The original commit's `batch_id` is recorded on `vault_assets`; derivative rows reference `asset_id` and inherit batch context transitively. Adding `batch_id` to `asset_media` would be over-engineering. | LOCKED (audit recommendation) |
| **IP-5: PR 3 test scope** | **Narrow.** Assert: enqueue inserts exactly the expected 3 rows with correct shape; replay of the same commit does not duplicate (UNIQUE constraint enforces); commit failure path does not enqueue; commit success enqueues. Worker integration tests are PR 4's concern. | LOCKED (audit recommendation) |

---

## 4. Scope estimate for PR-3-PLAN.md (after PR 1.3 ships)

**Files to add (2):**
- `src/lib/processing/enqueue.ts` — `enqueueDerivativeRows(assetId)` function + role list constant. Inserts 3 rows: `thumbnail`, `watermarked_preview`, `og_image` with `generation_status='pending'`, `storage_ref=NULL`, `watermark_profile_version=NULL`. ~80 lines.
- `src/lib/processing/__tests__/enqueue.test.ts` — happy path; replay safety; partial-failure handling. ~150 lines.

**Files to touch (2):**
- `src/lib/upload/commit-service.ts` — call `enqueueDerivativeRows(assetId)` after successful `insertDraftAndOriginal`. **Decision per IP-3:** if enqueue throws, log structured error and still return `{ ok: true, outcome: 'created', assetId }` — the original commit is canonical; backfill picks up the gap. ~10 lines added.
- `src/lib/upload/__tests__/commit-service.test.ts` — add tests for enqueue-on-success + enqueue-failure-does-not-roll-back-the-asset-commit. ~60 lines added.

**Files NOT touched:** worker, dispatcher, pipeline, delivery route, simulation path, UI, batch routes.

**One small migration needed** (audit correction, 2026-04-26 during PR-3-PLAN composition) — relax NOT NULL on `asset_media.storage_ref` and `content_type`; add CHECK that ready rows still have both populated. ~30 lines including rollback.

**Total:** ~4 files, ~300 lines including tests. Small directive once PR 1.3 has settled the commit-service shape.

---

## 5. Phase B sequencing — REVISED

The original Phase B sequencing in `UX-BRIEF.md` v3 §6 said:
- B1 — Resume PR 3
- B2 — Resume PR 4

The audit reveals this was incomplete. The actual sequencing is:

```
B1 — PR 1.3   Legacy /api/upload becomes batch-aware
              (21-arg RPC migration, drop 15-arg overload, wire batch_id through commit)
              ~10-15 files. Compose PR-1.3-PLAN.md first.

B2 — PR 3     Derivative row enqueue on commit (this audit's target)
              ~4 files, ~300 lines. Compose PR-3-PLAN.md after B1 ships.

B3 — PR 4     Worker activation + reaper
              ~6-8 files. Compose PR-4-PLAN.md after B2 ships.
```

Phase B is now 3 directives, not 2. The PR 1.3 directive was implicit in the IMPLEMENTATION-PLAN.md but missed by the original audit.

---

## 6. Recommended next action

**Compose `PR-1.3-PLAN.md`** as the next directive. The plan should:

1. Audit-first read of `src/lib/upload/upload-store.ts` (the 15-arg RPC caller), `/api/upload/route.ts`, and the 21-arg RPC body in the migration file
2. Define the migration shape: drop the 15-arg overload, ensure all callers route through 21-arg
3. Specify the `commit-service.ts` changes to thread `batch_id` + the 6 new columns (`proposal_snapshot`, `extracted_metadata`, `metadata_source`, `duplicate_status`, `duplicate_of_id`) through to the RPC
4. Specify `/api/upload/route.ts` changes to accept and validate `batch_id` (and the new metadata fields if applicable in the upload payload)
5. Specify test additions: regression on existing PR 2 idempotency contract; new tests for batch-aware commit
6. Surface IPs as HALT before founder ratification

PR-1.3-PLAN.md is itself an audit-first composition pass. When it lands and PR 1.3 ships, this audit document remains valid for PR-3-PLAN.md composition.

---

End of PR 3 pre-composition audit.
