# Phase 1 — PR 1.2 — /api/v2/batch routes

**Status:** SHIPPED
**Date locked:** 2026-04-17
**Predecessor:** main @ `e1b6ee2` (PR 1.1 merged)
**Scope:** two POST routes + service/store layer. Dormant behind `FFF_REAL_UPLOAD`.

---

## 1. Scope boundary

PR 1.2 **does**:

- Add `POST /api/v2/batch` — create a new `upload_batches` row, returns 201 with id+state+created_at+newsroom_mode
- Add `POST /api/v2/batch/[id]/commit` — atomic `open → committed` state transition, returns 200 with id+state+committed_at
- Add `src/lib/upload/batch-service.ts` — thin orchestration layer (mirrors `commit-service.ts` pattern)
- Add `src/lib/upload/batch-store.ts` — DB boundary with dual-mode (Supabase + in-memory mock, `__testing` surface)
- Add three test files (service unit tests, two route integration tests)
- Both routes gated behind `FFF_REAL_UPLOAD=true` (reuses PR 2's flag — one pipeline, one switch)

PR 1.2 **does not**:

- Touch `vault_assets` — batch_id tagging happens in PR 1.3 when `/api/upload` becomes batch-aware
- Compute a `V2CompletionSummary` — depends on per-asset commit-time validation rules that live in PR 1.3
- Call the 21-arg `upload_commit` RPC — that's PR 1.3's job
- Ship a cancel endpoint — out of scope, the `cancelled` state is added to the enum but only reachable via future work
- Wire any UI component to the routes — PR 1.4+ migrates the v2 simulation
- Add RLS — matches `vault_assets` / `upload_batches` (both service-role-only access)

---

## 2. Files

### 2.1 Add (8)

| Path | Purpose |
|---|---|
| `src/app/api/v2/batch/route.ts` | POST handler — create batch |
| `src/app/api/v2/batch/[id]/commit/route.ts` | POST handler — commit batch |
| `src/lib/upload/batch-service.ts` | Service orchestration (createBatch, commitBatch) |
| `src/lib/upload/batch-store.ts` | DB layer (insertBatch, transitionToCommitted), dual-mode, `__testing` surface |
| `src/lib/upload/__tests__/batch-service.test.ts` | Service unit tests — 8 tests |
| `src/app/api/v2/batch/__tests__/route.test.ts` | Create-route integration tests — 8 tests |
| `src/app/api/v2/batch/[id]/commit/__tests__/route.test.ts` | Commit-route integration tests — 7 tests |
| `src/lib/upload/PR-1.2-PLAN.md` | This plan doc |

### 2.2 Touch

None.

### 2.3 Not touched (explicit)

- `src/lib/upload/upload-store.ts` — PR 2 caller unaffected; the 15-arg `upload_commit` RPC remains the target
- `src/lib/upload/commit-service.ts` — PR 2 orchestration untouched
- `src/app/api/upload/route.ts` — legacy route untouched; PR 1.3 makes it batch-aware
- `src/lib/flags.ts` — reuses existing `isRealUploadEnabled()` rather than minting a new flag

---

## 3. Endpoint contracts

### 3.1 `POST /api/v2/batch`

Request headers:

| Header | Required | Purpose |
|---|---|---|
| `X-Creator-Id` | yes | Placeholder session — same pattern as PR 2's `/api/upload`. Real resolver lands ahead of PR 5 cutover. |
| `Content-Type: application/json` | when body present | |

Request body (optional):

```json
{ "newsroom_mode": false }
```

Empty body is valid — `newsroom_mode` defaults to `false`.

Response 201:

```json
{
  "id": "<uuid>",
  "state": "open",
  "newsroom_mode": false,
  "created_at": "<iso8601>"
}
```

Error responses:

| Status | `code` | Condition |
|---|---|---|
| 503 | `not_enabled` | `FFF_REAL_UPLOAD` not truthy |
| 401 | `unauthenticated` | `X-Creator-Id` missing |
| 400 | `bad_request` | body is malformed JSON, not an object, or `newsroom_mode` is not a boolean |
| 500 | `persistence_failed` | DB error on insert |

### 3.2 `POST /api/v2/batch/[id]/commit`

Request headers:

| Header | Required |
|---|---|
| `X-Creator-Id` | yes |

Request body: none (server has all info from `batch_id` + auth).

Response 200:

```json
{
  "id": "<uuid>",
  "state": "committed",
  "committed_at": "<iso8601>"
}
```

Error responses:

| Status | `code` | Condition |
|---|---|---|
| 503 | `not_enabled` | flag off |
| 400 | `bad_request` | path param is not a UUID |
| 401 | `unauthenticated` | `X-Creator-Id` missing |
| 403 | `forbidden` | batch belongs to a different creator |
| 404 | `not_found` | no batch with that id |
| 409 | `invalid_state` | batch is already `committed` or `cancelled`. Response body includes `current_state`. |
| 500 | `persistence_failed` | DB error |

---

## 4. State transition atomicity

The commit endpoint uses one conditional UPDATE in the store:

```sql
UPDATE upload_batches
SET state = 'committed',
    committed_at = now(),
    updated_at   = now()
WHERE id         = $1
  AND creator_id = $2
  AND state      = 'open'
RETURNING *;
```

Concurrent commit requests for the same batch race for this UPDATE. Exactly one row is returned to the winner; the losers see zero rows and fall through to a disambiguation SELECT that maps the current state to the appropriate error kind (`not_found` / `forbidden` / `invalid_state`).

In-memory mock mirrors the same semantics — a single synchronous map mutation gated on the same three conditions.

No RPC is added for this — the conditional UPDATE gives the atomicity needed, and adding a `commit_upload_batch` plpgsql function would have scope-crept into PR 1.1's schema territory.

---

## 5. Why the service + store split

Mirrors [commit-service.ts](commit-service.ts) / [upload-store.ts](upload-store.ts) from PR 2 for consistency. PR 1.2's orchestration is thinner than PR 2's, but keeping the layering means:

- Tests can inject state through the store's `__testing` surface without routing through HTTP
- A future PR 1.3 commit-summary computation will slot into the service layer without re-shaping the route
- Dual-mode (Supabase + in-memory) stays isolated to one file per domain concern

---

## 6. Decisions (locked 2026-04-17)

| Concern | Decision | Why |
|---|---|---|
| Flag | Reuse `FFF_REAL_UPLOAD` (PR 2's flag) | One pipeline, one switch. Fewer operational variables. Separate flag can split later if staged rollout demands it. |
| Auth | `X-Creator-Id` header (placeholder) | Matches PR 2. Single replacement point when real session resolver lands (one file per endpoint). |
| Idempotency on create | Not implemented | Would require a new `client_batch_token` column + UNIQUE index on `upload_batches`, i.e. PR 1.1 territory. Orphan empty-state batches on network retry are a cheap cleanup concern, not a correctness concern. |
| Response code on create | 201 Created | REST convention for resource creation. Body is the created resource. |
| Concurrency on commit | Conditional UPDATE + post-hoc SELECT | No new RPC — the SQL-level atomicity is sufficient. Adding `commit_upload_batch` plpgsql would have crossed PR 1.1's boundary. |
| `assetCount` in commit response | Omitted | Assets don't carry `batch_id` yet (PR 1.3). Returning `0` would be misleading; returning `null` would pollute the contract. Add it in PR 1.3 when meaningful. |
| UUID validation on path | Regex at the edge | Cheap guardrail against PostgreSQL's uuid-parse-error path. |
| JSON body parsing | Manual check + single `req.json()` | Zod would be a net addition of a dependency for a single boolean field. Inline check is clearer and fails with a precise 400 code. |
| RLS | None | Matches all existing Frontfiles tables. Access is mediated by server routes using the service-role client. |

---

## 7. Verification (per `feedback_local_commit_verification.md`)

| Gate | Expected / Actual |
|---|---|
| Isolated worktree | `git worktree add -B pr-1.2/batch-api-routes /tmp/ff-pr1-2 main` |
| Baseline | `main @ e1b6ee2` (PR 1.1 landed) |
| `bun x tsc --noEmit` | byte-identical to baseline — 11 pre-existing errors unchanged |
| `bun x vitest run` | +23 tests in 3 new files; 0 regressions |
| `git diff --cached --name-status` | 8 files, all `A` |

---

## 8. After PR 1.2 lands

- `/api/v2/batch` URL space exists on disk
- Both endpoints return 503 by default (flag off)
- `upload_batches` insert + state-transition paths are exercised by tests
- Gate for PR 1.3 (legacy `/api/upload` becomes batch-aware, wires 21-arg RPC, drops 15-arg overload) is green
