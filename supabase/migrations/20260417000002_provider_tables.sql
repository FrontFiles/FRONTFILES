-- ════════════════════════════════════════════════════════════════
-- Migration: External Providers — Tables
--
-- Three tables make up the provider foundation:
--
--   1. external_connections
--        Polymorphic ownership over a provider account. One row
--        per (provider, owner) pair. The application registry in
--        `lib/providers/registry.ts` is the source of truth for
--        which provider keys are valid and which auth types they
--        support; this table stores the live connections.
--
--   2. external_credentials
--        Credential metadata SHOULD live here. The actual secret
--        material does NOT — `secret_ref` is an opaque pointer
--        into a real secret store (Supabase Vault / AWS Secrets
--        Manager / env). See `lib/providers/secrets.ts` for the
--        resolver interface. NEVER store plaintext tokens here.
--
--   3. external_webhook_events
--        The append-only ledger every provider webhook gets
--        ingested into. Dedupe key is `(provider, external_event_id)`
--        — replays land on the same row. Processing is
--        idempotent: a row's `processing_status` advances forward
--        only.
--
-- DESIGN NOTES
--
-- - `provider` columns are TEXT (not enum). The application
--   validates against the registry, so adding a new provider is
--   one TS file and zero ALTER TYPE migrations.
--
-- - `owner_id` is nullable so platform-owned connections can
--   live in the same table. A CHECK constraint enforces:
--     owner_type='platform' → owner_id IS NULL
--     owner_type<>'platform' → owner_id IS NOT NULL
--
-- - `external_account_id` (e.g. Stripe `acct_*`, Google account
--   id) is the provider's stable identifier for the account.
--   We don't FK it anywhere; it's a label for cross-system joins.
--
-- - `metadata` is jsonb so each provider can stash adapter-
--   specific normalized state (Stripe `business_type`, Google
--   token expiry hint, etc.) without schema churn.
--
-- Depends on:
--   20260417000001_provider_enums.sql
--   20260408230009_identity_tables.sql (users)
--   20260413230015_companies_and_memberships.sql (companies)
--
-- Rollback: DROP TABLE for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- external_connections
-- ─────────────────────────────────────────────────────────────

CREATE TABLE external_connections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider identity ─────────────────────────────────────────
  provider             text NOT NULL,
  category             provider_category NOT NULL,

  -- Polymorphic ownership ─────────────────────────────────────
  owner_type           provider_owner_type NOT NULL,
  -- Polymorphic id. Points at users(id) for owner_type='user',
  -- companies(id) for owner_type='company', a future workspaces
  -- table for owner_type='workspace', and is NULL for
  -- owner_type='platform'. PostgreSQL cannot model a single FK
  -- against multiple targets, so existence is enforced in the
  -- service layer (lib/providers/service.ts -> createConnection)
  -- and at the DB by the CHECK below + the partial UNIQUE index
  -- in the indexes migration. This mirrors how
  -- `posts.attachment_id` is held FK-free for polymorphism over
  -- vault_assets / stories / articles / collections.
  owner_id             uuid,

  -- Provider account identity ─────────────────────────────────
  external_account_id  text NOT NULL,
  account_label        text,

  -- Lifecycle ─────────────────────────────────────────────────
  status               provider_connection_status NOT NULL DEFAULT 'pending',
  granted_scopes       text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Audit ─────────────────────────────────────────────────────
  created_by_user_id   uuid REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at           timestamptz,
  last_synced_at       timestamptz,

  -- Adapter-specific normalized state ─────────────────────────
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- ── Invariants ──────────────────────────────────────────

  -- Platform connections are not owned by a user/company row.
  CONSTRAINT external_connections_platform_owner_null
    CHECK (
      (owner_type = 'platform' AND owner_id IS NULL)
      OR (owner_type <> 'platform' AND owner_id IS NOT NULL)
    ),

  -- Revoked connections must have a revoked_at timestamp.
  CONSTRAINT external_connections_revoked_consistency
    CHECK (
      (status = 'revoked' AND revoked_at IS NOT NULL)
      OR (status <> 'revoked')
    )
);

COMMENT ON TABLE external_connections IS
  'External provider connections. Polymorphic ownership: user, company, workspace, or platform. Validated against the application registry in lib/providers/registry.ts.';

COMMENT ON COLUMN external_connections.provider IS
  'Provider key. TEXT not enum so new providers are zero-migration. Validated by lib/providers/registry.ts.';

COMMENT ON COLUMN external_connections.metadata IS
  'Adapter-specific normalized state. NEVER stores plaintext secrets — see external_credentials.';

-- ─────────────────────────────────────────────────────────────
-- external_credentials
-- ─────────────────────────────────────────────────────────────

CREATE TABLE external_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  connection_id   uuid NOT NULL UNIQUE
                  REFERENCES external_connections(id) ON DELETE CASCADE,

  auth_type       provider_auth_type NOT NULL,

  -- Opaque pointer into a real secret store. Format is
  -- adapter-defined: e.g. 'stripe:acct_xxx:secret_key',
  -- 'google:user_123:refresh_token'. Resolved at runtime by
  -- `lib/providers/secrets.ts -> resolveSecret(ref)`.
  --
  -- This column NEVER stores plaintext token material. The dev
  -- fallback resolver reads from process.env when the ref is
  -- prefixed `env:`, but production deploys MUST point at a
  -- real secret manager.
  secret_ref      text NOT NULL,

  refreshable     boolean NOT NULL DEFAULT false,
  expires_at      timestamptz,
  last_rotated_at timestamptz,

  scopes_granted  text[] NOT NULL DEFAULT ARRAY[]::text[],

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT external_credentials_no_plaintext
    CHECK (secret_ref NOT LIKE 'plain:%')
);

COMMENT ON TABLE external_credentials IS
  'Credential metadata for external connections. NEVER stores plaintext secrets — secret_ref points at an external secret store.';

COMMENT ON COLUMN external_credentials.secret_ref IS
  'Opaque pointer into a real secret store. Format adapter-defined. The CHECK constraint forbids the literal "plain:" prefix to make accidental plaintext storage loud.';

-- ─────────────────────────────────────────────────────────────
-- external_webhook_events
-- ─────────────────────────────────────────────────────────────

CREATE TABLE external_webhook_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  provider            text NOT NULL,
  external_event_id   text NOT NULL,
  event_type          text NOT NULL,

  -- Raw verified payload. Adapter-normalized state goes elsewhere
  -- (per-domain tables). This column is the audit trail.
  payload             jsonb NOT NULL,

  signature_status    provider_webhook_signature_status NOT NULL DEFAULT 'unverified',
  processing_status   provider_webhook_processing_status NOT NULL DEFAULT 'pending',

  -- The connection this event belongs to, when resolvable. NULL
  -- for platform-level events that don't bind to one connection.
  -- ON DELETE SET NULL: if a connection is ever hard-deleted
  -- (operator cleanup, GDPR right-to-erasure), the dependent
  -- webhook event rows must NOT block the delete and must NOT
  -- be cascaded away — they are the append-only audit trail.
  -- Breaking the link and keeping the row is the right behavior.
  connection_id       uuid REFERENCES external_connections(id) ON DELETE SET NULL,

  -- Lifecycle ─────────────────────────────────────────────────
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  retry_count         int NOT NULL DEFAULT 0,
  error_message       text
);

COMMENT ON TABLE external_webhook_events IS
  'Append-only webhook ledger. Dedupe by (provider, external_event_id). Processing is idempotent and forward-only.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS external_webhook_events;
-- DROP TABLE IF EXISTS external_credentials;
-- DROP TABLE IF EXISTS external_connections;
