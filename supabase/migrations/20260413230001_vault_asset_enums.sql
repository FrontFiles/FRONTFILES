-- ════════════════════════════════════════════════════════════════
-- Migration 12: Vault Assets — Enum Types
--
-- Enums for the asset governance and media derivative layer.
--
-- Reused from prior migrations (NOT recreated here):
--   licence_type        (Migration 5, Direct Offer enums)
--   account_state       (Migration 8, Identity enums)
--
-- All new enums below match TypeScript union types exactly.
--
-- Depends on: nothing (standalone enums)
-- Rollback: DROP TYPE ... CASCADE for each type (see bottom).
-- ════════════════════════════════════════════════════════════════

-- Canonical 7 asset formats (Spec §5, types.ts:15-22)
CREATE TYPE asset_format AS ENUM (
  'photo',
  'video',
  'audio',
  'text',
  'illustration',
  'infographic',
  'vector'
);

-- Three-level privacy (Spec §6.5, types.ts:38)
CREATE TYPE privacy_state AS ENUM (
  'PUBLIC',
  'PRIVATE',
  'RESTRICTED'
);

-- Publication lifecycle (types.ts:503)
CREATE TYPE publication_state AS ENUM (
  'PUBLISHED',
  'DRAFT',
  'UNPUBLISHED'
);

-- FCS validation declaration (Spec §7.4, types.ts:51-58)
CREATE TYPE validation_declaration_state AS ENUM (
  'fully_validated',
  'provenance_pending',
  'manifest_invalid',
  'corroborated',
  'under_review',
  'disputed',
  'invalidated'
);

-- Per-asset watermark override (watermark/types.ts:8)
CREATE TYPE watermark_mode AS ENUM (
  'none',
  'subtle',
  'standard',
  'strong'
);

-- Exclusive licence tier (Spec §9.6, types.ts:370)
CREATE TYPE exclusive_tier AS ENUM (
  '30_day',
  '1_year',
  'perpetual'
);

-- Media derivative role — what this file IS in relation to the asset
-- Determines delivery behavior: previews are public, originals are gated.
CREATE TYPE media_role AS ENUM (
  'original',
  'watermarked_preview',
  'thumbnail',
  'detail_preview',
  'og_image',
  'video_stream',
  'audio_stream'
);

-- Derivative generation pipeline status
CREATE TYPE media_generation_status AS ENUM (
  'pending',
  'processing',
  'ready',
  'failed'
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS media_generation_status CASCADE;
-- DROP TYPE IF EXISTS media_role CASCADE;
-- DROP TYPE IF EXISTS exclusive_tier CASCADE;
-- DROP TYPE IF EXISTS watermark_mode CASCADE;
-- DROP TYPE IF EXISTS validation_declaration_state CASCADE;
-- DROP TYPE IF EXISTS publication_state CASCADE;
-- DROP TYPE IF EXISTS privacy_state CASCADE;
-- DROP TYPE IF EXISTS asset_format CASCADE;
