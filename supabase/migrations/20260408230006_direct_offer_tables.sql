-- ════════════════════════════════════════════════════════════════
-- Migration 6: Direct Offer Engine — Core Tables
--
-- Three tables for the Direct Offer negotiation domain:
--   1. direct_offer_threads — master negotiation record
--   2. direct_offer_events — append-only audit log
--   3. offer_checkout_intents — acceptance-to-checkout handoff
--
-- TypeScript row types: DirectOfferThreadRow, DirectOfferEventRow,
--   OfferCheckoutIntentRow (src/lib/db/schema.ts)
-- Domain spec: DIRECT_OFFER_SPEC.md §C–H
--
-- Money: integer EUR cents (never decimal/float).
-- Timestamps: timestamptz, UTC.
-- IDs: uuid with gen_random_uuid() default.
--
-- Depends on: 20260408230005_direct_offer_enums.sql
-- Rollback: DROP TABLE in reverse dependency order (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. DIRECT_OFFER_THREADS — Master negotiation record
-- TypeScript: DirectOfferThread → DirectOfferThreadRow
--
-- One active thread per buyer × asset × licence context.
-- One live offer amount at a time. One clear turn at a time.
-- ──────────────────────────────────────────────

CREATE TABLE direct_offer_threads (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id                        uuid NOT NULL,  -- FK to vault_assets when that table exists
  buyer_id                        uuid NOT NULL,
  creator_id                      uuid NOT NULL,
  licence_type                    licence_type NOT NULL,
  listed_price_at_open            integer NOT NULL,  -- EUR cents — snapshot at creation, immutable
  current_offer_amount            integer NOT NULL,  -- EUR cents — latest live offer
  current_offer_by                offer_party NOT NULL,
  round_count                     integer NOT NULL DEFAULT 1,
  creator_response_window_minutes integer NOT NULL DEFAULT 240,
  expires_at                      timestamptz NOT NULL,
  status                          direct_offer_status NOT NULL DEFAULT 'buyer_offer_pending_creator',
  accepted_amount                 integer,  -- EUR cents — locked on acceptance
  checkout_intent_id              uuid,     -- links to offer_checkout_intents
  auto_cancel_reason              direct_offer_auto_cancel_reason,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  resolved_at                     timestamptz,

  -- ── Invariants ──

  -- Listed price must be positive
  CONSTRAINT offer_listed_price_positive CHECK (listed_price_at_open > 0),

  -- Current offer must be positive and below listed price
  CONSTRAINT offer_amount_positive CHECK (current_offer_amount > 0),
  CONSTRAINT offer_amount_below_listed CHECK (current_offer_amount < listed_price_at_open),

  -- Round count: 1-based, max 3 (Spec §C.3)
  CONSTRAINT offer_round_count_range CHECK (round_count >= 1 AND round_count <= 3),

  -- Response window: 30 min to 24 hours (Spec §C.5)
  CONSTRAINT offer_response_window_range CHECK (
    creator_response_window_minutes >= 30
    AND creator_response_window_minutes <= 1440
  ),

  -- Accepted amount must be positive when present
  CONSTRAINT offer_accepted_amount_positive CHECK (
    accepted_amount IS NULL OR accepted_amount > 0
  ),

  -- Accepted amount must be set when status is accepted_pending_checkout or completed
  CONSTRAINT offer_accepted_requires_amount CHECK (
    (status IN ('accepted_pending_checkout', 'completed') AND accepted_amount IS NOT NULL)
    OR (status NOT IN ('accepted_pending_checkout', 'completed'))
  ),

  -- Auto-cancel reason must be set when status is auto_cancelled
  CONSTRAINT offer_auto_cancel_requires_reason CHECK (
    (status = 'auto_cancelled' AND auto_cancel_reason IS NOT NULL)
    OR (status != 'auto_cancelled' AND auto_cancel_reason IS NULL)
  ),

  -- Resolved timestamp must be set for terminal states
  CONSTRAINT offer_resolved_terminal CHECK (
    (status IN ('accepted_pending_checkout', 'declined', 'expired', 'auto_cancelled', 'completed')
      AND resolved_at IS NOT NULL)
    OR (status NOT IN ('accepted_pending_checkout', 'declined', 'expired', 'auto_cancelled', 'completed'))
  ),

  -- Buyer cannot make an offer on their own asset
  CONSTRAINT offer_no_self_offer CHECK (buyer_id != creator_id)
);

COMMENT ON TABLE direct_offer_threads IS 'Master Direct Offer negotiation thread. One active thread per buyer × asset × licence. Spec §10.4.';
COMMENT ON COLUMN direct_offer_threads.listed_price_at_open IS 'Creator listed price at thread creation. Immutable snapshot. EUR cents.';
COMMENT ON COLUMN direct_offer_threads.current_offer_amount IS 'Latest live offer amount. Updated on each counter. EUR cents.';
COMMENT ON COLUMN direct_offer_threads.round_count IS '1-based round counter. Incremented on each counter-offer. Max 3.';
COMMENT ON COLUMN direct_offer_threads.asset_id IS 'Reference to vault_assets table. FK added when vault_assets table is created.';

-- ──────────────────────────────────────────────
-- 2. DIRECT_OFFER_EVENTS — Append-only audit log
-- TypeScript: DirectOfferEvent → DirectOfferEventRow
--
-- Every state transition produces an immutable event.
-- Events may never be modified or deleted.
-- ──────────────────────────────────────────────

CREATE TABLE direct_offer_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL REFERENCES direct_offer_threads(id) ON DELETE RESTRICT,
  event_type      direct_offer_event_type NOT NULL,
  actor_id        uuid NOT NULL,
  amount          integer,      -- EUR cents — null for non-price events
  message         text,         -- negotiation note (licensing context, rationale, usage)
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Amount must be positive when present
  CONSTRAINT offer_event_amount_positive CHECK (amount IS NULL OR amount > 0)
);

