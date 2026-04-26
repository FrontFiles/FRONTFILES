-- ════════════════════════════════════════════════════════════════
-- Migration — PR 4: add asset_media.processing_started_at timestamp
--
-- Required by the PR 4 reaper to detect rows stuck in 'processing'
-- state past a configurable timeout (default 600s). The MediaRowAdapter
-- stamps `processing_started_at = now()` when transitioning a row from
-- pending → processing; clears it (sets NULL) on transition to ready,
-- failed, or back to pending (reaper reset).
--
-- IP-3 from PR-4-PLAN.md: this column did not exist in the prior
-- schema (verified by grep against supabase/migrations/ — only doc
-- references found). Adding it as a small additive migration.
--
-- Default NULL — pre-PR-4 rows have NULL processing_started_at.
-- The reaper query uses generation_status='processing' as the primary
-- filter, so the secondary timestamp check operates on a small set;
-- no index needed at current volume.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE asset_media
  ADD COLUMN processing_started_at timestamptz;

COMMENT ON COLUMN asset_media.processing_started_at IS
  'Stamped when a row transitions pending→processing; cleared on transition to ready/failed/pending. Used by the reaper to detect stuck rows past FFF_PROCESSING_TIMEOUT_SECONDS.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- ALTER TABLE asset_media DROP COLUMN IF EXISTS processing_started_at;
