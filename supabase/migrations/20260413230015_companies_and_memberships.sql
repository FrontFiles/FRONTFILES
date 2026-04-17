-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Companies & Company Memberships
--
-- Creates the two missing tables that complete the identity +
-- entitlement + fulfilment layer for launch:
--
--   1. companies          — first-class organizational entity
--   2. company_memberships — user × company role bindings
--
-- WHY THESE ARE NEEDED:
--
--   Multiple existing tables reference companies(id) via FK:
--     licence_grants.grantee_company_id  (Migration 24)
--     certified_packages.owner_company_id (Migration 23)
--     transactions.buyer_company_id       (Migration 23)
--     download_events.company_id          (Migration 25)
--
--   The fulfilment store queries company_memberships for package
--   ownership checks. The entitlement store queries it for
--   company-grant delivery authorization.
--
-- RELATIONSHIP TO buyer_accounts:
--
--   buyer_accounts models "a user's commercial buyer facet"
--   (individual or company buyer). companies models "an
--   organizational entity that can own packages and hold grants."
--
--   A buyer_account with buyer_type='company' is the commercial
--   FACET of a user who acts on behalf of a company. The company
--   itself is the entity in THIS table. The link:
--
--     companies.primary_buyer_account_id → buyer_accounts.id
--
--   This is a 1:1 optional link — not all companies start from a
--   buyer_account, and not all buyer_accounts are companies.
--
-- RELATIONSHIP TO buyer_company_memberships:
--
--   buyer_company_memberships (Migration 9) links users to
--   buyer_accounts with a role. company_memberships (this file)
--   links users to companies directly. Both exist:
--     - buyer_company_memberships: commercial capabilities
--       (who can commit purchases on behalf of a buyer_account)
--     - company_memberships: organizational access
--       (who can download company-owned packages and originals)
--
--   In practice they will converge — if you're an editor in the
--   company buyer_account, you're also an editor in the company.
--   But the structural separation allows company membership to
--   exist independently of the buyer facet.
--
-- MEMBERSHIP STATUS MODEL:
--
--   company_memberships has a status field matching the TypeScript
--   CompanyMembershipRow type already used by the entitlement and
--   fulfilment stores: active, invited, revoked, left.
--
-- DEPENDS ON:
--   Tables: users, buyer_accounts
--   Enums:  buyer_company_role (Migration 1), account_state (Migration 8)
--
-- ROLLBACK: see bottom of file.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUM: COMPANY MEMBERSHIP STATUS                        │
-- │                                                             │
-- │  Matches the TypeScript CompanyMembershipRow.status type    │
-- │  already in use in the entitlement module.                  │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE company_membership_status AS ENUM (
  'active',
  'invited',
  'revoked',
  'left'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  COMPANIES TABLE                                        │
-- │                                                             │
-- │  First-class organizational entity.                         │
-- │                                                             │
-- │  GRAIN: one row per organization on Frontfiles.             │
-- │  A company can own licence grants, certified packages, and  │
-- │  transactions. It has members with roles that determine     │
-- │  download eligibility.                                      │
-- │                                                             │
-- │  IDENTITY:                                                  │
-- │  created_by_user_id records who founded the company.        │
-- │  primary_buyer_account_id links to the commercial facet     │
-- │  (optional — set when the company has a buyer_account).     │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE companies (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name                      text NOT NULL,
  slug                      text NOT NULL,
  state                     account_state NOT NULL DEFAULT 'active',

  -- Legal / billing
  legal_name                text,
  vat_number                text,
  tax_id                    text,
  billing_email             text,
  country_code              char(2),

  -- Origin
  created_by_user_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Link to commercial facet (optional, 1:1)
  primary_buyer_account_id  uuid REFERENCES buyer_accounts(id) ON DELETE SET NULL,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT companies_slug_unique UNIQUE (slug),

  -- Slug format: lowercase alphanumeric + hyphens
  CONSTRAINT companies_slug_format CHECK (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'
  ),

  -- Country code: ISO 3166-1 alpha-2 when present
  CONSTRAINT companies_country_format CHECK (
    country_code IS NULL OR country_code ~ '^[A-Z]{2}$'
  )
);

COMMENT ON TABLE companies IS
  'First-class organizational entity.  Can own licence grants, '
  'certified packages, and transactions.  Members access company '
  'resources via company_memberships with eligible roles.';

COMMENT ON COLUMN companies.created_by_user_id IS
  'The user who created this company.  Always set.  Does not '
  'imply ongoing admin role — role is tracked in company_memberships.';

COMMENT ON COLUMN companies.primary_buyer_account_id IS
  'Links to the buyer_accounts row when this company has a '
  'commercial buyer facet.  NULL for companies that only receive '
  'creator packs (e.g. a news agency that commissions work).';

-- ── Indexes ──

CREATE INDEX idx_companies_slug
  ON companies (slug);

CREATE INDEX idx_companies_state
  ON companies (state)
  WHERE state = 'active';

CREATE INDEX idx_companies_created_by
  ON companies (created_by_user_id);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  COMPANY MEMBERSHIPS TABLE                              │
-- │                                                             │
-- │  Links users to companies with a role and status.           │
-- │                                                             │
-- │  GRAIN: one row per (company, user).                        │
-- │                                                             │
-- │  ROLE POLICY:                                               │
-- │  Download-eligible roles: admin, content_commit_holder,     │
-- │  editor.  The entitlement module and fulfilment store both  │
-- │  filter on these roles when checking company-level access.  │
-- │                                                             │
-- │  STATUS POLICY:                                             │
-- │  Only 'active' memberships authorize access.  invited,      │
-- │  revoked, and left memberships are retained for audit but   │
-- │  do not grant access to company resources.                  │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE company_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role            buyer_company_role NOT NULL,
  status          company_membership_status NOT NULL DEFAULT 'invited',

  invited_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at      timestamptz NOT NULL DEFAULT now(),
  activated_at    timestamptz,
  left_at         timestamptz,
  revoked_at      timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- One membership per user per company
  CONSTRAINT company_memberships_unique UNIQUE (company_id, user_id),

  -- Status → timestamp coherence
  CONSTRAINT cm_active_needs_ts CHECK (
    status != 'active' OR activated_at IS NOT NULL
  ),
  CONSTRAINT cm_left_needs_ts CHECK (
    status != 'left' OR left_at IS NOT NULL
  ),
  CONSTRAINT cm_revoked_needs_ts CHECK (
    status != 'revoked' OR revoked_at IS NOT NULL
  )
);

