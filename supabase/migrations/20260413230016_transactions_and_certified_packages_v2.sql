-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Transactions & Certified Packages
-- Hardened production migration
--
-- REPLACES migrations 19–22. Before applying on a db where those
-- ran, execute the CLEANUP block at the bottom first.
--
-- NEW:
--   transactions, transaction_line_items
--
-- REVISED (vs migrations 19–22):
--   certified_packages, certified_package_items,
--   certified_package_artifacts
--
-- DEPENDS ON (must exist before this migration):
--   Extensions : pgcrypto, citext
--   Functions  : set_updated_at()
--   Tables     : users, companies, vault_assets, asset_media,
--                licence_grants
--   Enums      : licence_source_type, licence_type,
--                validation_declaration_state
--
-- ROLLBACK: see bottom of file.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUM TYPES                                             │
-- └─────────────────────────────────────────────────────────────┘

-- What type of commercial event this is.
-- Independent of source_type (which records WHERE the transaction
-- originated).  A catalogue_checkout can be either catalog_purchase
-- or bundle_purchase depending on cart composition.
CREATE TYPE transaction_kind AS ENUM (
  'catalog_purchase',       -- standard listed-price purchase
  'bundle_purchase',        -- multi-asset bundle at bundle pricing
  'negotiated_purchase'     -- price agreed via offer/assignment
);

-- Transaction lifecycle.
-- Happy path: draft → pending_payment → paid → fulfilling → fulfilled.
-- Terminal: cancelled (pre-payment), failed (system), refunded (post-payment).
CREATE TYPE transaction_status AS ENUM (
  'draft',
  'pending_payment',
  'paid',
  'fulfilling',
  'fulfilled',
  'cancelled',
  'failed',
  'refunded'
);

-- Which party a certified package is generated for.
-- "Blue Pack" = buyer_pack.   "White Pack" = creator_pack.
CREATE TYPE package_kind AS ENUM (
  'buyer_pack',
  'creator_pack'
);

-- Certified Package lifecycle.
-- No 'draft' — rows are created when building begins.
CREATE TYPE package_status AS ENUM (
  'building',
  'ready',
  'failed',
  'revoked'
);

-- Artifact generation lifecycle.
CREATE TYPE artifact_status AS ENUM (
  'pending',
  'generated',
  'available',
  'failed',
  'revoked'
);

