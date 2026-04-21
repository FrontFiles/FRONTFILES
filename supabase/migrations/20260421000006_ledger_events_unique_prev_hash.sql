-- ═══════════════════════════════════════════════════════════════════
-- Frontfiles — ledger_events concurrent-insert race closure
--
-- References:
--   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1b — the defect
--     being closed here: the BEFORE-INSERT trigger in migration
--     20260421000004 (L427-468, function `enforce_ledger_hash_chain()`)
--     does a `SELECT ... ORDER BY created_at DESC, id DESC LIMIT 1
--     FOR UPDATE` on the thread tail. Under read-committed isolation,
--     two concurrent inserts on the same thread can BOTH read the
--     same latest_hash, BOTH pass the IS DISTINCT FROM equality
--     check, BOTH compute a new `event_hash`, and BOTH commit — the
--     chain forks. `FOR UPDATE` on an empty result set (no rows to
--     lock) provides no mutual exclusion, and even when rows exist,
--     the predicate lock only covers the rows the trigger actually
--     reads, not the gap a second transaction will insert into.
--
--   - docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md — the
--     directive governing this migration. Decisions D1-D10 are
--     recorded there and implemented below.
--
--   - docs/audits/P4_CONCERN_4A_1_EXIT_REPORT.md — this migration
--     closes open items (a) "trigger-race follow-up" and (g)
--     "require-actor D8 directive mismatch". Load-bearing for
--     4A.2 (offer surface), which is the first write-path route
--     group that will exercise emitEvent() under real concurrency.
--
--   - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
--     L222-243 — `public.ledger_events` table shape (this migration
--     supplements that table; zero changes to the table itself).
--
--   - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
--     L427-468 — `enforce_ledger_hash_chain()` trigger body. THIS
--     MIGRATION DOES NOT MODIFY THE TRIGGER. The UNIQUE index
--     supplements the trigger; the trigger still catches the
--     programmer-error case of a caller passing a stale
--     `prev_event_hash` (SQLSTATE 23514, check_violation). The
--     UNIQUE index catches the infrastructure case of two
--     concurrent inserts that both passed the trigger but only
--     one of which can actually land (SQLSTATE 23505,
--     unique_violation).
--
--   - docs/specs/ECONOMIC_FLOW_v1.md §8.3 — hash-chain storage
--     shape: (thread_type, thread_id) is the thread key, and
--     prev_event_hash is the pointer that threads one row to the
--     next. Uniqueness on (thread_type, thread_id, prev_event_hash)
--     is the structural assertion that within a single thread,
--     no two rows share the same prior-event pointer — i.e. the
--     chain is a linked list, not a tree.
--
-- Fix outline:
--   (1) CREATE UNIQUE INDEX on (thread_type, thread_id,
--       prev_event_hash) with NULLS NOT DISTINCT. Postgres B-tree
--       uniqueness is transactional: the second of two concurrent
--       INSERTs with the same (thread_key, prev_event_hash) will
--       block on the first's index entry until commit, then fail
--       with SQLSTATE 23505 (unique_violation) when the first
--       commits. No fork.
--
--   (2) NULLS NOT DISTINCT (PG15+). Without this clause, Postgres'
--       default NULLS DISTINCT semantics treats every NULL as
--       distinct, so two concurrent first-event inserts on the
--       same thread — both with prev_event_hash IS NULL — would
--       NOT collide, and the defect would be half-fixed. The
--       preflight precondition in the directive requires PG ≥ 15.
--
--   (3) CREATE UNIQUE INDEX (not ALTER TABLE ADD CONSTRAINT). The
--       constraint-level syntax in Postgres does not accept
--       NULLS NOT DISTINCT directly; UNIQUE INDEX does. IF NOT
--       EXISTS makes the statement idempotent on re-apply.
--
-- Downstream writer classification:
--   src/lib/ledger/writer.ts, in the same commit as this migration,
--   adds a new EmitEventResult.reason kind CONCURRENT_CHAIN_ADVANCE
--   that matches on SQLSTATE 23505 AND the index name substring
--   `ledger_events_thread_prev_hash_unique`. Distinct from
--   HASH_CHAIN_VIOLATION (SQLSTATE 23514 — trigger programmer-error
--   stale prev) for telemetry; caller retry semantics identical
--   (both mean "re-read thread tail and retry").
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── UNIQUE index on (thread_type, thread_id, prev_event_hash) ────
--
-- The (thread_type, thread_id, prev_event_hash) tuple is the
-- structural "what does this row follow?" pointer in the hash
-- chain. UNIQUE here asserts: within a given thread, no two rows
-- can point at the same predecessor. The chain is a linked list.
--
-- NULLS NOT DISTINCT covers the first-event-on-thread case where
-- prev_event_hash IS NULL. Without the clause, Postgres would
-- treat the two NULLs as distinct and the second concurrent
-- first-event insert would NOT collide. Required, not optional.
--
-- IF NOT EXISTS: this migration is idempotent — re-applying it
-- against a database where the index already exists is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS
  ledger_events_thread_prev_hash_unique
  ON public.ledger_events (thread_type, thread_id, prev_event_hash)
  NULLS NOT DISTINCT;