COMMENT ON TABLE company_memberships IS
  'User × company role binding.  Only status=active grants access '
  'to company-owned resources.  Eligible roles for downloads: '
  'admin, content_commit_holder, editor.';

COMMENT ON COLUMN company_memberships.role IS
  'Reuses buyer_company_role enum.  All three current values '
  '(admin, content_commit_holder, editor) are download-eligible.';

COMMENT ON COLUMN company_memberships.status IS
  'Only active authorizes access.  invited = pending acceptance.  '
  'revoked = removed by admin.  left = voluntary departure.';

-- ── Indexes ──

-- User's company list (account settings, membership checks)
CREATE INDEX idx_cm_user
  ON company_memberships (user_id, status);

-- Company's member list (company admin panel)
CREATE INDEX idx_cm_company
  ON company_memberships (company_id, status);

-- Active members with eligible roles (entitlement + fulfilment queries)
-- This is the hot-path index: both the entitlement store and
-- fulfilment store query for active members with specific roles.
CREATE INDEX idx_cm_active_eligible
  ON company_memberships (user_id, company_id)
  WHERE status = 'active';

-- Company delivery check (entitlement: "does this user have
-- active membership in company X with eligible role?")
CREATE INDEX idx_cm_delivery_check
  ON company_memberships (user_id, company_id, role)
  WHERE status = 'active';

CREATE TRIGGER trg_company_memberships_updated_at
  BEFORE UPDATE ON company_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  VALIDATE DEFERRED FOREIGN KEYS                         │
-- │                                                             │
-- │  Now that companies exists, validate the NOT VALID FKs      │
-- │  from earlier migrations that reference companies(id).      │
-- │                                                             │
-- │  VALIDATE CONSTRAINT is non-blocking for concurrent reads   │
-- │  and writes — it only acquires SHARE UPDATE EXCLUSIVE lock. │
-- └─────────────────────────────────────────────────────────────┘

-- licence_grants.grantee_company_id → companies(id) (added in Migration 24)
-- ALTER TABLE licence_grants
--   VALIDATE CONSTRAINT fk_licence_grants_grantee_company;


-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- ALTER TABLE licence_grants
--   DROP CONSTRAINT IF EXISTS fk_licence_grants_grantee_company;
-- -- (re-add as NOT VALID if needed)
-- DROP TABLE IF EXISTS company_memberships CASCADE;
-- DROP TABLE IF EXISTS companies CASCADE;
-- DROP TYPE IF EXISTS company_membership_status CASCADE;
