# PR 3 — Implementation Plan

**Status:** DRAFT — companion to `docs/audits/UPLOAD-PR3-AUDIT-2026-04-26.md` which locked the IPs
**Date:** 2026-04-26
**Predecessor:** PR 1.3 shipped (`/api/upload` is batch-aware; calls 21-arg `upload_commit`)
**Governing documents:** `src/lib/processing/ARCHITECTURE-BRIEF.md`, `src/lib/processing/IMPLEMENTATION-PLAN.md` §PR 3, `docs/audits/UPLOAD-PR3-AUDIT-2026-04-26.md`
**Scope:** Insert pending derivative rows on commit. Per asset, three rows: `thumbnail`, `watermarked_preview`, `og_image`. Worker remains dormant (PR 4). All callers continue behind `FFF_REAL_UPLOAD=false`.

This is a slim plan; the audit already resolved IPs 1–5 and documented current state. Refer to the audit for findings, current commit-service shape, scope estimate, and IP rationale.

---

## 1. Scope boundary

PR 3 **does**:
- Add `src/lib/processing/enqueue.ts` — `enqueueDerivativeRows(assetId)` function + `DERIVATIVE_ROLES` constant
- Add tests for the enqueue function in isolation
- Touch `src/lib/upload/commit-service.ts` — call enqueue after successful `insertDraftAndOriginal`; failure logs but does NOT roll back
- Touch `src/lib/upload/__tests__/commit-service.test.ts` — add tests for enqueue-on-success + enqueue-failure-no-rollback

PR 3 **also**:
- Adds one small migration to relax `asset_media.storage_ref` and `content_type` from NOT NULL to nullable, with a new CHECK ensuring ready rows still have both. **This corrects an audit finding** — `UPLOAD-PR3-AUDIT-2026-04-26.md` initially claimed "no migration needed" based on the UNIQUE constraint already existing, but missed that pending derivative rows can't have NULL `storage_ref` under the current NOT NULL constraint. Audit corrected; see audit doc's correction note.

