-- ════════════════════════════════════════════════════════════════
-- Migration 11: Identity Layer — FK Backfill
--
-- Activates deferred foreign key constraints on existing domain
-- tables now that the `users` table exists.
--
-- Affected tables:
--   - assignments (buyer_id, creator_id)
--   - direct_offer_threads (buyer_id, creator_id)
--   - direct_offer_events (actor_id)
--   - offer_checkout_intents (buyer_id, creator_id)
--
-- Strategy: ADD CONSTRAINT ... NOT VALID
--
-- NOT VALID means:
--   - New inserts and updates ARE validated against users.id
--   - Existing rows are NOT retroactively checked
--   - This is necessary because seed data uses deterministic UUIDs
--     (30000001-..., 40000001-...) that do not yet have matching
--     users rows
--
-- To fully validate after seeding users:
--   ALTER TABLE assignments VALIDATE CONSTRAINT fk_assignments_buyer;
--   (repeat for each constraint)
--
-- Depends on: 20260408230009_identity_tables.sql
-- Rollback: DROP CONSTRAINT for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- ASSIGNMENTS — buyer_id, creator_id → users.id
-- ──────────────────────────────────────────────

ALTER TABLE assignments
  ADD CONSTRAINT fk_assignments_buyer
  FOREIGN KEY (buyer_id) REFERENCES users(id)
  NOT VALID;

ALTER TABLE assignments
  ADD CONSTRAINT fk_assignments_creator
  FOREIGN KEY (creator_id) REFERENCES users(id)
  NOT VALID;

-- ──────────────────────────────────────────────
-- DIRECT_OFFER_THREADS — buyer_id, creator_id → users.id
-- ──────────────────────────────────────────────

ALTER TABLE direct_offer_threads
  ADD CONSTRAINT fk_offer_threads_buyer
  FOREIGN KEY (buyer_id) REFERENCES users(id)
  NOT VALID;

ALTER TABLE direct_offer_threads
  ADD CONSTRAINT fk_offer_threads_creator
  FOREIGN KEY (creator_id) REFERENCES users(id)
  NOT VALID;

-- ──────────────────────────────────────────────
-- DIRECT_OFFER_EVENTS — actor_id → users.id
-- actor_id can be 'system' in expired/auto_cancelled/completed events.
-- Those use a synthetic system UUID, not a real user.
-- FK is NOT VALID to accommodate this. Application must ensure
-- non-system actor_ids reference real users.
-- ──────────────────────────────────────────────

-- NOTE: actor_id FK is intentionally OMITTED.
--
-- Reason: the Direct Offer service uses string 'system' as actor_id
-- for expired, auto_cancelled, and completed events:
--
--   services.ts:457  appendEvent(..., 'expired', 'system')
--   services.ts:488  appendEvent(..., 'auto_cancelled', 'system')
--   services.ts:556  appendEvent(..., 'completed', 'system')
--
-- 'system' is not a valid uuid. A FK to users.id would reject
-- these inserts. Options:
--   a) Create a well-known system user row (uuid for 'system')
--   b) Make actor_id nullable (null = system action)
--   c) Leave actor_id without FK
--
-- Choosing (c) for now. This matches the Assignment Engine pattern
-- where assignment_events.actor_id also has no FK to users.
-- Resolution deferred to auth integration phase.

-- ──────────────────────────────────────────────
-- OFFER_CHECKOUT_INTENTS — buyer_id, creator_id → users.id
-- ──────────────────────────────────────────────

ALTER TABLE offer_checkout_intents
  ADD CONSTRAINT fk_checkout_intents_buyer
  FOREIGN KEY (buyer_id) REFERENCES users(id)
  NOT VALID;

ALTER TABLE offer_checkout_intents
  ADD CONSTRAINT fk_checkout_intents_creator
  FOREIGN KEY (creator_id) REFERENCES users(id)
  NOT VALID;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- ALTER TABLE offer_checkout_intents DROP CONSTRAINT IF EXISTS fk_checkout_intents_creator;
-- ALTER TABLE offer_checkout_intents DROP CONSTRAINT IF EXISTS fk_checkout_intents_buyer;
-- ALTER TABLE direct_offer_threads DROP CONSTRAINT IF EXISTS fk_offer_threads_creator;
-- ALTER TABLE direct_offer_threads DROP CONSTRAINT IF EXISTS fk_offer_threads_buyer;
-- ALTER TABLE assignments DROP CONSTRAINT IF EXISTS fk_assignments_creator;
-- ALTER TABLE assignments DROP CONSTRAINT IF EXISTS fk_assignments_buyer;
