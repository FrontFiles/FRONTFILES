-- ════════════════════════════════════════════════════════════════
-- Migration — Phase 1 PR 1.1: upload_batches + vault_assets extensions
--
-- Adds the commit-contract substrate for the Creator Processing
-- Substrate rebuild. All additive: no drops, no column rewrites,
-- reversible rollback block at the bottom.
--
-- Scope:
--   * 2 new enum types (upload_batch_state, duplicate_status)
--   * 1 new table (upload_batches)
--   * 6 new columns on vault_assets
--   * 2 new partial indexes on vault_assets
--   * 1 new CHECK constraint (duplicate consistency)
--   * 1 new 21-arg overload of upload_commit RPC
--   * 15-arg upload_commit RPC left intact (PR 2 callers unaffected;
--     dropped in PR 1.3 when the legacy /api/upload caller migrates)
--
-- Domain anchors (verbatim TS source of truth):
--   * duplicate_status        — src/lib/upload/v2-types.ts:92
--   * MetadataSource          — src/lib/upload/v2-types.ts:19
--   * ExtractedMetadata       — src/lib/upload/v2-types.ts:34
--   * AssetProposal           — src/lib/upload/v2-types.ts:128
--   * AssetEditableFields     — src/lib/upload/v2-types.ts:143
--   * V2State.batch           — src/lib/upload/v2-types.ts:321
--
-- jsonb wire convention:
--   Keys inside proposal_snapshot, extracted_metadata, and
--   metadata_source are snake_case. The TS interfaces above use
--   camelCase; one transform helper at the boundary handles
--   camelCase ↔ snake_case. Snake-cased wire keys are required by
--   the ExtractedMetadataInput hard rule (no grouped {exif, iptc}
--   buckets) and keep jsonb path queries idiomatic.
-- ════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────

CREATE TYPE upload_batch_state AS ENUM (
  'open',         -- accepting uploads via /api/upload with this batch_id
  'committing',   -- commit RPC in flight; no new uploads accepted
  'committed',    -- frozen; member vault_assets are vault-permanent
  'cancelled'     -- abandoned before commit
);

CREATE TYPE duplicate_status AS ENUM (
  'none',                -- no duplicate detected, or analysis cleared
  'likely_duplicate',    -- fingerprint hit, awaiting creator resolution
  'confirmed_duplicate'  -- creator confirmed; duplicate_of_id required
);

-- ── upload_batches table ────────────────────────────────────────

CREATE TABLE upload_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     uuid NOT NULL REFERENCES users(id),
  state          upload_batch_state NOT NULL DEFAULT 'open',
  newsroom_mode  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  committed_at   timestamptz,
  cancelled_at   timestamptz
);

COMMENT ON TABLE upload_batches IS
  'Phase 1 commit contract — a batch is the creator-side intake unit. One batch groups N staged uploads (vault_assets rows) before they commit to the vault.';
COMMENT ON COLUMN upload_batches.state IS
  'DB lifecycle state. Distinct from the UI stage (V2Stage in src/lib/upload/v2-types.ts:74). open→committing→committed is the success path; open→cancelled is abandonment.';
COMMENT ON COLUMN upload_batches.newsroom_mode IS
  'Mirrors V2State.batch.newsroomMode. Persists creator''s newsroom-mode choice across reloads so rehydration is faithful.';
COMMENT ON COLUMN upload_batches.committed_at IS
  'Terminal timestamp set when state transitions to "committed". NULL otherwise.';
COMMENT ON COLUMN upload_batches.cancelled_at IS
  'Terminal timestamp set when state transitions to "cancelled". NULL otherwise.';

CREATE INDEX upload_batches_creator_state_idx
  ON upload_batches (creator_id, state);

-- ── vault_assets extensions ─────────────────────────────────────

ALTER TABLE vault_assets
  ADD COLUMN batch_id            uuid REFERENCES upload_batches(id),
  ADD COLUMN proposal_snapshot   jsonb,
  ADD COLUMN extracted_metadata  jsonb,
  ADD COLUMN metadata_source     jsonb,
  ADD COLUMN duplicate_status    duplicate_status,
  ADD COLUMN duplicate_of_id     uuid REFERENCES vault_assets(id);

COMMENT ON COLUMN vault_assets.batch_id IS
  'FK to upload_batches(id). NULL for legacy / PR 2-era rows. PR 1.3 will tighten the legacy /api/upload route to require X-Batch-Id (returns 400 batch_id_required when absent).';
COMMENT ON COLUMN vault_assets.proposal_snapshot IS
  'JSON serialization of the system-generated AssetProposal at commit time. Audit trail; read-only after commit. Wire shape: snake_case mirror of src/lib/upload/v2-types.ts:128 AssetProposal.';
