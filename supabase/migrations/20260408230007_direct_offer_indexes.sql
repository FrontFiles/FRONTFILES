-- ════════════════════════════════════════════════════════════════
-- Migration 7: Direct Offer Engine — Indexes
--
-- Performance indexes for:
-- - Buyer offer list (all threads by buyer, filtered by status)
-- - Creator offer inbox (all threads by creator, filtered by status)
-- - Asset offers (all threads on an asset — for auto-cancel)
-- - Active thread uniqueness enforcement
-- - Event timeline (all events for a thread, chronological)
-- - Expiry job (active threads past their deadline)
-- - Checkout intent lookup
--
-- Depends on: 20260408230006_direct_offer_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- DIRECT_OFFER_THREADS — List and filter queries
-- ──────────────────────────────────────────────

-- Buyer's offer list: filtered by status, sorted by updated_at
CREATE INDEX idx_offer_threads_buyer_status
  ON direct_offer_threads (buyer_id, status, updated_at DESC);

-- Creator's offer inbox: filtered by status, sorted by updated_at
CREATE INDEX idx_offer_threads_creator_status
  ON direct_offer_threads (creator_id, status, updated_at DESC);

-- Asset-level queries: auto-cancel all active threads for an asset
CREATE INDEX idx_offer_threads_asset_status
  ON direct_offer_threads (asset_id, status);

-- One active thread per buyer × asset × licence (Spec §C.2)
-- Partial unique index: only non-terminal threads count
CREATE UNIQUE INDEX idx_offer_threads_active_unique
  ON direct_offer_threads (buyer_id, asset_id, licence_type)
  WHERE status NOT IN ('declined', 'expired', 'auto_cancelled', 'completed');

-- Expiry background job: active threads that may have expired
CREATE INDEX idx_offer_threads_expires
  ON direct_offer_threads (expires_at)
  WHERE status IN (
    'buyer_offer_pending_creator',
    'creator_counter_pending_buyer',
    'buyer_counter_pending_creator'
  );

-- Temporal sort for admin / staff views
CREATE INDEX idx_offer_threads_created_at
  ON direct_offer_threads (created_at DESC);

-- ──────────────────────────────────────────────
-- DIRECT_OFFER_EVENTS — Timeline queries
-- ──────────────────────────────────────────────

-- All events for a thread in chronological order (timeline panel)
CREATE INDEX idx_offer_events_thread_time
  ON direct_offer_events (thread_id, created_at ASC);

-- Events by type (for analytics: count of acceptances, declines, etc.)
CREATE INDEX idx_offer_events_type
  ON direct_offer_events (event_type, created_at DESC);

-- ──────────────────────────────────────────────
-- OFFER_CHECKOUT_INTENTS
-- ──────────────────────────────────────────────

-- Already has UNIQUE on thread_id from table definition.
-- Buyer lookup for "my pending checkouts"
CREATE INDEX idx_checkout_intents_buyer
  ON offer_checkout_intents (buyer_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_checkout_intents_buyer;
-- DROP INDEX IF EXISTS idx_offer_events_type;
-- DROP INDEX IF EXISTS idx_offer_events_thread_time;
-- DROP INDEX IF EXISTS idx_offer_threads_created_at;
-- DROP INDEX IF EXISTS idx_offer_threads_expires;
-- DROP INDEX IF EXISTS idx_offer_threads_active_unique;
-- DROP INDEX IF EXISTS idx_offer_threads_asset_status;
-- DROP INDEX IF EXISTS idx_offer_threads_creator_status;
-- DROP INDEX IF EXISTS idx_offer_threads_buyer_status;
