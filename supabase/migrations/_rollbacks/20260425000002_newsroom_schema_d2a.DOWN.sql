-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000002_newsroom_schema_d2a.sql
--
-- Inverse of the Newsroom Schema Extensions Part A (NR-D2a) up
-- migration.  Removes everything that migration created:
--
--   - 6 RLS policies across the four new tables
--   - 1 deferred FK on newsroom_packs.rights_warranty_id
--   - 4 tables (newsroom_corrections, newsroom_rights_warranties,
--              newsroom_asset_renditions, newsroom_asset_scan_results)
--   - 3 enums (newsroom_rendition_format, newsroom_rendition_kind,
--              newsroom_scan_result)
--
-- Does NOT touch NR-D1's 20260425000001 objects (newsroom_profiles,
-- newsroom_verification_records, newsroom_packs, newsroom_assets,
-- the six NR-D1 enums, the two RLS helper functions, or the NR-D1
-- triggers/policies).  Does NOT touch any pre-Newsroom migration.
--
-- Reverse dependency order (mirroring up §1–§7):
--
--   §1  DROP POLICIES (defensive; CASCADE on tables would suffice).
--   §2  ALTER TABLE newsroom_packs DROP CONSTRAINT
--         fk_newsroom_packs_rights_warranty.
--       MUST run BEFORE §3 — otherwise the FK target disappears
--       while the constraint still references it and Postgres
--       rejects the table drop.  Order is load-bearing; do NOT
--       reorder for "tidiness".
--   §3  DROP TABLE newsroom_corrections CASCADE.
--   §4  DROP TABLE newsroom_rights_warranties CASCADE.
--   §5  DROP TABLE newsroom_asset_renditions CASCADE.
--   §6  DROP TABLE newsroom_asset_scan_results CASCADE.
--   §7  DROP TYPE newsroom_rendition_format.
--   §8  DROP TYPE newsroom_rendition_kind.
--   §9  DROP TYPE newsroom_scan_result.
--
-- RLS policies, indexes, and triggers on the dropped tables die
-- with their tables via CASCADE; they are dropped explicitly in
-- §1 only as a defensive measure (so the rollback is observable
-- step-by-step in case a later migration re-adds a same-named
-- table without the same policies).
--
-- ⚠ WARNING: CASCADE drops will delete any rows that exist in
-- the four new tables.  There is no non-destructive rollback
-- once they have data.  Take a backup first if running this
-- against a populated database.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1  DROP POLICIES (defensive; CASCADE on tables would suffice) ──

DROP POLICY IF EXISTS newsroom_corrections_insert_editor
  ON newsroom_corrections;
DROP POLICY IF EXISTS newsroom_corrections_select_public
  ON newsroom_corrections;

DROP POLICY IF EXISTS newsroom_rw_insert_editor
  ON newsroom_rights_warranties;
DROP POLICY IF EXISTS newsroom_rw_select_editor
  ON newsroom_rights_warranties;

DROP POLICY IF EXISTS newsroom_renditions_select
  ON newsroom_asset_renditions;

DROP POLICY IF EXISTS newsroom_scan_select_editor
  ON newsroom_asset_scan_results;

-- ── §2  DROP DEFERRED FK on newsroom_packs ──
--
-- MUST run BEFORE §4 (DROP TABLE newsroom_rights_warranties);
-- the FK on newsroom_packs.rights_warranty_id references that
-- table and would block its drop otherwise.

ALTER TABLE newsroom_packs
  DROP CONSTRAINT IF EXISTS fk_newsroom_packs_rights_warranty;

-- ── §3–§6  DROP TABLES (reverse dependency order) ──

DROP TABLE IF EXISTS newsroom_corrections           CASCADE;
DROP TABLE IF EXISTS newsroom_rights_warranties     CASCADE;
DROP TABLE IF EXISTS newsroom_asset_renditions      CASCADE;
DROP TABLE IF EXISTS newsroom_asset_scan_results    CASCADE;

-- ── §7–§9  DROP ENUMS ──

DROP TYPE IF EXISTS newsroom_rendition_format;
DROP TYPE IF EXISTS newsroom_rendition_kind;
DROP TYPE IF EXISTS newsroom_scan_result;

COMMIT;
