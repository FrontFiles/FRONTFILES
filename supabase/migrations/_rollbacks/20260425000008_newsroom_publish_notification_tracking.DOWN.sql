-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000008_newsroom_publish_notification_tracking.sql
--
-- Inverse of NR-D9c's F1 migration. Drops the partial index then
-- drops the `notification_sent_at` column.
--
-- ⚠ WARNING: After this rollback, the NR-D9c cron worker
-- (`/api/cron/newsroom-publish-pipeline`) will fail with a
-- "column does not exist" error on its idempotency UPDATE. The
-- typescript layer typechecks against the schema.ts definition,
-- so a rollback without a paired schema.ts revert will produce a
-- runtime PGRST schema-cache miss (PostgREST will re-fetch and
-- log the column absence). Re-applying the up migration restores
-- normal operation.
--
-- No data loss: the column is nullable and tracks idempotency
-- only — published packs still have their `published_at` and
-- subscribers can be re-notified by the next cron tick once the
-- column is restored (notification_sent_at IS NULL after re-add).
-- ════════════════════════════════════════════════════════════════

BEGIN;

DROP INDEX IF EXISTS idx_newsroom_packs_unnotified_published;

ALTER TABLE newsroom_packs
  DROP COLUMN IF EXISTS notification_sent_at;

COMMIT;