-- Physical document/file types within a Certified Package.
--
-- PACKAGE-LEVEL (item_id IS NULL):
--   contract_with_frontfiles — platform terms snapshot
--   invoice                 — transaction invoice
--   payment_receipt         — payment confirmation
--   payout_summary          — creator earnings breakdown
--
-- ITEM-LEVEL (item_id IS NOT NULL):
--   certificate             — per-asset certification / provenance record
--   licence_agreement       — per-asset licence terms document
--   original_file           — the purchased content asset itself
CREATE TYPE package_artifact_type AS ENUM (
  'certificate',
  'licence_agreement',
  'original_file',
  'contract_with_frontfiles',
  'invoice',
  'payment_receipt',
  'payout_summary'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  TRANSACTIONS                                           │
-- │                                                             │
-- │  Core commercial event.  Groups one or more asset purchases │
-- │  into a single payment + fulfilment lifecycle.              │
-- │                                                             │
-- │  TABLE NAMING:                                              │
-- │  "transactions" is kept deliberately.  In a commerce domain │
-- │  it is universally understood and unambiguous.  It is not a │
-- │  reserved word in PostgreSQL.  The rest of the schema uses  │
-- │  qualified names (vault_assets, licence_grants) only where  │
-- │  the bare noun is overloaded across domains; "transaction"  │
-- │  in this codebase refers exclusively to a commercial event. │
-- │                                                             │
-- │  GRAIN: one row per checkout / offer / assignment.          │
-- │                                                             │
-- │  IDENTITY:                                                  │
-- │  buyer_user_id → users.id (stable human identity).          │
-- │  buyer_company_id is optional context when the buyer acts   │
-- │  on behalf of a company.                                    │
-- │  Creator identity is per-asset and lives on line items.     │
-- │                                                             │
-- │  MONEY: integer EUR cents.  Currency explicit on the row.   │
-- │  gross = platform_fee + creator_payout (invariant).         │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  kind                    transaction_kind NOT NULL,
  status                  transaction_status NOT NULL DEFAULT 'draft',

  -- Source flow that created this transaction.
  -- licence_source_type already exists (Migration 16).
  source_type             licence_source_type NOT NULL,
  source_id               uuid NOT NULL,

  -- Idempotency key for safe payment retry.
  idempotency_key         text,

  -- Buyer identity.
  buyer_user_id           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_company_id        uuid REFERENCES companies(id) ON DELETE RESTRICT,

  -- Aggregate financials (sum of all line items).
  currency_code           char(3) NOT NULL DEFAULT 'EUR',
  gross_amount_cents      integer NOT NULL DEFAULT 0,
  platform_fee_cents      integer NOT NULL DEFAULT 0,
  creator_payout_cents    integer NOT NULL DEFAULT 0,

  -- Payment provider (generic — not provider-specific fields).
  payment_provider        text,
  payment_reference       text,

  -- Lifecycle timestamps.
  submitted_at            timestamptz,
  paid_at                 timestamptz,
  fulfilled_at            timestamptz,
  cancelled_at            timestamptz,
  failed_at               timestamptz,
  refunded_at             timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- ── Monetary invariants ──

  CONSTRAINT transactions_gross_non_negative
    CHECK (gross_amount_cents >= 0),
  CONSTRAINT transactions_fee_non_negative
    CHECK (platform_fee_cents >= 0),
  CONSTRAINT transactions_payout_non_negative
    CHECK (creator_payout_cents >= 0),
  CONSTRAINT transactions_payout_lte_gross
    CHECK (platform_fee_cents + creator_payout_cents <= gross_amount_cents),
  CONSTRAINT transactions_currency_format
    CHECK (currency_code ~ '^[A-Z]{3}$'),

  -- ── Status → timestamp coherence ──
  -- Forward checks only: reaching a status requires its timestamp.
  -- The inverse is not enforced — a fulfilled txn retains its paid_at.

  CONSTRAINT transactions_paid_needs_ts
    CHECK (status NOT IN ('paid','fulfilling','fulfilled','refunded')
           OR paid_at IS NOT NULL),
  CONSTRAINT transactions_fulfilled_needs_ts
    CHECK (status != 'fulfilled' OR fulfilled_at IS NOT NULL),
  CONSTRAINT transactions_cancelled_needs_ts
    CHECK (status != 'cancelled' OR cancelled_at IS NOT NULL),
  CONSTRAINT transactions_failed_needs_ts
    CHECK (status != 'failed' OR failed_at IS NOT NULL),
  CONSTRAINT transactions_refunded_needs_ts
    CHECK (status != 'refunded' OR refunded_at IS NOT NULL),

  -- ── Timestamp ordering ──

  CONSTRAINT transactions_paid_after_submitted
    CHECK (paid_at IS NULL OR submitted_at IS NULL OR paid_at >= submitted_at),
  CONSTRAINT transactions_fulfilled_after_paid
    CHECK (fulfilled_at IS NULL OR paid_at IS NULL OR fulfilled_at >= paid_at)
);

COMMENT ON TABLE transactions IS
  'Core commercial event.  One per checkout / offer / assignment.  Groups line items into a single payment lifecycle.';
COMMENT ON COLUMN transactions.kind IS
  'What type of purchase: catalog, bundle, or negotiated.  Independent of source_type.';
COMMENT ON COLUMN transactions.source_id IS
  'Polymorphic: offer_thread.id, assignment.id, or checkout.id.  No FK — multiple source tables.';
COMMENT ON COLUMN transactions.buyer_company_id IS
  'Set when buyer acts on behalf of a company.  NULL = individual purchase.';
COMMENT ON COLUMN transactions.currency_code IS
  'ISO 4217.  Inherited by all line items and derived packages.';
COMMENT ON COLUMN transactions.idempotency_key IS
  'Unique among live (non-cancelled, non-failed) transactions.  Prevents duplicate charges.';

-- ── Indexes ──

CREATE UNIQUE INDEX uq_transactions_idempotency
  ON transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status NOT IN ('cancelled', 'failed');

CREATE UNIQUE INDEX uq_transactions_source
  ON transactions (source_type, source_id)
  WHERE status NOT IN ('cancelled', 'failed');

CREATE INDEX idx_transactions_buyer
  ON transactions (buyer_user_id, created_at DESC);

CREATE INDEX idx_transactions_buyer_company
  ON transactions (buyer_company_id)
  WHERE buyer_company_id IS NOT NULL;

CREATE INDEX idx_transactions_status
  ON transactions (status);

