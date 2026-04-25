# NR-D9a — Pack State-Machine RPC

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D8 (`f97e680`) — embargo configuration
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~5 new + 0 modified files; route count delta 0

---

## 1. Why this directive

NR-D9 splits three ways (per founder ratification): NR-D9a (state-machine RPC), NR-D9b (publish UI flow), NR-D9c (embargo lift worker + subscriber notifications). NR-D9a is the **backend-only** directive — pure SQL + TypeScript wrapper + tests. No UI, no API routes.

NR-D9a ships the canonical state-transition entry point per **PRD §3.3** (state-machine matrix + transition table + publish precondition checklist). Subsequent directives (D9b UI, D9c worker, NR-D10 signing keys, NR-D11 consumer-side) call this RPC to mutate Pack state — no other code path is permitted to write `newsroom_packs.status`.

**Locked architecture (per founder ratification, Option A):**

- PostgreSQL `SECURITY DEFINER` function `newsroom_pack_transition(...)`
- Atomic transactional semantics inside Postgres (no two-INSERT caveat)
- Callable via Supabase `.rpc()` from service-role context
- Application-layer auth (caller admin role verified upstream; user ID passed in as parameter for any audit logging)
- Sets the canonical RPC pattern that v1.1 retrofits onto NR-D7a/D8 compound-write atomicity

**In scope for NR-D9a:**

- 5 transitions: `draft → scheduled`, `draft → published`, `scheduled → draft`, `scheduled → published`, `published → archived`, `archived → published`. Six total transitions (the takedown family is admin-side, NR-D17/D18).
- Precondition checks per PRD §3.3 (line 576): title/credit_line/licence_class set, ≥1 Asset, every Asset `scan_result='clean'`, RightsWarranty confirmed (all 3 true), embargo_id or publish_at set as appropriate, active SigningKey exists.
- Side effects: timestamp updates (published_at, archived_at), embargo state transitions (`active → lifted` on auto-lift; `active → cancelled` on pullback), visibility derivation (status × embargo.state).
- TypeScript wrapper `transitionPack(client, input)` that calls the RPC and types the result.
- Vitest cases for the RPC against the local Supabase stack (real DB integration tests, mirroring NR-D2 test patterns).

**Out of scope (downstream directives):**

- **Rights warranty UI/persistence** — NR-D9b. NR-D9a's RPC reads warranty as a precondition (verifies row exists with all 3 booleans true) but doesn't create it.
- **Publish UI flow + P9 modal + checklist sidebar** — NR-D9b.
- **Embargo lift worker (cron)** — NR-D9c. The worker calls `transitionPack(scheduled → published)` at `publish_at`.
- **Subscriber notifications** — NR-D9c. The RPC's side effects don't fire emails directly; it writes to a notification queue (or fires a row-level hook), and D9c's worker drains.
- **SigningKey check semantics in v1** — RPC checks `EXISTS (SELECT 1 FROM newsroom_signing_keys WHERE status='active')`. Until NR-D10 lands the first active key, all publish transitions fail with `precondition: no-active-signing-key`. Tests in F4 manually INSERT a fake active key to exercise the success paths. Documented as carry-forward for NR-D10.
- **Admin takedown transitions** (`* → takedown`) — admin-side directive (NR-D17/D18); separate RPC.

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | **§3.3 state machine, transition table (line 562), publish precondition checklist (line 576)** verbatim authority |
| Existing migrations | `supabase/migrations/20260425000001_*` through `20260425000006_*` | All current schema; NR-D9a appends a function migration |
| Existing schema.ts | `src/lib/db/schema.ts` | `NewsroomPackRow`, `NewsroomPackStatus`, `NewsroomPackVisibility`, `NewsroomEmbargoRow`, `NewsroomEmbargoState`, `NewsroomScanResult` types |
| Embargo precedent | NR-D8 F5 DELETE | UPDATE state='cancelled' + clear pack.embargo_id pattern — mirrored inside the RPC for `scheduled → draft` transition |

PRD §3.3 is verbatim authority for: transition matrix, precondition checklist, side-effect list. Any deviation is a PRD divergence requiring an IP surface during composition.

---

## 3. AUDIT FIRST — MANDATORY

