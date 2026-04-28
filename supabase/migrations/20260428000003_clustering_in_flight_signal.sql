-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — E5: Clustering in-flight signal on upload_batches
--
-- Per E5-DIRECTIVE.md §10.2.
--
-- Adds three columns to upload_batches that the Class B clustering job
-- uses as its lifecycle signal:
--   clustering_started_at    — claimed by dispatcher; reaper sweep target
--   clustering_completed_at  — released on success or failure
--   clustering_error         — error message on failure; NULL on success
--
-- These columns are independent of upload_batches.state — clustering can
-- run on already-committed batches via the creator "Re-analyze this
-- session" action. Re-running clears clustering_started_at to NULL,
-- making the next claim succeed.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE upload_batches
  ADD COLUMN clustering_started_at TIMESTAMPTZ,
  ADD COLUMN clustering_completed_at TIMESTAMPTZ,
  ADD COLUMN clustering_error TEXT,
  ADD CONSTRAINT clustering_lifecycle_consistent CHECK (
    -- completed_at requires started_at — can't complete without starting
    clustering_completed_at IS NULL OR clustering_started_at IS NOT NULL
  );

-- Reaper-friendly partial index: only currently-in-flight rows
CREATE INDEX upload_batches_clustering_in_flight_idx
  ON upload_batches (clustering_started_at)
  WHERE clustering_started_at IS NOT NULL AND clustering_completed_at IS NULL;

COMMENT ON COLUMN upload_batches.clustering_started_at IS
  'E5: timestamp the Class B clustering job claimed this batch. NULL = not started OR completed (paired with clustering_completed_at).';
COMMENT ON COLUMN upload_batches.clustering_completed_at IS
  'E5: timestamp the Class B clustering job released the batch. Set on both success and failure (failure sets clustering_error). Independent of upload_batches.state.';
COMMENT ON COLUMN upload_batches.clustering_error IS
  'E5: error message on Class B failure. NULL on success.';
