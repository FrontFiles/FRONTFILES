# Image Asset Lifecycle — Implementation Plan

**Status**: DRAFT — planning only, no code in this pass
**Date**: 2026-04-16
**Governing document**: [ARCHITECTURE-BRIEF.md](./ARCHITECTURE-BRIEF.md)
**Scope**: image assets only (photo, illustration, infographic, vector)

---

## Objective

Close the runtime gap between the already-hardened delivery path and the still-simulated ingest path, so that an uploaded image flows end-to-end: client commit → server persistence of the canonical original → pending derivative rows → async derivative generation via the approved watermark pipeline → delivery from real, DB-authoritative rows. The work lands as a sequence of narrow, dormant-first PRs so the simulation keeps working until an explicit, flag-gated cutover flips the runtime to real assets, with the same pipeline covering new uploads, regeneration, and the eventual beta import.

---

## Invariants (non-negotiable)

1. **Original is the canonical source file.** Every derivative is derived from it; the browser never sees it without an explicit `?delivery=original` path + entitlement.
2. **Original is persisted before any derivative work begins.** Derivative jobs read from storage, not from the upload stream. Step 3 (original persisted) strictly precedes Step 6 (derivative rows created) in brief §2.
3. **The DB is authoritative; storage paths are opaque.** `media_role`, `generation_status`, `storage_ref`, and `content_type` are stored columns on `asset_media`. Nothing is inferred from filename, extension, or path convention at delivery time.
4. **Previews never fall back to the original.** Missing, pending, or failed derivative → 404. No silent substitution. No "just serve the original for now." This is the core leak-prevention guarantee and must survive every PR.
5. **Watermark profiles remain founder-governed.** The pipeline refuses to generate any watermarked derivative unless an approved profile exists for the required (intrusion_level, format_family) pair. Approval happens in the DB, not in code.
6. **Beta import uses the same derivative / backfill pipeline.** No import-only code path. Imported originals land as `asset_media role=original status=ready`; derivatives are produced by the same worker and the same backfill query that covers new uploads.
7. **`storage_ref` is never exposed to the browser.** All client URLs are `/api/media/{id}?ctx=...` shapes resolved server-side.
8. **Pipeline jobs are idempotent.** Same (asset_id, media_role, profile_version) → same output. UNIQUE `(asset_id, media_role)` is the guardrail.

---

## PR Sequence

Each PR is intentionally narrow. Dormant PRs (1–4, 6) land without changing user-visible behavior. Runtime-changing PRs (5, 7, 8) are gated and ordered last.

### PR 1 — Storage adapter + bucket configuration (dormant)

- **Goal**: Introduce the storage substrate all later PRs depend on, with zero runtime callers.
- **Touches**: new `frontfiles/src/lib/storage/` (adapter interface + filesystem impl for dev + Supabase-Storage impl for prod), env wiring.
- **Behavior added**: `StorageAdapter` with `putOriginal`, `putDerivative`, `getBytes(storage_ref)`, `exists(storage_ref)`. Deterministic path helpers matching brief §4.1. Selection driven by env (`FFF_STORAGE_DRIVER=fs|supabase`).
- **Untouched**: upload flow, delivery route (`src/app/api/media/[id]/route.ts`), mock `src/lib/media/asset-media-repo.ts`, all UI.
- **Risks**: Supabase bucket misconfiguration — surfaces only when a later PR wires it. Path-helper drift vs brief §4.1 — pin with a unit test that asserts path strings against the brief's table.
- **Validation**: unit tests round-tripping bytes through each adapter against a temp dir / test bucket; path-format test; rejection test for absolute / traversal refs.
- **Rollback**: delete the directory. Nothing else imports it yet.
- **Exit criteria (all required before merge)**:
  1. `StorageAdapter` interface exported; no import edge from `src/app/**`, `src/lib/upload/**`, `src/lib/media/**`, or `src/lib/processing/**` (verified by a grep check in CI or pre-merge).
  2. Filesystem adapter round-trips `putOriginal` / `putDerivative` / `getBytes` / `exists` in a temp directory test.
  3. Path helpers produce strings matching every row of brief §4.1; asserted by a table-driven unit test.
  4. Traversal / absolute / empty `storage_ref` inputs are rejected with a typed error in both adapters.
  5. Driver selection via `FFF_STORAGE_DRIVER` documented in env reference; default is `fs`. Unset → `fs`, not a throw.
  6. Prod driver (Supabase) may land as a structural implementation but is **not** required to be configured against a live bucket in this PR — bucket choice (Open Decision §5) can remain pending without blocking merge, provided the fs driver is the active default and the Supabase driver is behind the env switch.
  7. `npm run build` and type-check green; no new runtime dependency added to `package.json` beyond what the Supabase adapter itself requires.
