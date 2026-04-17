-- ════════════════════════════════════════════════════════════════
-- Migration 10: Identity Layer — Indexes
--
-- Performance indexes for:
-- - Username lookup (already UNIQUE — covered by constraint index)
-- - Email lookup (already UNIQUE — covered by constraint index)
-- - User state queries (staff: suspended users, active creators)
-- - Creator discovery (badge, location, specialisation)
-- - Buyer lookup (type, company)
-- - Company membership (user's roles, account's members)
-- - Granted types (user lookup)
--
-- Depends on: 20260408230009_identity_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- USERS
-- username and email already have UNIQUE constraint indexes.
-- ──────────────────────────────────────────────

-- Staff queries: users by account state
CREATE INDEX idx_users_account_state
  ON users (account_state)
  WHERE account_state != 'active';

-- Temporal sort for admin views
CREATE INDEX idx_users_created_at
  ON users (created_at DESC);

-- ──────────────────────────────────────────────
-- USER_GRANTED_TYPES
-- ──────────────────────────────────────────────

-- All granted types for a user (session hydration)
CREATE INDEX idx_granted_types_user
  ON user_granted_types (user_id);

-- All users of a given type (platform stats, creator counts)
CREATE INDEX idx_granted_types_type
  ON user_granted_types (user_type);

-- ──────────────────────────────────────────────
-- CREATOR_PROFILES
-- user_id already has UNIQUE constraint index.
-- ──────────────────────────────────────────────

-- Discovery: creators by trust badge (search filters, badge management)
CREATE INDEX idx_creator_profiles_badge
  ON creator_profiles (trust_badge);

-- Discovery: creators by verification status (reverification queue)
CREATE INDEX idx_creator_profiles_verification
  ON creator_profiles (verification_status)
  WHERE verification_status != 'verified';

-- Discovery: creators by location (geo search)
CREATE INDEX idx_creator_profiles_location
  ON creator_profiles (location_base)
  WHERE location_base IS NOT NULL;

-- ──────────────────────────────────────────────
-- BUYER_ACCOUNTS
-- user_id already has UNIQUE constraint index.
-- ──────────────────────────────────────────────

-- Buyer type filter (individual vs company)
CREATE INDEX idx_buyer_accounts_type
  ON buyer_accounts (buyer_type);

-- ──────────────────────────────────────────────
-- BUYER_COMPANY_MEMBERSHIPS
-- ──────────────────────────────────────────────

-- All members of a company buyer account
CREATE INDEX idx_company_memberships_account
  ON buyer_company_memberships (buyer_account_id);

-- All company roles held by a user
CREATE INDEX idx_company_memberships_user
  ON buyer_company_memberships (user_id);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_company_memberships_user;
-- DROP INDEX IF EXISTS idx_company_memberships_account;
-- DROP INDEX IF EXISTS idx_buyer_accounts_type;
-- DROP INDEX IF EXISTS idx_creator_profiles_location;
-- DROP INDEX IF EXISTS idx_creator_profiles_verification;
-- DROP INDEX IF EXISTS idx_creator_profiles_badge;
-- DROP INDEX IF EXISTS idx_granted_types_type;
-- DROP INDEX IF EXISTS idx_granted_types_user;
-- DROP INDEX IF EXISTS idx_users_created_at;
-- DROP INDEX IF EXISTS idx_users_account_state;
