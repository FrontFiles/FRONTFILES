-- ════════════════════════════════════════════════════════════════
-- Migration: FFF Sharing — Post Enum Types
--
-- Enums for the in-product "Posts" feature (FFF Sharing v1).
--
-- IMPORTANT — do NOT confuse with the existing `/share/[token]`
-- preview-link system. That system lives entirely under the
-- `share`/`shares` namespace and is unchanged by this migration.
-- "Posts" are authenticated, in-product social-feed objects.
--
-- Each enum mirrors a TypeScript union type in
-- `src/lib/db/schema.ts` 1:1. Keep them in lockstep.
--
-- Depends on: nothing (standalone enums)
-- Rollback: DROP TYPE … CASCADE for each type (see bottom).
-- ════════════════════════════════════════════════════════════════

-- What kind of Frontfiles content a post is attached to.
-- Free text-only posts are explicitly disallowed — every post
-- must attach to exactly one of these types.
CREATE TYPE post_attachment_type AS ENUM (
  'asset',
  'story',
  'article',
  'collection'
);

-- Visibility audience for a post.
-- v1 uses 'public' only in behaviour; 'connections' is reserved
-- for a later phase so the column can land now without a later
-- ALTER TYPE.
CREATE TYPE post_visibility AS ENUM (
  'public',
  'connections'
);

-- Lifecycle state of a post.
-- 'removed'         = hard-removed by author (or staff); the row
--                     survives so reposts-of-removed-posts still
--                     render a "quoted post removed" placeholder.
-- 'hidden_by_author'= soft-hide; author can re-publish.
CREATE TYPE post_status AS ENUM (
  'published',
  'removed',
  'hidden_by_author'
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS post_status CASCADE;
-- DROP TYPE IF EXISTS post_visibility CASCADE;
-- DROP TYPE IF EXISTS post_attachment_type CASCADE;
