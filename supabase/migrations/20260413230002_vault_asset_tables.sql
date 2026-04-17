-- ════════════════════════════════════════════════════════════════
-- Migration 13: Vault Assets — Core Tables
--
-- Two tables implementing the governed asset + media derivative model:
--   1. vault_assets  — the governed editorial/commercial object
--   2. asset_media   — physical file records (original + derivatives)
--
-- CANONICAL BOUNDARY:
--   vault_assets owns: identity, editorial metadata, governance state,
--     commercial terms, certification status.
--   asset_media owns: storage location, file properties, generation state.
--
-- DELIVERY PRINCIPLE:
--   Existence of an 'original' media row does NOT grant access.
--   Storage existence != access entitlement. The delivery API must
--   check BOTH media existence AND purchase/authorization before
--   serving originals. Preview derivatives are served without
--   entitlement check — they are the commercial display layer.
--   Original delivery requires verified purchase. This is enforced
--   in application code, not in this schema.
--
-- TypeScript source types:
--   VaultAsset (lib/types.ts) + AssetData (data/assets.ts)
--     → collapsed into one canonical vault_assets table
--   AssetMedia has no current TypeScript row type (new table)
--
-- Money: integer EUR cents (never decimal/float).
-- Timestamps: timestamptz, UTC.
-- IDs: uuid with gen_random_uuid() default.
--
-- Depends on: 20260413230001_vault_asset_enums.sql,
--             20260408230009_identity_tables.sql (users table)
-- Rollback: DROP TABLE in reverse dependency order (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. VAULT_ASSETS — Governed editorial/commercial object
--
-- One row per certified piece of content in the Vault.
-- This is what Frontfiles governs, prices, licences, and protects.
-- It is NOT a file. It is the work.
--
-- file_size_bytes, width, height live on asset_media (file truth).
-- aspect_ratio, duration_seconds, word_count live here (editorial truth).
-- ──────────────────────────────────────────────

CREATE TABLE vault_assets (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                  uuid NOT NULL REFERENCES users(id),
  story_id                    uuid,  -- FK deferred: stories table does not yet exist
  slug                        text NOT NULL,
  title                       text NOT NULL,
  description                 text,
  format                      asset_format NOT NULL,

  -- Editorial metadata — properties of the work, not the file
  geography                   text,
  location_label              text,
  tags                        text[] NOT NULL DEFAULT '{}',
  capture_date                date,
  aspect_ratio                text,           -- e.g. "16:9" — editorial property of the work
  duration_seconds            numeric(10,2),  -- canonical duration of audio/video work (editorial, not file-level)
  word_count                  integer,        -- text/article assets
  text_excerpt                text,           -- first N chars for discovery cards

  -- Governance state
  privacy_state               privacy_state NOT NULL DEFAULT 'PRIVATE',
  declaration_state           validation_declaration_state,  -- NULL = not yet assessed
  publication_state           publication_state NOT NULL DEFAULT 'DRAFT',

  -- Commercial terms
  creator_price_cents         integer,  -- EUR cents. NULL = unpriced.
  enabled_licences            text[] NOT NULL DEFAULT '{}',
  watermark_mode              watermark_mode,  -- NULL = inherit context default

  -- Certification
  certification_hash          text,
  c2pa_version                text,        -- NULL = no C2PA manifest
  c2pa_manifest_valid         boolean,     -- NULL = not assessed

  -- Exclusive lock (NULL fields = no active exclusive)
  exclusive_lock_tier         exclusive_tier,
  exclusive_lock_buyer_id     uuid REFERENCES users(id),  -- who holds the exclusive
  exclusive_lock_activated_at timestamptz,
  exclusive_lock_expires_at   timestamptz,  -- NULL = perpetual

  -- Lifecycle timestamps
  uploaded_at                 timestamptz NOT NULL DEFAULT now(),
  certified_at                timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- Slug must be unique
  CONSTRAINT vault_assets_slug_unique UNIQUE (slug),

  -- Price must be non-negative when present
  CONSTRAINT vault_assets_price_non_negative CHECK (
    creator_price_cents IS NULL OR creator_price_cents >= 0
  ),

  -- Enabled licences must contain only valid licence_type values
  CONSTRAINT vault_assets_licences_valid CHECK (
    enabled_licences <@ ARRAY[
      'editorial', 'commercial', 'broadcast', 'print',
      'digital', 'web', 'merchandise'
    ]::text[]
  ),

  -- Word count must be positive when present
  CONSTRAINT vault_assets_word_count_positive CHECK (
    word_count IS NULL OR word_count > 0
  ),

  -- Duration must be positive when present
  CONSTRAINT vault_assets_duration_positive CHECK (
    duration_seconds IS NULL OR duration_seconds > 0
  ),

  -- Exclusive lock fields must be set together or all null
  CONSTRAINT vault_assets_exclusive_lock_coherent CHECK (
    (exclusive_lock_tier IS NOT NULL
      AND exclusive_lock_buyer_id IS NOT NULL
      AND exclusive_lock_activated_at IS NOT NULL)
    OR (exclusive_lock_tier IS NULL
      AND exclusive_lock_buyer_id IS NULL
      AND exclusive_lock_activated_at IS NULL
      AND exclusive_lock_expires_at IS NULL)
  ),

  -- Creator cannot hold an exclusive on their own asset
  CONSTRAINT vault_assets_exclusive_not_creator CHECK (
    exclusive_lock_buyer_id IS NULL OR exclusive_lock_buyer_id != creator_id
  )
);

COMMENT ON TABLE vault_assets IS 'Governed editorial/commercial object. One row per certified Vault content. This is the work, not a file.';
COMMENT ON COLUMN vault_assets.creator_id IS 'Creator who owns this asset. FK to users.id.';
COMMENT ON COLUMN vault_assets.story_id IS 'Story container. FK deferred until stories table exists.';
COMMENT ON COLUMN vault_assets.duration_seconds IS 'Canonical duration of the work (editorial). File-level duration lives on asset_media.';
COMMENT ON COLUMN vault_assets.enabled_licences IS 'Array of licence_type values. Validated by CHECK constraint.';
COMMENT ON COLUMN vault_assets.declaration_state IS 'FCS validation declaration. NULL = not yet assessed. Transactable states: fully_validated, provenance_pending, corroborated, under_review.';
COMMENT ON COLUMN vault_assets.exclusive_lock_buyer_id IS 'User who holds the exclusive licence. References users.id (identity), not buyer_accounts.id (facet).';

-- ──────────────────────────────────────────────
-- 2. ASSET_MEDIA — Physical file records
--
-- One row per derivative per asset.
-- Records what files EXIST and where they are stored.
--
-- IMPORTANT: Existence of an 'original' row does NOT grant access.
-- Storage existence != access entitlement. The delivery API checks
-- both media existence and purchase/authorization. If either is
-- missing, the response is 404 (fail closed).
--
-- Preview/thumbnail derivatives are served without entitlement.
-- Original delivery requires verified purchase — enforced in
-- application code, prepared for by structural separation here.
-- ──────────────────────────────────────────────

CREATE TABLE asset_media (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            uuid NOT NULL REFERENCES vault_assets(id) ON DELETE CASCADE,
  media_role          media_role NOT NULL,
  storage_ref         text NOT NULL,   -- S3 key or storage path. NEVER exposed to browser.
  content_type        text NOT NULL,   -- MIME type (image/jpeg, video/mp4, etc.)
  file_size_bytes     bigint,
  width               integer,         -- pixels, for image/video derivatives
  height              integer,         -- pixels, for image/video derivatives
  duration_seconds    numeric(10,2),   -- file-level duration (may differ from editorial for trimmed derivatives)
  generation_status   media_generation_status NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- One file per role per asset
  CONSTRAINT asset_media_role_unique UNIQUE (asset_id, media_role),

  -- File size must be positive when present
  CONSTRAINT asset_media_file_size_positive CHECK (
    file_size_bytes IS NULL OR file_size_bytes > 0
  ),

  -- Dimensions must be positive when present
  CONSTRAINT asset_media_dimensions_positive CHECK (
    (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)
  ),

  -- Duration must be positive when present
  CONSTRAINT asset_media_duration_positive CHECK (
    duration_seconds IS NULL OR duration_seconds > 0
  )
);

COMMENT ON TABLE asset_media IS 'Physical file records. One per derivative per asset. Storage existence != access entitlement.';
COMMENT ON COLUMN asset_media.storage_ref IS 'S3 key or storage path. Resolved server-side only. Never sent to browser.';
COMMENT ON COLUMN asset_media.media_role IS 'What this file IS: original, watermarked_preview, thumbnail, etc. Determines delivery behavior.';
COMMENT ON COLUMN asset_media.duration_seconds IS 'File-level duration. May differ from vault_assets.duration_seconds for trimmed/processed derivatives.';
COMMENT ON COLUMN asset_media.generation_status IS 'Derivative pipeline status. Delivery API returns 404 unless ready.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (reverse dependency order)
-- ════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS asset_media CASCADE;
-- DROP TABLE IF EXISTS vault_assets CASCADE;
