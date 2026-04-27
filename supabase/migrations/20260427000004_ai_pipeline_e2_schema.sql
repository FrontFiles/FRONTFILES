-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — E2: AI suggestion pipeline schema (proposal storage layer)
--
-- Per src/lib/processing/AI-PIPELINE-BRIEF.md v2 §4.4 and
-- src/lib/processing/AI-PIPELINE-ARCHITECTURE.md (E1.5).
--
-- Adds the proposal-storage and pipeline-settings layer. Reuses shipped
-- pgvector infrastructure (asset_embeddings, ai_analysis, audit_log)
-- from migration 20260419110000_phase1_vector_cache_audit.sql.
--
-- All four tables are RLS-enabled service-role-only at creation, matching
-- the established AI-related-table posture. No client policies.
--
-- Down-migration at supabase/migrations/_rollbacks/20260427000004_ai_pipeline_e2_schema.DOWN.sql.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ai_pipeline_settings                                   │
-- │                                                             │
-- │  Singleton table — one row, founder-tunable.                │
-- │  Holds tuning knobs for the AI pipeline that E1.5 commits   │
-- │  to "founder-approved at ratification" rather than baking  │
-- │  into code constants. Production env reads this row;       │
-- │  preview/dev applies env-aware multipliers in the settings │
-- │  reader (src/lib/ai-suggestions/settings.ts).              │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE ai_pipeline_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Singleton key — enforces one-row-only via UNIQUE + CHECK.
  singleton_key TEXT NOT NULL UNIQUE DEFAULT 'global'
    CHECK (singleton_key = 'global'),

  -- Cost ceilings (E1.5 §7.2; production defaults; preview/dev applies multiplier)
  daily_cap_cents INTEGER NOT NULL DEFAULT 50000,      -- $500/day production default
  monthly_cap_cents INTEGER NOT NULL DEFAULT 1000000,  -- $10000/month production default

  -- Tag taxonomy (E1.5 §8)
  tag_taxonomy_top_n INTEGER NOT NULL DEFAULT 50,

  -- Confidence floors (E1.5 §5)
  confidence_floor_caption NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  confidence_floor_keywords NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  confidence_floor_tags_existing NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  confidence_floor_tags_new NUMERIC(3,2) NOT NULL DEFAULT 0.75,
  confidence_floor_silhouette NUMERIC(3,2) NOT NULL DEFAULT 0.30,

  -- Image-prep (E1.5 §6)
  vision_max_long_edge_px INTEGER NOT NULL DEFAULT 1568,
  vision_jpeg_quality INTEGER NOT NULL DEFAULT 85
    CHECK (vision_jpeg_quality BETWEEN 1 AND 100),

  -- Circuit breaker (E1.5 §11)
  circuit_failure_threshold INTEGER NOT NULL DEFAULT 5,
  circuit_cooldown_ms INTEGER NOT NULL DEFAULT 60000,

  -- Bookkeeping
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

CREATE TRIGGER trg_ai_pipeline_settings_updated_at
  BEFORE UPDATE ON ai_pipeline_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ai_pipeline_settings ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE ai_pipeline_settings IS
  'Singleton (one-row) tuning table for the AI suggestion pipeline. Read by src/lib/ai-suggestions/settings.ts; preview/dev apply env-aware multipliers on cost ceilings. Founder-tunable. Service-role only.';

-- Seed the singleton row immediately so reads never fail.
INSERT INTO ai_pipeline_settings (singleton_key) VALUES ('global');


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  asset_proposal_clusters                                │
-- │                                                             │
-- │  One row per AI-detected cluster. Created by Class B        │
-- │  clustering job (E5). Forward-referenced by                 │
-- │  asset_proposals.cluster_id (NULLable; populated by E5).    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE asset_proposal_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  proposed_name TEXT,
  asset_count INTEGER NOT NULL CHECK (asset_count > 0),
  silhouette_score NUMERIC(3,2),
  model_version TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('europe-west4', 'us-central1')),

  -- Acceptance tracking (per AI-PIPELINE-BRIEF v2 §4.4)
  accepted_as_story_group_id UUID,
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Mutual exclusion: a cluster is either accepted, dismissed, or pending — never both.
  CONSTRAINT cluster_resolution_exclusive CHECK (
    NOT (accepted_at IS NOT NULL AND dismissed_at IS NOT NULL)
  )
);

CREATE INDEX asset_proposal_clusters_creator_batch_idx
  ON asset_proposal_clusters (creator_id, batch_id, generated_at DESC);

CREATE INDEX asset_proposal_clusters_pending_idx
  ON asset_proposal_clusters (creator_id, generated_at DESC)
  WHERE accepted_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE asset_proposal_clusters ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE asset_proposal_clusters IS
  'AI-detected story group clusters from Class B clustering job. One row per cluster. Forward-referenced by asset_proposals.cluster_id. Service-role only.';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  asset_proposals                                        │
