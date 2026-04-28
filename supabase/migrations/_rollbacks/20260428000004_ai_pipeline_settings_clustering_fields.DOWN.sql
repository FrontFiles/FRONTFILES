-- Rollback for 20260428000004_ai_pipeline_settings_clustering_fields.sql
ALTER TABLE ai_pipeline_settings
  DROP COLUMN IF EXISTS cluster_min_size,
  DROP COLUMN IF EXISTS cluster_min_samples;
