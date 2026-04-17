-- ════════════════════════════════════════════════════════════════
-- Migration 16: Licence Grants — Enum Types
--
-- Enums for the entitlement/licence grant layer.
--
-- Reused from prior migrations (NOT recreated here):
--   licence_type  (Migration 5, Direct Offer enums)
--
-- Depends on: nothing (standalone enums)
-- Rollback: DROP TYPE ... CASCADE for each type (see bottom).
-- ════════════════════════════════════════════════════════════════

-- Licence grant lifecycle state (5 states)
-- ONLY 'active' authorizes original delivery. All others fail closed.
CREATE TYPE licence_grant_state AS ENUM (
  'pending',     -- created, awaiting payment confirmation
  'active',      -- rights granted, original delivery authorized
  'suspended',   -- under dispute, rights frozen
  'expired',     -- term-limited licence past expiry
  'revoked'      -- permanently revoked (terminal)
);

-- Source flow that created the grant
CREATE TYPE licence_source_type AS ENUM (
  'direct_offer',        -- from Direct Offer negotiation thread
  'assignment',          -- from commissioned assignment fulfilment
  'catalogue_checkout',  -- from standard catalogue purchase (future)
  'bulk_licence',        -- from bulk licensing flow (future)
  'article_licence'      -- from article/composer transaction (future)
);

-- NOTE: licence_type already exists from Migration 5 (Direct Offer enums):
-- editorial, commercial, broadcast, print, digital, web, merchandise.
-- Do not recreate.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS licence_source_type CASCADE;
-- DROP TYPE IF EXISTS licence_grant_state CASCADE;
