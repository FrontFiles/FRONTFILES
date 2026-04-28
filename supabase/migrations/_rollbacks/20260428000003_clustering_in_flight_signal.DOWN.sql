-- Rollback for 20260428000003_clustering_in_flight_signal.sql
DROP INDEX IF EXISTS upload_batches_clustering_in_flight_idx;
ALTER TABLE upload_batches
  DROP CONSTRAINT IF EXISTS clustering_lifecycle_consistent,
  DROP COLUMN IF EXISTS clustering_started_at,
  DROP COLUMN IF EXISTS clustering_completed_at,
  DROP COLUMN IF EXISTS clustering_error;
