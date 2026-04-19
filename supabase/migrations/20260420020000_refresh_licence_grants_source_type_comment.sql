-- ════════════════════════════════════════════════════════════════
-- P5 follow-up: refresh licence_grants.source_type column comment
--
-- Context
--   Migration 20260420010000 renamed the direct_offer_* DB objects
--   AND the licence_source_type enum value 'direct_offer' to
--   'special_offer' (§2). Its §9 updated the table-level comments
--   on the two renamed tables, but deliberately scoped out column
--   comments on the rationale that column comments describe
--   functionality rather than the product name.
--
--   Preflight audit of the live schema surfaced one exception:
--   licence_grants.source_type's column comment enumerates the
--   enum's valid values as prose, and one of those values is
--   'direct_offer'. After P5, that value no longer exists. The
--   comment is stale documentation, not a functional break.
--
-- Scope
--   COMMENT ON COLUMN public.licence_grants.source_type
--
-- Safety
--   Read-free at the data layer. Affects documentation only.
--   Idempotent: COMMENT ON ... IS ... unconditionally replaces.
-- ════════════════════════════════════════════════════════════════

BEGIN;

COMMENT ON COLUMN public.licence_grants.source_type IS
  'Specific commercial flow that created this grant: special_offer, assignment, catalogue_checkout, etc. NULL for admin and system grants (no commercial flow). Uses licence_source_type enum (shared with transactions).';

COMMIT;
