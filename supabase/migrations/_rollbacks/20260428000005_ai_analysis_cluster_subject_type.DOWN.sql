-- Rollback for 20260428000005_ai_analysis_cluster_subject_type.sql
--
-- PostgreSQL doesn't support DROP VALUE on an enum type. Removing
-- 'cluster' would require:
--   1. CREATE a new enum without 'cluster'
--   2. Migrate columns to the new enum (rejecting any 'cluster' rows)
--   3. DROP the old enum + RENAME the new one
--
-- For a fresh dev DB before any 'cluster' rows exist, the simpler
-- approach is to recreate the enum. For production with 'cluster'
-- rows, a real rollback would also DELETE those ai_analysis rows
-- first — not in scope for this script.
--
-- This rollback is intentionally minimal: it does NOT remove 'cluster'
-- from the enum. If a true rollback is needed (rare; only if E5 is
-- being entirely reverted), use the 4-step procedure above manually.

-- intentionally empty (see comment above)
SELECT 1;
