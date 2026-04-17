-- ════════════════════════════════════════════════════════════════
-- Migration: Watermark Profiles — Tables & Column Additions
--
-- 1. watermark_profiles — versioned, approval-gated processing recipes
-- 2. vault_assets.intrusion_level — per-asset watermark level
-- 3. asset_media.watermark_profile_version — which profile version
--    was used to generate each derivative (enables re-generation)
--
-- PROCESSING RULE:
--   The pipeline REFUSES to process if no approved profile exists
--   for the required (intrusion_level, template_family) pair.
--   This is the approval gate — nothing ships until explicitly
--   approved by the product owner.
--
-- Depends on: 20260417100001_watermark_profile_enums.sql,
--             20260413230002_vault_asset_tables.sql
-- Rollback: see bottom.
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. WATERMARK_PROFILES — Versioned processing recipes
--
-- Each (intrusion_level, template_family) combination has
-- independently versioned profiles. Only 'approved' profiles
-- are used by the processing pipeline.
--
-- 6 profiles at launch: 3 levels x 2 families (portrait/landscape).
-- All start as 'draft' — nothing processes until approved.
-- ──────────────────────────────────────────────

CREATE TABLE watermark_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version           INTEGER NOT NULL,
  intrusion_level   watermark_intrusion_level NOT NULL,
  template_family   TEXT NOT NULL CHECK (template_family IN ('portrait', 'landscape')),

  -- Processing parameters — the rendering recipe
  -- All positions are ratios relative to image dimensions (0.0–1.0)
  bar_position      JSONB NOT NULL,       -- { x_ratio, y_ratio, anchor }
  bar_width_ratio   NUMERIC NOT NULL,     -- bar width as fraction of short edge
  brand_block       JSONB NOT NULL,       -- { height_ratio, logo_asset }
  id_block          JSONB NOT NULL,       -- { height_ratio, font_size_ratio }
  attribution_block JSONB NOT NULL,       -- { height_ratio, font_size_ratio }
  scatter_config    JSONB,                -- heavy level only: { density, opacity, icon_size_px }

  -- Approval gate
  approval_status   watermark_approval_status NOT NULL DEFAULT 'draft',
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One version per (level, family) combination
  CONSTRAINT watermark_profiles_version_unique
    UNIQUE (version, intrusion_level, template_family),

  -- bar_width_ratio must be positive and sane
  CONSTRAINT watermark_profiles_bar_width_valid
    CHECK (bar_width_ratio > 0 AND bar_width_ratio < 0.5),

  -- approved_by and approved_at must be set together
  CONSTRAINT watermark_profiles_approval_coherent
    CHECK (
      (approval_status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
      OR (approval_status != 'approved')
    ),

  -- scatter_config required for heavy level, forbidden for others
  CONSTRAINT watermark_profiles_scatter_coherent
    CHECK (
      (intrusion_level = 'heavy' AND scatter_config IS NOT NULL)
      OR (intrusion_level != 'heavy' AND scatter_config IS NULL)
    )
);

COMMENT ON TABLE watermark_profiles IS 'Versioned, approval-gated watermark processing recipes. Only approved profiles are used by the derivative pipeline.';
COMMENT ON COLUMN watermark_profiles.bar_position IS 'Bar anchor position as ratios of image dimensions. JSON: { x_ratio, y_ratio, anchor }.';
COMMENT ON COLUMN watermark_profiles.scatter_config IS 'Heavy level only. FF icon scatter parameters: { density, opacity, icon_size_px }.';
COMMENT ON COLUMN watermark_profiles.approval_status IS 'Only approved profiles may be used by the processing pipeline. Draft = testing. Deprecated = superseded.';

-- ──────────────────────────────────────────────
-- 2. VAULT_ASSETS — Add intrusion_level column
--
-- New column alongside existing watermark_mode.
-- watermark_mode is kept during transition and dropped
-- in the cleanup migration after all assets migrate.
-- ──────────────────────────────────────────────

ALTER TABLE vault_assets
  ADD COLUMN intrusion_level watermark_intrusion_level NOT NULL DEFAULT 'standard';

COMMENT ON COLUMN vault_assets.intrusion_level IS 'Baked watermark intrusion level for preview derivatives. Replaces legacy watermark_mode.';

-- ──────────────────────────────────────────────
-- 3. ASSET_MEDIA — Add watermark_profile_version
--
-- Tracks which profile version produced each derivative.
-- NULL for originals and unwatermarked thumbnails.
-- Enables targeted re-generation when profiles are updated.
-- ──────────────────────────────────────────────

ALTER TABLE asset_media
  ADD COLUMN watermark_profile_version INTEGER;

COMMENT ON COLUMN asset_media.watermark_profile_version IS 'Profile version used to generate this derivative. NULL for originals and unwatermarked thumbnails.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- ALTER TABLE asset_media DROP COLUMN IF EXISTS watermark_profile_version;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS intrusion_level;
-- DROP TABLE IF EXISTS watermark_profiles CASCADE;