### Pre-audit findings (verified during drafting)

- (P1) Last migration: confirm via `ls supabase/migrations/`. F1's migration is `20260425000007` (or next sequential — Claude Code's audit confirms).
- (P2) Function precedent: `is_newsroom_admin(uuid)` and `is_newsroom_editor_or_admin(uuid)` (foundation migration line 524) are existing SECURITY DEFINER STABLE functions. Mirror their style + auth posture for the new transition function.
- (P3) Pack table CHECK constraints (foundation migration line 316–349): the RPC's UPDATE writes must not violate `newsroom_packs_status_visibility_coherence`, `newsroom_packs_published_at_coherence`, etc. The RPC computes the new (status, visibility, timestamps) tuple consistent with these CHECKs.

### Audit checks to run

#### (a) Next migration number
- `ls supabase/migrations/` → confirm next sequential. F1 + F2 use that number with `_pack_transition_rpc` suffix.

#### (b) Existing helper functions style
- Read `is_newsroom_editor_or_admin` body. Confirm SECURITY DEFINER + STABLE + `SET search_path = public, pg_temp` pattern. Mirror in the new function.

#### (c) RightsWarranty schema confirmation
- Confirm `newsroom_rights_warranties` table from NR-D2a (or wherever it landed): columns `pack_id (FK 1:1), subject_releases_confirmed, third_party_content_cleared, music_cleared, narrative_text, confirmed_by_user_id, confirmed_at`. PRD §3.2 line 354 is canonical.
- The RPC's `draft → scheduled` precondition reads this row: `EXISTS + all 3 booleans true`. If schema diverges from PRD, surface as IP.

#### (d) SigningKey table confirmation
- Confirm `newsroom_signing_keys` table exists with `status` column accepting `'active'`. RPC checks `EXISTS (SELECT 1 ... WHERE status='active')`.

#### (e) Visibility derivation
- PRD §3.3 line 553 spec: `draft → private`, `scheduled+embargo.active → restricted`, `scheduled+no embargo → private`, `published → public`, `archived → public`, `takedown → tombstone`. Confirm this is the exact derivation; surface as IP if PRD updated.

#### (f) Notification queue / hook for D9c
- Decision: does NR-D9a write to a notification queue (e.g., a new table `newsroom_notification_pending`) for D9c to drain, OR does it leave the trigger as "the row's `published_at` going from NULL to non-NULL is the signal D9c queries on"?
- **Recommended Option B (signal via row state):** simpler v1; D9c's worker queries `newsroom_packs WHERE published_at >= last_run_at AND notify_subscribers = true`. No new queue table. Surface as IP if a queue is preferred.

#### (g) RPC return shape
- Return a structured row: `{ ok bool, new_status, new_visibility, new_published_at, error_code text, missing_preconditions text[] }`. Caller can interpret for UI surfacing in D9b.

### Audit deliverable

Findings table + IPs + locked file list. HALT before composing if any IP surfaces.

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| F1 | `supabase/migrations/{NEXT}_newsroom_pack_transition_rpc.sql` | NEW — SECURITY DEFINER function `newsroom_pack_transition(pack_id, target_status, caller_user_id, override_embargo_cancellation)` | ~280 |
| F2 | `supabase/migrations/_rollbacks/{NEXT}_newsroom_pack_transition_rpc.DOWN.sql` | NEW — DROP FUNCTION | ~10 |
| F3 | `src/lib/newsroom/pack-transition.ts` | NEW — `transitionPack(client, input)` wrapper + types: `TransitionInput`, `TransitionResult`, `TransitionErrorCode`. **Renamed from `state-machine.ts` per IP-1 audit:** NR-D4 already owns `state-machine.ts` as the pure validator (`canTransition`, `deriveVisibility`, `isTerminalStatus`) used by UI; NR-D9a's RPC wrapper is the executor — distinct concerns must not share a file (forcing `'server-only'` would break NR-D4's UI consumers). | ~140 |
| F4 | `src/lib/newsroom/__tests__/pack-transition.test.ts` | NEW — vitest cases against local Supabase stack: each transition success path + each precondition failure. Renamed per IP-1. | ~280 |
| ~~F5~~ | ~~`src/lib/db/schema.ts`~~ | **SKIPPED** — `TransitionResult` composes from existing schema.ts exports (`NewsroomPackStatus`, `NewsroomPackVisibility`); F3 builds the discriminated union inline. | — |

