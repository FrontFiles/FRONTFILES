-- ════════════════════════════════════════════════════════════════
-- Migration 9: Identity Layer — Core Tables
--
-- Five tables implementing the Frontfiles identity model:
--   1. users               — one stable row per human
--   2. user_granted_types   — granted capabilities (creator/buyer/reader)
--   3. creator_profiles     — public creator projection (1:1 with users)
--   4. buyer_accounts       — commercial buyer facet (1:1 with users)
--   5. buyer_company_memberships — role within a company buyer account
--
-- Canon rules enforced at schema level:
--   - One human = one users row
--   - Granted types are capabilities, not separate identities
--   - Active user type is NOT stored (session only)
--   - creator_profiles and buyer_accounts are facets of the same user
--   - display_name and email live on users only, never duplicated
--   - Company roles are organizational bindings, not user types
--
-- users.id is designed to equal auth.users.id (Supabase Auth UID).
-- The FK to auth.users is not declared here — it is added when
-- Supabase Auth RLS policies are configured.
--
-- Money: n/a for identity tables.
-- Timestamps: timestamptz, UTC.
-- IDs: uuid with gen_random_uuid() default.
--
-- Depends on: 20260408230008_identity_enums.sql
-- Rollback: DROP TABLE in reverse dependency order (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. USERS — Core identity record
-- TypeScript: SessionUser + AccountType + AccountState
--
-- One row per human on the platform.
-- Every other identity table points back here.
-- ──────────────────────────────────────────────

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username        text NOT NULL,
  display_name    text NOT NULL,
  email           text NOT NULL,
  avatar_url      text,
  account_state   account_state NOT NULL DEFAULT 'active',
  founding_member boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Username: 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen
  CONSTRAINT users_username_format CHECK (
    username ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$'
  ),

  -- Uniqueness
  CONSTRAINT users_username_unique UNIQUE (username),
  CONSTRAINT users_email_unique UNIQUE (email)
);

COMMENT ON TABLE users IS 'Core identity record. One row per human. users.id = auth.users.id when Supabase Auth is wired.';
COMMENT ON COLUMN users.username IS 'Root-level public URL: frontfiles.com/{username}. Immutable after 30-day grace.';
COMMENT ON COLUMN users.display_name IS 'From identity verification. Authoritative name — not duplicated into profiles.';
COMMENT ON COLUMN users.founding_member IS 'Permanent designation. Cannot be revoked once earned (Spec §6.7).';

-- ──────────────────────────────────────────────
-- 2. USER_GRANTED_TYPES — Capability grants
-- TypeScript: grantedUserTypes: UserType[]
--
-- A user may have 1, 2, or 3 granted types.
-- These are capabilities, not identities.
-- active_user_type is session-only — NOT stored here.
-- ──────────────────────────────────────────────

CREATE TABLE user_granted_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_type   user_type NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),

  -- One grant per type per user
  CONSTRAINT user_granted_types_unique UNIQUE (user_id, user_type)
);

COMMENT ON TABLE user_granted_types IS 'Granted capabilities. A user has 1-3 rows. Active type is session state, not stored.';
COMMENT ON COLUMN user_granted_types.user_type IS 'creator / buyer / reader — what this user can do, not who they are.';

-- ──────────────────────────────────────────────
-- 3. CREATOR_PROFILES — Public creator projection
-- TypeScript: CreatorProfile (minus display_name, email, avatar — those live on users)
--
-- One per user who has 'creator' granted type.
-- Public-facing. Queryable by badge, location, specialisation.
-- ──────────────────────────────────────────────

CREATE TABLE creator_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  professional_title    text,
  location_base         text,
  website_url           text,
  biography             text,
  trust_tier            trust_tier NOT NULL DEFAULT 'standard',
  trust_badge           trust_badge NOT NULL DEFAULT 'verified',
  verification_status   verification_status NOT NULL DEFAULT 'verified',
  last_verified_at      timestamptz,
  coverage_areas        text[] NOT NULL DEFAULT '{}',
  specialisations       text[] NOT NULL DEFAULT '{}',
  media_affiliations    text[] NOT NULL DEFAULT '{}',
  press_accreditations  text[] NOT NULL DEFAULT '{}',
  published_in          text[] NOT NULL DEFAULT '{}',
  skills                text[] NOT NULL DEFAULT '{}',
  also_me_links         text[] NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE creator_profiles IS 'Public creator projection. 1:1 with users via UNIQUE FK. display_name/email/avatar read from users.';
COMMENT ON COLUMN creator_profiles.trust_tier IS 'standard = normal track. protected_source = Tier 2 pseudonymous (post-launch).';
COMMENT ON COLUMN creator_profiles.also_me_links IS 'External professional links. Disabled for Tier 2 creators (enforced in application).';
COMMENT ON COLUMN creator_profiles.verification_status IS 'Verified at onboarding; periodic and event-driven re-verification applies (Memo §11).';

-- ──────────────────────────────────────────────
-- 4. BUYER_ACCOUNTS — Commercial buyer facet
-- TypeScript: BuyerAccount (minus display_name, email — those live on users)
--
-- One per user who has 'buyer' granted type.
-- individual = personal buyer. company = organizational buyer.
-- ──────────────────────────────────────────────

CREATE TABLE buyer_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  buyer_type    buyer_type NOT NULL,
  company_name  text,
  vat_number    text,
  tax_id        text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Company buyers must have a company name
  CONSTRAINT buyer_company_name_required CHECK (
    (buyer_type = 'company' AND company_name IS NOT NULL AND company_name != '')
    OR (buyer_type = 'individual')
  )
);

COMMENT ON TABLE buyer_accounts IS 'Commercial buyer facet. 1:1 with users via UNIQUE FK. display_name/email read from users.';
COMMENT ON COLUMN buyer_accounts.vat_number IS 'VAT-registered buyer track (EU). NULL for non-VAT jurisdictions.';
COMMENT ON COLUMN buyer_accounts.tax_id IS 'EIN/TIN for non-VAT jurisdictions (US, etc). NULL for VAT-registered.';

-- ──────────────────────────────────────────────
-- 5. BUYER_COMPANY_MEMBERSHIPS — Role bindings
-- TypeScript: BuyerCompanyRole within a company buyer account
--
-- Links users to company buyer accounts with a specific role.
-- A user can be a creator (own identity) AND an editor
-- (role in someone else's company buyer account).
-- ──────────────────────────────────────────────

CREATE TABLE buyer_company_memberships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_account_id  uuid NOT NULL REFERENCES buyer_accounts(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              buyer_company_role NOT NULL,
  granted_at        timestamptz NOT NULL DEFAULT now(),

  -- One role per user per company
  CONSTRAINT buyer_membership_unique UNIQUE (buyer_account_id, user_id)
);

COMMENT ON TABLE buyer_company_memberships IS 'Role binding: user × company buyer account. A user may hold roles in multiple companies.';
COMMENT ON COLUMN buyer_company_memberships.role IS 'admin / content_commit_holder / editor. Reuses enum from Assignment Engine.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (reverse dependency order)
-- ════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS buyer_company_memberships CASCADE;
-- DROP TABLE IF EXISTS buyer_accounts CASCADE;
-- DROP TABLE IF EXISTS creator_profiles CASCADE;
-- DROP TABLE IF EXISTS user_granted_types CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
