-- ════════════════════════════════════════════════════════════════
-- Migration 15: Vault Assets — FK Backfill
--
-- Activates deferred foreign key constraints on existing domain
-- tables now that vault_assets exists.
--
-- Affected columns:
--   - direct_offer_threads.asset_id  (uuid NOT NULL, Migration 6)
--   - offer_checkout_intents.asset_id (uuid NOT NULL, Migration 6)
--   - evidence_items.vault_asset_id   (uuid nullable, Migration 2)
--
-- Strategy: ADD CONSTRAINT ... NOT VALID
--
-- NOT VALID means:
--   - New inserts and updates ARE validated against vault_assets.id
--   - Existing rows are NOT retroactively checked
--   - Necessary because existing tables may contain asset IDs from
--     mock/seed data that do not have matching vault_assets rows
--
-- To fully validate after seeding vault_assets:
--   ALTER TABLE direct_offer_threads VALIDATE CONSTRAINT fk_offer_threads_asset;
--   (repeat for each constraint)
--
-- Depends on: 20260413230002_vault_asset_tables.sql
-- Rollback: DROP CONSTRAINT for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- DIRECT_OFFER_THREADS — asset_id → vault_assets.id
-- Column: uuid NOT NULL (Migration 6, line 31)
-- ──────────────────────────────────────────────

ALTER TABLE direct_offer_threads
  ADD CONSTRAINT fk_offer_threads_asset
  FOREIGN KEY (asset_id) REFERENCES vault_assets(id)
  NOT VALID;

-- ──────────────────────────────────────────────
-- OFFER_CHECKOUT_INTENTS — asset_id → vault_assets.id
-- Column: uuid NOT NULL (Migration 6, line 161)
-- ──────────────────────────────────────────────

ALTER TABLE offer_checkout_intents
  ADD CONSTRAINT fk_checkout_intents_asset
  FOREIGN KEY (asset_id) REFERENCES vault_assets(id)
  NOT VALID;

-- ──────────────────────────────────────────────
-- EVIDENCE_ITEMS — vault_asset_id → vault_assets.id
-- Column: uuid nullable (Migration 2, line 173)
-- Comment: "FK to vault_assets when that table exists"
-- ──────────────────────────────────────────────

ALTER TABLE evidence_items
  ADD CONSTRAINT fk_evidence_items_vault_asset
  FOREIGN KEY (vault_asset_id) REFERENCES vault_assets(id)
  NOT VALID;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- ALTER TABLE evidence_items DROP CONSTRAINT IF EXISTS fk_evidence_items_vault_asset;
-- ALTER TABLE offer_checkout_intents DROP CONSTRAINT IF EXISTS fk_checkout_intents_asset;
-- ALTER TABLE direct_offer_threads DROP CONSTRAINT IF EXISTS fk_offer_threads_asset;