Totals: 4 NEW = 4 conceptual deliverables; +0 routes. Final commit = 6 paths (4 deliverables + directive + exit report).

**Note: this is the smallest directive in the entire NR build.** All other distributor directives have UI surfaces; NR-D9a is pure backend.

---

## 5. F-specs

### F1 — `{NEXT}_newsroom_pack_transition_rpc.sql` (NEW)

```sql
-- Pack state-machine transition RPC.
-- Sole authoritative entry point for newsroom_packs.status mutations
-- (excluding admin takedown — NR-D17/D18). Atomicity guaranteed by
-- single-transaction execution inside the function body.

CREATE OR REPLACE FUNCTION newsroom_pack_transition(
  p_pack_id                     uuid,
  p_target_status               newsroom_pack_status,
  p_caller_user_id              uuid,
  p_override_embargo_cancel     boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pack            newsroom_packs%ROWTYPE;
  v_embargo         newsroom_embargoes%ROWTYPE;
  v_warranty        newsroom_rights_warranties%ROWTYPE;
  v_asset_count     integer;
  v_unclean_count   integer;
  v_signing_active  boolean;
  v_new_visibility  newsroom_pack_visibility;
  v_now             timestamptz := now();
  v_missing         text[]      := ARRAY[]::text[];
BEGIN
  -- 1. Load the pack with FOR UPDATE lock (serializes concurrent transitions)
  SELECT * INTO v_pack
    FROM newsroom_packs
   WHERE id = p_pack_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'pack-not-found');
  END IF;

  -- 2. Reject illegal source→target combos
  IF NOT (
    -- draft → scheduled
    (v_pack.status = 'draft'      AND p_target_status = 'scheduled')
    OR (v_pack.status = 'draft'      AND p_target_status = 'published')
    OR (v_pack.status = 'scheduled'  AND p_target_status = 'draft')
    OR (v_pack.status = 'scheduled'  AND p_target_status = 'published')
    OR (v_pack.status = 'published'  AND p_target_status = 'archived')
    OR (v_pack.status = 'archived'   AND p_target_status = 'published')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'illegal-transition',
      'from', v_pack.status,
      'to',   p_target_status
    );
  END IF;

  -- 3. Per-transition precondition checks
  IF p_target_status IN ('scheduled', 'published') AND v_pack.status = 'draft' THEN
    -- Required Pack fields (PRD §3.3 publish checklist #1)
    IF v_pack.title IS NULL OR v_pack.title = '' THEN v_missing := v_missing || 'title'; END IF;
    IF v_pack.credit_line IS NULL OR v_pack.credit_line = '' THEN v_missing := v_missing || 'credit_line'; END IF;

    -- ≥1 Asset (#2)
    SELECT COUNT(*) INTO v_asset_count FROM newsroom_assets WHERE pack_id = p_pack_id;
    IF v_asset_count = 0 THEN v_missing := v_missing || 'no_assets'; END IF;

    -- Every Asset image has alt_text (#3)
    -- (Counted as 'asset_alt_text_missing' if any image asset has NULL/empty alt_text)
    PERFORM 1 FROM newsroom_assets
      WHERE pack_id = p_pack_id AND kind = 'image' AND (alt_text IS NULL OR alt_text = '');
    IF FOUND THEN v_missing := v_missing || 'asset_alt_text_missing'; END IF;

    -- Every Asset scan_result = 'clean' (#4)
    SELECT COUNT(*) INTO v_unclean_count
      FROM newsroom_asset_scan_results sr
      JOIN newsroom_assets a ON a.id = sr.asset_id
     WHERE a.pack_id = p_pack_id AND sr.result <> 'clean';
    IF v_unclean_count > 0 THEN v_missing := v_missing || 'asset_scan_pending_or_flagged'; END IF;

    -- RightsWarranty confirmed (#5)
    SELECT * INTO v_warranty FROM newsroom_rights_warranties WHERE pack_id = p_pack_id;
    IF NOT FOUND
      OR NOT v_warranty.subject_releases_confirmed
      OR NOT v_warranty.third_party_content_cleared
      OR NOT v_warranty.music_cleared
    THEN
      v_missing := v_missing || 'rights_warranty_missing_or_incomplete';
    END IF;

    -- Active SigningKey exists (#7)
    SELECT EXISTS (SELECT 1 FROM newsroom_signing_keys WHERE status = 'active') INTO v_signing_active;
    IF NOT v_signing_active THEN v_missing := v_missing || 'no_active_signing_key'; END IF;

    -- For 'scheduled': either embargo_id or publish_at set
    IF p_target_status = 'scheduled' AND v_pack.embargo_id IS NULL AND v_pack.publish_at IS NULL THEN
      v_missing := v_missing || 'scheduled_requires_embargo_or_publish_at';
    END IF;

    -- For 'published' (immediate): no embargo, no publish_at
    IF p_target_status = 'published'
       AND (v_pack.embargo_id IS NOT NULL OR v_pack.publish_at IS NOT NULL)
    THEN
      v_missing := v_missing || 'immediate_publish_disallows_embargo_or_publish_at';
    END IF;

    IF array_length(v_missing, 1) > 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'preconditions-not-met',
        'missing_preconditions', v_missing
      );
    END IF;
  END IF;

  -- 4. scheduled → draft pullback: embargo cancellability check (PRD §3.3 line 567)
  IF v_pack.status = 'scheduled' AND p_target_status = 'draft' AND v_pack.embargo_id IS NOT NULL THEN
    PERFORM 1 FROM newsroom_embargo_recipients
      WHERE embargo_id = v_pack.embargo_id AND access_count > 0;
    IF FOUND AND NOT p_override_embargo_cancel THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'embargo-already-accessed',
        'hint', 'Pass p_override_embargo_cancel=true to override.'
      );
    END IF;
  END IF;

  -- 5. Apply the transition + side effects per PRD §3.3 lines 565–571
  -- (All UPDATEs in single transaction; CHECK constraints enforce coherence)

  IF v_pack.status = 'draft' AND p_target_status = 'scheduled' THEN
    -- Embargo state → 'active' if embargo set; else stays NULL (no embargo row to update)
    IF v_pack.embargo_id IS NOT NULL THEN
      UPDATE newsroom_embargoes SET state = 'active' WHERE id = v_pack.embargo_id;
      v_new_visibility := 'restricted';
    ELSE
      v_new_visibility := 'private';
    END IF;
    UPDATE newsroom_packs
       SET status = 'scheduled', visibility = v_new_visibility, updated_at = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'draft' AND p_target_status = 'published' THEN
    UPDATE newsroom_packs
       SET status = 'published', visibility = 'public', published_at = v_now, updated_at = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'scheduled' AND p_target_status = 'draft' THEN
    IF v_pack.embargo_id IS NOT NULL THEN
      UPDATE newsroom_embargoes
         SET state = 'cancelled', cancelled_at = v_now
       WHERE id = v_pack.embargo_id;
      UPDATE newsroom_packs
         SET status = 'draft', visibility = 'private', embargo_id = NULL, updated_at = v_now
       WHERE id = p_pack_id;
    ELSE
      UPDATE newsroom_packs
         SET status = 'draft', visibility = 'private', updated_at = v_now
       WHERE id = p_pack_id;
    END IF;

  ELSIF v_pack.status = 'scheduled' AND p_target_status = 'published' THEN
    -- Auto-lift or manual early lift. Side effect: embargo → 'lifted'
    IF v_pack.embargo_id IS NOT NULL THEN
      UPDATE newsroom_embargoes
         SET state = 'lifted', lifted_at = v_now
       WHERE id = v_pack.embargo_id;
    END IF;
    UPDATE newsroom_packs
       SET status = 'published',
           visibility = 'public',
           published_at = COALESCE(v_pack.publish_at, v_now),
           updated_at = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'published' AND p_target_status = 'archived' THEN
    UPDATE newsroom_packs
       SET status = 'archived', visibility = 'public', archived_at = v_now, updated_at = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'archived' AND p_target_status = 'published' THEN
    UPDATE newsroom_packs
       SET status = 'published', visibility = 'public', archived_at = NULL, updated_at = v_now
     WHERE id = p_pack_id;
  END IF;

  -- 6. Re-fetch the post-update pack for return shape
  SELECT * INTO v_pack FROM newsroom_packs WHERE id = p_pack_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_status', v_pack.status,
    'new_visibility', v_pack.visibility,
    'new_published_at', v_pack.published_at,
    'new_archived_at', v_pack.archived_at
  );
END;
$$;

-- Permissions: callable by service-role only (no GRANT to authenticated/anon)
REVOKE ALL ON FUNCTION newsroom_pack_transition FROM PUBLIC;

COMMENT ON FUNCTION newsroom_pack_transition IS
  'Sole authoritative entry point for newsroom_packs.status transitions '
  '(excluding admin takedown). Atomic transactional execution. '
  'Application-layer auth: caller must be admin of pack.company_id; '
  'caller_user_id passed for any future audit logging. '
  'Returns jsonb with ok bool + new_* state on success, or '
  'error_code + missing_preconditions[] on failure. See PRD §3.3.';
```

