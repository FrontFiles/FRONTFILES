-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260421000005_seed_system_actor.sql
--
-- Deletes the sentinel actor_handles row. Safe ONLY if no
-- ledger_events rows reference it (ledger_events.actor_ref has
-- ON DELETE RESTRICT). Immediately post-M5, no such rows exist.
-- Once P4 runtime traffic begins, this DOWN becomes unsafe — the
-- rollback path then is git revert + snapshot restore (same as
-- M3).
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M5 rollback
-- ════════════════════════════════════════════════════════════════

BEGIN;

DELETE FROM public.actor_handles
  WHERE handle = '00000000-0000-0000-0000-000000000001'::uuid;

COMMIT;
