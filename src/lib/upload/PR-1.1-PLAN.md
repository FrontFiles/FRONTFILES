# Phase 1 — PR 1.1 — Schema + RPC migration

**Status:** SHIPPED
**Date locked:** 2026-04-17
**Predecessor:** main @ `26c31d7` (Phase 0 + PR 2 merged)
**Scope:** one migration SQL file. No app code, no tests, no TS.
**Migration file:** [`supabase/migrations/20260419000001_phase1_upload_batches.sql`](../../../supabase/migrations/20260419000001_phase1_upload_batches.sql)

---

## 1. Scope boundary

PR 1.1 **does**:

- Add one migration SQL file
- Create `upload_batches` table + `upload_batch_state` enum
- Create `duplicate_status` enum
- Add 6 columns + 2 indexes + 1 CHECK to `vault_assets`
- Add a 21-arg overload of `upload_commit` (the 15-arg PR 2 form stays)

PR 1.1 **does not**:

- Touch any TypeScript file
- Touch any test
- Add `/api/v2/batch` routes (PR 1.2)
- Migrate the legacy `/api/upload` caller to the 21-arg RPC (PR 1.3)
- Create `stories` / `story_memberships` tables (later PR 1.X)

---

## 2. Files

### 2.1 Add

| Path | Lines | Purpose |
|---|---|---|
| `supabase/migrations/20260419000001_phase1_upload_batches.sql` | ~165 | Single migration. Reversible rollback block at bottom. |
| `src/lib/upload/PR-1.1-PLAN.md` | this file | Permanent reference for what shipped and why. |

### 2.2 Touch / not touched

Nothing else. PR 2's `upload-store.ts:165` continues to call the 15-arg `upload_commit` and is unaffected.

---

## 3. Decisions (locked 2026-04-17)

Every choice on this PR. Each row pairs with a one-line engineer rationale rather than a `[PROPOSED]` flag.

| Concern | Decision | Why |
|---|---|---|
| `duplicate_status` enum values | `'none' \| 'likely_duplicate' \| 'confirmed_duplicate'` | Verbatim from TS [v2-types.ts:92](v2-types.ts:92). The TS is the canonical domain — DB conforms to it, not the other way around. |
| `MetadataSource` allowed values | `'embedded' \| 'extracted' \| 'ai' \| 'creator'` | Verbatim from TS [v2-types.ts:19](v2-types.ts:19). |
| `metadata_source` tracked fields | 8 keys = `AssetEditableFields` minus self | Computed from TS [v2-types.ts:143](v2-types.ts:143). jsonb shape stores any subset of these as `Partial<>`. |
| `extracted_metadata` field list | 27 keys flattened from TS `ExtractedMetadata` | Verbatim from TS [v2-types.ts:34](v2-types.ts:34). Snake-cased at the wire. |
| `proposal_snapshot` shape | `AssetProposal` snake-cased | Verbatim from TS [v2-types.ts:128](v2-types.ts:128). |
| `duplicate_of_id` wire name | `duplicate_of_id` | Locked hard rule (memory). NOT `duplicate_of_asset_id`. |
| jsonb key casing | snake_case | The `ExtractedMetadataInput` hard rule mandates flat snake_case. Cost is a single camelCase↔snake_case helper at the TS boundary in PR 1.3; benefit is consistent jsonb-path queries (`->>'camera_make'`) and one rule for the whole DB. |
| `upload_batch_state` values | `'open' \| 'committing' \| 'committed' \| 'cancelled'` | Four states are the minimum for the success and abandonment paths. `expired` is deferred — no timeout mechanism is in scope; enums are additive (`ALTER TYPE … ADD VALUE`) so adding it later is cheap. |
| `upload_batches` columns | `id, creator_id, state, newsroom_mode, created_at, updated_at, committed_at, cancelled_at` | Minimal commit-contract surface. `newsroom_mode` is included because TS [v2-types.ts:327](v2-types.ts:327) places it on `V2State.batch` — round-trip rehydration must restore it. No denormalized counts (single source of truth = `COUNT(*) WHERE batch_id = …`). |
| RPC overload strategy | Keep 15-arg PR 2 RPC; add 21-arg as a true overload | PostgreSQL identifies functions by (name, arg-type list) so this is non-breaking. PR 1.3 migrates the one caller and drops the 15-arg form then. Phase boundary preserved — PR 1.1 stays migration-only. |
| Duplicate-consistency CHECK | Included | The TS UI already enforces "`confirmed_duplicate` ⇒ `duplicateOfId IS NOT NULL`." Mirroring it as a CHECK matches the existing `vault_assets` exclusive-lock pattern (multi-column invariant via CHECK) and prevents broken state from any non-TS write path. |
| Migration filename | `20260419000001_phase1_upload_batches.sql` | One day after PR 2's `20260418000001` for clean apply order. `000001` suffix leaves room for companion migrations same day. |
| FK `ON DELETE` clauses | None (default `NO ACTION`) | Matches existing migrations. `duplicate_of_id`'s default specifically prevents deleting an original while a confirmed duplicate references it — desirable. |
| RLS on `upload_batches` | None | Matches `vault_assets` and every other Frontfiles table. All access is mediated by server routes via the service-role client. |

