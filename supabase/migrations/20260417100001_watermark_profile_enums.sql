-- ════════════════════════════════════════════════════════════════
-- Migration: Watermark Profiles — Enum Types
--
-- New enums for the canonical watermark intrusion level system.
-- Replaces the legacy watermark_mode approach (frontend-only CSS
-- overlays) with a server-side baked-watermark pipeline.
--
-- The old watermark_mode enum is NOT dropped here — it remains
-- on vault_assets.watermark_mode until the cleanup migration
-- after all assets are migrated to intrusion_level.
--
-- Depends on: nothing (standalone enums)
-- Rollback: DROP TYPE ... CASCADE for each type (see bottom).
-- ════════════════════════════════════════════════════════════════

-- Three canonical intrusion levels for baked watermarks.
-- These replace the legacy 4-mode system (none/subtle/standard/strong).
-- Every preview derivative is watermarked — there is no 'none' level.
CREATE TYPE watermark_intrusion_level AS ENUM (
  'light',     -- vertical bar at edge, minimal disruption
  'standard',  -- vertical bar shifted toward center, harder to crop
  'heavy'      -- bar + scattered FF brand icons across image surface
);

-- Approval lifecycle for watermark processing profiles.
-- Only 'approved' profiles may be used by the processing pipeline.
CREATE TYPE watermark_approval_status AS ENUM (
  'draft',       -- created, not yet reviewed
  'approved',    -- reviewed and approved for production use
  'deprecated'   -- superseded by a newer version, derivatives should be re-generated
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS watermark_approval_status CASCADE;
-- DROP TYPE IF EXISTS watermark_intrusion_level CASCADE;