COMMENT ON INDEX public.ledger_events_thread_prev_hash_unique IS
  'Closes the concurrent-insert race in enforce_ledger_hash_chain() '
  '(P4 design lock §6.1b). Under read-committed, two concurrent '
  'inserts on the same thread can both pass the BEFORE-INSERT '
  'trigger; this UNIQUE index makes the second commit fail with '
  'SQLSTATE 23505 at INSERT time. NULLS NOT DISTINCT covers the '
  'first-event-on-thread case (prev_event_hash IS NULL).';


-- ── Inline assertion ─────────────────────────────────────────────
--
-- Mirrors the precedent in migration 20260421000004 L640-749
-- (hash-chain round-trip verification via `DO $verify$ ... $verify$`
-- with RAISE EXCEPTION on failure). The migration txn rolls back
-- atomically if any RAISE EXCEPTION fires, including the ALTER
-- TABLE DISABLE TRIGGER toggle below — no manual re-enable on
-- the failure path.
--
-- Why the trigger must be temporarily disabled for this assertion:
-- we need to insert two rows with the same (thread_key,
-- prev_event_hash). With the BEFORE-INSERT trigger active, the
-- second insert would fail with SQLSTATE 23514
-- (hash-chain violation) BEFORE the UNIQUE index gets a chance
-- to fire 23505 — because the trigger re-reads the thread tail
-- and sees the first row's event_hash, which will not equal the
-- second insert's prev_event_hash. Disabling the trigger lets the
-- UNIQUE index be exercised in isolation, which is the only path
-- that assertion here proves.
DO $verify$
DECLARE
  test_actor      uuid;
  test_thread     uuid;
  caught_sqlstate text;
  row2_id         uuid;
BEGIN
  -- Disposable actor — not the M5 system actor. Keeps the seed
  -- surface clean. Matches the precedent in migration 20260421000004.
  INSERT INTO public.actor_handles (auth_user_id, tombstoned_at)
    VALUES (NULL, NULL)
    RETURNING handle INTO test_actor;

  test_thread := gen_random_uuid();

  -- Temporarily disable the hash-chain trigger so the UNIQUE index
  -- can be exercised in isolation. If the block below RAISEs, the
  -- outer BEGIN/COMMIT rolls back the trigger toggle as part of
  -- the migration txn — no manual re-enable needed on failure.
  ALTER TABLE public.ledger_events
    DISABLE TRIGGER trg_ledger_events_hash_chain;

  -- Row 1: first event on a fresh thread. prev_event_hash = NULL.
  -- event_hash must be supplied manually because the trigger that
  -- normally computes it is disabled. 'verify-prev-null-row-1' is
  -- a human-readable sentinel; the value is never read.
  INSERT INTO public.ledger_events (
    thread_type, thread_id, event_type, payload,
    actor_ref, prev_event_hash, event_hash
  ) VALUES (
    'offer', test_thread, 'offer.created',
    '{"v":1,"_test":"unique-prev-hash-row-1"}'::jsonb,
    test_actor, NULL, 'verify-prev-null-row-1'
  );

  -- Row 2: same (thread_type, thread_id, prev_event_hash = NULL).
  -- With NULLS NOT DISTINCT on the new UNIQUE index, this MUST
  -- fail with SQLSTATE 23505 (unique_violation). If it inserts
  -- successfully, the index is not doing its job and the
  -- assertion explicitly RAISEs.
  BEGIN
    INSERT INTO public.ledger_events (
      thread_type, thread_id, event_type, payload,
      actor_ref, prev_event_hash, event_hash
    ) VALUES (
      'offer', test_thread, 'offer.countered',
      '{"v":1,"_test":"unique-prev-hash-row-2"}'::jsonb,
      test_actor, NULL, 'verify-prev-null-row-2'
    )
    RETURNING id INTO row2_id;

    -- Getting here means the UNIQUE index did NOT fire.
    RAISE EXCEPTION
      'unique-prev-hash assertion failed: second row with '
      'prev_event_hash = NULL on the same thread inserted '
      'successfully (id=%) — NULLS NOT DISTINCT semantics '
      'are not being applied', row2_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Expected path. Capture the SQLSTATE for the RAISE NOTICE
      -- below so the log line is self-explanatory.
      GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
  END;

  -- Re-enable the trigger on the happy path.
  ALTER TABLE public.ledger_events
    ENABLE TRIGGER trg_ledger_events_hash_chain;

  -- Cleanup: events first (ON DELETE RESTRICT on
  -- ledger_events.actor_ref forces this order), then the
  -- disposable actor_handle. Same pattern as migration
  -- 20260421000004's assertion block.
  DELETE FROM public.ledger_events WHERE thread_id = test_thread;
  DELETE FROM public.actor_handles  WHERE handle   = test_actor;

  RAISE NOTICE
    'M6 unique-prev-hash assertion verified: concurrent-insert '
    'race closure fires SQLSTATE % (unique_violation) on the '
    'ledger_events_thread_prev_hash_unique index when two rows '
    'share (thread_type, thread_id, prev_event_hash = NULL). '
    'Trigger re-enabled on happy path.', caught_sqlstate;
END
$verify$;


COMMIT;
