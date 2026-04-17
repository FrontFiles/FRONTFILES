-- ════════════════════════════════════════════════════════════════
-- Migration 17: Licence Grants — Table
--
-- The canonical entitlement record. One row per licence right
-- granted to a buyer for a specific asset under specific terms.
--
-- GRAIN: one buyer × one asset × one licence_type × one source flow.
--
-- DELIVERY RULE:
--   Only grants with state = 'active' authorize original delivery.
--   pending, suspended, expired, revoked all fail closed.
--   Existence of a grant does NOT imply that a file exists.
--   Existence of a file does NOT imply that a grant exists.
--   The delivery API must check BOTH asset_media (file exists)
--   AND licence_grants (entitlement active) before serving originals.
--   Preview/thumbnail delivery does NOT consult this table.
--
-- IDENTITY:
--   buyer_id references users.id — the stable human identity.
--   Not buyer_accounts.id. Commercial details (company, VAT) are
--   resolved by joining users → buyer_accounts when needed.
--   creator_id is a snapshot of the asset creator at grant time.
--
-- TypeScript: no existing row type (new table).
-- Money: integer EUR cents (never decimal/float).
-- Timestamps: timestamptz, UTC.
-- IDs: uuid with gen_random_uuid() default.
--
-- Depends on:
--   20260413230005_licence_grant_enums.sql
--   20260413230002_vault_asset_tables.sql (vault_assets)
--   20260408230009_identity_tables.sql (users)
--   20260408230005_direct_offer_enums.sql (licence_type)
-- Rollback: DROP TABLE (see bottom).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE licence_grants (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was licensed
  asset_id                    uuid NOT NULL REFERENCES vault_assets(id) ON DELETE RESTRICT,

  -- Who holds the licence (human identity, not buyer facet)
  buyer_id                    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Snapshot of creator at grant time (may differ from current asset creator if transferred)
  creator_id                  uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Licence terms
  licence_type                licence_type NOT NULL,
  state                       licence_grant_state NOT NULL DEFAULT 'pending',
  exclusive                   boolean NOT NULL DEFAULT false,
  territory                   text,  -- NULL = worldwide (default)
  term_start                  timestamptz NOT NULL,
  term_end                    timestamptz,  -- NULL = perpetual

  -- Source flow that created this grant
  source_type                 licence_source_type NOT NULL,
  source_id                   uuid NOT NULL,  -- FK to offer thread, assignment, or future checkout

  -- Financial snapshot (audit trail, independent of source transaction)
  negotiated_amount_cents     integer NOT NULL,  -- price actually paid, EUR cents
  listed_price_at_grant_cents integer NOT NULL,  -- listed price snapshot at grant time

  -- Provenance package link (deferred: certified_packages table does not exist yet)
  -- TODO: ADD CONSTRAINT fk_licence_grants_certified_package
  --   FOREIGN KEY (certified_package_id) REFERENCES certified_packages(id)
  --   when certified_packages table is created.
  certified_package_id        uuid,

  -- Suspension state (set when dispute filed)
  suspended_at                timestamptz,
  suspended_reason            text,

  -- Revocation state (terminal — takedown, fraud, dispute upheld)
  revoked_at                  timestamptz,
  revoked_reason              text,

  -- Lifecycle timestamps
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- Financial amounts must be positive
  CONSTRAINT licence_grants_negotiated_positive CHECK (negotiated_amount_cents > 0),
  CONSTRAINT licence_grants_listed_positive CHECK (listed_price_at_grant_cents > 0),

  -- Term end must be after term start when present
  CONSTRAINT licence_grants_term_order CHECK (
    term_end IS NULL OR term_end > term_start
  ),

  -- Suspension field coherence:
  -- suspended_at must be set when state = 'suspended', null otherwise
  CONSTRAINT licence_grants_suspension_coherent CHECK (
    (state = 'suspended' AND suspended_at IS NOT NULL)
    OR (state != 'suspended' AND suspended_at IS NULL AND suspended_reason IS NULL)
  ),

  -- Revocation field coherence:
  -- revoked_at must be set when state = 'revoked', null otherwise
  CONSTRAINT licence_grants_revocation_coherent CHECK (
    (state = 'revoked' AND revoked_at IS NOT NULL)
    OR (state != 'revoked' AND revoked_at IS NULL AND revoked_reason IS NULL)
  ),

  -- Buyer cannot licence their own asset
  CONSTRAINT licence_grants_no_self_licence CHECK (buyer_id != creator_id)
);

COMMENT ON TABLE licence_grants IS 'Canonical entitlement record. One row per buyer × asset × licence_type × source. Only state=active authorizes original delivery.';
COMMENT ON COLUMN licence_grants.state IS 'Only ACTIVE authorizes original delivery. pending/suspended/expired/revoked all fail closed.';
COMMENT ON COLUMN licence_grants.buyer_id IS 'References users.id (stable identity), not buyer_accounts.id (commercial facet).';
COMMENT ON COLUMN licence_grants.creator_id IS 'Snapshot of asset creator at grant time. For audit — may differ from current vault_assets.creator_id.';
COMMENT ON COLUMN licence_grants.source_id IS 'Points to the record that created this grant: offer_thread.id, assignment.id, or future checkout.id. No FK — polymorphic reference.';
COMMENT ON COLUMN licence_grants.certified_package_id IS 'Provenance package. FK deferred until certified_packages table exists. May remain NULL initially.';
COMMENT ON COLUMN licence_grants.territory IS 'NULL = worldwide (default). Future: structured territory codes.';
COMMENT ON COLUMN licence_grants.term_end IS 'NULL = perpetual licence. Non-null = term-limited, checked at delivery time.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS licence_grants CASCADE;