PR 3 **does not**:
- Activate any worker (that's PR 4)
- Touch the route handler
- Touch the storage adapter
- Touch the delivery resolver
- Change the idempotency contract
- Enqueue on the idempotency-replay (hit) path — only the happy `outcome: 'created'` path enqueues; replay assumes original commit already attempted (per audit IP-3)
- Enqueue on the token-race recovery path — same reasoning

---

## 2. Files to add / touch / not touched

### 2.1 Add (3)

| Path | Purpose | Lines (est.) |
|---|---|---|
| `supabase/migrations/<next-ts>_asset_media_pending_nullable.sql` | Relax NOT NULL on `storage_ref` + `content_type`; add CHECK that ready rows have both populated; reversible rollback | ~30 |
| `src/lib/processing/enqueue.ts` | Enqueue function + role constant + dual-mode (mock + Supabase) + `__testing` surface | ~120 |
| `src/lib/processing/__tests__/enqueue.test.ts` | Inserts 3 rows; idempotency on replay; mock state assertions | ~110 |

### 2.2 Touch (2)

| Path | Change |
|---|---|
| `src/lib/upload/commit-service.ts` | After `outcome.kind === 'ok'`, call `enqueueDerivativeRows(assetId)`; on non-ok result, log structured error and continue (return success). ~12 lines added. |
| `src/lib/upload/__tests__/commit-service.test.ts` | Reset enqueue mock in beforeEach; add 3 tests (enqueue runs on success, doesn't run on failure, doesn't roll back on enqueue failure). ~50 lines added. |

### 2.3 Not touched

- `src/app/api/upload/route.ts` — route is enqueue-agnostic; the call lives in commit-service
- `src/lib/upload/upload-store.ts` — separate concern from enqueue
- `src/lib/processing/{dispatcher,pipeline,resize,profiles,watermark-compositor,types}.ts` — worker activation is PR 4
- `src/lib/storage/**` — no signature change
- All test files outside the two listed above
- All migrations — UNIQUE constraint already in place

---

## 3. `enqueueDerivativeRows` — function spec

### 3.1 Signature

```typescript
export const DERIVATIVE_ROLES = [
  'thumbnail',
  'watermarked_preview',
  'og_image',
] as const
export type DerivativeRole = typeof DERIVATIVE_ROLES[number]

export type EnqueueResult =
  | { kind: 'ok'; rolesInserted: DerivativeRole[] }
  | { kind: 'partial'; rolesInserted: DerivativeRole[]; failures: Array<{ role: DerivativeRole; error: string }> }
  | { kind: 'other'; error: string }

export async function enqueueDerivativeRows(assetId: string): Promise<EnqueueResult>
```

### 3.2 Behavior

**Real mode (Supabase configured):**
- For each role in `DERIVATIVE_ROLES`, INSERT one `asset_media` row with `media_role`, `generation_status = 'pending'`, all other fields NULL (or DB-default)
- On unique-violation (SQLSTATE `23505`), treat as success — the row already exists from a prior commit. The UNIQUE `(asset_id, media_role)` constraint enforces idempotency.
- On other errors per role, accumulate in `failures[]`. Do not abort the loop; insert as many as possible. Result kind = `'partial'` if any failed.
- If the entire operation fails before any insert (e.g. client unavailable), return `kind: 'other'`.

**Mock mode (Supabase not configured):**
- Track `${assetId}:${role}` in an in-memory `Set<string>`
- Replay (same `assetId` second time) returns same `rolesInserted` — replay-safe by design

### 3.3 Idempotency posture

The function is fully idempotent at the (asset_id, role) level. Calling it twice for the same `assetId` is safe; the second call returns `{ kind: 'ok', rolesInserted: [3 roles] }` without creating new rows.

This means PR 3's commit-service hook can fire enqueue without first checking whether rows already exist — the function handles its own idempotency.

### 3.4 No worker invocation

Per the architecture brief §6 and the per-PR plan, PR 3 only inserts pending rows. Nothing reads them until PR 4 activates the worker. Until then, a steady-state DB will accumulate `pending` rows that never transition. This is the documented intended state.

---

## 4. Commit-service hook

### 4.1 Insertion point

After PR 1.3's edits, the relevant block in `commit-service.ts` is:

```typescript
const outcome = await insertDraftAndOriginal(input)
if (outcome.kind === 'ok') {
  return { ok: true, outcome: 'created', assetId }
}
```

The hook adds the enqueue call between `if (outcome.kind === 'ok') {` and the `return`:

```typescript
if (outcome.kind === 'ok') {
  // PR 3 — enqueue derivative pending rows. Failure does NOT roll
  // back the commit per UPLOAD-PR3-AUDIT-2026-04-26.md IP-3.
  // Backfill (PR 6) sweeps any orphan asset that committed but
  // failed to enqueue.
  const enqueueResult = await enqueueDerivativeRows(assetId)
  if (enqueueResult.kind !== 'ok') {
    console.error(
      'commit.enqueue: derivative_enqueue_failed',
      JSON.stringify({
        code: 'derivative_enqueue_failed',
        asset_id: assetId,
        result: enqueueResult,
      }),
    )
  }
  return { ok: true, outcome: 'created', assetId }
}
```

### 4.2 Failure semantics

- Enqueue success → return `{ ok: true, outcome: 'created', assetId }` (unchanged from current behavior)
- Enqueue partial or other → log structured error, **still** return `{ ok: true, outcome: 'created', assetId }`. The asset commit is canonical; the missing pending rows are an operational concern that backfill resolves.
- The route handler observes no difference between full success and enqueue-failed success. The asset_id is returned; preview URLs will 404 until either (a) the missing rows are enqueued by backfill + the worker processes them or (b) the worker activates and the existing rows process.

### 4.3 Where enqueue does NOT happen

Per audit IP-3:
- **Idempotency-replay 'hit' path** (line 143 of commit-service.ts) — does not enqueue. The original commit was responsible. If it failed, backfill resolves.
- **Token-race recovery path** (lines 232-247 of commit-service.ts after PR 1.3's edits) — does not enqueue. The race winner's commit was responsible.

This keeps enqueue tightly coupled to "this commit just created a brand new asset row," which matches the audit's IP-3 intent and avoids double-emitting structured error logs on every replay.

---

## 5. Tests

### 5.1 `enqueue.test.ts` (NEW file)

Per audit IP-5, narrow scope — function-level only. Worker integration tests are PR 4's concern.

| # | Test | Asserts |
|---|---|---|
| 1 | inserts exactly 3 rows for a new asset | `result.kind === 'ok'`; `rolesInserted` contains all 3 roles; mock has 3 entries |
| 2 | replay is idempotent — same call twice returns ok with all 3 roles both times | mock store stays at 3 entries after the second call |
| 3 | replay still reports `rolesInserted: [3 roles]` (not empty) | the contract is "the asset has these pending roles," not "we just inserted these" — replay returns the same shape |
| 4 | DERIVATIVE_ROLES constant exposes exactly the 3 expected roles in order | catches accidental enum drift |
| 5 | enqueue for two distinct assetIds doesn't cross-contaminate | mock has 6 entries (3 per asset), no shared state |

### 5.2 `commit-service.test.ts` extensions

| # | Test | Asserts |
|---|---|---|
| 1 | happy path triggers enqueue | enqueue mock has 3 entries for the committed asset_id |
| 2 | commit failure path (storage write fails) does NOT trigger enqueue | enqueue mock is empty |
| 3 | enqueue failure does NOT roll back the commit | result is `{ ok: true, outcome: 'created', assetId }`; row is persisted; structured error was logged (test captures via console spy or returned shape — pick the simpler assertion) |

### 5.3 Coverage NOT added in PR 3

Per audit IP-5:
- Worker behavior on the pending rows — PR 4
- Backfill behavior — PR 6
- Multi-role processing race conditions — PR 4
- Profile-version handling on watermarked roles — PR 4

---

## 6. Internal consistency checks

- `DERIVATIVE_ROLES` matches the audit's IP-2 resolution (3 roles; no `detail_preview`)
- The Supabase insert path uses NULL for `storage_ref` and `watermark_profile_version` (other columns get DB defaults)
- The unique-violation handler maps SQLSTATE `23505` to "success" (the row exists; that's the intended state)
- The mock store keys by `${assetId}:${role}` to mirror the UNIQUE constraint
- The commit-service hook fires only on `outcome.kind === 'ok'` (the happy path), not on the `'hit'` or token-race paths
- Enqueue failure is logged with the same structured-JSON style used by `compensating_delete_failed` in `route.ts`
- Return value of `commitUpload` is unchanged — no new failure code, no new field. The hook is internally observable only via logs and the actual DB state.

---

## 7. Open items

None remaining. All audit IPs resolved (see audit doc §3).

---

## 8. Approval gate

This plan ratifies in tandem with the audit (`UPLOAD-PR3-AUDIT-2026-04-26.md`). If the audit is ratified, this plan is the implementation companion. Founder can override any audit IP at this gate; otherwise composes-as-written.

---

End of PR 3 implementation plan.
