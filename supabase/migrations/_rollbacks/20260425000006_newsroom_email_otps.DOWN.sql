-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260425000006_newsroom_email_otps.sql
--
-- Inverse of the Newsroom Domain-Email OTP storage migration
-- (NR-D5b-ii) — the FIRST migration of Phase NR-2 (Distributor
-- Path). Removes everything that migration created:
--
--   - 1 table       (newsroom_email_otps)
--   - 2 indexes     (idx_newsroom_email_otps_lookup,
--                    idx_newsroom_email_otps_cleanup)
--   - 1 trigger     (trg_newsroom_email_otps_updated_at)
--   - 5 constraints (email_format, attempts_nonneg,
--                    attempts_max, consumed_after_created,
--                    expires_after_created)
--   - 0 enums       (this migration introduced no new enums)
--   - 0 RLS policies (the table runs with RLS ENABLED + zero
--                     authenticated policies; nothing to drop)
--
-- Does NOT touch any prior Newsroom table — the only FK is to
-- companies(id), and CASCADE on the table drop tears down all
-- dependent objects (indexes, trigger, constraints) without
-- needing explicit drops here.
--
-- Reverse dependency order (mirroring up §1–§2):
--
--   §1  ALTER TABLE … DISABLE ROW LEVEL SECURITY
--       Defensive: a later same-named-table migration that
--       forgets ENABLE will inherit the old enabled state if
--       we don't disable here. CASCADE on the table drop also
--       tears RLS down, but disabling first makes the rollback
--       observable in step-by-step traces.
--   §2  DROP TABLE newsroom_email_otps CASCADE
--       Removes the table, its 2 indexes, its trigger, and
--       its 5 CHECK constraints in one shot.
--
-- ⚠ WARNING: CASCADE drops will delete any rows that exist in
-- newsroom_email_otps at rollback time. Active OTPs in flight
-- will be invalidated; users mid-verification will need to
-- request a new code post-rollback. Take a backup if running
-- this against a populated database with in-flight OTPs.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1  Disable RLS (defensive) ──

ALTER TABLE newsroom_email_otps DISABLE ROW LEVEL SECURITY;

-- ── §2  Drop the table (cascades to indexes, trigger, CHECKs) ──

DROP TABLE IF EXISTS newsroom_email_otps CASCADE;

COMMIT;
