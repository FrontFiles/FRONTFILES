-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — E5: ai_pipeline_settings clustering fields
--
-- Per E5-DIRECTIVE.md §8.3.
--
-- Adds two clustering knobs to the singleton settings row. Both default
-- to values per the directive's verify-at-implementation gate (§7.3) —
-- founder ratifies during E5 implementation review based on the
-- empirical-knob calibration script's results.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE ai_pipeline_settings
  ADD COLUMN cluster_min_size INTEGER NOT NULL DEFAULT 3
    CHECK (cluster_min_size >= 2),
  ADD COLUMN cluster_min_samples INTEGER
    -- NULL = library defaults to min_cluster_size; explicit value overrides
    CHECK (cluster_min_samples IS NULL OR cluster_min_samples >= 1);

COMMENT ON COLUMN ai_pipeline_settings.cluster_min_size IS
  'E5: HDBSCAN min_cluster_size. Smallest meaningful Story group: a triplet (3). Verify at implementation per E5 §7.3.';
COMMENT ON COLUMN ai_pipeline_settings.cluster_min_samples IS
  'E5: HDBSCAN min_samples (density param). NULL = use library default = min_cluster_size. Verify at implementation per E5 §7.3.';