-- │                                                             │
-- │  One row per asset. Created by Class A per-asset job (E3).  │
-- │  Holds caption / keywords / tags + per-field confidence +   │
-- │  cluster membership + provenance.                           │
-- │                                                             │
-- │  Embeddings live in asset_embeddings (shipped 2026-04-19);  │
-- │  cache hits live in ai_analysis (shipped 2026-04-19).       │
-- │  No duplication.                                            │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE asset_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL UNIQUE REFERENCES vault_assets(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Generation state machine (mirrors asset_media pattern)
  generation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'processing', 'ready', 'failed', 'not_applicable')),
  processing_started_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0
    CHECK (retry_count >= 0),
  error TEXT,

  -- Per-field proposals (NULL until ready)
  caption TEXT
    CHECK (caption IS NULL OR length(caption) <= 200),
  caption_confidence NUMERIC(3,2)
    CHECK (caption_confidence IS NULL OR (caption_confidence >= 0 AND caption_confidence <= 1)),
  keywords TEXT[],
  keywords_confidence NUMERIC(3,2)
    CHECK (keywords_confidence IS NULL OR (keywords_confidence >= 0 AND keywords_confidence <= 1)),
  tags TEXT[],
  tags_confidence NUMERIC(3,2)
    CHECK (tags_confidence IS NULL OR (tags_confidence >= 0 AND tags_confidence <= 1)),

  -- Cluster membership (populated by Class B; both NULL until cluster proposed)
  cluster_id UUID REFERENCES asset_proposal_clusters(id) ON DELETE SET NULL,
  cluster_confidence NUMERIC(3,2)
    CHECK (cluster_confidence IS NULL OR (cluster_confidence >= 0 AND cluster_confidence <= 1)),

  -- Provenance (note: embedding lives in asset_embeddings, not here)
  model_version TEXT,
  generation_cost_cents INTEGER
    CHECK (generation_cost_cents IS NULL OR generation_cost_cents >= 0),
  generation_latency_ms INTEGER
    CHECK (generation_latency_ms IS NULL OR generation_latency_ms >= 0),
  region TEXT
    CHECK (region IS NULL OR region IN ('europe-west4', 'us-central1'))
);

CREATE INDEX asset_proposals_status_idx
  ON asset_proposals (generation_status);

CREATE INDEX asset_proposals_pending_idx
  ON asset_proposals (asset_id) WHERE generation_status = 'pending';

CREATE INDEX asset_proposals_cluster_idx
  ON asset_proposals (cluster_id) WHERE cluster_id IS NOT NULL;

ALTER TABLE asset_proposals ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE asset_proposals IS
  'Per-asset AI-generated metadata proposals (caption / keywords / tags) + cluster membership. One row per asset. Embeddings live in asset_embeddings. Cache hits live in ai_analysis. Service-role only.';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  asset_proposal_audit_log                               │
-- │                                                             │
-- │  Field-grain audit of every proposal event (generated /     │
-- │  accepted / overridden / dismissed) and cluster event       │
-- │  (cluster_proposed / cluster_accepted / cluster_dismissed). │
-- │  System-grain events (ai.gemini.call, etc.) go to the       │
-- │  shipped audit_log table — different table for different    │
-- │  query patterns.                                            │
-- │                                                             │
-- │  Mirrors pricing_audit_log shape (PRICE-ENGINE-BRIEF v3).   │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE asset_proposal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_id UUID NOT NULL REFERENCES vault_assets(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'proposal_generated',
      'proposal_accepted',
      'proposal_overridden',
      'proposal_dismissed',
      'cluster_proposed',
      'cluster_accepted',
      'cluster_dismissed'
    )),

  proposal_id UUID REFERENCES asset_proposals(id) ON DELETE SET NULL,
  cluster_id UUID REFERENCES asset_proposal_clusters(id) ON DELETE SET NULL,
  field_name TEXT
    CHECK (field_name IS NULL OR field_name IN ('caption', 'keywords', 'tags')),
  before_value JSONB,
  after_value JSONB,
  surface TEXT NOT NULL
    CHECK (surface IN ('upload', 'vault_edit', 'bulk_action', 'system')),
  override_reason TEXT
);

CREATE INDEX asset_proposal_audit_log_asset_creator_time_idx
  ON asset_proposal_audit_log (asset_id, creator_id, event_at DESC);

CREATE INDEX asset_proposal_audit_log_event_type_time_idx
  ON asset_proposal_audit_log (event_type, event_at DESC);

CREATE INDEX asset_proposal_audit_log_creator_time_idx
  ON asset_proposal_audit_log (creator_id, event_at DESC);

ALTER TABLE asset_proposal_audit_log ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE asset_proposal_audit_log IS
  'Field-grain audit of AI proposal events. Append-only at the application layer. System-grain AI events go to audit_log (shipped 2026-04-19). Service-role only.';


-- ════════════════════════════════════════════════════════════════
-- END E2 schema migration.
--
-- Downstream dependencies unlocked:
--   - E3 (per-asset Vertex Gemini Vision job) writes asset_proposals + ai_analysis
--   - E3 also writes asset_embeddings (already shipped)
--   - E4 (worker integration) extends dispatcher + reaper for asset_proposals
--   - E5 (Class B clustering) writes asset_proposal_clusters + updates
--     asset_proposals.cluster_id
--   - E6 (UI integration) reads asset_proposals + asset_proposal_clusters via
--     server-side service-role; client receives proposal data through API
--     routes that re-author the access boundary (RLS posture preserved).
-- ════════════════════════════════════════════════════════════════
