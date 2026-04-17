-- ════════════════════════════════════════════════════════════════
-- Migration: FFF Sharing — Posts Indexes
--
-- Performance indexes for the read paths that land in this
-- session:
--   1. User feed — posts by author, newest first.
--   2. Reverse attachment lookup — "which posts share this
--      asset/story/article/collection?"
--   3. Repost chain lookup — "show every repost of this post."
--   4. Repost dedupe — partial unique to enforce "a user can
--      only repost the same post once."
--
-- Depends on: 20260416000002_post_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- 1. User feed: `/creator/[handle]/posts`
--    The primary read path for Module 5. Partial on
--    status='published' so author-hidden/removed rows are
--    skipped without a runtime filter.
CREATE INDEX idx_posts_author_published_at
  ON posts (author_user_id, published_at DESC)
  WHERE status = 'published';

-- 2. Reverse attachment lookup: "posts about this asset".
--    Enables the "X people shared this on Frontfiles" rail on
--    asset/story/article/collection detail pages (Module 6+).
CREATE INDEX idx_posts_attachment
  ON posts (attachment_type, attachment_id, published_at DESC)
  WHERE status = 'published';

-- 3. Repost chain: every repost of a given post.
CREATE INDEX idx_posts_repost_of
  ON posts (repost_of_post_id, published_at DESC)
  WHERE repost_of_post_id IS NOT NULL
    AND status = 'published';

-- 4. Repost dedupe: a user may not repost the same post twice.
--    Partial index so originals (repost_of_post_id IS NULL) are
--    excluded — an author can have many original posts.
CREATE UNIQUE INDEX uq_posts_author_repost_unique
  ON posts (author_user_id, repost_of_post_id)
  WHERE repost_of_post_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS uq_posts_author_repost_unique;
-- DROP INDEX IF EXISTS idx_posts_repost_of;
-- DROP INDEX IF EXISTS idx_posts_attachment;
-- DROP INDEX IF EXISTS idx_posts_author_published_at;
