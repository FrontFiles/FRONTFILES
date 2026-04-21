# P4 Concern 1 — Trigger Race Follow-Up Directive

**Status.** Drafted 2026-04-21 on top of `feat/p4-economic-cutover` commit `468a3a0` (P4 Concern 4A.1 follow-on corrections). Closes P4 Concern 4A.1 exit-report open items (a) and (g). Design lock §6.1b remediation. **Load-bearing for 4A.2** — must land before 4A.2 dispatches its first write-path route. Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Surgical fix of the concurrent-insert race in `enforce_ledger_hash_chain()` (concern-1 defect flagged in `P4_CONCERN_4_DESIGN_LOCK.md` §6.1b) **plus** correction of the D8 mismatch in `src/lib/auth/require-actor.ts` (`'use server'` → `import 'server-only'`). One concern, one exit report. No other scope.

**Cross-references.**
`docs/audits/P4_CONCERN_4_DESIGN_LOCK.md` §6.1 (writer contract), §6.1a (atomicity via RPC), **§6.1b (concern-1 defect flag — this directive closes it)**; `docs/audits/P4_CONCERN_4A_1_DIRECTIVE.md` §DECISIONS D8 (`import 'server-only'` over `'use server'` for internal server helpers), §EXIT REPORT open items (a) concurrent-insert race and (g) `require-actor.ts` D8 mismatch; 4A.1 commit `121dd4a` + follow-on `468a3a0`; `docs/specs/ECONOMIC_FLOW_v1.md` §8.3 (storage shape + hash preimage), §8.5 (atomicity), §8.6 (payload versioning); `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql` L222-243 (`ledger_events` table shape), L427-468 (`enforce_ledger_hash_chain()` trigger body — **not modified by this directive**), L642-750 (inline `DO $verify$` assertion precedent); `supabase/migrations/20260421000005_seed_system_actor.sql` (system actor seed — unrelated to this fix, cited for slot context).

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: P4 Concern 1 — Trigger-Race Follow-Up
       (closes 4A.1 exit-report open items (a) + (g); required
       before 4A.2 dispatches its first write-path route)

SCOPE
You are closing a concern-1 defect flagged in
docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1b, plus the D8 mismatch
open-itemed in the 4A.1 exit report as item (g). Surgical scope.

Two changes, one commit:

  (1) New migration 20260421000006_ledger_events_unique_prev_hash.sql
      Adds UNIQUE INDEX on (thread_type, thread_id, prev_event_hash)
      NULLS NOT DISTINCT. Closes the BEFORE-INSERT-trigger race under
      read-committed isolation: two concurrent inserts on the same
      thread both read the same latest_hash, both pass trigger
      validation, and then one fails at INSERT time with SQLSTATE
      23505 instead of forking the chain.

  (2) Writer error classification — src/lib/ledger/writer.ts
      Adds CONCURRENT_CHAIN_ADVANCE to EmitEventResult.reason. Maps
      SQLSTATE 23505 + index-name substring to the new reason.
      Distinct from HASH_CHAIN_VIOLATION (23514 = programmer-error
      stale prev), identical retry semantics at the caller.

  (3) Directive mismatch cleanup — src/lib/auth/require-actor.ts
      Swaps 'use server' for `import 'server-only'` (D8 parallel to
      writer.ts). JSDoc rewritten to cite D8 rationale.

Explicit narrowing:
  - ZERO changes to enforce_ledger_hash_chain() trigger body. The
    UNIQUE index supplements the trigger; does not replace it.
  - ZERO changes to any existing migration. New migration only.
  - ZERO changes to src/lib/ledger/ beyond writer.ts edits + writer
    test additions.
  - ZERO changes to the 4A.1 feature flag scaffolding.
  - ZERO changes to the atomicity utility RPC rpc_append_ledger_event.
  - ZERO route handlers, ZERO replacement pages.
  - require-actor.ts edit is L1 directive + JSDoc ONLY. The four
    outcomes (FEATURE_DISABLED / UNAUTHENTICATED / ACTOR_NOT_FOUND /
    ok) and their runtime logic stay intact. Existing
    require-actor tests must pass unchanged.