CREATE INDEX idx_transactions_paid
  ON transactions (paid_at DESC)
  WHERE paid_at IS NOT NULL;

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  TRANSACTION LINE ITEMS                                 │
-- │                                                             │
-- │  Per-asset order lines within a transaction.                │
-- │  Captures what was ordered and at what price BEFORE licence │
-- │  grants are created.                                        │
-- │                                                             │
-- │  GRAIN: one row per (transaction, asset, licence_type).     │
-- │  Buying one photo with both editorial + commercial licences │
-- │  in one checkout produces two line items.                   │
-- │                                                             │
-- │  RELATIONSHIP TO LICENCE_GRANTS:                            │
-- │  After payment, each line item produces one licence_grant.  │
-- │  licence_grant_id is set during fulfilment.  Before payment │
-- │  it is NULL.                                                │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE transaction_line_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  transaction_id          uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  asset_id                uuid NOT NULL REFERENCES vault_assets(id) ON DELETE RESTRICT,
  creator_id              uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  licence_type            licence_type NOT NULL,

  -- Back-link set during fulfilment.  NULL before payment.
  licence_grant_id        uuid REFERENCES licence_grants(id) ON DELETE RESTRICT,

  -- Pricing at order time.
  unit_price_cents        integer NOT NULL,
  line_total_cents        integer NOT NULL,

  sort_order              integer NOT NULL DEFAULT 0,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- One line per asset per licence type per transaction.
  CONSTRAINT uq_line_items_txn_asset_licence
    UNIQUE (transaction_id, asset_id, licence_type),

  CONSTRAINT line_items_unit_price_non_negative
    CHECK (unit_price_cents >= 0),
  CONSTRAINT line_items_line_total_non_negative
    CHECK (line_total_cents >= 0),
  CONSTRAINT line_items_sort_non_negative
    CHECK (sort_order >= 0)
);

COMMENT ON TABLE transaction_line_items IS
  'Per-asset order line.  Pre-payment pricing truth.  Post-payment: linked to its licence_grant.';
COMMENT ON COLUMN transaction_line_items.licence_grant_id IS
  'Set during fulfilment when the licence_grant is created.  NULL in draft/pending_payment.';
COMMENT ON COLUMN transaction_line_items.creator_id IS
  'Creator of this asset at order time.  Snapshot — may differ across items in multi-creator transactions.';

-- ── Indexes ──

CREATE INDEX idx_line_items_transaction
  ON transaction_line_items (transaction_id, sort_order);

CREATE INDEX idx_line_items_asset
  ON transaction_line_items (asset_id, created_at DESC);

-- One grant per line item (1:1 after fulfilment).
CREATE UNIQUE INDEX uq_line_items_grant
  ON transaction_line_items (licence_grant_id)
  WHERE licence_grant_id IS NOT NULL;

CREATE TRIGGER trg_line_items_updated_at
  BEFORE UPDATE ON transaction_line_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  CERTIFIED PACKAGES                                     │
