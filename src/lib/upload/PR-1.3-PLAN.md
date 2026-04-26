# PR 1.3 — Implementation Plan

**Status:** DRAFT — planning only, no code in this pass
**Date:** 2026-04-26
**Predecessor:** PR 1.2 shipped (`/api/v2/batch` + `/api/v2/batch/[id]/commit` dormant behind `FFF_REAL_UPLOAD`)
**Governing documents:** `src/lib/processing/ARCHITECTURE-BRIEF.md`, `src/lib/processing/IMPLEMENTATION-PLAN.md`, `src/lib/upload/PR-1.1-PLAN.md`, `src/lib/upload/PR-1.2-PLAN.md`, `src/lib/processing/PR-2-PLAN.md`
**Audit basis:** `docs/audits/UPLOAD-PR3-AUDIT-2026-04-26.md` IP-1 (PR 1.3 first; PR 3 second)
**Scope:** Migrate `/api/upload` from 15-arg `upload_commit` to 21-arg, require `X-Batch-Id` header, thread the 5 new vault_assets fields through commit-service and upload-store, drop the 15-arg RPC overload. **Dormant behind `FFF_REAL_UPLOAD=false`** (no flag flip in this PR).

---

## 1. Scope boundary

PR 1.3 **does**:

- Add one migration: drop the 15-arg `upload_commit` overload
- Make `/api/upload` batch-aware: require `X-Batch-Id` header; validate it (UUID + exists + belongs to creator + state=`'open'`); reject with `400 batch_id_required` (or appropriate code) on failure
- Extend `CommitUploadRequest` (commit-service) with `batchId` + the 5 new vault_assets fields
- Extend `InsertDraftAndOriginalInput` (upload-store) with the same 6 new fields
- Switch `upload-store.ts:165` from 15-arg `upload_commit` call to 21-arg
- Extend the route's form-parse to accept the 5 new fields (NULL-tolerant — see §10 IP-1)
- Pre-merge gate: grep verifies zero remaining callers of the 15-arg overload before the migration's drop runs in production
- Add tests for the new contract; preserve all PR 2 idempotency tests

PR 1.3 **does not**:

- Replace the placeholder session resolver (`X-Creator-Id` header → real auth) — deferred to PR 1.4 (see §10 IP-2)
- Touch the V2 batch routes (`/api/v2/batch`, `/api/v2/batch/[id]/commit`) — already batch-aware per PR 1.2
- Touch `batch-service.ts` or `batch-store.ts` — already batch-aware
- Touch the simulation path (`v2-state.ts`, `v2-simulation-engine.ts`, `services.ts`) — simulation remains authoritative until PR 5
- Touch the storage adapter — no signature changes
- Touch the processing module — derivative enqueue is PR 3 (sequenced after this)
- Flip `FFF_REAL_UPLOAD` — that's PR 5
- Add UI changes — UI rebuild is Phase C
- Tighten the 5 new fields from optional to required — left NULL-tolerant per IP-1; tightening is a later PR once the analysis pipeline is real

---

## 2. Files to add / touch / not touched

### 2.1 Add (3)

| Path | Purpose |
|---|---|
| `frontfiles/supabase/migrations/<next-ts>_drop_upload_commit_15arg.sql` | Drop the 15-arg `upload_commit(uuid, uuid, text, text, asset_format, validation_declaration_state, text, bigint, text, text, text, bigint, integer, integer, text)` overload. Reversible rollback block at bottom (re-creating the 15-arg form from the body in `20260418000001_upload_idempotency.sql` or similar — TBD which migration introduced the 15-arg form). |
| `frontfiles/src/lib/upload/__tests__/route-batch-aware.test.ts` *(or extend existing `src/app/api/upload/__tests__/route.test.ts`)* | Tests for the new `X-Batch-Id` contract: missing header → 400; bad UUID → 400; nonexistent batch → 404; wrong creator → 403; non-`open` state → 409; happy path → 200 with batch_id stored on the row. |
| `frontfiles/src/lib/upload/__tests__/upload-store-21arg.test.ts` *(or extend `commit-service.test.ts`)* | Tests for the 21-arg RPC call shape and the 5 new field threading. |