- **Merge notes (landed 2026-04-16)**:
  - Module `src/lib/storage/` is **type-clean** under `tsc --noEmit` (0 errors from PR 1 files).
  - Storage tests are **green**: 44/44 passing in `vitest run src/lib/storage` (`paths.test.ts`, `fs-adapter.test.ts`, `index.test.ts`).
  - Repo-wide `tsc --noEmit` retains **15 pre-existing errors in unrelated files** (`src/components/discovery/AssistantInput.tsx`, `src/components/upload-v2/CommitScreen.tsx`, `src/components/upload-v2/StoryGroupsPanel.tsx`, `src/lib/bolt/cross-ref.ts`, `src/lib/processing/dispatcher.ts`, `src/lib/upload/v2-state.ts`). These are inherited state, not introduced by PR 1, and are out of PR 1 scope.
  - Interface decision held as landed: `putOriginal(input: PutOriginalInput)` / `putDerivative(input: PutDerivativeInput)` use object args; `getBytes(storageRef)` / `exists(storageRef)` take positional string. Not to be converted to positional args in later PRs without an explicit interface-revision decision.
  - No new runtime dependencies added; Supabase adapter reuses `@supabase/supabase-js` already on `package.json`.

### PR 2 — Upload API route + original persistence (dormant; feature-flagged)

- **Goal**: Stand up the real ingest endpoint behind `FFF_REAL_UPLOAD=false`. Simulation stays authoritative for all users until PR 5.
- **Touches**: new `frontfiles/src/app/api/upload/route.ts`, new `frontfiles/src/lib/upload/commit-service.ts`, re-use of server-side MIME/magic-byte validation derived from `frontfiles/src/lib/upload/validation.ts`.
- **Behavior added**:
  1. Server re-validates MIME + size + magic bytes.
  2. Inserts a draft `vault_assets` row (minimal fields, privacy=private, publication=draft, declaration=pending) to obtain `asset_id` — required because `asset_media.asset_id` FKs `vault_assets.id` (see brief §2 ordering invariants).
  3. `StorageAdapter.putOriginal(asset_id, filename, bytes)`.
  4. Inserts `asset_media` row: `role='original', generation_status='ready', storage_ref, content_type, file_size_bytes, width, height`.
  5. Returns `{ asset_id }`.
- **Untouched**: `v2-state.ts` `ADD_FILES`/`COMPLETE_COMMIT` remain mock by default. Delivery route. Processing pipeline.
- **Idempotency contract** (precise):
  - **Scope key**: `(creator_id, client_upload_token)`. The token is bound to the authenticated creator, not globally unique. A second creator using the same token string is a distinct request.
  - **Fingerprint**: on first accept, the route stores `original_sha256` on the `asset_media` row and `original_size_bytes` + the client-supplied metadata checksum on `vault_assets`. These are the three values that define the request fingerprint.
  - **Replay with identical bytes + identical metadata** → route returns the **same `{ asset_id }`** as the original response, HTTP 200. No new row. No new storage write. This is the normal retry path.
  - **Replay with same token but different bytes or different metadata** → HTTP 409 Conflict. No mutation. The original row and original bytes are preserved. Client must mint a new token to submit a different payload.
  - **Token never submitted before** for this creator → proceed with the full insert / write sequence.
  - **Enforcement**: unique index on `(creator_id, client_upload_token)`; application-level comparison of `original_sha256` and metadata checksum before returning 200 on replay.