COMMENT ON COLUMN vault_assets.extracted_metadata IS
  'Raw EXIF/GPS/IPTC/XMP/C2PA/file-level extraction as flat snake_case jsonb. Wire shape: snake_case mirror of src/lib/upload/v2-types.ts:34 ExtractedMetadata. NOT grouped buckets like {exif, iptc, xmp} — flattened per the ExtractedMetadataInput hard rule.';
COMMENT ON COLUMN vault_assets.metadata_source IS
  'Per-field source tracking for editable fields. Wire shape: partial map { <editable_field_snake_case>: <source_tag> }. Source tags from src/lib/upload/v2-types.ts:19 MetadataSource ("embedded" | "extracted" | "ai" | "creator"). Editable field keys from AssetEditableFields minus self.';
COMMENT ON COLUMN vault_assets.duplicate_status IS
  'Duplicate-detection state. Enum values mirror TS DuplicateStatus at src/lib/upload/v2-types.ts:92.';
COMMENT ON COLUMN vault_assets.duplicate_of_id IS
  'FK to vault_assets(id) when duplicate_status = "confirmed_duplicate". Required by check constraint vault_assets_duplicate_consistency. Wire name is duplicate_of_id (NOT duplicate_of_asset_id) per locked naming hard rule.';

CREATE INDEX vault_assets_batch_id_idx
  ON vault_assets (batch_id) WHERE batch_id IS NOT NULL;

CREATE INDEX vault_assets_duplicate_of_idx
  ON vault_assets (duplicate_of_id) WHERE duplicate_of_id IS NOT NULL;

ALTER TABLE vault_assets
  ADD CONSTRAINT vault_assets_duplicate_consistency
  CHECK (
    duplicate_status <> 'confirmed_duplicate'
    OR duplicate_of_id IS NOT NULL
  );

COMMENT ON CONSTRAINT vault_assets_duplicate_consistency ON vault_assets IS
  'Mirror of UI invariant: a row in confirmed_duplicate state must point at the original via duplicate_of_id. NULL duplicate_status passes (legacy rows + rows that never went through duplicate detection).';

-- ── upload_commit — 21-arg overload ─────────────────────────────

-- Extended signature for Phase 1. The original 15-arg upload_commit
-- (PR 2) remains intact — PostgreSQL identifies functions by
-- (name, arg type list) so this is a true overload, not a rewrite.
-- PR 2's call site at src/lib/upload/upload-store.ts continues to
-- resolve to the 15-arg version. PR 1.3 migrates the caller to
-- the 21-arg form and drops the 15-arg overload at that point.

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
  p_original_sha256      text,
  p_batch_id             uuid,
  p_proposal_snapshot    jsonb,
  p_extracted_metadata   jsonb,
  p_metadata_source      jsonb,
  p_duplicate_status     duplicate_status,
  p_duplicate_of_id      uuid
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
    metadata_checksum,
    batch_id,
    proposal_snapshot,
    extracted_metadata,
    metadata_source,
    duplicate_status,
    duplicate_of_id
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
    p_metadata_checksum,
    p_batch_id,
    p_proposal_snapshot,
    p_extracted_metadata,
    p_metadata_source,
    p_duplicate_status,
    p_duplicate_of_id
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

COMMENT ON FUNCTION upload_commit(
  uuid, uuid, text, text, asset_format, validation_declaration_state,
  text, bigint, text, text, text, bigint, integer, integer, text,
  uuid, jsonb, jsonb, jsonb, duplicate_status, uuid
) IS
  'PR 1.1 — 21-arg commit for a batch-aware upload. Same atomic two-row insert as the 15-arg PR 2 form, with the six new batch/metadata/duplicate columns appended. The CHECK constraint on duplicate consistency is enforced by the DB.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (reverse dependency order)
-- ════════════════════════════════════════════════════════════════
-- DROP FUNCTION IF EXISTS upload_commit(
--   uuid, uuid, text, text, asset_format, validation_declaration_state,
--   text, bigint, text, text, text, bigint, integer, integer, text,
--   uuid, jsonb, jsonb, jsonb, duplicate_status, uuid
-- );
-- ALTER TABLE vault_assets DROP CONSTRAINT IF EXISTS vault_assets_duplicate_consistency;
-- DROP INDEX IF EXISTS vault_assets_duplicate_of_idx;
-- DROP INDEX IF EXISTS vault_assets_batch_id_idx;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS duplicate_of_id;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS duplicate_status;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS metadata_source;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS extracted_metadata;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS proposal_snapshot;
-- ALTER TABLE vault_assets DROP COLUMN IF EXISTS batch_id;
-- DROP INDEX IF EXISTS upload_batches_creator_state_idx;
-- DROP TABLE IF EXISTS upload_batches;
-- DROP TYPE  IF EXISTS duplicate_status;
-- DROP TYPE  IF EXISTS upload_batch_state;