### 2.2 Touch

| Path | Change |
|---|---|
| `frontfiles/src/app/api/upload/route.ts` | Add `X-Batch-Id` header parse + UUID validation. Add batch-existence + ownership + state check (one indexed SELECT against `upload_batches`). Add form-field parsing for the 5 new optional fields (or accept them inside the existing `metadata` JSON — see §4.2 for the chosen wire shape). Pass `batchId` + the 5 fields through to `commitUpload`. |
| `frontfiles/src/lib/upload/commit-service.ts` | Extend `CommitUploadRequest` interface with `batchId: string` (required) + 5 new optional fields (`proposalSnapshot`, `extractedMetadata`, `metadataSource`, `duplicateStatus`, `duplicateOfId`). Thread them into the `InsertDraftAndOriginalInput` call. No change to validation, fingerprint, idempotency lookup, or rollback logic — all preserved. |
| `frontfiles/src/lib/upload/upload-store.ts` | Extend `InsertDraftAndOriginalInput` with the same 6 new fields. Switch `client.rpc('upload_commit', {...15 params})` to `{...21 params}` adding `p_batch_id`, `p_proposal_snapshot`, `p_extracted_metadata`, `p_metadata_source`, `p_duplicate_status`, `p_duplicate_of_id`. Mock store updated to record `batchId` in `StoredUpload` (for testing the threading; not used in idempotency lookup). |
| `frontfiles/src/lib/upload/types.ts` *(if needed)* | Add shared types for the 5 new field shapes if not already exported from `v2-types.ts` (which the migration comments cite as the canonical source). Likely re-export from there. |

### 2.3 Not touched (explicit)

- `src/app/api/v2/batch/route.ts`, `src/app/api/v2/batch/[id]/commit/route.ts` — PR 1.2 batch routes; already batch-aware
- `src/lib/upload/batch-service.ts`, `batch-store.ts` — PR 1.2; already batch-aware
- `src/lib/upload/v2-state.ts`, `v2-simulation-engine.ts`, `services.ts`, `validation.ts` — simulation path
- `src/app/api/media/[id]/route.ts`, `src/lib/media/*` — delivery path
- `src/lib/processing/**` — derivative pipeline (PR 3+)
- `src/lib/storage/**` — storage adapter (no signature change)
- `src/data/assets.ts`, `src/lib/mock-data.ts` — mock surface
- `src/lib/flags.ts` — `isRealUploadEnabled()` unchanged

---

## 3. Schema delta (single migration)

One migration, reversible. Drops the 15-arg `upload_commit` overload after the application has migrated all callers to the 21-arg form.

```sql
-- ════════════════════════════════════════════════════════════════
-- PR 1.3 — drop the 15-arg upload_commit overload
--
-- The 15-arg form was introduced in PR 2 (migration
-- 20260418000001_upload_idempotency.sql) and preserved alongside
-- the 21-arg form added by PR 1.1 (migration
-- 20260419000001_phase1_upload_batches.sql) so PR 2 callers
-- could continue to resolve to the 15-arg version.
--
-- PR 1.3 migrates the only application caller
-- (src/lib/upload/upload-store.ts:165) to the 21-arg form.
-- After that migration, the 15-arg overload has zero callers
-- and is dropped here.
--
-- Pre-merge gate: a repo-wide grep for the 15-arg signature
-- (`upload_commit\(.*15.*params|p_height.*p_original_sha256.*\)$`)
-- returns ZERO TypeScript or SQL hits before this migration runs
-- in production. Verified by CI or pre-merge script.
-- ════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS upload_commit(
  uuid, uuid, text, text, asset_format, validation_declaration_state,
  text, bigint, text, text, text, bigint, integer, integer, text
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- Re-create the 15-arg form by re-running the body from
-- 20260418000001_upload_idempotency.sql §upload_commit (15-arg).
-- Source preserved in that migration file; the rollback block here
-- holds a copy for emergency recovery without cross-file reference.
-- (Body inlined in the actual migration file; omitted from this plan
-- doc to avoid drift — single source of truth = PR 2's migration.)
```

