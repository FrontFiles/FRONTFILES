-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000001_newsroom_schema_foundation.sql
--
-- Inverse of the Newsroom Schema Foundation (NR-D1) up migration.
-- Does NOT touch any existing table, enum, function, or trigger.
-- Only removes the four newsroom_* tables, six newsroom_* enums,
-- and two RLS helper functions introduced by NR-D1.
--
-- Reverse dependency order:
--   1. DROP POLICY (all four tables)          — defensive; CASCADE would handle
--   2. DROP TABLE newsroom_assets CASCADE      — also drops fk_newsroom_profiles_logo_asset
--   3. DROP TABLE newsroom_packs CASCADE
--   4. DROP TABLE newsroom_verification_records CASCADE
--   5. DROP TABLE newsroom_profiles CASCADE
--   6. DROP FUNCTION is_newsroom_editor_or_admin(uuid)
--   7. DROP FUNCTION is_newsroom_admin(uuid)
--   8. DROP TYPE newsroom_asset_kind
--   9. DROP TYPE newsroom_licence_class
--  10. DROP TYPE newsroom_pack_visibility
--  11. DROP TYPE newsroom_pack_status
--  12. DROP TYPE newsroom_verification_method
--  13. DROP TYPE newsroom_verification_tier
--
-- RLS policies, indexes, and triggers on the dropped tables die
-- with their tables via CASCADE.  The fk_newsroom_profiles_logo_asset
-- constraint on newsroom_profiles.logo_asset_id is also dropped by
-- the CASCADE on newsroom_assets (it points INTO newsroom_assets).
--
-- ⚠ WARNING: CASCADE drops will delete any Newsroom rows that
-- exist in these tables.  There is no non-destructive rollback
-- once the tables have data.  Take a backup first if running
-- this against a populated database.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1  DROP POLICIES (defensive; CASCADE on tables would suffice) ──

DROP POLICY IF EXISTS newsroom_assets_delete          ON newsroom_assets;
DROP POLICY IF EXISTS newsroom_assets_update          ON newsroom_assets;
DROP POLICY IF EXISTS newsroom_assets_insert          ON newsroom_assets;
DROP POLICY IF EXISTS newsroom_assets_select          ON newsroom_assets;

DROP POLICY IF EXISTS newsroom_packs_update_editor    ON newsroom_packs;
DROP POLICY IF EXISTS newsroom_packs_insert_editor    ON newsroom_packs;
DROP POLICY IF EXISTS newsroom_packs_select_public    ON newsroom_packs;

DROP POLICY IF EXISTS newsroom_vr_select_admin        ON newsroom_verification_records;

DROP POLICY IF EXISTS newsroom_profiles_update_admin  ON newsroom_profiles;
DROP POLICY IF EXISTS newsroom_profiles_insert_admin  ON newsroom_profiles;
DROP POLICY IF EXISTS newsroom_profiles_select_public ON newsroom_profiles;

-- ── §2  DROP TABLES (reverse dependency order) ──

DROP TABLE IF EXISTS newsroom_assets               CASCADE;  -- drops fk_newsroom_profiles_logo_asset
DROP TABLE IF EXISTS newsroom_packs                CASCADE;
DROP TABLE IF EXISTS newsroom_verification_records CASCADE;
DROP TABLE IF EXISTS newsroom_profiles             CASCADE;

-- ── §3  DROP HELPER FUNCTIONS ──

DROP FUNCTION IF EXISTS is_newsroom_editor_or_admin(uuid);
DROP FUNCTION IF EXISTS is_newsroom_admin(uuid);

-- ── §4  DROP ENUMS ──

DROP TYPE IF EXISTS newsroom_asset_kind;
DROP TYPE IF EXISTS newsroom_licence_class;
DROP TYPE IF EXISTS newsroom_pack_visibility;
DROP TYPE IF EXISTS newsroom_pack_status;
DROP TYPE IF EXISTS newsroom_verification_method;
DROP TYPE IF EXISTS newsroom_verification_tier;

COMMIT;
