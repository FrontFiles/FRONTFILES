-- ════════════════════════════════════════════════════════════════
-- Migration 5: Direct Offer Engine — Enum Types
--
-- PostgreSQL enum types backing the TypeScript union types in
-- src/lib/types.ts (DirectOfferStatus, DirectOfferEventType,
-- DirectOfferAutoCancelReason, LicenceType).
--
-- Every enum value matches its TypeScript counterpart exactly.
--
-- Depends on: nothing (standalone enums)
-- Rollback: DROP TYPE ... CASCADE for each type (see bottom).
-- ════════════════════════════════════════════════════════════════

-- §10.4 — Direct Offer status (8 states)
CREATE TYPE direct_offer_status AS ENUM (
  'buyer_offer_pending_creator',
  'creator_counter_pending_buyer',
  'buyer_counter_pending_creator',
  'accepted_pending_checkout',
  'declined',
  'expired',
  'auto_cancelled',
  'completed'
);

-- §10.4 — Direct Offer event types (10 types)
CREATE TYPE direct_offer_event_type AS ENUM (
  'buyer_offer',
  'creator_counter',
  'buyer_counter',
  'creator_accept',
  'buyer_accept',
  'creator_decline',
  'expired',
  'auto_cancelled',
  'checkout_started',
  'completed'
);

-- §10.4 — Auto-cancel reason codes (4 triggers)
CREATE TYPE direct_offer_auto_cancel_reason AS ENUM (
  'privacy_changed',
  'declaration_non_transactable',
  'exclusive_activated',
  'asset_delisted'
);

-- Licence types (shared — skip if already created by a prior migration)
DO $$ BEGIN
  CREATE TYPE licence_type AS ENUM (
    'editorial',
    'commercial',
    'broadcast',
    'print',
    'digital',
    'web',
    'merchandise'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Offer party (who placed the current offer)
CREATE TYPE offer_party AS ENUM (
  'buyer',
  'creator'
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS offer_party CASCADE;
-- DROP TYPE IF EXISTS licence_type CASCADE;
-- DROP TYPE IF EXISTS direct_offer_auto_cancel_reason CASCADE;
-- DROP TYPE IF EXISTS direct_offer_event_type CASCADE;
-- DROP TYPE IF EXISTS direct_offer_status CASCADE;