Nothing else in the schema changes. No new columns, no enum changes, no constraint rewrites. The 21-arg `upload_commit`, the `upload_batches` table, the 6 vault_assets columns, and all PR 2-era idempotency columns are preserved exactly.

---

## 4. The `X-Batch-Id` contract

### 4.1 Header shape

- Header name: `X-Batch-Id`
- Format: UUID (any version digit; same loose match as `X-Upload-Token` per route.ts line 36)
- Required: yes (per PR 1.1 migration comment line 88)
- Transport: HTTP header (consistent with `X-Upload-Token` and `X-Creator-Id` patterns)

### 4.2 Wire shape for the 5 new optional fields

**Decision: top-level form fields, not nested under `metadata`.** Rationale: the existing `metadata` blob is checksummed and treated as opaque client metadata. The 5 new fields are persisted to dedicated columns and have well-defined shapes (per `v2-types.ts`). Mixing them into `metadata` would couple their persistence to the metadata checksum (a change to any of them would invalidate the idempotency fingerprint). Top-level keeps them separate from the fingerprint surface.

| Form field | Type | Required | Persisted to |
|---|---|---|---|
| `file` | Blob | yes (existing) | `asset_media.original` storage_ref |
| `metadata` | string (JSON) | optional (existing; default `{}`) | checksummed, NOT persisted verbatim |
| `proposal_snapshot` | string (JSON, snake_case) | **optional in PR 1.3** | `vault_assets.proposal_snapshot` jsonb |
| `extracted_metadata` | string (JSON, snake_case) | **optional in PR 1.3** | `vault_assets.extracted_metadata` jsonb |
| `metadata_source` | string (JSON, snake_case) | **optional in PR 1.3** | `vault_assets.metadata_source` jsonb |
| `duplicate_status` | string (`'none' \| 'likely_duplicate' \| 'confirmed_duplicate'`) | optional; defaults to NULL | `vault_assets.duplicate_status` enum |
| `duplicate_of_id` | string (UUID) | optional; required iff `duplicate_status = 'confirmed_duplicate'` (DB CHECK enforces) | `vault_assets.duplicate_of_id` uuid |

Optional in PR 1.3 = NULL-tolerant. The 21-arg RPC accepts NULL for each of these (the column types are nullable; the RPC body just passes them through). This matches the migration's NULL-tolerant column design.

A later PR (after the analysis pipeline is real per Phase E) will tighten `proposal_snapshot` + `extracted_metadata` + `metadata_source` to required. PR 1.3 stays NULL-tolerant to avoid blocking on Phase E.

### 4.3 Batch validation flow

Inserted between Step 3 (idempotency token validation) and Step 4 (parse multipart body) of the existing route flow:

```
3.5 Batch header parse + validate
    a. const batchId = req.headers.get('x-batch-id') ?? ''
       if missing OR not UUID → return 400 { code: 'batch_id_required' }
    b. SELECT id, creator_id, state FROM upload_batches WHERE id = $batchId LIMIT 1
       if not found → return 404 { code: 'batch_not_found' }
       if creator_id != session creatorId → return 403 { code: 'forbidden' }
       if state != 'open' → return 409 { code: 'invalid_batch_state', current_state: <state> }
    c. Cache batchId in request scope; pass to commit service
```

One indexed SELECT (the `upload_batches_creator_state_idx` index from PR 1.1 covers it). Cost is small (~1ms). Defensive value is high: prevents uploads against committed/cancelled batches and prevents cross-creator batch use.

### 4.4 Idempotency contract preservation

**No change to idempotency.** The contract remains:
- Scope key: `(creator_id, client_upload_token)` (NOT including `batch_id`)
- Fingerprint: `original_sha256` + `original_size_bytes` + `metadata_checksum` (NOT including `batch_id`)

