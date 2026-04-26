-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000007_newsroom_pack_transition_rpc.sql
--
-- Inverse of the NR-D9a Pack state-machine RPC migration.
-- Removes the function created by the up migration:
--
--   newsroom_pack_transition(uuid, newsroom_pack_status, uuid, boolean)
--
-- Does NOT touch any table, enum, or other function — the up
-- migration created a single SECURITY DEFINER function and
-- nothing else.
--
-- ⚠ WARNING: After this rollback, calls to
-- `newsroom_pack_transition(...)` will fail with a "function
-- does not exist" error. The TypeScript wrapper at
-- src/lib/newsroom/pack-transition.ts surfaces this as a
-- runtime RPC error. Re-applying the up migration restores the
-- function and resumes normal operation.
--
-- No data is lost — pack state is in newsroom_packs columns
-- which this rollback does not touch.
-- ════════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION IF EXISTS newsroom_pack_transition(
  uuid, newsroom_pack_status, uuid, boolean
);

COMMIT;