COMMENT ON TABLE direct_offer_events IS 'Append-only event log for Direct Offer lifecycle. No UPDATE or DELETE permitted.';
COMMENT ON COLUMN direct_offer_events.thread_id IS 'ON DELETE RESTRICT — events must not be orphaned by thread deletion.';
COMMENT ON COLUMN direct_offer_events.message IS 'Negotiation note — licensing context, rationale, intended use. Not chat.';

-- ──────────────────────────────────────────────
-- APPEND-ONLY ENFORCEMENT TRIGGERS
-- Same pattern as assignment_events (Migration 4).
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION direct_offer_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'direct_offer_events is append-only. % operations are forbidden.', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_direct_offer_events_no_update
  BEFORE UPDATE ON direct_offer_events
  FOR EACH ROW
  EXECUTE FUNCTION direct_offer_events_immutable();

CREATE TRIGGER trg_direct_offer_events_no_delete
  BEFORE DELETE ON direct_offer_events
  FOR EACH ROW
  EXECUTE FUNCTION direct_offer_events_immutable();

-- ──────────────────────────────────────────────
-- 3. OFFER_CHECKOUT_INTENTS — Acceptance handoff
-- TypeScript: OfferCheckoutIntent → OfferCheckoutIntentRow
--
-- Created when either party accepts. Locks the negotiated
-- amount and links to the checkout flow.
-- ──────────────────────────────────────────────

CREATE TABLE offer_checkout_intents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         uuid NOT NULL UNIQUE REFERENCES direct_offer_threads(id) ON DELETE RESTRICT,
  asset_id          uuid NOT NULL,  -- FK to vault_assets when that table exists
  buyer_id          uuid NOT NULL,
  creator_id        uuid NOT NULL,
  licence_type      licence_type NOT NULL,
  negotiated_amount integer NOT NULL,  -- EUR cents — locked from accepted offer
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Negotiated amount must be positive
  CONSTRAINT checkout_intent_amount_positive CHECK (negotiated_amount > 0),

  -- Buyer cannot checkout their own asset
  CONSTRAINT checkout_intent_no_self CHECK (buyer_id != creator_id)
);

COMMENT ON TABLE offer_checkout_intents IS 'Acceptance-to-checkout handoff. One per thread (UNIQUE). Locks negotiated price.';
COMMENT ON COLUMN offer_checkout_intents.negotiated_amount IS 'EUR cents. Locked at acceptance. Used by checkout for all economics.';
COMMENT ON COLUMN offer_checkout_intents.thread_id IS 'ON DELETE RESTRICT — intent must not be orphaned. UNIQUE — one intent per thread.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (reverse dependency order)
-- ════════════════════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS trg_direct_offer_events_no_delete ON direct_offer_events;
-- DROP TRIGGER IF EXISTS trg_direct_offer_events_no_update ON direct_offer_events;
-- DROP FUNCTION IF EXISTS direct_offer_events_immutable();
-- DROP TABLE IF EXISTS offer_checkout_intents CASCADE;
-- DROP TABLE IF EXISTS direct_offer_events CASCADE;
-- DROP TABLE IF EXISTS direct_offer_threads CASCADE;
