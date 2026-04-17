-- ════════════════════════════════════════════════════════════════
-- Migration 18: Licence Grants — Indexes
--
-- Performance indexes for:
-- - Original delivery check: (asset_id, buyer_id, state)
-- - Buyer's licence list: (buyer_id, state)
-- - Asset's licence list: (asset_id, state)
-- - Source flow lookup: (source_type, source_id)
-- - Creator's granted licences: (creator_id, state)
-- - Exclusive grant enforcement: partial UNIQUE
--
-- Depends on: 20260413230006_licence_grant_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- DELIVERY QUERY — the critical path
-- "Does this user have an active grant for this asset?"
-- Used by can_serve_original(user_id, asset_id)
-- ──────────────────────────────────────────────

CREATE INDEX idx_licence_grants_delivery
  ON licence_grants (asset_id, buyer_id, state);

-- ──────────────────────────────────────────────
-- BUYER'S LICENCE LIST
-- "Show me all my active/expired/revoked licences"
-- Used by buyer account page, download history
-- ──────────────────────────────────────────────

CREATE INDEX idx_licence_grants_buyer
  ON licence_grants (buyer_id, state, created_at DESC);

-- ──────────────────────────────────────────────
-- ASSET'S LICENCE LIST
-- "Who has licenced this asset?"
-- Used by creator vault, rights management, exclusivity checks
-- ──────────────────────────────────────────────

CREATE INDEX idx_licence_grants_asset
  ON licence_grants (asset_id, state, created_at DESC);

-- ──────────────────────────────────────────────
-- SOURCE FLOW LOOKUP
-- "Find the licence grant(s) created by this offer/assignment"
-- Used when completing a transaction or resolving a dispute
-- ──────────────────────────────────────────────

CREATE INDEX idx_licence_grants_source
  ON licence_grants (source_type, source_id);

-- ──────────────────────────────────────────────
-- CREATOR'S OUTGOING LICENCES
-- "Show me all licences granted on my assets"
-- Used by creator earnings/settlements view
-- ──────────────────────────────────────────────

CREATE INDEX idx_licence_grants_creator
  ON licence_grants (creator_id, state, created_at DESC);

-- ──────────────────────────────────────────────
-- EXCLUSIVE GRANT ENFORCEMENT
-- At most one ACTIVE exclusive grant per (asset, licence_type).
-- Multiple non-exclusive active grants are permitted.
-- Expired/revoked exclusive grants do not block new ones.
-- ──────────────────────────────────────────────

CREATE UNIQUE INDEX idx_licence_grants_exclusive_active
  ON licence_grants (asset_id, licence_type)
  WHERE state = 'active' AND exclusive = true;

-- ──────────────────────────────────────────────
-- TERM EXPIRY JOB
-- Background job: find active grants past their term_end
-- ──────────────────────────────────────────────

CREATE INDEX idx_licence_grants_expiry
  ON licence_grants (term_end)
  WHERE state = 'active' AND term_end IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_licence_grants_expiry;
-- DROP INDEX IF EXISTS idx_licence_grants_exclusive_active;
-- DROP INDEX IF EXISTS idx_licence_grants_creator;
-- DROP INDEX IF EXISTS idx_licence_grants_source;
-- DROP INDEX IF EXISTS idx_licence_grants_asset;
-- DROP INDEX IF EXISTS idx_licence_grants_buyer;
-- DROP INDEX IF EXISTS idx_licence_grants_delivery;