-- │                                                             │
-- │  Governed evidence bundle generated for one party of a      │
-- │  transaction.                                               │
-- │                                                             │
-- │  GRAIN:                                                     │
-- │  One package per (transaction, kind, owner).                │
-- │  buyer_pack = "Blue Pack" — buyer's evidence bundle.        │
-- │  creator_pack = "White Pack" — creator's evidence bundle.   │
-- │                                                             │
-- │  OWNERSHIP:                                                 │
-- │  owner_user_id is always set (NOT NULL) — every package     │
-- │  belongs to a person.  owner_company_id is optional context │
-- │  when the owner acted on behalf of a company.  There is no  │
-- │  counterparty field; the other party is derivable:          │
-- │    buyer_pack → creator(s) on items                         │
-- │    creator_pack → buyer via transactions.buyer_user_id      │
-- │                                                             │
-- │  IMMUTABILITY:                                              │
-- │  Once ready, governed fields are locked by a BEFORE UPDATE  │
-- │  trigger (protect_ready_package).  Only status transitions, │
-- │  revoked_at, version, and updated_at remain writable.       │
-- │                                                             │
-- │  ENTITLEMENT:                                               │
-- │  A package existing does NOT imply access.  Download        │
-- │  authorization is checked separately.  This table records   │
-- │  WHAT EXISTS, not WHO MAY ACCESS.                           │
-- │                                                             │
-- │  COMPLETENESS:                                              │
-- │  Minimum artifact composition (e.g. buyer_pack must have an │
-- │  invoice before being marked ready) is enforced by the pack │
-- │  builder service, not by SQL constraints.  DB-level         │
-- │  composition checks are brittle against changing business   │
-- │  rules and not worth the trigger complexity.                │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE certified_packages (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  package_number              text NOT NULL,

  transaction_id              uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  kind                        package_kind NOT NULL,
  status                      package_status NOT NULL DEFAULT 'building',

  -- Owner: the party this package was generated for.
  owner_user_id               uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  owner_company_id            uuid REFERENCES companies(id) ON DELETE RESTRICT,

  -- Aggregate financials (snapshot from transaction at generation time).
  total_buyer_pays_cents      integer NOT NULL,
  total_creator_receives_cents integer NOT NULL,
  total_platform_earns_cents  integer NOT NULL,

  -- Regeneration tracking.
  version                     integer NOT NULL DEFAULT 1,

  -- Lifecycle timestamps.
  generated_at                timestamptz NOT NULL,
  ready_at                    timestamptz,
  revoked_at                  timestamptz,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT certified_packages_number_unique
    UNIQUE (package_number),

  CONSTRAINT certified_packages_buyer_pays_non_negative
    CHECK (total_buyer_pays_cents >= 0),
  CONSTRAINT certified_packages_creator_receives_non_negative
    CHECK (total_creator_receives_cents >= 0),
  CONSTRAINT certified_packages_platform_earns_non_negative
    CHECK (total_platform_earns_cents >= 0),

  CONSTRAINT certified_packages_version_positive
    CHECK (version >= 1),

  -- ── Lifecycle ordering ──

  CONSTRAINT certified_packages_ready_after_generated
    CHECK (ready_at IS NULL OR ready_at >= generated_at),
  CONSTRAINT certified_packages_revoked_after_generated
    CHECK (revoked_at IS NULL OR revoked_at >= generated_at),

  -- ── Status → timestamp coherence ──

  CONSTRAINT certified_packages_ready_needs_ts
    CHECK (status != 'ready' OR ready_at IS NOT NULL),
  CONSTRAINT certified_packages_revoked_needs_ts
    CHECK (status != 'revoked' OR revoked_at IS NOT NULL)
);

COMMENT ON TABLE certified_packages IS
  'Governed evidence bundle.  One per (transaction, kind, owner).  Governed fields immutable after ready (trigger-enforced).  Entitlement checked separately.';
COMMENT ON COLUMN certified_packages.package_number IS
  'Human-readable (e.g. FP-2026-000001).  For correspondence, invoices, legal reference.';
COMMENT ON COLUMN certified_packages.kind IS
  'buyer_pack = Blue Pack (buyer evidence).  creator_pack = White Pack (creator evidence).';
COMMENT ON COLUMN certified_packages.owner_user_id IS
  'The party who receives this pack.  Buyer for buyer_pack, creator for creator_pack.';
COMMENT ON COLUMN certified_packages.owner_company_id IS
  'Optional company context.  NULL = individual.  Counterparty is NOT stored — derive from transaction or items.';
COMMENT ON COLUMN certified_packages.version IS
  'Regeneration counter.  Old version is revoked; new version starts at version+1.';
COMMENT ON COLUMN certified_packages.status IS
  'building → ready (success) or failed (retryable).  ready → revoked (terminal).  Pack builder validates artifact completeness before setting ready.';

-- ── Indexes ──

-- One live package per kind per transaction per owner.
CREATE UNIQUE INDEX uq_certified_packages_txn_kind_owner
  ON certified_packages (transaction_id, kind, owner_user_id)
  WHERE status NOT IN ('failed', 'revoked');

-- Owner's package list (account page, download history) — hot query.
CREATE INDEX idx_certified_packages_owner_ready
  ON certified_packages (owner_user_id, ready_at DESC)
  WHERE status = 'ready';

-- Transaction's packages (fulfilment view).
CREATE INDEX idx_certified_packages_transaction
  ON certified_packages (transaction_id);

-- Admin: recently generated.
CREATE INDEX idx_certified_packages_generated
  ON certified_packages (generated_at DESC);

-- Company package list.
CREATE INDEX idx_certified_packages_company
  ON certified_packages (owner_company_id)
  WHERE owner_company_id IS NOT NULL;

CREATE TRIGGER trg_certified_packages_updated_at
  BEFORE UPDATE ON certified_packages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4b  PACKAGE IMMUTABILITY TRIGGER                          │
