-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000004_newsroom_schema_d2c_i.sql
--
-- Inverse of the Newsroom Schema Extensions Part C-i (NR-D2c-i)
-- up migration.  Removes everything that migration created:
--
--   - 2 RLS policies across the three new tables
--     (newsroom_signing_keys has RLS enabled but zero policies
--      in the up migration, so nothing to drop for that table
--      except via the CASCADE table drop).
--   - 3 tables (newsroom_download_receipts,
--              newsroom_distribution_events,
--              newsroom_signing_keys)
--   - 4 enums (newsroom_signing_key_status,
--             newsroom_signing_algorithm,
--             newsroom_distribution_source,
--             newsroom_distribution_event_type)
--
-- Does NOT touch NR-D1's 20260425000001 objects (newsroom_profiles,
-- newsroom_verification_records, newsroom_packs, newsroom_assets,
-- newsroom_licence_class and other NR-D1 enums, the two RLS
-- helper functions).  Does NOT touch NR-D2a's 20260425000002
-- objects (scan_results, renditions, rights_warranties,
-- corrections, the three NR-D2a enums, or
-- fk_newsroom_packs_rights_warranty).  Does NOT touch NR-D2b's
-- 20260425000003 objects (outlets, recipients, embargoes,
-- embargo_recipients, newsroom_embargo_state, or
-- fk_newsroom_packs_embargo).  Does NOT touch any pre-Newsroom
-- migration.
--
-- NO deferred-FK cleanup step — unlike NR-D2a and NR-D2b,
-- this up migration does not add any ALTER TABLE on an
-- existing object.  The three new tables carry FKs OUT to
-- existing tables (newsroom_packs, newsroom_assets,
-- newsroom_recipients); those FKs live on the dropped tables
-- and die with them via CASCADE.  The FK from
-- newsroom_download_receipts.signing_key_kid →
-- newsroom_signing_keys(kid) is an intra-migration FK and
-- also dies with the CASCADE table drop.
--
-- Reverse dependency order (mirroring up §1–§5):
--
--   §1  DROP POLICIES (defensive; CASCADE on tables would suffice).
--   §2  DROP TABLE newsroom_download_receipts CASCADE.
--       MUST run BEFORE §4 — the receipt table has an FK to
--       newsroom_signing_keys(kid) and would block its drop.
--       Must also run BEFORE §3 — the receipt table has an FK
--       to newsroom_distribution_events(id) and would block
--       that table's drop.
--   §3  DROP TABLE newsroom_distribution_events CASCADE.
--   §4  DROP TABLE newsroom_signing_keys CASCADE.
--   §5  DROP TYPE newsroom_signing_key_status.
--   §6  DROP TYPE newsroom_signing_algorithm.
--   §7  DROP TYPE newsroom_distribution_source.
--   §8  DROP TYPE newsroom_distribution_event_type.
--
-- RLS policies, indexes, and triggers on the dropped tables die
-- with their tables via CASCADE; policies are dropped
-- explicitly in §1 only as a defensive measure (so the rollback
-- is observable step-by-step in case a later migration re-adds
-- a same-named table without the same policies).
--
-- ⚠ WARNING: CASCADE drops will delete any rows that exist in
-- the three new tables.  Download receipts are tamper-evident
-- provenance artefacts — there is no non-destructive rollback
-- once they have data.  Take a backup first if running this
-- against a populated database.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1  DROP POLICIES (defensive; CASCADE on tables would suffice) ──

DROP POLICY IF EXISTS newsroom_dr_select_public
  ON newsroom_download_receipts;

DROP POLICY IF EXISTS newsroom_de_select_org
  ON newsroom_distribution_events;

-- newsroom_signing_keys has zero policies in the up migration
-- (deny-all for non-service_role); nothing to drop here.

-- ── §2–§4  DROP TABLES (reverse dependency order) ──
--
-- newsroom_download_receipts MUST drop first — it has FKs to
-- both newsroom_distribution_events(id) and
-- newsroom_signing_keys(kid), and would block either drop
-- otherwise.  Order is load-bearing; do NOT reorder for
-- "tidiness".

DROP TABLE IF EXISTS newsroom_download_receipts     CASCADE;
DROP TABLE IF EXISTS newsroom_distribution_events   CASCADE;
DROP TABLE IF EXISTS newsroom_signing_keys          CASCADE;

-- ── §5–§8  DROP ENUMS ──

DROP TYPE IF EXISTS newsroom_signing_key_status;
DROP TYPE IF EXISTS newsroom_signing_algorithm;
DROP TYPE IF EXISTS newsroom_distribution_source;
DROP TYPE IF EXISTS newsroom_distribution_event_type;

COMMIT;