Implication: a creator with token `"abc"` cannot reuse it across batches. The token is globally unique per creator regardless of batch. This is the existing behavior — clients should mint a fresh token per upload attempt.

**Replay edge case:** if a creator submits the same token + same fingerprint but a different `batch_id` than the original commit's batch, the response is 200 with the original `asset_id` (the original batch_id wins). The retry's batch_id is logged for operator visibility but does not change persisted state. Rationale: the asset is identified by token + bytes, not by batch. The batch is a session organizer; assets persist past batches.

This edge case is documented in tests (see §5.4) but is not a new failure code.

---

## 5. Threading new fields through the pipeline

### 5.1 Route handler (`/api/upload/route.ts`)

Three changes:
- Add header parse for `X-Batch-Id` (per §4.1)
- Add batch validation block (per §4.3) — runs after auth + idempotency token, before form parse
- Add form-field parsing for the 5 new fields (per §4.2) — runs alongside existing `metadata` parse
- Thread `batchId` + the 5 fields into the `commitUpload({...request, batchId, proposalSnapshot, ...})` call

### 5.2 Commit service (`commit-service.ts`)

`CommitUploadRequest` extended:
```typescript
export interface CommitUploadRequest {
  // existing
  creatorId: string
  clientUploadToken: string
  filename: string
  claimedMime: string
  bytes: Buffer
  metadata: unknown
  // NEW (PR 1.3)
  batchId: string
  proposalSnapshot?: unknown        // optional; passed to RPC as jsonb
  extractedMetadata?: unknown       // optional
  metadataSource?: unknown          // optional
  duplicateStatus?: 'none' | 'likely_duplicate' | 'confirmed_duplicate' | null
  duplicateOfId?: string | null
}
```

Threading: the existing flow (validate → fingerprint → idempotency lookup → putOriginal → insertDraftAndOriginal → rollback) is unchanged. The new fields are simply included in the `InsertDraftAndOriginalInput` constructed at step 6.

Per the brief invariants, validation logic is unchanged, fingerprint logic is unchanged, idempotency logic is unchanged, rollback logic is unchanged. The 5 new fields ride along.

### 5.3 Upload store (`upload-store.ts`)

`InsertDraftAndOriginalInput` extended with 6 new fields. The RPC call switches:

```typescript
// Before (15-arg)
const { error } = await client.rpc('upload_commit', {
  p_asset_id: input.assetId,
  // ... 14 more params
  p_original_sha256: input.originalSha256,
})

// After (21-arg)
const { error } = await client.rpc('upload_commit', {
  p_asset_id: input.assetId,
  // ... 14 same params
  p_original_sha256: input.originalSha256,
  p_batch_id: input.batchId,
  p_proposal_snapshot: input.proposalSnapshot ?? null,
  p_extracted_metadata: input.extractedMetadata ?? null,
  p_metadata_source: input.metadataSource ?? null,
  p_duplicate_status: input.duplicateStatus ?? null,
  p_duplicate_of_id: input.duplicateOfId ?? null,
})
```

The mock store is updated to record `batchId` in `StoredUpload` (for fidelity in tests) but does NOT use it in the idempotency lookup. Lookup remains by `(creator_id, client_upload_token)`.

### 5.4 Tests

Additions on top of existing PR 2 tests (which all stay green):

**Route tests (`route.test.ts` extension):**
- Missing `X-Batch-Id` → 400 `batch_id_required`
- Malformed UUID `X-Batch-Id` → 400 `batch_id_required`
- Nonexistent batch → 404 `batch_not_found`
- Batch belongs to different creator → 403 `forbidden`
- Batch state `'committing'` → 409 `invalid_batch_state` with `current_state` in body
- Batch state `'committed'` → same
- Batch state `'cancelled'` → same
- Happy path with all 6 new fields populated → 200, row has `batch_id` + all 5 fields persisted as expected
- Happy path with NULL 5 new fields → 200, row has `batch_id` set + 5 fields NULL
- Idempotency replay across different batches: same token, same fingerprint, different `X-Batch-Id` → 200 with original `asset_id`; retry's `batch_id` ignored (logged)
- Idempotency conflict: same token, mutated bytes, same `X-Batch-Id` → 409 `idempotency_conflict` (existing PR 2 behavior preserved)