---

## 4. Schema delta — at a glance

```
CREATE TYPE upload_batch_state ENUM (open, committing, committed, cancelled)
CREATE TYPE duplicate_status   ENUM (none, likely_duplicate, confirmed_duplicate)

CREATE TABLE upload_batches (
  id, creator_id, state, newsroom_mode,
  created_at, updated_at, committed_at, cancelled_at
)
INDEX upload_batches_creator_state_idx ON (creator_id, state)

ALTER vault_assets ADD COLUMN
  batch_id            uuid REFERENCES upload_batches(id)
  proposal_snapshot   jsonb
  extracted_metadata  jsonb
  metadata_source     jsonb
  duplicate_status    duplicate_status
  duplicate_of_id     uuid REFERENCES vault_assets(id)

INDEX vault_assets_batch_id_idx       ON (batch_id) WHERE batch_id IS NOT NULL
INDEX vault_assets_duplicate_of_idx   ON (duplicate_of_id) WHERE duplicate_of_id IS NOT NULL

CHECK vault_assets_duplicate_consistency
  duplicate_status <> 'confirmed_duplicate' OR duplicate_of_id IS NOT NULL

CREATE OR REPLACE FUNCTION upload_commit(...21 args...) RETURNS uuid
  -- 15-arg PR 2 version preserved as a separate overload
```

Full SQL with comments, justifications, and rollback block: [migration file](../../../supabase/migrations/20260419000001_phase1_upload_batches.sql).

---

## 5. RPC: 15-arg → 21-arg

15 PR 2 params, in order, then 6 new params **appended** to preserve PR 2 caller compatibility:

| # | Param | Type | Source |
|---|---|---|---|
| 1–15 | (existing) | (existing) | PR 2 — unchanged |
| 16 | `p_batch_id` | `uuid` | NULL-tolerant until 1.3 |
| 17 | `p_proposal_snapshot` | `jsonb` | snake-cased AssetProposal |
| 18 | `p_extracted_metadata` | `jsonb` | snake-cased ExtractedMetadata |
| 19 | `p_metadata_source` | `jsonb` | partial map of editable field → source tag |
| 20 | `p_duplicate_status` | `duplicate_status` enum | scalar (NOT object) |
| 21 | `p_duplicate_of_id` | `uuid` | required when status = `confirmed_duplicate` (CHECK) |

Function body: identical two-row INSERT pattern as PR 2, with the 6 new columns added to the `vault_assets` INSERT only. `asset_media` insert unchanged (per-asset, not per-batch).

---

## 6. Verification (per `feedback_local_commit_verification.md`)

| Gate | Expected |
|---|---|
| Isolated worktree | `git worktree add -B pr-1.1/phase1-upload-batches /tmp/ff-pr1-1 main` |
| Baseline | `main @ 26c31d7` (PR 2 already landed) |
| `bun x tsc --noEmit` delta vs baseline | **zero** — no .ts files changed |
| `bun x vitest run` delta vs baseline | **zero** — no tests added or removed |
| `git diff --cached --name-only` | exactly two files (the migration + this plan) |

---

## 7. After PR 1.1 lands

- `main` advances by one commit
- `vault_assets` has 6 new nullable columns + 2 partial indexes + 1 CHECK
- `upload_batches` exists, empty
- `upload_commit` has two overloads (15-arg + 21-arg)
- PR 2's upload route still resolves to the 15-arg overload — zero behavior change
- Gate for PR 1.2 (`/api/v2/batch` create + commit endpoints) is green
