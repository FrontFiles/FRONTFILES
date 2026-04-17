-- ════════════════════════════════════════════════════════════════
-- Migration: Watermark Profiles — Indexes
--
-- Indexes for:
-- 1. Profile lookup by the processing pipeline (approved only)
-- 2. Finding derivatives needing re-generation after profile update
-- 3. Backfill: assets with original but missing preview derivatives
--
-- Depends on: 20260417100002_watermark_profile_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- Pipeline lookup: find the current approved profile for a (level, family) pair
CREATE INDEX idx_watermark_profiles_approved
  ON watermark_profiles (intrusion_level, template_family, version DESC)
  WHERE approval_status = 'approved';

-- Re-generation: find derivatives produced by an older profile version
-- Used when a profile is updated and re-approved — derivatives with
-- older versions are candidates for re-processing.
CREATE INDEX idx_asset_media_profile_version
  ON asset_media (watermark_profile_version, media_role)
  WHERE generation_status = 'ready'
    AND media_role IN ('watermarked_preview', 'og_image');

-- Backfill: find assets that have an original but are missing
-- one or more preview derivatives. Used by the backfill job
-- to generate derivatives for imported/legacy assets.
-- (Uses the existing idx_asset_media_ready index for the EXISTS check,
--  so no additional index needed for the subquery.)

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_asset_media_profile_version;
-- DROP INDEX IF EXISTS idx_watermark_profiles_approved;
