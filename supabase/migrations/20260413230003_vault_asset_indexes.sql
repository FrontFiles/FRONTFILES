-- ════════════════════════════════════════════════════════════════
-- Migration 14: Vault Assets — Indexes
--
-- Performance indexes for:
-- - Creator asset list (vault page, profile)
-- - Slug lookup (URL resolution)
-- - Format filtering (search, discovery)
-- - Privacy/publication state filtering (public discovery, vault management)
-- - Declaration state (staff review queue, transaction eligibility)
-- - Story membership (story detail page)
-- - Capture date (temporal search)
-- - Media resolution (delivery API: asset_id + media_role)
-- - Media generation status (processing pipeline)
--
-- slug already has UNIQUE constraint index from table definition.
--
-- Depends on: 20260413230002_vault_asset_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- VAULT_ASSETS
-- ──────────────────────────────────────────────

-- Creator's asset list (vault page, sorted by upload date)
CREATE INDEX idx_vault_assets_creator
  ON vault_assets (creator_id, uploaded_at DESC);

-- Format filtering in search/discovery
CREATE INDEX idx_vault_assets_format
  ON vault_assets (format);

-- Public discovery: only published public assets
CREATE INDEX idx_vault_assets_public_published
  ON vault_assets (format, uploaded_at DESC)
  WHERE privacy_state = 'PUBLIC' AND publication_state = 'PUBLISHED';

-- Privacy state filter (vault management)
CREATE INDEX idx_vault_assets_privacy
  ON vault_assets (privacy_state);

-- Publication state filter
CREATE INDEX idx_vault_assets_publication
  ON vault_assets (publication_state);

-- Declaration state (staff review queue: non-validated assets)
CREATE INDEX idx_vault_assets_declaration
  ON vault_assets (declaration_state)
  WHERE declaration_state IS NOT NULL
    AND declaration_state NOT IN ('fully_validated', 'provenance_pending');

-- Story membership (story detail page: all assets in a story)
CREATE INDEX idx_vault_assets_story
  ON vault_assets (story_id)
  WHERE story_id IS NOT NULL;

-- Temporal search (capture date range queries)
CREATE INDEX idx_vault_assets_capture_date
  ON vault_assets (capture_date DESC)
  WHERE capture_date IS NOT NULL;

-- Temporal sort for admin/staff views
CREATE INDEX idx_vault_assets_created_at
  ON vault_assets (created_at DESC);

-- ──────────────────────────────────────────────
-- ASSET_MEDIA
-- (asset_id, media_role) already has UNIQUE constraint index.
-- ──────────────────────────────────────────────

-- Delivery API resolution: find the ready derivative for an asset + role
-- The UNIQUE index covers (asset_id, media_role) lookups.
-- This partial index adds generation_status filtering for the pipeline.
CREATE INDEX idx_asset_media_ready
  ON asset_media (asset_id, media_role)
  WHERE generation_status = 'ready';

-- Processing pipeline: find pending/processing derivatives
CREATE INDEX idx_asset_media_generation
  ON asset_media (generation_status, created_at ASC)
  WHERE generation_status IN ('pending', 'processing');

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_asset_media_generation;
-- DROP INDEX IF EXISTS idx_asset_media_ready;
-- DROP INDEX IF EXISTS idx_vault_assets_created_at;
-- DROP INDEX IF EXISTS idx_vault_assets_capture_date;
-- DROP INDEX IF EXISTS idx_vault_assets_story;
-- DROP INDEX IF EXISTS idx_vault_assets_declaration;
-- DROP INDEX IF EXISTS idx_vault_assets_publication;
-- DROP INDEX IF EXISTS idx_vault_assets_privacy;
-- DROP INDEX IF EXISTS idx_vault_assets_public_published;
-- DROP INDEX IF EXISTS idx_vault_assets_format;
-- DROP INDEX IF EXISTS idx_vault_assets_creator;
