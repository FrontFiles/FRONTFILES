-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Entitlement Hardening of licence_grants
--
-- Evolves the existing licence_grants table (Migrations 16–18)
-- into the hardened download-authorization model.
--
-- This is an ALTER migration.  It does NOT drop and recreate.
-- The table's identity, existing FKs from transaction_line_items
-- and certified_package_items, and all existing indexes remain.
--
-- ── WHAT CHANGES ──
--
--   ADD    grantee_company_id       company-level grantee FK
--   ADD    entitlement_source_type  new entitlement_source enum
--   ADD    granted_by_user_id       audit: who created this grant
--   ADD    granted_at               when the entitlement became effective
--   RELAX  source_type              drop NOT NULL (NULL for admin/system)
--   RELAX  source_id                drop NOT NULL (NULL for admin/system)
--   DROP   negotiated_amount_cents  → lives on transaction_line_items
--   DROP   listed_price_at_grant_cents → lives on certified_package_items
--
-- ── CRITICAL AUTHORIZATION BOUNDARY ──
--
--   licence_grants is the SOLE source of truth for original-file
--   delivery authorization.  The delivery API checks ONLY:
--
--     licence_grants.state = 'active'
--     AND (term_end IS NULL OR term_end > now())
--     AND (buyer_id = requesting_user
--          OR grantee_company_id IN user's active companies)
--
--   The following are NOT authorization signals:
--     × certified_packages / certified_package_artifacts existing
--     × asset_media rows with role = 'original' existing
--     × storage_ref being non-NULL on any row
--     × a user being the owner of a certified_package
--
--   If no matching active grant exists → 404.  Fail closed.
--
-- DEPENDS ON:
--   Tables: users, companies, vault_assets, transactions
--   Enums:  licence_grant_state (Migration 16), licence_type (Migration 5)
--   Prior:  Migration 12 backfill (transaction_id column + FK already added)
--
-- ROLLBACK: see bottom of file.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  NEW ENUM                                               │
-- │                                                             │
-- │  What class of event created this entitlement.              │
-- │                                                             │
-- │  This is NOT the same axis as licence_source_type, which    │
-- │  identifies the specific commercial flow (direct_offer,     │
-- │  assignment, catalogue_checkout, etc.).                     │
-- │                                                             │
-- │  entitlement_source is the broader categorization:          │
-- │  did this grant come from a commercial transaction, an      │
-- │  admin override, or a platform-automated action?            │
-- │                                                             │
-- │  We do not add values to licence_source_type because that   │
-- │  enum is shared with transactions.source_type, where        │
-- │  admin/system values would be semantically invalid.         │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE entitlement_source AS ENUM (
  'transaction',      -- fulfilment of a paid commercial transaction
  'admin_grant',      -- manual override by a platform admin
  'system_grant'      -- automated platform action (future: creator
                      -- portfolio access, partnership import, migration)
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  ADD COLUMNS                                            │
-- │                                                             │
-- │  All added nullable initially.  Backfilled in §3.           │
-- │  NOT NULL set in §4 after backfill.                         │
-- └─────────────────────────────────────────────────────────────┘

-- 2a. Company-level grantee.
-- When set, any active member of this company is authorized to
-- download originals for this asset.  buyer_id remains NOT NULL —
-- the purchasing/granting user is always recorded.
ALTER TABLE licence_grants
  ADD COLUMN IF NOT EXISTS grantee_company_id uuid;

-- 2b. Entitlement source type (the new primary source indicator).
ALTER TABLE licence_grants
  ADD COLUMN IF NOT EXISTS entitlement_source_type entitlement_source;

-- 2c. Who created or approved this grant (audit trail).
ALTER TABLE licence_grants
  ADD COLUMN IF NOT EXISTS granted_by_user_id uuid;

-- 2d. When the entitlement became effective.
-- May differ from created_at for backdated admin grants.
ALTER TABLE licence_grants
  ADD COLUMN IF NOT EXISTS granted_at timestamptz;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  BACKFILL EXISTING DATA                                 │
-- │                                                             │
-- │  All existing rows are commercially-sourced grants.         │
-- │  Set entitlement_source_type = 'transaction' and            │
-- │  granted_at = created_at for every row.                     │
-- └─────────────────────────────────────────────────────────────┘

UPDATE licence_grants
SET entitlement_source_type = 'transaction'
WHERE entitlement_source_type IS NULL;

UPDATE licence_grants
SET granted_at = created_at
WHERE granted_at IS NULL;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  SET NOT NULL (after backfill)                          │
-- │                                                             │
-- │  These acquire ShareUpdateExclusiveLock + table scan.       │
-- │  Non-blocking for reads and concurrent writes.              │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE licence_grants
  ALTER COLUMN entitlement_source_type SET NOT NULL;

ALTER TABLE licence_grants
  ALTER COLUMN granted_at SET NOT NULL;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  RELAX source_type / source_id TO NULLABLE              │
-- │                                                             │
-- │  These columns carry the specific commercial-flow origin    │
-- │  (direct_offer, assignment, etc.) and the polymorphic       │
-- │  source record ID.  They are only meaningful for            │
-- │  transaction-sourced grants.                                │
-- │                                                             │
-- │  Admin and system grants have no commercial flow —          │
-- │  source_type and source_id are honestly NULL.               │
-- │                                                             │
-- │  DROP NOT NULL is instant (no rewrite, no lock escalation). │
-- │  Existing rows are unchanged (all have values set).         │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE licence_grants
  ALTER COLUMN source_type DROP NOT NULL;

ALTER TABLE licence_grants
  ALTER COLUMN source_id DROP NOT NULL;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §6  ADD FOREIGN KEYS (NOT VALID)                           │
-- │                                                             │
-- │  NOT VALID: new inserts/updates are validated immediately.  │
-- │  Existing rows are not retroactively checked.               │
-- │  Run VALIDATE CONSTRAINT separately after backfill.         │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE licence_grants
  ADD CONSTRAINT fk_licence_grants_grantee_company
  FOREIGN KEY (grantee_company_id) REFERENCES companies(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE licence_grants
  ADD CONSTRAINT fk_licence_grants_granted_by
  FOREIGN KEY (granted_by_user_id) REFERENCES users(id)
  ON DELETE RESTRICT
  NOT VALID;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §7  DROP FINANCIAL FIELDS                                  │
-- │                                                             │
-- │  Pricing facts belong elsewhere:                            │
-- │    negotiated_amount_cents   → transaction_line_items        │
-- │                                .line_total_cents             │
-- │    listed_price_at_grant_cents → certified_package_items     │
-- │                                .listed_price_at_grant_cents  │
-- │                                                             │
-- │  The entitlement table must be pure authorization truth,    │
-- │  not a commercial snapshot.                                 │
-- │                                                             │
-- │  Constraints dropped first, then columns.                   │
-- │  DROP COLUMN is instant in PostgreSQL (no rewrite).         │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE licence_grants
  DROP CONSTRAINT IF EXISTS licence_grants_negotiated_positive;

ALTER TABLE licence_grants
  DROP CONSTRAINT IF EXISTS licence_grants_listed_positive;

ALTER TABLE licence_grants
  DROP COLUMN IF EXISTS negotiated_amount_cents;

ALTER TABLE licence_grants
  DROP COLUMN IF EXISTS listed_price_at_grant_cents;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §8  CHECK CONSTRAINTS                                      │
-- │                                                             │
-- │  Source coherence: transaction-sourced grants must have      │
-- │  source_type, source_id, AND transaction_id set.            │
-- │  Admin grants must record who created them.                 │
-- │                                                             │
-- │  NOT VALID on txn coherence: existing rows have             │
-- │  entitlement_source_type = 'transaction' but may have       │
-- │  transaction_id = NULL (not yet backfilled from upstream).  │
-- │  Run VALIDATE CONSTRAINT after transaction_id backfill.     │
-- └─────────────────────────────────────────────────────────────┘

-- Transaction-sourced grants must have commercial provenance.
ALTER TABLE licence_grants
  ADD CONSTRAINT licence_grants_txn_source_coherent CHECK (
    entitlement_source_type != 'transaction'
    OR (
      source_type IS NOT NULL
      AND source_id IS NOT NULL
      AND transaction_id IS NOT NULL
    )
  ) NOT VALID;

-- Admin grants must record who authorized them.
ALTER TABLE licence_grants
  ADD CONSTRAINT licence_grants_admin_needs_actor CHECK (
    entitlement_source_type != 'admin_grant'
    OR granted_by_user_id IS NOT NULL
  );

-- Non-transaction grants should not have transaction_id set.
ALTER TABLE licence_grants
  ADD CONSTRAINT licence_grants_non_txn_no_transaction CHECK (
    entitlement_source_type = 'transaction'
    OR transaction_id IS NULL
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §9  INDEXES                                                │
-- │                                                             │
-- │  New indexes for company-grant delivery, active-entitlement │
-- │  queries, and uniqueness enforcement.                       │
-- │                                                             │
-- │  Existing indexes from Migration 18 remain:                 │
-- │    idx_licence_grants_delivery  (asset, buyer, state)       │
-- │    idx_licence_grants_buyer     (buyer, state, created_at)  │
-- │    idx_licence_grants_asset     (asset, state, created_at)  │
-- │    idx_licence_grants_source    (source_type, source_id)    │
-- │    idx_licence_grants_creator   (creator, state, created_at)│
-- │    idx_licence_grants_exclusive_active  UNIQUE partial      │
-- │    idx_licence_grants_expiry    (term_end) WHERE active     │
-- │  And from Migration 12 backfill:                            │
-- │    idx_licence_grants_transaction  (transaction_id)         │
-- └─────────────────────────────────────────────────────────────┘

-- Company-level delivery check.
-- "Does this user's company have an active grant for this asset?"
CREATE INDEX idx_licence_grants_company_delivery
  ON licence_grants (asset_id, grantee_company_id)
  WHERE grantee_company_id IS NOT NULL
    AND state = 'active';

-- Company's grant list (company admin / legal view).
CREATE INDEX idx_licence_grants_company
  ON licence_grants (grantee_company_id, state, created_at DESC)
  WHERE grantee_company_id IS NOT NULL;

-- Active entitlements per asset (rights management, admin overview).
CREATE INDEX idx_licence_grants_asset_active
  ON licence_grants (asset_id)
  WHERE state = 'active';

-- Entitlement source type (admin views: "all admin-granted entitlements").
CREATE INDEX idx_licence_grants_ent_source
  ON licence_grants (entitlement_source_type, created_at DESC);

-- ──────────────────────────────────────────────
-- ACTIVE ENTITLEMENT UNIQUENESS
--
-- At most one active or pending entitlement per
-- (asset, buyer, licence_type).
--
-- This prevents accidental duplicate grants for the same right.
-- Expired/revoked grants do not block renewals.
-- ──────────────────────────────────────────────

CREATE UNIQUE INDEX uq_licence_grants_active_per_buyer
  ON licence_grants (asset_id, buyer_id, licence_type)
  WHERE state IN ('active', 'pending');


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §10  COMMENTS                                              │
-- │                                                             │
-- │  Update table and column comments to reflect the hardened   │
-- │  authorization semantics.                                   │
-- └─────────────────────────────────────────────────────────────┘

COMMENT ON TABLE licence_grants IS
  'CANONICAL AUTHORIZATION TABLE for original-file delivery.  '
  'One row per buyer × asset × licence_type × source.  '
  'ONLY state = active AND term not expired authorizes download.  '
  'Storage existence (asset_media) does NOT imply authorization.  '
  'Package existence (certified_packages) does NOT imply authorization.  '
  'This table is the SOLE source of truth.  Fail closed on all non-active states.';

COMMENT ON COLUMN licence_grants.state IS
  'DELIVERY GATE.  Only ''active'' authorizes original download.  '
  'pending/suspended/expired/revoked all fail closed.  '
  'The delivery API must ALSO check term_end > now() when term_end IS NOT NULL.  '
  'State transition active → expired is a background-job responsibility.';

COMMENT ON COLUMN licence_grants.asset_id IS
  'The governed WORK this grant covers.  References vault_assets.id, NOT asset_media.id.  '
  'The grant is for the work; the delivery API resolves the physical file via '
  'asset_media(role=''original'', generation_status=''ready'').';

COMMENT ON COLUMN licence_grants.buyer_id IS
  'The purchasing/granting human.  Always NOT NULL.  References users.id (stable identity).  '
  'Even for company-wide grants, the buyer who triggered the purchase is recorded.';

COMMENT ON COLUMN licence_grants.grantee_company_id IS
  'When set, any active member of this company is authorized to download originals.  '
  'NULL = personal grant (buyer_id only).  Does NOT replace buyer_id.';

COMMENT ON COLUMN licence_grants.entitlement_source_type IS
  'What class of event created this grant: transaction (commercial purchase), '
  'admin_grant (manual override), or system_grant (automated).  '
  'Primary source indicator — broader than source_type which only covers commercial flows.';

COMMENT ON COLUMN licence_grants.source_type IS
  'Specific commercial flow that created this grant: direct_offer, assignment, '
  'catalogue_checkout, etc.  NULL for admin and system grants (no commercial flow).  '
  'Uses licence_source_type enum (shared with transactions).';

COMMENT ON COLUMN licence_grants.source_id IS
  'Polymorphic ID of the source record: offer_thread.id, assignment.id, etc.  '
  'NULL for admin and system grants.  No FK — multiple source tables.';

COMMENT ON COLUMN licence_grants.granted_by_user_id IS
  'The user who created or approved this grant.  Required for admin_grant.  '
  'NULL for automated transaction fulfilment and system grants.';

COMMENT ON COLUMN licence_grants.granted_at IS
  'When the entitlement became effective.  May differ from created_at for '
  'backdated admin grants.';

COMMENT ON COLUMN licence_grants.transaction_id IS
  'FK to the transaction that created this grant.  Required when '
  'entitlement_source_type = transaction.  NULL for admin/system grants.';

COMMENT ON COLUMN licence_grants.certified_package_id IS
  'Link to the evidence package.  Informational, NOT authorization.  '
  'A package existing does NOT imply download rights.  '
  'Authorization comes from state + term, never from package linkage.';


-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (reverse order of operations)
-- ════════════════════════════════════════════════════════════════
--
-- -- §9 Indexes
-- DROP INDEX IF EXISTS uq_licence_grants_active_per_buyer;
-- DROP INDEX IF EXISTS idx_licence_grants_ent_source;
-- DROP INDEX IF EXISTS idx_licence_grants_asset_active;
-- DROP INDEX IF EXISTS idx_licence_grants_company;
-- DROP INDEX IF EXISTS idx_licence_grants_company_delivery;
--
-- -- §8 Check constraints
-- DROP owned constraints before restoring NOT NULL:
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS licence_grants_non_txn_no_transaction;
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS licence_grants_admin_needs_actor;
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS licence_grants_txn_source_coherent;
--
-- -- §7 Restore financial columns + constraints
-- ALTER TABLE licence_grants ADD COLUMN IF NOT EXISTS negotiated_amount_cents integer;
-- ALTER TABLE licence_grants ADD COLUMN IF NOT EXISTS listed_price_at_grant_cents integer;
-- ALTER TABLE licence_grants ADD CONSTRAINT licence_grants_negotiated_positive
--   CHECK (negotiated_amount_cents > 0);
-- ALTER TABLE licence_grants ADD CONSTRAINT licence_grants_listed_positive
--   CHECK (listed_price_at_grant_cents > 0);
-- NOTE: restored columns will be NULL.  Backfill from
-- certified_package_items if historical values are needed.
--
-- -- §6 Foreign keys
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS fk_licence_grants_granted_by;
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS fk_licence_grants_grantee_company;
--
-- -- §5 Restore NOT NULL on source columns
-- ALTER TABLE licence_grants ALTER COLUMN source_id SET NOT NULL;
-- ALTER TABLE licence_grants ALTER COLUMN source_type SET NOT NULL;
--
-- -- §4 (cannot unset NOT NULL without dropping the columns)
-- -- §3 (backfill data is harmless if columns are dropped)
--
-- -- §2 Drop added columns
-- ALTER TABLE licence_grants DROP COLUMN IF EXISTS granted_at;
-- ALTER TABLE licence_grants DROP COLUMN IF EXISTS granted_by_user_id;
-- ALTER TABLE licence_grants DROP COLUMN IF EXISTS entitlement_source_type;
-- ALTER TABLE licence_grants DROP COLUMN IF EXISTS grantee_company_id;
--
-- -- §1 Enum
-- DROP TYPE IF EXISTS entitlement_source CASCADE;
-- ════════════════════════════════════════════════════════════════