**Upload-store tests (`upload-store-21arg.test.ts` or extension):**
- 21-arg RPC call shape: all 21 params present, in order, with correct values
- 5 new fields default to NULL when not provided
- `duplicate_status='confirmed_duplicate'` without `duplicateOfId` → caught by DB CHECK (test asserts the unique violation surfaces; the application doesn't pre-validate this — the DB does)

**Commit-service tests (`commit-service.test.ts` extension):**
- `commitUpload` accepts the new fields; they reach `insertDraftAndOriginal` unchanged
- Existing happy path / idempotency / rollback tests still pass (regression)

### 5.5 Pre-merge gate

A grep script (or manual check) verifies zero remaining callers of the 15-arg `upload_commit`:

```bash
# Should return zero hits before merging the migration
grep -rn "upload_commit" --include="*.ts" --include="*.sql" \
  --exclude-dir=node_modules \
  --exclude="*PR-1.3-PLAN.md" \
  --exclude="20260418000001*" \
  --exclude="20260419000001*" \
  --exclude="<this-PR-migration-filename>" \
  | grep -v "21-arg\|p_batch_id"
```

The grep must return 0 lines. CI integration optional; manual pre-merge is acceptable if CI is not yet wired for this check.

---

## 6. Failure modes and rollback

| Failure point | Behavior | HTTP |
|---|---|---|
| `X-Batch-Id` missing or malformed | None (no DB or storage touched yet); return | 400 `batch_id_required` |
| Batch SELECT fails (DB error) | Log and return | 500 `persistence_failed` |
| Batch not found | Return | 404 `batch_not_found` |
| Batch belongs to different creator | Return | 403 `forbidden` |
| Batch state not `'open'` | Return with `current_state` in body | 409 `invalid_batch_state` |
| All other PR 2 failure modes | Preserved unchanged (validation, idempotency_conflict, decode_failed, storage_write_failed, persistence_failed, token race) | (existing) |

Rollback for PR 1.3 itself: revert the migration (re-create 15-arg overload from the rollback block) + revert the 4 source files. The 21-arg overload + `upload_batches` table + 6 vault_assets columns from PR 1.1 are NOT touched by PR 1.3's rollback (they belong to PR 1.1).

---

## 7. Internal consistency checks

- **15-arg overload not present after migration**: verified by inspection in production after migration runs
- **No application caller still uses 15-arg**: verified by pre-merge grep (§5.5)
- **`upload_commit` 21-arg is the only RPC referenced** in `upload-store.ts:165` (or wherever the call moves)
- **All 21 params in the RPC call** match the migration's param order (PR 1.1 §upload_commit body)
- **No unintended field ordering change** — existing 15 params remain in their original positions; the 6 new params are appended
- **Idempotency invariant** preserved: lookup key still `(creator_id, client_upload_token)`; fingerprint still `(original_sha256, original_size_bytes, metadata_checksum)`; batch_id absent from both
- **CHECK constraint** on `duplicate_consistency` (PR 1.1) still valid: PR 1.3 never bypasses it; if `duplicate_status='confirmed_duplicate'` is passed without `duplicateOfId`, the DB rejects (surfaces as `unique_violation`-like; should be a check_violation actually — test the exact error code)
- **No new env vars** introduced; `FFF_REAL_UPLOAD` flag still gates the route at the top
- **All four PR 1.1 invariants** from its plan §3 preserved (vault_assets schema, upload_batches schema, 21-arg RPC, CHECK constraint)
- **All PR 2 invariants** from its plan §10 preserved (idempotency contract, storage write before row insert, compensating delete on failure, 503 fast-path on flag-off)

---

## 8. Tests — full surface

| Test file | New tests | Existing tests |
|---|---|---|
| `src/app/api/upload/__tests__/route.test.ts` | +10 (per §5.4 route tests) | All preserved |
| `src/lib/upload/__tests__/commit-service.test.ts` | +3 (new field threading) | All preserved |
| `src/lib/upload/__tests__/upload-store-21arg.test.ts` (NEW) | +5 (RPC shape + NULL handling + CHECK behavior) | N/A (new file) |
| `src/lib/upload/__tests__/server-validation.test.ts` | 0 | All preserved |
| `src/lib/storage/__tests__/fs-adapter*.test.ts` | 0 | All preserved |
| `src/lib/upload/__tests__/batch-service.test.ts` | 0 (PR 1.2 unchanged) | All preserved |
| `src/app/api/v2/batch/__tests__/*` | 0 (PR 1.2 unchanged) | All preserved |

Net: ~18 new tests. Zero regressions on the ~122 PR 1+2 tests already passing.

---

## 9. What this PR does NOT introduce

- No flag flip (still `FFF_REAL_UPLOAD=false` by default)
- No real session resolver (still placeholder `X-Creator-Id` header — see §10 IP-2)
- No derivative enqueue (that's PR 3, audit-locked per `UPLOAD-PR3-AUDIT-2026-04-26.md`)
- No new schema columns, enums, or tables — only the function drop
- No new env vars
- No new runtime dependencies
- No simulation-path changes
- No UI changes
- No batch lifecycle changes (the route doesn't transition batch state; `/api/v2/batch/[id]/commit` does that)
- No tightening of the 5 new fields from optional to required (deferred until Phase E AI pipeline)

---

## 10. Open items (surfacing — IPs resolved with rationale; not blocking plan approval)

These are the five interface points surfaced during the audit. Each is resolved here with a default; founder can override at plan ratification.

### IP-1 — 5 new fields: required vs optional in PR 1.3

**Resolution:** Optional (NULL-tolerant) in PR 1.3.

**Rationale:** The 21-arg RPC accepts NULL for each. The columns are nullable per PR 1.1 schema. The 5 fields are produced by the analysis pipeline (`proposal_snapshot`, `extracted_metadata`, `metadata_source`) or duplicate detector (`duplicate_status`, `duplicate_of_id`) — both of which are simulated today and become real in Phase E. Requiring them in PR 1.3 would block on Phase E completing. Optional now; tighten later when there's a real producer.

**Override condition:** if the founder wants to enforce the analysis pipeline as a hard prerequisite for any upload, mark `proposal_snapshot` + `extracted_metadata` + `metadata_source` as required and reject uploads without them (400 `analysis_required`). Adds a Phase E blocker on PR 1.3.

### IP-2 — Session resolver: in PR 1.3 or PR 1.4?

**Resolution:** Separate PR 1.4. Out of PR 1.3 scope.

**Rationale:** Replacing the `X-Creator-Id` header placeholder with real session resolution touches auth lib, JWT/cookie handling, and likely middleware — independent surface from batch-awareness. Bundling them risks a single PR doing two unrelated things. PR 2 plan §10 already documented this as a separate concern: "Session resolution on the route is a placeholder ... and will be replaced by real session resolution before PR 5's cutover." Sequenced as PR 1.4 between PR 1.3 and PR 3.

**Override condition:** if the founder wants to keep PR count low, fold session resolver into PR 1.3. Adds ~5-8 files of scope and one architectural concern (which auth provider; how cookies/JWT flow). Recommend against.

### IP-3 — `X-Batch-Id` validation: full or minimal?

**Resolution:** Full (UUID format + batch exists + belongs to creator + state=`'open'`). One indexed SELECT.

**Rationale:** Per `upload_batches_creator_state_idx` (PR 1.1), the SELECT cost is ~1ms. The defensive value is significant: prevents uploads against committed/cancelled batches (which would silently succeed and create vault_assets rows orphaned from any active batch); prevents cross-creator batch reuse (which would be a serious authorization bug); rejects malformed batch IDs early before any storage write. Aligns with PR 2's defensive-at-the-edge style.

**Override condition:** if the founder wants minimum validation (UUID format only), drop the SELECT and accept that the 21-arg RPC will fail with FK violation on bad batch_id (returned as `persistence_failed` 500, not the precise codes above). Slower diagnostics; weaker UX. Recommend full validation.

### IP-4 — Idempotency: include `batch_id` in fingerprint or not?

**Resolution:** Do NOT include `batch_id` in the idempotency fingerprint. Lookup by `(creator_id, client_upload_token)`; fingerprint by `(original_sha256, original_size_bytes, metadata_checksum)`. Replay across batches returns 200 with original `asset_id`.

**Rationale:** Assets are identified by token + bytes, not by batch. The batch is a session organizer; assets persist past batches. Including `batch_id` in the fingerprint would mean a creator who retries the same upload from a different batch gets a `409` instead of `200` — which is creator-hostile and architecturally confusing. The existing fingerprint contract works correctly; PR 1.3 preserves it.

**Override condition:** if the founder wants strict scoping (`batch_id` part of fingerprint), the unique index changes to `(creator_id, batch_id, client_upload_token)`. This requires a schema migration (modify the existing partial unique index from PR 2). Adds scope. Not recommended.

### IP-5 — Drop 15-arg overload in PR 1.3 or follow-up?

**Resolution:** Drop in PR 1.3 (this PR).

**Rationale:** PR 1.1 plan §3 explicitly prescribes: "PR 1.3 migrates the one caller and drops the 15-arg form then." Pre-merge grep gate (§5.5) verifies zero remaining callers before the migration runs in production. If grep fails (a caller still exists), the migration is held back. Splitting the drop into PR 1.4 would leave a window where two overloads coexist with the application using only the 21-arg — wasted DB function surface and a footgun for any future SQL author.

**Override condition:** if pre-merge grep finds an unexpected caller (e.g., a test that explicitly calls 15-arg), defer the drop to a follow-up PR after the caller is migrated. Should not happen if the grep gate is run honestly.

---

## 11. References

- Architecture brief (governing): `src/lib/processing/ARCHITECTURE-BRIEF.md`
- Implementation plan (governing): `src/lib/processing/IMPLEMENTATION-PLAN.md`
- PR 1.1 plan (schema + RPC overload): `src/lib/upload/PR-1.1-PLAN.md`
- PR 1.2 plan (batch routes): `src/lib/upload/PR-1.2-PLAN.md`
- PR 2 plan (idempotency contract): `src/lib/processing/PR-2-PLAN.md`
- PR 3 audit (sequencing — PR 1.3 first): `docs/audits/UPLOAD-PR3-AUDIT-2026-04-26.md`
- 21-arg RPC source: `supabase/migrations/20260419000001_phase1_upload_batches.sql:125-220`
- Current 15-arg call site: `src/lib/upload/upload-store.ts:165`
- Current route handler: `src/app/api/upload/route.ts`
- UX brief (v3): `docs/upload/UX-BRIEF.md`
- Domain types (canonical for the 5 new field shapes): `src/lib/upload/v2-types.ts`

---

## 12. Approval gate

Before any PR 1.3 code work composes, the founder ratifies this plan.

Ratification means: the scope in §1 stands, the file changes in §2 are the target, the 21-arg threading approach in §5 is the implementation, and the 5 IP resolutions in §10 are the answers. If any of those is wrong, this plan gets revised before code begins.

After ratification: PR 1.3 composes as a single-pass implementation directive. Estimated 10-15 files touched (per scope estimate from `UPLOAD-PR3-AUDIT-2026-04-26.md` §5), ~18 new tests, one migration. Should pass tests cleanly with zero regressions on the existing 122-test PR 1+2 suite.

After PR 1.3 ships: PR 3 (derivative row enqueue) is unblocked per the prior PR 3 audit. PR 4 (worker activation) follows. Then Phase D D1 (PR 5 cutover) requires Phase B + Phase C + Phase E + Phase F complete per `UX-BRIEF.md` v3 §6.

---

End of PR 1.3 implementation plan.
