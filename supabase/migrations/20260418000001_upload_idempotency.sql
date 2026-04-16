-- ════════════════════════════════════════════════════════════════
-- Migration — Upload idempotency + atomic commit function
--
-- Adds the columns the upload API route needs to enforce the
-- idempotency contract defined in
-- src/lib/processing/IMPLEMENTATION-PLAN.md §PR 2, and the
-- plpgsql function that inserts both `vault_assets` and
-- `asset_media` rows atomically (no partial commits).
--
-- Scope is strictly additive:
--   * Three nullable columns on vault_assets
--   * One nullable column on asset_media
--   * One partial UNIQUE index on vault_assets
--   * One SECURITY DEFINER plpgsql function
--
-- No enum changes. No rewrites to existing columns. No drops.
-- Every addition is reversible — rollback block at the bottom.
-- ════════════════════════════════════════════════════════════════

-- ── Columns ──────────────────────────────────────────────────────

ALTER TABLE vault_assets
  ADD COLUMN client_upload_token text,
  ADD COLUMN original_size_bytes bigint,
  ADD COLUMN metadata_checksum   text;

COMMENT ON COLUMN vault_assets.client_upload_token IS
  'Client-supplied idempotency token (UUID v4). NULL for rows predating PR 2 and for beta imports. Uniqueness enforced per creator via partial index.';
COMMENT ON COLUMN vault_assets.original_size_bytes IS
  'Byte count of the uploaded original. Part of the idempotency fingerprint. NULL until PR 2 persists the first real upload.';
COMMENT ON COLUMN vault_assets.metadata_checksum IS
  'Hex SHA-256 of the canonical client-supplied metadata JSON. Part of the idempotency fingerprint.';

ALTER TABLE asset_media
  ADD COLUMN original_sha256 text;

COMMENT ON COLUMN asset_media.original_sha256 IS
  'Hex SHA-256 of the file bytes. Only populated for media_role=original; NULL for derivatives.';

-- ── Partial unique index ────────────────────────────────────────

-- Enforces one open upload token per creator. Legacy rows and
-- imports carry NULL tokens, so the partial predicate keeps the
-- constraint narrow and non-disruptive.
CREATE UNIQUE INDEX vault_assets_creator_upload_token_key
  ON vault_assets (creator_id, client_upload_token)
  WHERE client_upload_token IS NOT NULL;

-- ── Atomic commit function ──────────────────────────────────────

-- Inserts both rows in one transaction. If either INSERT fails
-- (unique violation on the token, FK violation on creator_id, a
-- CHECK constraint, etc.) the whole call rolls back and PostgREST
-- surfaces the SQLSTATE to the caller. Called via supabase-js
-- `.rpc('upload_commit', { ... })`.
--
-- The function returns the asset_id (same UUID the caller passed
-- in) on success, so the API route does not need a follow-up
-- SELECT.
CREATE OR REPLACE FUNCTION upload_commit(
  p_asset_id             uuid,
  p_creator_id           uuid,
  p_slug                 text,
  p_title                text,
  p_format               asset_format,
  p_declaration_state    validation_declaration_state,
  p_client_upload_token  text,
  p_original_size_bytes  bigint,
  p_metadata_checksum    text,
  p_storage_ref          text,
  p_content_type         text,
  p_file_size_bytes      bigint,
  p_width                integer,
  p_height               integer,
  p_original_sha256      text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO vault_assets (
    id,
    creator_id,
    slug,
    title,
    format,
    privacy_state,
    publication_state,
    declaration_state,
    client_upload_token,
    original_size_bytes,
    metadata_checksum
  ) VALUES (
    p_asset_id,
    p_creator_id,
    p_slug,
    p_title,
    p_format,
    'PRIVATE',
    'DRAFT',
    p_declaration_state,
    p_client_upload_token,
    p_original_size_bytes,
    p_metadata_checksum
  );

  INSERT INTO asset_media (
    asset_id,
    media_role,
    storage_ref,
    content_type,
    file_size_bytes,
    width,
    height,
    generation_status,
    original_sha256
  ) VALUES (
    p_asset_id,
    'original',
    p_storage_ref,
    p_content_type,
    p_file_size_bytes,
    p_width,
    p_height,
    'ready',
    p_original_sha256
  );

  RETURN p_asset_id;
END;
$$;

COMMENT ON FUNCTION upload_commit IS
  'PR 2 — atomic two-row insert for a newly persisted original. Rolls back automatically on any constraint violation (including the creator_id/client_upload_token unique index).';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP FUNCTION IF EXISTS upload_commit(
--   uuid, uuid, text, text, asset_format, validation_declaration_state,
--   text, bigint, text, text, text, bigint, integer, integer, text
-- );
-- DROP INDEX IF EXISTS vault_assets_creator_upload_token_key;
-- ALTER TABLE asset_media  DROP COLUMN IF EXISTS original_sha256;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS metadata_checksum;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS original_size_bytes;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS client_upload_token;