### F2 — Rollback (NEW)

```sql
DROP FUNCTION IF EXISTS newsroom_pack_transition(uuid, newsroom_pack_status, uuid, boolean);
```

### F3 — `pack-transition.ts` (NEW, renamed per IP-1)

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  NewsroomPackStatus,
  NewsroomPackVisibility,
} from '@/lib/db/schema'

export type TransitionErrorCode =
  | 'pack-not-found'
  | 'illegal-transition'
  | 'preconditions-not-met'
  | 'embargo-already-accessed'

export interface TransitionInput {
  packId: string
  targetStatus: NewsroomPackStatus
  callerUserId: string
  overrideEmbargoCancel?: boolean
}

export type TransitionResult =
  | {
      ok: true
      newStatus: NewsroomPackStatus
      newVisibility: NewsroomPackVisibility
      newPublishedAt: string | null
      newArchivedAt: string | null
    }
  | {
      ok: false
      errorCode: TransitionErrorCode
      missingPreconditions?: ReadonlyArray<string>
      from?: NewsroomPackStatus
      to?: NewsroomPackStatus
      hint?: string
    }

export async function transitionPack(
  client: SupabaseClient,
  input: TransitionInput,
): Promise<TransitionResult> {
  const { data, error } = await client.rpc('newsroom_pack_transition', {
    p_pack_id: input.packId,
    p_target_status: input.targetStatus,
    p_caller_user_id: input.callerUserId,
    p_override_embargo_cancel: input.overrideEmbargoCancel ?? false,
  })

  if (error) {
    throw new Error(`transitionPack RPC error: ${error.message}`)
  }

  // RPC returns jsonb; client receives as parsed JSON object
  return data as TransitionResult
}
```

### F4 — `pack-transition.test.ts` (NEW, renamed per IP-1)

Vitest. Sets up a real Supabase test fixture (mirrors the migration test pattern from NR-D2). Each test case:

1. **draft → scheduled (success)** — fully populated pack + assets clean + warranty + active key + embargo set. Asserts `ok: true, newStatus: 'scheduled', newVisibility: 'restricted'`.
2. **draft → scheduled (no embargo, publish_at set)** — same but publish_at instead of embargo. Asserts `newVisibility: 'private'`.
3. **draft → published (success)** — fully populated, no embargo, no publish_at. Asserts `newStatus: 'published', newVisibility: 'public', newPublishedAt: ~now`.
4. **draft → scheduled (missing title)** — `ok: false, errorCode: 'preconditions-not-met', missingPreconditions: ['title']`.
5. **draft → scheduled (no assets)** — `missingPreconditions: ['no_assets']`.
6. **draft → scheduled (image asset missing alt_text)** — `missingPreconditions: ['asset_alt_text_missing']`.
7. **draft → scheduled (asset scan pending)** — `missingPreconditions: ['asset_scan_pending_or_flagged']`.
8. **draft → scheduled (warranty incomplete)** — `missingPreconditions: ['rights_warranty_missing_or_incomplete']`.
9. **draft → scheduled (no signing key)** — `missingPreconditions: ['no_active_signing_key']`.
10. **draft → scheduled (no embargo, no publish_at)** — `missingPreconditions: ['scheduled_requires_embargo_or_publish_at']`.
11. **draft → published (with embargo set)** — `missingPreconditions: ['immediate_publish_disallows_embargo_or_publish_at']`.
12. **scheduled → draft (no recipient access)** — success. Asserts embargo state='cancelled', pack.embargo_id=NULL.
13. **scheduled → draft (with recipient access, no override)** — `errorCode: 'embargo-already-accessed'`.
14. **scheduled → draft (with recipient access, override=true)** — success.
15. **scheduled → published (auto-lift)** — success. Asserts embargo state='lifted'.
16. **published → archived** — success. Asserts archived_at set.
17. **archived → published** — success. Asserts archived_at NULL.
18. **published → draft (illegal)** — `errorCode: 'illegal-transition'`.
19. **draft → archived (illegal)** — `errorCode: 'illegal-transition'`.
20. **takedown → anything (illegal)** — `errorCode: 'illegal-transition'`. (Takedown is NR-D17 territory; D9a doesn't enable transitions out.)

Aim for ~20 cases. Test fixture setup helper creates a verified company + admin user + pack + assets + scan_results + warranty + active signing key. Each test reuses the helper with field overrides.

### F5 — `schema.ts` (CONDITIONAL EDIT)

If the audit confirms the existing types compose to `TransitionResult` cleanly, skip. Otherwise append. Most likely skip — F3's union is built from existing exports.

---

## 6. New env vars

None.

---

## 7. VERIFY block

1. Migration apply: `bun run supabase db reset` exits 0; the new function is callable.
2. `bun run typecheck` exit 0.
3. `bunx vitest run src/lib/newsroom/__tests__/state-machine.test.ts` — all 20 cases green.
4. `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full suite green; prior 259/259 still passing.
5. `bun run build` exit 0; route count unchanged at 114.
6. Function inspection: `psql -c "\df newsroom_pack_transition"` confirms SECURITY DEFINER + signature.
7. Rollback smoke: apply DOWN migration, confirm function gone; re-apply UP, confirm restored.
8. CHECK-constraint smoke: attempt a manual UPDATE on `newsroom_packs.status` outside the RPC (e.g., via raw SQL with service-role), confirm CHECK constraints still fire. The RPC enforces the *transition* policy, but the table's existing CHECKs enforce *coherence*. Both must hold.
9. Scope diff: `git status --porcelain` shows exactly 4 paths (post-IP-1 rename + F5 SKIP).