- **Risks**: duplicate rows from client retry — covered by the contract above. Partial write (bytes stored but row insert failed) — route writes bytes, then row; on row failure, deletes bytes before returning error.
- **Validation**: integration tests against fs-adapter; rejection test for MIME/magic mismatch; idempotency-token replay test (identical-payload → 200 same id); idempotency conflict test (same token, mutated bytes → 409); concurrent-double-submit test.
- **Rollback**: feature flag off, or revert route. No mock callers are affected.
- **Merge notes (landed 2026-04-16)**:
  - Planning doc [PR-2-PLAN.md](./PR-2-PLAN.md) governed the build; approved as-written plus the approved additive `StorageAdapter.delete(storageRef)` method.
  - Focused tests **122/122 passing** in `vitest run src/lib/storage src/lib/upload src/app/api/upload` (44 PR 1 storage + 78 PR 2 upload/route).
  - Type-check: **zero new errors** from PR 2 files. Repo-wide `tsc --noEmit` retains the same pre-existing errors in unrelated files carried over from before PR 1.
  - Runtime behavior preserved while `FFF_REAL_UPLOAD=false` (default): route returns 503 before any body read, auth check, or adapter call. Simulation path in `v2-state.ts` is untouched.
  - Schema delta landed in `supabase/migrations/20260418000001_upload_idempotency.sql`: `vault_assets.{client_upload_token, original_size_bytes, metadata_checksum}`, `asset_media.original_sha256`, partial unique index `vault_assets_creator_upload_token_key`, `upload_commit(...)` plpgsql function for atomic two-row insert. All additive, fully reversible.
  - **Idempotency + race-branch semantics (final)**: on token race with matching fingerprints, canonical business outcome is success (200 with the winner's `asset_id`). If the loser's compensating delete fails, the cleanup failure is surfaced via (a) `console.error` with `compensating_delete_failed` code + full context, and (b) `compensating_action_failed: true` in the 200 response body. Never swallowed.
  - Session resolution on the route is a **placeholder** (`X-Creator-Id` header) and will be replaced by real session resolution before PR 5's cutover. Safe during PR 2 because the 503 flag gate precedes the session check.
  - One known deferred concern carried forward from [PR-2-PLAN.md](./PR-2-PLAN.md) §11: rate limiting on `/api/upload` — intentionally deferred to PR 5 per the original risk list, since the flag-off default means no production exposure.

### PR 3 — Derivative row enqueue on commit (dormant)

- **Goal**: On successful original persistence, insert pending derivative rows so the worker has work to find. Still behind `FFF_REAL_UPLOAD=false`.
- **Touches**: extend `src/lib/upload/commit-service.ts`; new `src/lib/processing/enqueue.ts` (queries + insert helpers).
- **Behavior added**: after PR 2 Step 4, insert one `asset_media` row per derivative role (`thumbnail`, `watermarked_preview`, `og_image`) with `generation_status='pending'`, `storage_ref=NULL`, `watermark_profile_version=NULL`. UNIQUE `(asset_id, media_role)` makes this safe against replay. No worker runs yet.
- **Untouched**: existing dormant processing module (`src/lib/processing/pipeline.ts`, `dispatcher.ts`) is not invoked; delivery continues to 404 for missing rows, which is correct.
- **Risks**: orphan pending rows if the worker is never turned on — acceptable while dormant; backfill (PR 6) will sweep them once the worker exists.
- **Validation**: post-commit query asserts exactly the expected 3 pending rows; replay of the commit does not duplicate rows.
- **Rollback**: feature flag off.

### PR 4 — Processing worker activation (dormant until invoked)

- **Goal**: Wire the already-written processing module to pending `asset_media` rows. Exposed as an explicit script first; no scheduled invocation yet.
- **Touches**: `frontfiles/src/lib/processing/dispatcher.ts`, `frontfiles/src/lib/processing/pipeline.ts`, new `frontfiles/scripts/process-derivatives.ts`, new `src/lib/processing/worker.ts` (selection + CAS).
- **Behavior added**:
  1. `SELECT ... FROM asset_media WHERE generation_status='pending' FOR UPDATE SKIP LOCKED LIMIT N`, then atomic transition `pending → processing`. Stamp `processing_started_at = now()` on the same UPDATE.
  2. Load original bytes via `StorageAdapter.getBytes(original.storage_ref)`.
  3. **Profile requirement, per role (explicit)**:
     - `thumbnail` — unwatermarked resize only. **Does not** depend on any watermark profile. Proceeds whenever the original is readable.
     - `watermarked_preview` — requires an approved profile for `(intrusion_level, format_family)`. If missing, row stays `pending` (not `failed`), logged, and becomes eligible the moment a profile is approved.
     - `og_image` — watermarked; same profile requirement as `watermarked_preview`. Same stay-pending behavior on missing profile.
     - Rule: the profile check is per-row, not per-asset. A missing profile blocks only the watermarked derivatives for that asset. Its `thumbnail` still completes.
  4. Execute pipeline (resize → watermark composite for watermarked roles) from `src/lib/processing/pipeline.ts`.
  5. `StorageAdapter.putDerivative(asset_id, role, bytes)` → update row: `storage_ref`, `generation_status='ready'`, `watermark_profile_version` (NULL for `thumbnail`), dimensions, size.
  6. On exception: `generation_status='failed'`, no storage write.
  7. **Stuck-processing reaper** (same script, runs on each tick before claim step): `UPDATE asset_media SET generation_status='pending', processing_started_at=NULL WHERE generation_status='processing' AND processing_started_at < now() - interval '10 minutes'`. Emits one structured log line per reset: `{asset_id, media_role, stuck_duration_seconds}`. Timeout value is configurable via `FFF_PROCESSING_TIMEOUT_SECONDS` (default 600). The reaper runs before claiming new work so a crashed worker's rows are recovered on the very next tick of any other worker.
- **Untouched**: delivery route (already fails closed on non-ready). Upload flow. UI.
- **Risks**: concurrent workers on the same row (mitigated by `FOR UPDATE SKIP LOCKED` + status CAS); partial derivative writes (write bytes first, then update row — a crash leaves an orphan byte blob that the next successful run overwrites deterministically since output is byte-equivalent); worker crash mid-processing (covered by the reaper above); missing approved profile for a watermarked role (stays pending per step 3, so approval flips it live without a manual reset).
- **Validation**: unit tests per pipeline step already exist (`__tests__/pipeline.test.ts`); add a worker-level integration test seeding one original + one pending row and asserting end-to-end transition; add a concurrency test with two workers racing one row; add a reaper test: insert a row with `generation_status='processing'` and `processing_started_at` > timeout in the past, run one worker tick, assert the row is `pending` again; add a per-role profile test: seed with no approved watermark profile, assert `thumbnail` completes while `watermarked_preview` / `og_image` stay `pending`.
- **Rollback**: stop invoking the script. Rows stay `pending`; delivery keeps 404-ing, which is the invariant.

### PR 5 — Runtime cutover: real upload in the committed UI flow (flagged)

- **Goal**: Flip `FFF_REAL_UPLOAD=true` in staging. The simulation path remains available as a scenario for tests.
- **Touches**: `frontfiles/src/lib/upload/v2-state.ts` (COMPLETE_COMMIT dispatch path), `frontfiles/src/lib/upload/services.ts` (replace `simulateFileUpload` call site), `frontfiles/src/lib/upload/v2-simulation-engine.ts` (leave simulation mode intact; add a real-mode branch).
- **Behavior added**: when flag on, the browser POSTs the actual `File` bytes to `/api/upload` (with idempotency token), receives `asset_id`, and the UI renders `resolveProtectedUrl(asset_id)` for previews. Preview URLs 404 until the worker produces `watermarked_preview` — the UI surfaces a "processing" state driven by polling `asset_media.generation_status`, not by retrying the image element.
- **Untouched**: delivery route. `src/middleware.ts`. Processing pipeline.
- **Risks**: UX dead-air while worker lags — the processing-state indicator is the containment. Rate limiting on `/api/upload` — reuse patterns from `src/lib/rate-limit/original-downloads.ts`.
- **Validation**: full end-to-end test in staging: upload → commit → poll → preview renders via real derivative. Regression: with flag off, the simulation still passes existing scenario tests.
- **Rollback**: feature flag off. Any rows already written remain valid and will complete through the worker.

### PR 6 — Backfill / regeneration CLI (dormant until invoked)

- **Goal**: Single query + script that covers three cases through the same pipeline: (a) assets with an original but missing derivative rows, (b) derivatives with `watermark_profile_version < current_approved_version`, (c) previously-failed rows an operator has re-queued. Required for beta import once that lands, and for any post-profile-approval sweep.
- **Touches**: new `frontfiles/scripts/backfill-derivatives.ts`, new `src/lib/processing/backfill.ts` (query helpers only — no new pipeline code).
- **Behavior added**: the script INSERTs missing derivative rows as `pending` and/or resets stale/failed ones to `pending`, then exits. The PR-4 worker does the actual work. Chunked by `--batch-size` to avoid regeneration storms.
- **Untouched**: upload, delivery, worker internals.
- **Risks**: mass regeneration after a profile version bump — mitigate with batch-size flag and a `--dry-run` that reports counts per bucket.
- **Validation**: seed scenarios for each of (a)/(b)/(c); run script; assert expected row transitions; run worker; assert `ready`.
- **Rollback**: stop the script; no orphan state.

### PR 7 — Remove mock preview fallback from delivery resolver (runtime)

- **Goal**: Stop serving `/public/assets/` as every role. After PR 5 is live and PR 6 has backfilled legacy assets, delivery must resolve only from real `asset_media` rows.
- **Touches**: `frontfiles/src/lib/media/asset-media-repo.ts` (`getReadyMedia`), `frontfiles/src/data/assets.ts`, `frontfiles/src/lib/mock-data.ts` (mock fixtures retained for test scenarios only).
- **Behavior added**: `getReadyMedia` returns `null` when no real `asset_media` row is ready. Existing delivery route already 404s on null — no change required there.
- **Untouched**: `src/app/api/media/[id]/route.ts`, middleware, entitlement, rate limit, audit log.
- **Risks**: any asset that slipped past backfill now 404s in preview. Pre-landing check: backfill dry-run report must show zero assets in bucket (a).
- **Validation**: snapshot the set of `vault_assets.id` values rendered on key discovery/detail pages; assert each resolves to a ready derivative row.
- **Rollback**: revert.

### PR 8 — Drop legacy `vault_assets.watermark_mode` column (runtime, deferred)

- **Goal**: Complete the schema cleanup called out in brief §3.1.
- **Preconditions**: founder decision on `watermark_mode='none'` mapping (brief §7.1) applied via data migration to `intrusion_level`. No runtime readers of `watermark_mode` remain.
- **Touches**: new migration under `frontfiles/supabase/migrations/` to drop the column; any stray TS references.
- **Untouched**: everything else.
- **Risks**: hidden reader outside the processing module. Pre-landing grep across the repo is the gate.
- **Validation**: repo-wide search returns zero non-migration references; staging migration + smoke pass before prod.
- **Rollback**: column drop is destructive — require a pre-migration snapshot of the column. Reversal migration is a re-add with no data, acceptable because the canonical source has moved to `intrusion_level`.

---

## Activation Order

**Dormant (no user-visible change):** PR 1, PR 2, PR 3, PR 4, PR 6.
- Flag `FFF_REAL_UPLOAD` stays `false`.
- Worker script is not scheduled.
- `/public/assets/` mock serving remains in place.
- Delivery route continues to 404 on missing rows — which is the same behavior it has today.

**Runtime-changing, in order:**
1. **PR 5 cutover** in staging with `FFF_REAL_UPLOAD=true`, with the worker (PR 4) running on a timer or long-lived process. Observe for at least one full creator-flow cycle before prod flip.
2. **PR 7 mock-fallback removal**, contingent on PR 6 backfill dry-run showing zero unresolved legacy assets.
3. **PR 8 column drop**, contingent on the founder decision in brief §7.1 and a clean repo-wide grep.

This ordering means no PR between 1 and 4 can break an existing user flow, because no existing flow touches any of the new code.

---

## Data Migration / Backfill Posture

- **New uploads (post-PR 5)**: follow the canonical lifecycle in brief §2. Original lands at commit-time; derivatives are produced asynchronously.
- **Existing mock fixtures in `public/assets/`**: not real assets. Remain in place as test scenario data. PR 7 removes them from the resolver but keeps the files on disk for tests.
- **Beta import (deferred per 2026-04-15 decision)**: when it lands, its responsibility stops at "write original bytes + insert `asset_media role=original status=ready` + insert `vault_assets` with mapped metadata." Derivative creation is **not** its job. PR 6's backfill discovers the missing derivative rows and runs them through the standard worker. This satisfies the invariant "beta import uses the same derivative/backfill pipeline."
- **Profile version bumps**: after founder approves a new profile version, PR 6 backfill with the stale-version query re-queues every affected derivative. No hand-written regeneration scripts.

---

## Concurrency / Idempotency Controls

| Hazard | Control | Enforced in |
|---|---|---|
| Duplicate upload POSTs from retry | Client idempotency token + unique index `(creator_id, client_upload_token)` | PR 2 |
| Two workers claim the same pending row | `SELECT ... FOR UPDATE SKIP LOCKED` + atomic `pending → processing` CAS update | PR 4 |
| Partial write: bytes present, row not updated | Write bytes first (deterministic path); update row last. Any re-run overwrites bytes byte-equivalently under the same profile version. | PR 4 |
| Partial write: row inserted, original bytes missing | PR 2 writes bytes before the `asset_media` row. On row-insert failure, delete the bytes before returning. | PR 2 |
| Duplicate derivative rows | `UNIQUE (asset_id, media_role)` already in migration `20260413230002_vault_asset_tables.sql` | Schema (already in place) |
| Backfill re-enqueues a row the worker is processing | Backfill filter excludes `generation_status='processing'`; only touches `pending`, `failed`, or stale-version `ready` rows | PR 6 |
| Profile-version race (approval during in-flight job) | Worker stamps `watermark_profile_version` at write time; subsequent backfill with the stale-version query re-queues any row that used the previous version. | PR 4 + PR 6 |
| Rapid upload → immediate preview expecting a ready derivative | UI polls `generation_status`; never retries the image element directly. Delivery 404s until `ready`. | PR 5 |
| Worker crash leaves a row stuck in `processing` | Reaper sweeps `processing` rows older than `FFF_PROCESSING_TIMEOUT_SECONDS` (default 600) back to `pending` on every worker tick; one structured log line per reset for operator visibility. | PR 4 |

### Orphan blob cleanup (minimal posture)

Three orphan classes can arise; policy is kept deliberately small:

1. **Original bytes written, then the `asset_media` row insert failed inside the same request.** PR 2's route deletes the bytes inline before returning the error. Coverage: the PR 2 partial-write risk is handled at the request boundary — no sweeper needed.
2. **Derivative bytes written, then the row update failed.** Left in place. The deterministic path `derivatives/{asset_id}/{role}.jpg` plus byte-equivalent Sharp output means the next successful retry overwrites the same key. No uniqueness drift, no rot.
3. **`putOriginal` bytes with no `vault_assets` / `asset_media` row after a long delay** (e.g. catastrophic process kill between adapter write and transaction open). Rare and invisible: the path is derived from an `asset_id` that has no row, so nothing references it. **Not swept in this plan's scope.** A future lightweight operational task — list `originals/` prefix, left-anti-join against `asset_media.storage_ref`, delete anything older than 24h — is noted here but intentionally deferred; introducing it now would add runtime surface area this plan is designed to avoid.

This posture is explicit: PR 2 handles the in-request case; retries are byte-safe by construction; the long-tail orphan class is acknowledged and deferred, not ignored.

---

## Open Decisions (founder / product)

Sourced directly from brief §7, unchanged scope:

1. **`watermark_mode='none'` mapping** — blocks PR 8 and any beta-import data mapping. Decision: light vs standard for opted-out legacy assets.
2. **Watermark profile approval** — blocks the worker's ability to produce watermarked derivatives. At minimum one approved profile per (intrusion_level, format_family) before PR 5 staging flip.
3. **Derivative dimension targets** (thumbnail 400px short, watermarked_preview 1600px long, og_image 1200x630) — to be frozen before PR 4 lands, otherwise re-generation sweeps are wasted.
4. **`detail_preview` merge timing** — whether the lightbox path uses `detail_preview` as a distinct role at activation, or stays merged with `watermarked_preview` for now. Affects PR 3's enqueue list.
5. **Storage bucket choice** (Supabase Storage vs S3 vs other) — blocks the prod adapter in PR 1. The fs adapter is unblocked and can proceed in parallel.
6. **Concurrency model** (in-process vs external queue) — affects PR 4. The `FOR UPDATE SKIP LOCKED` approach described above works for both, but a heavier queue (e.g., PG-boss, SQS) changes the script shape.

---

## Build First: PR 1 — Storage Adapter

Build PR 1 first.

- **It is the only PR with zero runtime surface area.** It touches nothing the UI, delivery route, or DB currently reads. Landing it is a pure additive operation.
- **Every later PR depends on it.** PR 2 needs `putOriginal`; PR 4 needs `getBytes` + `putDerivative`; PR 6 + beta import both rely on the same `putOriginal` contract. Shipping it first means the ingest and worker PRs can be reviewed against a stable, testable interface rather than a moving one.
- **It forces the bucket decision (open §5) into a config concern, not a code concern.** The adapter abstraction decouples "where bytes live" from "how the pipeline works," which is the same separation the brief's governing principle draws between storage (bytes) and DB (truth).
- **It validates brief §4.1's path contract up front.** If the deterministic path scheme has a flaw, we find it in an isolated unit test — not during the PR 5 cutover when the stakes are production uploads.
