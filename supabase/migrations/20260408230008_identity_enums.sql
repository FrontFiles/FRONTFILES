-- ════════════════════════════════════════════════════════════════
-- Migration 8: Identity Layer — Enum Types
--
-- Enums for the Frontfiles identity persistence layer.
-- One human = one stable identity. Granted types are capabilities.
-- Active user type is session state — NOT stored.
--
-- buyer_company_role already exists (Migration 1, Assignment Engine).
-- All others are new.
--
-- Depends on: nothing (standalone enums)
-- Rollback: DROP TYPE ... CASCADE for each type (see bottom).
-- ════════════════════════════════════════════════════════════════

-- Account lifecycle state (Spec §5)
CREATE TYPE account_state AS ENUM (
  'active',
  'suspended',
  'deleted'
);

-- User-facing session type — collapses buyer variants, excludes staff.
-- Used for granted capabilities, never for stored "active" mode.
CREATE TYPE user_type AS ENUM (
  'creator',
  'buyer',
  'reader'
);

-- Trust badge tier (Spec §2.5)
-- standard = normal identity track
-- protected_source = Tier 2, pseudonymous (post-launch, partner-gated)
CREATE TYPE trust_tier AS ENUM (
  'standard',
  'protected_source'
);

-- Trust badge level (Spec §2.5)
-- Earned, not assigned. Progression: verified → trusted.
CREATE TYPE trust_badge AS ENUM (
  'verified',
  'trusted'
);

-- Identity verification lifecycle (Spec §6.2, Memo §11)
CREATE TYPE verification_status AS ENUM (
  'verified',
  'pending_reverification',
  'expired'
);

-- Buyer account subtype (Spec §6.4)
CREATE TYPE buyer_type AS ENUM (
  'individual',
  'company'
);

-- NOTE: buyer_company_role already exists from Migration 1
-- (assignment_engine_enums.sql): admin, content_commit_holder, editor.
-- Do not recreate.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS buyer_type CASCADE;
-- DROP TYPE IF EXISTS verification_status CASCADE;
-- DROP TYPE IF EXISTS trust_badge CASCADE;
-- DROP TYPE IF EXISTS trust_tier CASCADE;
-- DROP TYPE IF EXISTS user_type CASCADE;
-- DROP TYPE IF EXISTS account_state CASCADE;