-- │                                                             │
-- │  Once a package reaches 'ready' or 'revoked', governed      │
-- │  fields are locked.  Only status transitions, revoked_at,   │
-- │  version, and updated_at may change.                        │
-- │                                                             │
-- │  This protects the legal evidence value of finalized        │
-- │  packages.  A corrupted package_number or changed financial │
-- │  snapshot on a certified package would compromise dispute   │
-- │  resolution and compliance audits.                          │
-- │                                                             │
-- │  Item and artifact immutability is enforced at the service  │
-- │  layer.  Items have no updated_at / set_updated_at trigger, │
-- │  signaling that they are write-once snapshot records.       │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION protect_ready_package()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Revoked is terminal.  No field may change.
  IF OLD.status = 'revoked' THEN
    RAISE EXCEPTION
      'Cannot modify a revoked certified package (id=%)',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Ready packages: governed fields are locked.
  -- Allowed: status (→ revoked only at service layer), revoked_at,
  --          version, updated_at.
  IF OLD.status = 'ready' THEN
    IF   NEW.package_number              IS DISTINCT FROM OLD.package_number
      OR NEW.transaction_id              IS DISTINCT FROM OLD.transaction_id
      OR NEW.kind                        IS DISTINCT FROM OLD.kind
      OR NEW.owner_user_id               IS DISTINCT FROM OLD.owner_user_id
      OR NEW.owner_company_id            IS DISTINCT FROM OLD.owner_company_id
      OR NEW.total_buyer_pays_cents      IS DISTINCT FROM OLD.total_buyer_pays_cents
      OR NEW.total_creator_receives_cents IS DISTINCT FROM OLD.total_creator_receives_cents
      OR NEW.total_platform_earns_cents  IS DISTINCT FROM OLD.total_platform_earns_cents
      OR NEW.generated_at               IS DISTINCT FROM OLD.generated_at
      OR NEW.ready_at                    IS DISTINCT FROM OLD.ready_at
    THEN
      RAISE EXCEPTION
        'Cannot modify governed fields on a finalized certified package (id=%, status=%)',
        OLD.id, OLD.status
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION protect_ready_package() IS
  'Revoked packages: blocks all modifications (terminal state).  Ready packages: locks governed fields; allows status transition, revoked_at, version, updated_at.';

CREATE TRIGGER trg_certified_packages_protect
  BEFORE UPDATE ON certified_packages
  FOR EACH ROW EXECUTE FUNCTION protect_ready_package();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  CERTIFIED PACKAGE ITEMS                                │
-- │                                                             │
-- │  Per-licence-grant record within a certified package.       │
-- │  Carries frozen provenance and commercial snapshots.        │
-- │                                                             │
-- │  GRAIN:                                                     │
-- │  One item per (package, licence_grant).                     │
-- │  The same grant appears in both buyer_pack and creator_pack │
-- │  — different packages, same underlying right.               │
-- │                                                             │
-- │  SNAPSHOT SEMANTICS:                                        │
-- │  Commercial terms are frozen from licence_grants.           │
-- │  Provenance fields are frozen from vault_assets.            │
-- │  Both record truth AT PACKAGE GENERATION TIME.              │
-- │  If the source later changes, the item preserves what it    │
-- │  was.  This is the governed evidentiary record.             │
-- │                                                             │
-- │  IMMUTABILITY:                                              │
-- │  Items are write-once snapshot records.  There is no        │
-- │  updated_at column and no set_updated_at trigger.  The      │
-- │  service layer must not issue UPDATE on this table.         │
-- │  If a correction is needed, the parent package is revoked   │
-- │  and a new version is generated.                            │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE certified_package_items (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  package_id                      uuid NOT NULL REFERENCES certified_packages(id) ON DELETE RESTRICT,
  licence_grant_id                uuid NOT NULL REFERENCES licence_grants(id) ON DELETE RESTRICT,
  asset_id                        uuid NOT NULL REFERENCES vault_assets(id) ON DELETE RESTRICT,
  creator_id                      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Commercial terms (frozen from licence_grant at generation).
  licence_type                    licence_type NOT NULL,
  negotiated_amount_cents         integer NOT NULL,
  listed_price_at_grant_cents     integer NOT NULL,
  territory                       text,          -- NULL = worldwide
  term_start                      timestamptz NOT NULL,
  term_end                        timestamptz,   -- NULL = perpetual
  exclusive                       boolean NOT NULL,

  -- Provenance snapshots (frozen from vault_assets at generation).
  declaration_state_at_issue      validation_declaration_state NOT NULL,
  c2pa_version_at_issue           text,
  c2pa_manifest_valid_at_issue    boolean,
  certification_hash_at_issue     text,

  sort_order                      integer NOT NULL DEFAULT 0,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  -- No updated_at — items are write-once snapshot records.

  -- ── Constraints ──

  -- One item per grant per package (allows same grant across packs).
  CONSTRAINT uq_pkg_items_package_grant
    UNIQUE (package_id, licence_grant_id),

  -- Negotiated may be 0 for comp/promo; listed is always positive.
  CONSTRAINT pkg_items_negotiated_non_negative
    CHECK (negotiated_amount_cents >= 0),
  CONSTRAINT pkg_items_listed_positive
    CHECK (listed_price_at_grant_cents > 0),

  -- Term ordering.
  CONSTRAINT pkg_items_term_order
    CHECK (term_end IS NULL OR term_end > term_start),

  CONSTRAINT pkg_items_sort_non_negative
    CHECK (sort_order >= 0)
);