---

## 8. Exit report mandate

`docs/audits/NR-D9a-state-machine-rpc-EXIT-REPORT.md`. Standard sections. Founder ratifies before commit.

---

## 9. Standing carry-forward checks

- Audit-first IP discipline.
- SECURITY DEFINER function with `SET search_path = public, pg_temp` — security hardening pattern.
- REVOKE EXECUTE FROM PUBLIC after CREATE FUNCTION (matches v1.1 backlog item; apply in NR-D9a's migration directly so the pattern's right from the start).
- Canonical state-transition entry point — D9b/D9c/NR-D10/NR-D11 all call this RPC; no direct UPDATE on `newsroom_packs.status` permitted.
- PRD §3.3 verbatim authority for transitions, preconditions, side effects.
- Atomicity inside the function body (single transaction); v1.1 retrofit of NR-D7a/D8 compound writes follows this pattern.
- Tight per-directive commits; selective add of exactly 4 deliverables + directive + exit report = 6 paths total (post-IP-1).
- **Two sources of truth on the transition matrix** — NR-D4's `canTransition()` validator (UI side) + NR-D9a's PG IF/ELSIF tree (server side). Hand-synced for v1. v1.1 backlog candidate: codegen one from the other or share a JSON manifest. Add to DIRECTIVE_SEQUENCE.md backlog at exit-report time.

---

## 10. Predecessor sequence

NR-D8 (`f97e680`) → **NR-D9a — this directive** → NR-D9b (publish UI flow) → NR-D9c (lift worker + notifications) → NR-D10 (signing keys + receipts + KMS) → NR-G2 phase gate.

---

End of NR-D9a directive.
