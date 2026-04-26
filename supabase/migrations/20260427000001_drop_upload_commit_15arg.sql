-- ════════════════════════════════════════════════════════════════
-- Migration — PR 1.3: drop the 15-arg upload_commit overload
--
-- The 15-arg form was introduced in
-- 20260418000001_upload_idempotency.sql (PR 2). The 21-arg form was
-- added in 20260419000001_phase1_upload_batches.sql (PR 1.1) as a
-- true overload (PostgreSQL identifies functions by name + arg
-- type list, so the two forms coexisted).
--
-- PR 1.3 migrates the only application caller
-- (src/lib/upload/upload-store.ts) from the 15-arg to the 21-arg
-- form. After that migration, the 15-arg overload has zero
-- application callers and is dropped here.
--
-- Pre-merge gate: a repo-wide grep verifies zero remaining
-- application callers of the 15-arg signature before this
-- migration runs in production. See PR-1.3-PLAN.md §5.5.
--
-- Safety: this drop is non-destructive — it removes a function
-- definition only. No data is touched. If the application code
-- somehow still resolves a 15-arg call after the drop, PostgREST
-- returns a 404-equivalent on the RPC call, surfacing as
-- `persistence_failed` 500. Pre-merge grep prevents this.
-- ════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS upload_commit(
  uuid, uuid, text, text, asset_format, validation_declaration_state,
  text, bigint, text, text, text, bigint, integer, integer, text
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- To roll back, re-create the 15-arg form. The canonical body is
-- in 20260418000001_upload_idempotency.sql §upload_commit (15-arg).
-- For emergency recovery, copy that CREATE FUNCTION block and run
-- it as a new migration (e.g. 20260427000001_REVERT_drop_upload_commit_15arg.sql).
-- ════════════════════════════════════════════════════════════════