COMMENT ON TABLE certified_package_items IS
  'Per-licence-grant snapshot record.  Frozen provenance + commercial terms.  Write-once — no updates.  Governed evidence.';
COMMENT ON COLUMN certified_package_items.declaration_state_at_issue IS
  'Asset declaration state at package generation.  Frozen — does not update if the asset''s state later changes.';
COMMENT ON COLUMN certified_package_items.creator_id IS
  'Creator of this asset at grant time.  May differ across items in multi-creator transactions.';
COMMENT ON COLUMN certified_package_items.territory IS
  'NULL = worldwide (default).  Future: ISO territory codes.';
COMMENT ON COLUMN certified_package_items.term_end IS
  'NULL = perpetual licence.  Non-null = term-limited.';

-- ── Indexes ──

-- Items in a package (package detail / download view).
CREATE INDEX idx_pkg_items_package
  ON certified_package_items (package_id, sort_order);

-- Asset's certified history (provenance / rights view).
CREATE INDEX idx_pkg_items_asset
  ON certified_package_items (asset_id, created_at DESC);

-- Creator's certified items (creator dashboard).
CREATE INDEX idx_pkg_items_creator
  ON certified_package_items (creator_id, created_at DESC);

-- Grant → items lookup (find buyer + creator items for one grant).
CREATE INDEX idx_pkg_items_grant
  ON certified_package_items (licence_grant_id);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §6  CERTIFIED PACKAGE ARTIFACTS                            │
