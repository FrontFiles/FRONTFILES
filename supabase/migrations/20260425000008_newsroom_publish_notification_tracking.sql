-- ════════════════════════════════════════════════════════════════
-- NR-D9c — Publish notification tracking (F1)
--
-- Adds `notification_sent_at` to newsroom_packs for cron-driven
-- subscriber-fanout idempotency. The NR-D9c cron worker
-- (`/api/cron/newsroom-publish-pipeline`) processes packs with
-- `published_at` set AND `notification_sent_at IS NULL`, sends
-- notification emails to matching `newsroom_beat_subscriptions`,
-- then marks `notification_sent_at = now()`.
--
-- Race-safe UPDATE pattern: the cron's notification pass uses
-- `WHERE id = ? AND notification_sent_at IS NULL` so concurrent
-- runs (or retries on the next hour's tick) cannot double-fire.
--
-- Partial index is the cron's hot query: "find published packs
-- not yet notified, oldest first." Tiny table for v1 closed beta;
-- index keeps the query fast as volume grows.
--
-- v1.1 backlog inheritance: NR-D7b's two-INSERT atomicity caveat
-- and the `.env.local` JWT drift item both apply transitively to
-- this surface. NR-D9c IP-1 deferred broader fanout (notify_on IN
-- ('new_pack', 'embargo_lift')) to v1.1.
-- ════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE newsroom_packs
  ADD COLUMN notification_sent_at timestamptz NULL;

COMMENT ON COLUMN newsroom_packs.notification_sent_at IS
  'When subscriber notifications were dispatched for this pack''s '
  'publish event. NULL = not yet sent. Set by NR-D9c cron worker. '
  'Race-safe UPDATE via WHERE notification_sent_at IS NULL.';

-- Partial index for the cron's hot query: find published packs not
-- yet notified, oldest published_at first.
CREATE INDEX idx_newsroom_packs_unnotified_published
  ON newsroom_packs (published_at)
  WHERE published_at IS NOT NULL
    AND notification_sent_at IS NULL;

COMMIT;
