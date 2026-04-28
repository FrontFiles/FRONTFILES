-- supabase/migrations/_rollbacks/20260427000004_ai_pipeline_e2_schema.DOWN.sql
--
-- Reverses E2 schema migration (20260427000004_ai_pipeline_e2_schema.sql).
-- Drop order respects FK dependencies:
--   1. asset_proposal_audit_log (FKs to asset_proposals + asset_proposal_clusters)
--   2. asset_proposals (FK to asset_proposal_clusters)
--   3. asset_proposal_clusters (no incoming FKs after step 2)
--   4. ai_pipeline_settings (independent)

DROP TABLE IF EXISTS asset_proposal_audit_log;
DROP TABLE IF EXISTS asset_proposals;
DROP TABLE IF EXISTS asset_proposal_clusters;
DROP TABLE IF EXISTS ai_pipeline_settings;
