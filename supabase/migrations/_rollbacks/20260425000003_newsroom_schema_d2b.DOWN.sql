-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000003_newsroom_schema_d2b.sql
--
-- Inverse of the Newsroom Schema Extensions Part B (NR-D2b) up
-- migration.  Removes everything that migration created:
--
--   - 4 RLS policies across the four new tables
--   - 1 deferred FK on newsroom_packs.embargo_id
--   - 4 tables (newsroom_embargo_recipients, newsroom_embargoes,
--              newsroom_recipients, newsroom_outlets)
--   - 1 enum (newsroom_embargo_state)
--
-- Does NOT touch NR-D1's 20260425000001 objects (newsroom_profiles,
-- newsroom_verification_records, newsroom_packs, newsroom_assets,
-- the six NR-D1 enums, the two RLS helper functions, or the NR-D1
-- triggers/policies).  Does NOT touch NR-D2a's 20260425000002
-- objects (newsroom_asset_scan_results, newsroom_asset_renditions,
-- newsroom_rights_warranties, newsroom_corrections, the three
-- NR-D2a enums, or fk_newsroom_packs_rights_warranty).  Does NOT
-- touch any pre-Newsroom migration.
--
-- Reverse dependency order (mirroring up §1–§7):
--
--   §1  DROP POLICIES (defensive; CASCADE on tables would suffice).
--   §2  ALTER TABLE newsroom_packs DROP CONSTRAINT
--         fk_newsroom_packs_embargo.
--       MUST run BEFORE §4 — otherwise the FK target disappears
--       while the constraint still references it and Postgres
--       rejects the table drop.  Order is load-bearing; do NOT
--       reorder for "tidiness".  Same pattern as NR-D2a rollback.
--   §3  DROP TABLE newsroom_embargo_recipients CASCADE.
--   §4  DROP TABLE newsroom_embargoes CASCADE.
--   §5  DROP TABLE newsroom_recipients CASCADE.
--   §6  DROP TABLE newsroom_outlets CASCADE.
--   §7  DROP TYPE newsroom_embargo_state.
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

DROP POLICY IF EXISTS newsroom_er_select_org_or_self
  ON newsroom_embargo_recipients;

DROP POLICY IF EXISTS newsroom_embargoes_select_org
  ON newsroom_embargoes;

DROP POLICY IF EXISTS newsroom_recipients_select_self_or_org
  ON newsroom_recipients;

DROP POLICY IF EXISTS newsroom_outlets_select_public
  ON newsroom_outlets;

-- ── §2  DROP DEFERRED FK on newsroom_packs ──
--
-- MUST run BEFORE §4 (DROP TABLE newsroom_embargoes); the FK on
-- newsroom_packs.embargo_id references that table and would block
-- its drop otherwise.

ALTER TABLE newsroom_packs
  DROP CONSTRAINT IF EXISTS fk_newsroom_packs_embargo;

-- ── §3–§6  DROP TABLES (reverse dependency order) ──

DROP TABLE IF EXISTS newsroom_embargo_recipients CASCADE;
DROP TABLE IF EXISTS newsroom_embargoes          CASCADE;
DROP TABLE IF EXISTS newsroom_recipients         CASCADE;
DROP TABLE IF EXISTS newsroom_outlets            CASCADE;

-- ── §7  DROP ENUM ──

DROP TYPE IF EXISTS newsroom_embargo_state;

COMMIT;