-- │                                                             │
-- │  Physical deliverables attached to a package or item.       │
-- │                                                             │
-- │  LEVEL SEMANTICS:                                           │
-- │  Package-level (item_id IS NULL):                           │
-- │    contract_with_frontfiles, invoice, payment_receipt,      │
-- │    payout_summary.                                          │
-- │  Item-level (item_id IS NOT NULL):                          │
-- │    certificate, licence_agreement, original_file.           │
-- │                                                             │
-- │  STORAGE:                                                   │
-- │  storage_ref is the S3 key at generation time.  It is a     │
-- │  snapshot — even if the underlying file is later moved or   │
-- │  re-processed, the artifact preserves the original path.    │
-- │  NEVER exposed to the browser.  Resolved server-side only.  │
-- │                                                             │
-- │  asset_media_id is set ONLY for original_file artifacts.    │
-- │  It links to the canonical asset_media row.  For generated  │
-- │  documents (certificates, invoices, etc.) it is NULL.       │
-- │                                                             │
-- │  CRITICAL: STORAGE EXISTENCE ≠ ACCESS ENTITLEMENT.          │
-- │  An artifact row with a storage_ref does NOT authorize      │
-- │  download.  The delivery API must independently verify      │
-- │  entitlements before serving any file.  This table records  │
-- │  WHAT FILES EXIST AND WHERE, not who may access them.       │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE certified_package_artifacts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  package_id              uuid NOT NULL REFERENCES certified_packages(id) ON DELETE RESTRICT,
  item_id                 uuid REFERENCES certified_package_items(id) ON DELETE RESTRICT,

  artifact_type           package_artifact_type NOT NULL,
  status                  artifact_status NOT NULL DEFAULT 'pending',

  -- S3 key at generation time.  NULL while pending.  Snapshot — immutable once set.
  storage_ref             text,
  -- Canonical media record for original_file artifacts.  NULL for generated docs.
  asset_media_id          uuid REFERENCES asset_media(id) ON DELETE RESTRICT,

  content_type            text,          -- MIME (application/pdf, image/jpeg, …)
  file_size_bytes         bigint,
  checksum_sha256         text,          -- tamper detection for governed documents

  -- Generation metadata.
  generated_by            text,          -- e.g. 'system:pack-builder-v2'
  generated_at            timestamptz,
  available_at            timestamptz,
  revoked_at              timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- ── Level coherence ──
  -- Package-level artifacts must NOT have item_id.
  -- Item-level artifacts MUST have item_id.

  CONSTRAINT pkg_artifacts_level_coherent CHECK (
    (artifact_type IN ('contract_with_frontfiles',
                       'invoice', 'payment_receipt', 'payout_summary')
      AND item_id IS NULL)
    OR
    (artifact_type IN ('certificate', 'licence_agreement', 'original_file')
      AND item_id IS NOT NULL)
  ),

  -- ── Storage coherence ──
  -- asset_media_id is required for original_file, forbidden otherwise.

  CONSTRAINT pkg_artifacts_media_coherent CHECK (
    (artifact_type = 'original_file' AND asset_media_id IS NOT NULL)
    OR
    (artifact_type != 'original_file' AND asset_media_id IS NULL)
  ),

  -- Generated / available artifacts must have storage.
  CONSTRAINT pkg_artifacts_needs_storage CHECK (
    status NOT IN ('generated', 'available')
    OR storage_ref IS NOT NULL
  ),

  -- ── Status → timestamp coherence ──

  CONSTRAINT pkg_artifacts_generated_needs_ts CHECK (
    status NOT IN ('generated', 'available')
    OR generated_at IS NOT NULL
  ),
  CONSTRAINT pkg_artifacts_available_needs_ts CHECK (
    status != 'available'
    OR available_at IS NOT NULL
  ),
  CONSTRAINT pkg_artifacts_revoked_needs_ts CHECK (
    status != 'revoked'
    OR revoked_at IS NOT NULL
  ),

  -- ── Timestamp ordering ──

  CONSTRAINT pkg_artifacts_available_after_generated CHECK (
    available_at IS NULL OR generated_at IS NULL
    OR available_at >= generated_at
  ),

  -- ── File metadata ──

  CONSTRAINT pkg_artifacts_size_positive CHECK (
    file_size_bytes IS NULL OR file_size_bytes > 0
  ),
  CONSTRAINT pkg_artifacts_checksum_format CHECK (
    checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'
  )
);

COMMENT ON TABLE certified_package_artifacts IS
  'Physical deliverables.  Package-level: platform terms, invoice, receipt, payout.  Item-level: certificate, licence agreement, original file.  STORAGE EXISTENCE ≠ ACCESS ENTITLEMENT.';
COMMENT ON COLUMN certified_package_artifacts.item_id IS
  'NULL for package-level artifacts.  Set for item-level artifacts.  Enforced by level_coherent constraint.';
COMMENT ON COLUMN certified_package_artifacts.storage_ref IS
  'S3 key snapshot at generation time.  NEVER exposed to browser.  Resolved server-side with entitlement check.';
COMMENT ON COLUMN certified_package_artifacts.asset_media_id IS
  'Links to canonical asset_media row.  Set ONLY for original_file artifacts.  NULL for generated documents.  DOES NOT grant access — entitlements checked separately.';
COMMENT ON COLUMN certified_package_artifacts.checksum_sha256 IS
  'SHA-256 digest for tamper detection on governed documents.';

-- ── Indexes ──

-- All artifacts in a package (download / ZIP generation).
CREATE INDEX idx_pkg_artifacts_package
  ON certified_package_artifacts (package_id);

-- Item-level artifacts (item detail view).
CREATE INDEX idx_pkg_artifacts_item
  ON certified_package_artifacts (item_id)
  WHERE item_id IS NOT NULL;

-- Pending artifacts (pack builder job queue).
CREATE INDEX idx_pkg_artifacts_pending
  ON certified_package_artifacts (package_id, artifact_type)
  WHERE status = 'pending';

-- asset_media lookups (which packages reference this media).
CREATE INDEX idx_pkg_artifacts_media
  ON certified_package_artifacts (asset_media_id)
  WHERE asset_media_id IS NOT NULL;

-- ── Artifact uniqueness (partial unique indexes) ──
-- One of each type per scope.

CREATE UNIQUE INDEX uq_pkg_artifacts_contract_ff
  ON certified_package_artifacts (package_id)
  WHERE artifact_type = 'contract_with_frontfiles';

