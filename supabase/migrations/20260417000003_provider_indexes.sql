-- ════════════════════════════════════════════════════════════════
-- Migration: External Providers — Indexes
--
-- Performance + uniqueness indexes for the provider tables.
--
-- Depends on: 20260417000002_provider_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- external_connections
-- ─────────────────────────────────────────────────────────────

-- Primary lookup: "connections owned by user X" /
-- "connections owned by company Y". Partial on active so the
-- common "do I have an active billing connection" probe is
-- a single seek.
CREATE INDEX idx_external_connections_owner_active
  ON external_connections (owner_type, owner_id, provider)
  WHERE status = 'active';

-- All-statuses variant for management surfaces (settings page,
-- admin debugging) where we want to see revoked / errored
-- connections too.
CREATE INDEX idx_external_connections_owner_all
  ON external_connections (owner_type, owner_id, created_at DESC);

-- Uniqueness: at most one ACTIVE connection per
-- (owner, provider). Revoked rows are ignored so a user can
-- disconnect → reconnect without colliding with their old row.
-- Platform connections collapse owner_id to NULL; the partial
-- index uses COALESCE to a sentinel so the constraint applies
-- to platform rows too.
CREATE UNIQUE INDEX uq_external_connections_owner_provider_active
  ON external_connections (
    owner_type,
    COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    provider
  )
  WHERE status = 'active';

-- Cross-account lookup: "find the connection by its provider
-- account id". Used by webhook adapters that have a Stripe
-- `acct_*` and need to resolve which Frontfiles owner it
-- belongs to.
CREATE INDEX idx_external_connections_external_account
  ON external_connections (provider, external_account_id);

-- ─────────────────────────────────────────────────────────────
-- external_credentials
-- ─────────────────────────────────────────────────────────────

-- 1:1 with connection — already enforced by the column UNIQUE,
-- but a named index makes EXPLAIN output friendlier.
CREATE INDEX idx_external_credentials_connection
  ON external_credentials (connection_id);

-- Find credentials due for refresh. Partial on `refreshable`
-- so the index stays small.
CREATE INDEX idx_external_credentials_expiry
  ON external_credentials (expires_at)
  WHERE refreshable = true AND expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- external_webhook_events
-- ─────────────────────────────────────────────────────────────

-- DEDUPE: at most one row per (provider, external_event_id).
-- This is what makes webhook ingestion idempotent — the
-- INSERT … ON CONFLICT DO NOTHING in
-- `lib/providers/service.ts -> recordWebhookEvent` rides on
-- this constraint.
CREATE UNIQUE INDEX uq_external_webhook_events_dedupe
  ON external_webhook_events (provider, external_event_id);

-- Operator query: "show pending events for provider X"
CREATE INDEX idx_external_webhook_events_pending
  ON external_webhook_events (provider, received_at DESC)
  WHERE processing_status = 'pending';

-- Operator query: "show dead-letter events for provider X"
CREATE INDEX idx_external_webhook_events_dead_letter
  ON external_webhook_events (provider, received_at DESC)
  WHERE processing_status = 'dead_letter';

-- Connection-scoped lookup: "what events does this connection
-- have a history of". Partial on non-null because most rows
-- will eventually have a connection_id once adapters resolve it.
CREATE INDEX idx_external_webhook_events_connection
  ON external_webhook_events (connection_id, received_at DESC)
  WHERE connection_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_external_webhook_events_connection;
-- DROP INDEX IF EXISTS idx_external_webhook_events_dead_letter;
-- DROP INDEX IF EXISTS idx_external_webhook_events_pending;
-- DROP INDEX IF EXISTS uq_external_webhook_events_dedupe;
-- DROP INDEX IF EXISTS idx_external_credentials_expiry;
-- DROP INDEX IF EXISTS idx_external_credentials_connection;
-- DROP INDEX IF EXISTS idx_external_connections_external_account;
-- DROP INDEX IF EXISTS uq_external_connections_owner_provider_active;
-- DROP INDEX IF EXISTS idx_external_connections_owner_all;
-- DROP INDEX IF EXISTS idx_external_connections_owner_active;
