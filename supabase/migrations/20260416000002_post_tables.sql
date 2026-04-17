-- ════════════════════════════════════════════════════════════════
-- Migration: FFF Sharing — Posts Table
--
-- One table `posts` holding every FFF Sharing post.
--
-- DESIGN NOTES
--
-- 1. attachment_id is NOT FK-bound.
--    Only `vault_assets` exists today as a real table — stories,
--    articles and collections are still seed-only (see the
--    `story_id uuid, -- FK deferred` comment in vault_asset_tables).
--    Enforcing existence at the SQL level for three missing tables
--    would be impossible. The service layer (`src/lib/post/
--    validation.ts` + `hydrate.ts`) is the single enforcement
--    point for attachment existence/privacy until those tables
--    land. This mirrors how `src/data/shares.ts` operates today.
--
-- 2. attachment_creator_user_id is snapshotted at post-time.
--    Preserves attribution even if a creator changes handles or
--    deletes the attachment later.
--
-- 3. Reposts are rows that set `repost_of_post_id`.
--    The attachment is ALSO denormalised onto the repost row —
--    this way the feed card can always render a preview even if
--    the original post was later removed (status='removed').
--
-- 4. CHECK constraints enforce the invariants the service layer
--    also enforces. Belt and braces.
--
-- Depends on:
--   20260408230009_identity_tables.sql (users table)
--   20260416000001_post_enums.sql
-- Rollback: DROP TABLE posts (see bottom).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE posts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity ────────────────────────────────────────────────────
  author_user_id              uuid NOT NULL REFERENCES users(id),

  -- Body ────────────────────────────────────────────────────────
  -- Max 600 chars (enforced by CHECK). Empty string is allowed
  -- (silent share) — NULL is not (simpler service contract).
  body                        text NOT NULL DEFAULT '',

  -- Attachment (required for originals AND reposts) ────────────
  attachment_type             post_attachment_type NOT NULL,
  attachment_id               uuid NOT NULL,
  attachment_creator_user_id  uuid NOT NULL REFERENCES users(id),

  -- Repost link ─────────────────────────────────────────────────
  -- NULL => original post.
  -- NOT NULL => repost; `attachment_*` is denormalised from the
  -- target so the feed row is self-sufficient.
  repost_of_post_id           uuid REFERENCES posts(id) ON DELETE RESTRICT,

  -- Visibility / lifecycle ──────────────────────────────────────
  visibility                  post_visibility NOT NULL DEFAULT 'public',
  status                      post_status NOT NULL DEFAULT 'published',

  -- Timestamps ──────────────────────────────────────────────────
  published_at                timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- ── Invariants ──────────────────────────────────────────────

  -- Body length bound. Consumer-social clones tend toward 280;
  -- essays toward 1000+. 600 balances "ambient commentary with
  -- room for nuance" per the plan.
  CONSTRAINT posts_body_length
    CHECK (char_length(body) <= 600),

  -- Self-repost forbidden.
  CONSTRAINT posts_no_self_repost
    CHECK (repost_of_post_id IS NULL OR repost_of_post_id <> id),

  -- Timestamp coherence.
  CONSTRAINT posts_created_before_published
    CHECK (created_at <= published_at),
  CONSTRAINT posts_updated_after_created
    CHECK (updated_at >= created_at)
);

COMMENT ON TABLE posts IS
  'FFF Sharing — in-product social posts. Authenticated, Frontfiles-content-only. Not to be confused with /share/[token] preview links.';

COMMENT ON COLUMN posts.attachment_id IS
  'Points to vault_assets.id for asset attachments. Stories / articles / collections are seed-only today; existence is enforced in src/lib/post/validation.ts until those tables land.';

COMMENT ON COLUMN posts.attachment_creator_user_id IS
  'Denormalised at post-time to preserve attribution even if the source entity is later removed or the original creator changes handle.';

COMMENT ON COLUMN posts.repost_of_post_id IS
  'NULL for originals. When set, this row is a repost; attachment_* is snapshotted from the target so the card survives target removal.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS posts;