CREATE UNIQUE INDEX uq_pkg_artifacts_invoice
  ON certified_package_artifacts (package_id)
  WHERE artifact_type = 'invoice';

CREATE UNIQUE INDEX uq_pkg_artifacts_receipt
  ON certified_package_artifacts (package_id)
  WHERE artifact_type = 'payment_receipt';

CREATE UNIQUE INDEX uq_pkg_artifacts_payout
  ON certified_package_artifacts (package_id)
  WHERE artifact_type = 'payout_summary';

CREATE UNIQUE INDEX uq_pkg_artifacts_cert
  ON certified_package_artifacts (item_id)
  WHERE artifact_type = 'certificate' AND item_id IS NOT NULL;

CREATE UNIQUE INDEX uq_pkg_artifacts_licence
  ON certified_package_artifacts (item_id)
  WHERE artifact_type = 'licence_agreement' AND item_id IS NOT NULL;

CREATE UNIQUE INDEX uq_pkg_artifacts_original
  ON certified_package_artifacts (item_id)
  WHERE artifact_type = 'original_file' AND item_id IS NOT NULL;

CREATE TRIGGER trg_pkg_artifacts_updated_at
  BEFORE UPDATE ON certified_package_artifacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §7  FK BACKFILLS                                           │
-- │                                                             │
-- │  Adds transaction_id to licence_grants (NOT VALID).         │
-- │  Re-adds certified_package_id FK.                           │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE licence_grants
  ADD COLUMN IF NOT EXISTS transaction_id uuid;

ALTER TABLE licence_grants
  ADD CONSTRAINT fk_licence_grants_transaction
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_licence_grants_transaction
  ON licence_grants (transaction_id)
  WHERE transaction_id IS NOT NULL;

COMMENT ON COLUMN licence_grants.transaction_id IS
  'Transaction that created this grant.  NULL for pre-existing grants.';

-- certified_package_id column already exists from Migration 17.
-- Drop old FK constraint (if present) and re-add pointing to the
-- new certified_packages table.
ALTER TABLE licence_grants
  DROP CONSTRAINT IF EXISTS fk_licence_grants_certified_package;

ALTER TABLE licence_grants
  ADD CONSTRAINT fk_licence_grants_certified_package
  FOREIGN KEY (certified_package_id) REFERENCES certified_packages(id)
  NOT VALID;


-- ════════════════════════════════════════════════════════════════
-- CLEANUP (only if migrations 19–22 were previously applied)
-- ════════════════════════════════════════════════════════════════
--
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS fk_licence_grants_certified_package;
-- DROP TABLE IF EXISTS certified_package_artifacts CASCADE;
-- DROP TABLE IF EXISTS certified_package_items CASCADE;
-- DROP TABLE IF EXISTS certified_packages CASCADE;
-- DROP TYPE IF EXISTS package_artifact_type CASCADE;
--
-- Then delete migration files 19–22 and apply this migration.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- FULL ROLLBACK (reverse dependency order)
-- ════════════════════════════════════════════════════════════════
--
-- -- FK backfills
-- DROP INDEX IF EXISTS idx_licence_grants_transaction;
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS fk_licence_grants_certified_package;
-- ALTER TABLE licence_grants DROP CONSTRAINT IF EXISTS fk_licence_grants_transaction;
-- ALTER TABLE licence_grants DROP COLUMN IF EXISTS transaction_id;
--
-- -- Trigger + function
-- DROP TRIGGER IF EXISTS trg_certified_packages_protect ON certified_packages;
-- DROP FUNCTION IF EXISTS protect_ready_package();
--
-- -- Tables (reverse dependency order)
-- DROP TABLE IF EXISTS certified_package_artifacts CASCADE;
-- DROP TABLE IF EXISTS certified_package_items CASCADE;
-- DROP TABLE IF EXISTS certified_packages CASCADE;
-- DROP TABLE IF EXISTS transaction_line_items CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
--
-- -- Enums
-- DROP TYPE IF EXISTS package_artifact_type CASCADE;
-- DROP TYPE IF EXISTS artifact_status CASCADE;
-- DROP TYPE IF EXISTS package_status CASCADE;
-- DROP TYPE IF EXISTS package_kind CASCADE;
-- DROP TYPE IF EXISTS transaction_status CASCADE;
-- DROP TYPE IF EXISTS transaction_kind CASCADE;
-- ════════════════════════════════════════════════════════════════