GATE
Do not open, read, or modify any file outside the paths listed in
§DELIVERABLES. You may read any spec or audit doc for context; do
not modify them. Do not touch the 13 retiring route files under
src/app/api/special-offer/** or src/app/api/assignment/** — those
retire under 4B.

If any precondition below mismatches, STOP and report. Do not
attempt workarounds.

PRECONDITIONS (verify in order; stop at first failure)
 1. On branch feat/p4-economic-cutover. If not, stop.
 2. `git status` is clean (no uncommitted changes, no stray files).
    Any deviation → stop.
 3. HEAD is commit f513933 (docs-only: this directive file, draft 1,
    on top of 468a3a03dbfd324cde95b0d26bfe6ce52b3e1155 — the 4A.1
    follow-on corrections commit). The only delta between
    468a3a0 and f513933 is the addition of
    docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md; no code,
    schema, or config change. Cite the actual full HEAD SHA in
    the exit report. If HEAD is not f513933 (or has any commits
    beyond f513933), stop and report — state has drifted and the
    directive must be re-validated before execution.
 4. `bun run test` reports 1103 passed | 10 skipped | 0 failed (the
    baseline after 468a3a0). Report actual counts. Any failure or
    file-load error → stop.
 5. `bun run build` completes green. Report the final "Compiled
    successfully" line.
 6. `bun run typecheck` completes with zero output. If the typecheck
    script is missing or fails, stop.
 7. Postgres version preflight via local Supabase:
      SELECT version();
    Must report PostgreSQL 15.0 or higher. NULLS NOT DISTINCT on
    UNIQUE indexes is a PG15+ feature. If PG < 15, STOP — do not
    implement a fallback; founder will decide scope.
 8. `src/lib/auth/require-actor.ts` L1 is literally the string
    `'use server'`. If not, stop — state has drifted.
 9. `src/lib/ledger/writer.ts` L1 is literally `import 'server-only'`.
    If not, stop — state has drifted.
10. `supabase/migrations/20260421000006*.sql` does NOT exist. Any
    file occupying that slot → stop.
11. `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`
    L442-446 RAISE text matches exactly:
      RAISE EXCEPTION
        'ledger_events hash-chain violation: expected prev_event_hash=%, got %',
        latest_hash, NEW.prev_event_hash
        USING ERRCODE = 'check_violation';
    If the trigger body has drifted, stop — the writer's matcher
    grounding assumption is broken.
12. `docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` exists on
    disk (this file). If not, stop.
13. `ledger_events` table has zero rows. Verify via
    `SELECT count(*) FROM public.ledger_events;`. The migration's
    inline assertion block creates and deletes its own test rows;
    a non-empty baseline is not blocking but must be cited in the
    exit report.

DELIVERABLES (4 files; 1 NEW migration, 2 EDITs, 1 EDIT test)

  NEW  supabase/migrations/20260421000006_ledger_events_unique_prev_hash.sql
       UNIQUE INDEX on (thread_type, thread_id, prev_event_hash)
       NULLS NOT DISTINCT + inline assertion block proving the
       constraint fires SQLSTATE 23505 when two rows with the same
       key are inserted (trigger temporarily disabled for the
       assertion).

  EDIT src/lib/ledger/writer.ts
       - Extend EmitEventResult.reason union with
         'CONCURRENT_CHAIN_ADVANCE'.
       - Add CONCURRENT_INSERT_SQLSTATE + CONCURRENT_INSERT_INDEX_NAME
         constants.
       - Add isConcurrentChainAdvance() classifier matching SQLSTATE
         AND index-name substring (both conditions).
       - Order the classifier: CONCURRENT_CHAIN_ADVANCE before
         HASH_CHAIN_VIOLATION before INSERT_FAILED fallback.
       - Update the "─── Trigger error matchers ───" docblock to
         cite the new migration and the three-way classification.

  EDIT src/lib/ledger/tests/writer.test.ts
       Two new `it()` cases:
         (a) 23505 + ledger index name → CONCURRENT_CHAIN_ADVANCE
         (b) 23505 + different index name → INSERT_FAILED
       (b) is load-bearing: it proves plain-SQLSTATE matching is
       insufficient and that the classifier scopes to the specific
       ledger_events index.

  EDIT src/lib/auth/require-actor.ts
       - L1: `'use server'` → `import 'server-only'`.
       - JSDoc at L46-49: rewrite as a D8-parallel block citing
         P4_CONCERN_4A_1_DIRECTIVE.md §DECISIONS D8. Specifically:
         require-actor is an internal server-side helper called by
         route handlers, not a Server Function surface. `'use server'`
         would wrongly mark `requireActor()` as a Server Function
         callable from client components. `import 'server-only'`
         raises a build error if any client component imports the
         module — the correct sentinel.
       - NO OTHER CHANGES in this file. Runtime behavior is identical.
       - Existing require-actor test file must pass unchanged.

IMPLEMENTATION STEPS (in order)

Step 1 — Write the migration
Read supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
L222-243 (ledger_events table shape) and L642-750 (inline assertion
precedent using `DO $verify$ ... $verify$`). Mirror that precedent.

Create supabase/migrations/20260421000006_ledger_events_unique_prev_hash.sql:

  A. Header comment. Must cite:
     - design lock §6.1b (the defect being closed)
     - 4A.1 exit report open items (a) and (g)
     - migration 20260421000004 L427-468 (the trigger this
       constraint supplements, NOT replaces)
     - spec §8.3 (hash-chain storage shape)
     A plain-English explanation of the defect and the fix:
     (1) Trigger does `SELECT ... FOR UPDATE LIMIT 1` on the thread
         tail. Under read-committed, two concurrent inserts can both
         see the same latest_hash, both pass validation, both
         compute event_hash, both commit — forking the chain.
     (2) UNIQUE (thread_type, thread_id, prev_event_hash) makes the
         second commit impossible: Postgres B-tree uniqueness is
         transactional, the second INSERT fails at INSERT time with
         SQLSTATE 23505 (unique_violation).
     (3) NULLS NOT DISTINCT required because the first event on a
         thread has prev_event_hash = NULL; without this clause, two
         concurrent first-event inserts both have NULL prev and
         would NOT collide under the default NULLS DISTINCT
         semantics.

  B. Wrap the migration body in `BEGIN; ... COMMIT;` per precedent.

  C. Index statement (idempotent):
       CREATE UNIQUE INDEX IF NOT EXISTS
         ledger_events_thread_prev_hash_unique
         ON public.ledger_events (thread_type, thread_id, prev_event_hash)
         NULLS NOT DISTINCT;

  D. Inline assertion block (`DO $verify$ ... $verify$;`) that:
     1. Inserts a disposable actor_handle (auth_user_id = NULL).
     2. Picks a fresh test_thread := gen_random_uuid().
     3. ALTER TABLE public.ledger_events DISABLE TRIGGER
        trg_ledger_events_hash_chain — so the assertion can insert
        two rows with the same prev_event_hash without the trigger
        catching the second one as a hash-chain violation (23514)
        before the UNIQUE index gets a chance to fire 23505.
     4. INSERT row 1: prev_event_hash = NULL, manual event_hash
        (trigger is disabled so the computed-hash default is not
        populated; supply a placeholder text like 'manual-hash-1').
     5. In a BEGIN / EXCEPTION / END block: INSERT row 2 with the
        same (thread_type, thread_id, prev_event_hash) — expect
        SQLSTATE 23505. Capture via `EXCEPTION WHEN unique_violation`.
        If row 2 inserts successfully, RAISE EXCEPTION — the UNIQUE
        did not fire.
     6. Re-enable the trigger: ALTER TABLE ... ENABLE TRIGGER ...
     7. Cleanup: DELETE the inserted row 1 + the disposable actor
        (order matters: actor_handle ON DELETE RESTRICT on
        ledger_events.actor_ref forces events-first).
     8. RAISE NOTICE confirming the fix is verified.

     IMPORTANT: if any step fails mid-block, the RAISE EXCEPTION
     aborts the migration txn and the whole thing rolls back —
     including the ALTER TABLE trigger toggle. No manual re-enable
     needed on the failure path.

  E. End with `COMMIT;`.

Step 2 — Writer unit edits
In src/lib/ledger/writer.ts:

  (a) Extend the EmitEventResult reason union:
        | 'PAYLOAD_VALIDATION_FAILED'
        | 'HASH_CHAIN_VIOLATION'
        | 'CONCURRENT_CHAIN_ADVANCE'    // NEW — added by concern-1 follow-up
        | 'INSERT_FAILED'

  (b) Add constants alongside the existing trigger-matcher constants
      (L105-107 in the 468a3a0 snapshot):
        const CONCURRENT_INSERT_SQLSTATE = '23505'
        const CONCURRENT_INSERT_INDEX_NAME =
          'ledger_events_thread_prev_hash_unique'

  (c) Add the classifier near isHashChainViolation:
        function isConcurrentChainAdvance(err: RpcErrorLike): boolean {
          if (err.code !== CONCURRENT_INSERT_SQLSTATE) return false
          const msg = err.message?.toLowerCase() ?? ''
          return msg.includes(CONCURRENT_INSERT_INDEX_NAME.toLowerCase())
        }

      Both conditions MUST hold. Plain SQLSTATE is unsafe — every
      UNIQUE constraint in the schema raises 23505. The index-name
      substring scopes the classifier to the specific ledger_events
      index.

  (d) In the error branch of emitEvent(), classify in this order:
        if (error) {
          if (isConcurrentChainAdvance(error as RpcErrorLike)) {
            return { ok: false, reason: 'CONCURRENT_CHAIN_ADVANCE',
                     detail: error.message }
          }
          if (isHashChainViolation(error as RpcErrorLike)) {
            return { ok: false, reason: 'HASH_CHAIN_VIOLATION',
                     detail: error.message }
          }
          return { ok: false, reason: 'INSERT_FAILED',
                   detail: error.message }
        }

      Race classification first, then programmer-error (trigger),
      then fallback. In practice the trigger fires BEFORE INSERT so
      only one path surfaces per error, but the ordering is robust.

  (e) Update the "─── Trigger error matchers ───" docblock to:
        - Cite SQLSTATE 23514 → HASH_CHAIN_VIOLATION (trigger
          programmer-error stale prev)
        - Cite SQLSTATE 23505 + index name → CONCURRENT_CHAIN_ADVANCE
          (concurrent-insert race closed by migration
          20260421000006)
        - Anything else → INSERT_FAILED
        - Note: caller retry semantics identical for 23514 and
          23505 (both mean "stale prev, re-read tail and retry");
          the distinction is preserved for observability
          (programmer-error bug rate vs legitimate race rate).

Step 3 — Writer tests
In src/lib/ledger/tests/writer.test.ts, add two `it()` cases
mirroring the existing "classifies the trigger RAISE as
HASH_CHAIN_VIOLATION" case shape:

  (a) "classifies unique-violation on the ledger prev-hash index
       as CONCURRENT_CHAIN_ADVANCE":
       stub error = {
         code: '23505',
         message: 'duplicate key value violates unique constraint
                   "ledger_events_thread_prev_hash_unique"'
       }
       expect result.reason === 'CONCURRENT_CHAIN_ADVANCE'

  (b) "classifies unique-violations from unrelated constraints as
       INSERT_FAILED (not CONCURRENT_CHAIN_ADVANCE)":
       stub error = {
         code: '23505',
         message: 'duplicate key value violates unique constraint
                   "actor_handles_auth_user_id_key"'
       }
       expect result.reason === 'INSERT_FAILED'

  DO NOT use vi.mock or module replacement. Use the existing
  makeStubClient helper pattern from writer.test.ts.

Step 4 — require-actor.ts cleanup
In src/lib/auth/require-actor.ts:

  (a) Replace L1 `'use server'` with `import 'server-only'`.
  (b) Rewrite the "'use server' note:" JSDoc block (L46-49 in the
      current snapshot) to a D8-parallel explanation. Keep the
      existing four-outcome contract section (L19-44) and the
      §8.4 system-actor invariant note (L37-44) intact.

  Target JSDoc block shape:
    * Server-only sentinel: `import 'server-only'` (not
    * `'use server'`). Per P4_CONCERN_4A_1_DIRECTIVE.md §DECISIONS
    * D8: this module is an internal server-to-DB helper called
    * by route handlers, NOT a Server Function surface.
    * `'use server'` would wrongly mark `requireActor()` as a
    * Server Function callable from client components;
    * `import 'server-only'` raises a build error if any client
    * component imports the module — the correct sentinel for an
    * internal helper. Closes 4A.1 exit-report open item (g).

  DO NOT touch the runtime function body, the Actor type, the
  RequireActorResult union, the extractAccessToken helper, the
  isAuthWired() gate, the actor_handles lookup, or any test.

DECISIONS RESOLVED (do not re-litigate during execution)

D1 Migration slot is 20260421000006. Groups architecturally with
   the concern-1 DDL/seed block (000004/000005) that the defect
   belongs to, rather than trailing 4A.1's RPC at 000010. Postgres
   only requires monotonic order relative to the latest applied
   migration; both slot choices work, but 000006 matches the "this
   closes a concern-1 defect" narrative and the exit report's own
   recommendation.

D2 UNIQUE via CREATE UNIQUE INDEX (not ALTER TABLE ADD CONSTRAINT).
   - Supports NULLS NOT DISTINCT directly in the index definition.
   - IF NOT EXISTS makes the statement idempotent (safe re-apply).
   - No semantic difference at the table level: Postgres implements
     table-level UNIQUE constraints as UNIQUE INDEXES anyway.

D3 NULLS NOT DISTINCT is required (not optional). Without it, two
   concurrent first-event inserts (both with prev_event_hash = NULL)
   would not collide, and the defect would be half-fixed. Requires
   PG15+. Precondition 7 verifies the version.

D4 New result kind CONCURRENT_CHAIN_ADVANCE (not collapsed under
   HASH_CHAIN_VIOLATION). Same retry semantics at the caller but
   distinct observability: 23514 = programmer-error stale prev
   (bug indicator); 23505 on this specific index = legitimate race
   (infra rate indicator). Telemetry needs to see these separately.
   4A.2+ business RPCs that wrap emitEvent() can treat both
   outcomes as "retry with refreshed tail" uniformly; the writer
   surfaces them distinctly.

D5 Classifier matches SQLSTATE 23505 AND index-name substring
   (both conditions). Plain SQLSTATE match is unsafe — every
   UNIQUE constraint in the schema raises 23505. Test (b) pins
   this invariant.

D6 Classifier order in the error branch: CONCURRENT_CHAIN_ADVANCE
   first, then HASH_CHAIN_VIOLATION, then INSERT_FAILED fallback.
   In practice the BEFORE-INSERT trigger catches stale prev before
   any UNIQUE index check, so only one classifier path fires per
   error, but the ordering is robust to any future re-ordering at
   the Postgres level.

D7 require-actor.ts swap scope: L1 directive + JSDoc only. No
   runtime change. No test edits. The four-outcome contract
   (FEATURE_DISABLED / UNAUTHENTICATED / ACTOR_NOT_FOUND / ok) is
   preserved exactly. Existing require-actor test file must pass
   unchanged.

D8 No compensating change to rpc_append_ledger_event.
   The utility RPC is a thin INSERT wrapper; retry policy belongs
   to the business-operation RPCs that 4A.2/4A.3/4A.4 will build
   on top of this writer. Those RPCs can either catch 23505/23514
   and retry inside Postgres, or propagate to the TS-side route
   handler for TS-side retry. The decision is deferred to 4A.2 —
   do not pre-dictate here.

D9 Inline assertion in migration over pgTAP. The existing
   migration 20260421000004 uses `DO $verify$ ... $verify$` with
   RAISE EXCEPTION for failure. Mirror that precedent; do not
   introduce a new testing harness.

D10 ALTER TABLE DISABLE TRIGGER inside the `DO` block is safe
    because the migration runs inside BEGIN/COMMIT; any RAISE
    EXCEPTION rolls back the whole txn including the trigger
    toggle. No manual re-enable on the failure path. Re-enable
    on the happy path is explicit.

BANNED TERMS
  rg -n 'certif|immutab|tamper.proof' \
     supabase/migrations/20260421000006_ledger_events_unique_prev_hash.sql \
     src/lib/ledger/writer.ts \
     src/lib/ledger/tests/writer.test.ts \
     src/lib/auth/require-actor.ts
  Must return zero matches. Provenance-aware / verifiable /
  independently-reviewable are acceptable substitutes per
  P4_CONCERN_1_DIRECTIVE.md and project CLAUDE.md.

ACCEPTANCE CRITERIA (all must hold)
 1. `supabase/migrations/20260421000006_ledger_events_unique_prev_hash.sql`
    exists with the exact filename.
 2. Migration body contains the literal:
      CREATE UNIQUE INDEX IF NOT EXISTS
        ledger_events_thread_prev_hash_unique
        ON public.ledger_events (thread_type, thread_id, prev_event_hash)
        NULLS NOT DISTINCT;
 3. Migration applies cleanly in a fresh `supabase db reset`-style
    run (or the equivalent your local setup uses). The inline
    assertion DO-block completes and emits its RAISE NOTICE.
 4. After apply, `\d+ public.ledger_events` (or equivalent) shows
    the index `ledger_events_thread_prev_hash_unique` present.
 5. `src/lib/ledger/writer.ts` EmitEventResult reason union includes
    `'CONCURRENT_CHAIN_ADVANCE'`.
 6. writer.ts classifier `isConcurrentChainAdvance` matches BOTH
    SQLSTATE AND index-name substring. Classifier order is:
    CONCURRENT_CHAIN_ADVANCE → HASH_CHAIN_VIOLATION → INSERT_FAILED.
 7. Two new writer unit tests pass:
    (a) 23505 with ledger index-name → CONCURRENT_CHAIN_ADVANCE
    (b) 23505 with unrelated index-name → INSERT_FAILED
 8. `src/lib/auth/require-actor.ts` L1 is `import 'server-only'`
    (not `'use server'`).
 9. require-actor.ts runtime body unchanged; existing
    require-actor test file passes with zero edits.
10. `rg -n 'SYSTEM_ACTOR_HANDLE' src/ supabase/` still matches
    only in `src/lib/ledger/system-actor.ts` and
    `src/lib/ledger/tests/system-actor.test.ts` (4A.1 follow-on
    invariant must not regress).
11. `bun run test` → 1103 baseline + 2 new writer cases = 1105
    passed. Zero failures, zero file-load errors. Skipped count
    unchanged at 10.
12. `bun run build` green.
13. `bun run typecheck` clean (zero output).
14. Zero banned-term matches.
15. Exactly 4 files created/modified per §DELIVERABLES.
16. Single commit, no squash, no amend, on feat/p4-economic-cutover.

COMMIT
Single concern-scoped commit. Template:

  fix(ledger): P4 concern-1 trigger-race + D8 require-actor cleanup

  Closes the concurrent-insert race in ledger_events' hash chain
  (design lock §6.1b) and the D8 mismatch flagged by 4A.1 exit
  report open items (a) + (g). Load-bearing for 4A.2.

  * supabase/migrations/20260421000006 — UNIQUE INDEX on
    (thread_type, thread_id, prev_event_hash) NULLS NOT DISTINCT.
    Supplements enforce_ledger_hash_chain(); does not replace it.
    Under read-committed, two concurrent inserts that both pass
    the BEFORE-INSERT trigger now collide at INSERT time with
    SQLSTATE 23505 instead of forking the chain. Inline DO-block
    assertion proves the constraint fires.

  * src/lib/ledger/writer.ts — new CONCURRENT_CHAIN_ADVANCE result
    kind classifies SQLSTATE 23505 + matching index name.
    Distinct from HASH_CHAIN_VIOLATION (23514 = programmer-error
    stale prev) for telemetry; caller retry semantics identical.
    Two new unit tests lock the classifier: matching index →
    CONCURRENT_CHAIN_ADVANCE; unrelated index → INSERT_FAILED.

  * src/lib/auth/require-actor.ts — swap 'use server' for
    `import 'server-only'`. D8 parallel to writer.ts in 4A.1.
    require-actor is an internal server-side helper called by
    route handlers, not a Server Function surface. Runtime
    behavior unchanged.

  Directive: docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md
  Closes: 4A.1 exit report open items (a) + (g)
  Builds on: 468a3a0

  Co-Authored-By: Claude <noreply@anthropic.com>

Do NOT merge to main. The feature branch feat/p4-economic-cutover
accumulates concerns 1-5; merge happens at P5.

EXIT REPORT
Produce a terminal-paste-ready report with these sections:

 1. Preconditions check — each of #1-13 with PASS/FAIL + a line
    explaining why. Cite the actual HEAD SHA, Postgres version
    string, and baseline test count.
 2. File list — every file created or edited, with line counts
    (or +/- diff stats for edits). Must be exactly 4 files.
 3. Migration body — paste the CREATE UNIQUE INDEX statement
    verbatim, plus the full inline DO-block assertion. Cite the
    RAISE NOTICE emitted on successful apply.
 4. Writer classifier — quote the final error-classification block
    in writer.ts (the `if (error) { ... }` arm of emitEvent). Show
    the order is CONCURRENT_CHAIN_ADVANCE → HASH_CHAIN_VIOLATION →
    INSERT_FAILED.
 5. require-actor.ts diff — show the L1 change AND the JSDoc
    rewrite. Confirm no runtime-body changes.
 6. Decisions log — confirm D1-D10 from §A were honored as written,
    OR cite where you deviated and why.
 7. Banned-term lint — full output of the rg command.
 8. Acceptance checklist — each of criteria 1-16 with PASS/FAIL.
 9. Test-run output — tail of `bun run test`. Cite the delta from
    the 1103 baseline (must be +2).
10. Typecheck output — tail of `bun run typecheck`.
11. Build output — tail of `bun run build`.
12. Commit SHA.
13. Open items — anything warranting founder review before 4A.2.
    Must include AT LEAST:
    (a) 4A.2 business-RPC retry policy for CONCURRENT_CHAIN_ADVANCE
        and HASH_CHAIN_VIOLATION — retry inside Postgres vs
        propagate to TS-side handler. Deferred per D8.
    (b) Whether 4A.2 business RPCs should use SERIALIZABLE isolation
        vs rely on the UNIQUE constraint alone. Recommended:
        UNIQUE-only (SERIALIZABLE has read-set-conflict abort cost
        at scale; UNIQUE-only gives us the correctness guarantee
        with near-zero overhead).
    (c) Canonicalisation formalisation (4A.1 open item (b)) — still
        open, still long-term; not blocking 4A.2.
14. Suggested next directive — "proceed to P4_CONCERN_4A_2" (offer
    surface) per design lock §9.2, or "pause for founder review of
    X" if you spotted anything.
```

---

## B — Scope confirmation

The directive body above is scoped to exactly the two open items from the 4A.1 exit report:

- **(a)** Concern-1 trigger-race fix → migration `20260421000006` + writer classifier extension.
- **(g)** `require-actor.ts` `'use server'` → `import 'server-only'` → directive + JSDoc swap.

It does NOT touch:

- Open item **(b)** canonicalisation — long-term spec work, not blocking 4A.2, explicitly noted in §EXIT REPORT 13(c) as still-open.
- Open items **(c), (e), (f)** — already closed by earlier verdicts.
- Open item **(d)** `rights` / `rights_diff` / `piece_ref` — deferred to 4A.2 and 4A.3 as first tightening tasks; TODOs already live in `schemas.ts`.

---

## C — Red-team pass

Three traps I considered and ruled on before writing the directive. Calling them out explicitly so there's no retro-fit later:

1. **"Why not make the trigger itself detect the race?"**
   The trigger runs BEFORE INSERT and sees the current thread tail via `SELECT ... FOR UPDATE`. Under read-committed, two concurrent txns can each grab that row-lock sequentially, each release and re-read in a loop, but they each see their *own* read snapshot of the table. Neither sees the other's in-flight insert until commit. The trigger cannot fix this without escalating to SERIALIZABLE isolation (costly) or holding a table-level lock (blocks throughput). The UNIQUE constraint offloads enforcement to the B-tree, which is transactional — the second commit physically cannot happen. Correct layer for the fix.

2. **"Why not collapse `CONCURRENT_CHAIN_ADVANCE` into `HASH_CHAIN_VIOLATION`?"**
   Retry semantics are identical at the caller, so collapsing is tempting. But telemetry needs to see the two rates separately: 23514 is a programmer-error signal (bug indicator → investigate why the caller passed a stale prev), 23505 on this index is an infra signal (race rate → investigate throughput/contention, not correctness). Collapsing hides a bug in a retry loop. Distinct reason, identical handling — the right split.

3. **"Why not add retry logic inside the writer itself?"**
   Retry belongs to the caller because the caller owns the txn boundary (design lock §6.1a). The writer cannot retry safely — retrying an INSERT with the same `prev_event_hash` that already failed will fail again by definition; the caller needs to re-read the thread tail inside its atomic RPC, which requires releasing and re-acquiring the row-lock on the business row. That loop belongs to the 4A.2+ business RPCs, not to `emitEvent`. Writer stays dumb.

---

## D — Dispatch readiness

Checklist before paste:

- [ ] Founder reviewed §A directive body and verdicted D4 (the `CONCURRENT_CHAIN_ADVANCE` new result kind, not collapse under HASH_CHAIN_VIOLATION).
- [ ] Founder verdicted D1 (slot `000006` vs `000011`).
- [ ] Commit `468a3a0` pushed to origin `feat/p4-economic-cutover` (confirmed earlier in session).
- [ ] This directive committed to `docs/audits/` on the same branch.
- [ ] Fresh Claude Code session, working directory is the repo root, no other work in progress.

When all boxes clear, paste §A verbatim into Claude Code. Wait for the exit report. Do not accept an implicit "all looks good" — demand the terminal-paste-ready report per §EXIT REPORT.

---

## E — Revision history

- **2026-04-21** — Drafted. Closes 4A.1 exit-report open items (a) and (g). Builds on `468a3a0`. Uses migration slot `20260421000006`, introduces `CONCURRENT_CHAIN_ADVANCE` writer result kind, swaps `require-actor.ts` to `import 'server-only'`.
- **2026-04-21** — Precondition #3 updated after commit `f513933` (directive-file-only) landed on top of `468a3a0`. The directive file's own precondition set was internally contradictory — #3 expected HEAD `468a3a0`, #12 required the directive file to be present. Resolution: #3 now expects `f513933` with a docs-only-delta note; #12 unchanged. No scope change, no substantive edit.
