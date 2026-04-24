-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000005_newsroom_schema_d2c_ii.sql
--
-- Inverse of the Newsroom Schema Extensions Part C-ii (NR-D2c-ii)
-- up migration — the FINAL schema directive of Phase NR-1.
-- Removes everything that migration created:
--
--   - 6 RLS policies across the four new tables
--     (newsroom_claims: 1, newsroom_admin_users: 1,
--      newsroom_admin_audit_events: 1,
--      newsroom_beat_subscriptions: 3)
--   - 4 tables (newsroom_beat_subscriptions,
--              newsroom_admin_audit_events,
--              newsroom_admin_users, newsroom_claims)
--   - 5 enums (newsroom_beat_notify_on,
--             newsroom_admin_target_type,
--             newsroom_admin_role,
--             newsroom_claim_status,
--             newsroom_claim_reason_category)
--
-- Does NOT touch NR-D1 / NR-D2a / NR-D2b / NR-D2c-i objects
-- (15 tables, 18 enums across those four migrations; the two
-- RLS helper functions; all pre-Newsroom migrations).
--
-- NO deferred-FK cleanup step — unlike NR-D2a and NR-D2b,
-- this up migration does not add any ALTER TABLE on an
-- existing object.  All FKs from the four new tables point
-- at existing objects and die with the dropped tables via
-- CASCADE.
--
-- Reverse dependency order (mirroring up §1–§6):
--
--   §1  DROP POLICIES (defensive; CASCADE on tables would suffice).
--   §2  DROP TABLE newsroom_beat_subscriptions CASCADE.
--       (Zero intra-migration dependencies; listed first for
--        clean CASCADE ordering, but no load-bearing constraint
--        — the four new tables have no FKs between themselves,
--        so drop order within §§2–§5 is cosmetic.)
--   §3  DROP TABLE newsroom_admin_audit_events CASCADE.
--   §4  DROP TABLE newsroom_admin_users CASCADE.
--   §5  DROP TABLE newsroom_claims CASCADE.
--   §6  DROP TYPE newsroom_beat_notify_on.
--   §7  DROP TYPE newsroom_admin_target_type.
--   §8  DROP TYPE newsroom_admin_role.
--   §9  DROP TYPE newsroom_claim_status.
--   §10 DROP TYPE newsroom_claim_reason_category.
--
-- RLS policies, indexes, and triggers on the dropped tables die
-- with their tables via CASCADE; policies are dropped
-- explicitly in §1 only as a defensive measure (so the rollback
-- is observable step-by-step in case a later migration re-adds
-- a same-named table without the same policies).
--
-- ⚠ WARNING: CASCADE drops will delete any rows that exist in
-- the four new tables.  Admin audit events are append-only
-- provenance artefacts; claims are legal-intake records.
-- There is no non-destructive rollback once they have data.
-- Take a backup first if running this against a populated
-- database.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1  DROP POLICIES (defensive; CASCADE on tables would suffice) ──

DROP POLICY IF EXISTS newsroom_bs_delete_self
  ON newsroom_beat_subscriptions;
DROP POLICY IF EXISTS newsroom_bs_insert_self
  ON newsroom_beat_subscriptions;
DROP POLICY IF EXISTS newsroom_bs_select_self
  ON newsroom_beat_subscriptions;

DROP POLICY IF EXISTS newsroom_aae_select_admin_any
  ON newsroom_admin_audit_events;

DROP POLICY IF EXISTS newsroom_admin_users_select_self
  ON newsroom_admin_users;

DROP POLICY IF EXISTS newsroom_claims_select_org
  ON newsroom_claims;

-- ── §2–§5  DROP TABLES ──
--
-- No intra-migration FKs between these four tables, so order
-- within §§2–§5 is cosmetic.  Kept symmetric with the UP
-- migration's §§2–§5 ordering for readability.

DROP TABLE IF EXISTS newsroom_beat_subscriptions   CASCADE;
DROP TABLE IF EXISTS newsroom_admin_audit_events   CASCADE;
DROP TABLE IF EXISTS newsroom_admin_users          CASCADE;
DROP TABLE IF EXISTS newsroom_claims               CASCADE;

-- ── §6–§10  DROP ENUMS ──

DROP TYPE IF EXISTS newsroom_beat_notify_on;
DROP TYPE IF EXISTS newsroom_admin_target_type;
DROP TYPE IF EXISTS newsroom_admin_role;
DROP TYPE IF EXISTS newsroom_claim_status;
DROP TYPE IF EXISTS newsroom_claim_reason_category;

COMMIT;
