-- ════════════════════════════════════════════════════════════════
-- ROLLBACK for migration
--   20260420010000_rename_direct_offer_to_special_offer.sql (v2.1)
--
-- Purpose
--   Reverse the P5 rename of direct_offer_* DB objects to
--   special_offer_*. After this rollback, no special_offer_*
--   object remains in the public schema; the original
--   direct_offer_* identifiers are fully restored.
--
-- Run mode
--   RUN MANUALLY. This file is not registered with the migrations
--   runner (it lives under _rollbacks/, not migrations/ root).
--   Execute via psql or Supabase SQL editor against remote-dev
--   only. Never against production without an incident-response
--   sign-off.
--
-- Idempotency
--   Same DO / IF EXISTS / drop-before-create pattern as the
--   forward migration, so the rollback can be re-run without
--   errors after a partial application.
--
-- Ordering (symmetric to forward §1 → §9):
--   §9 reverse  → restore original table COMMENTs
--   §8 reverse  → drop special_offer_* policies
--   §7 reverse  → drop special_offer_* triggers
--   §6b reverse → rename FK constraint back (BEFORE §6, because
--                 ALTER TABLE RENAME CONSTRAINT names the table)
--   §6a reverse → rename PK indexes back (OID-based, but placed
--                 leaf-up for a consistent progression)
--   §6 reverse  → rename tables back
--   §5 reverse  → drop special_offer function + recreate
--                 direct_offer_events_immutable() with the
--                 ORIGINAL error text ('direct_offer_events is
--                 append-only…')
--   §7 forward  → recreate the original-name triggers on the
--                 restored-name table
--   §8 forward  → recreate the original-name policies on the
--                 restored-name tables
--   §2 reverse  → rename licence_source_type enum value back
--   §1 reverse  → rename three enum types back
--
-- Alternative
--   Git-level rollback to checkpoint
--   `checkpoint/pre-special-offer-rename-20260418` and reset
--   remote-dev via this script (or `supabase db reset` if
--   local-dev is being recreated).
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- §9 reverse: restore original table comments
COMMENT ON TABLE special_offer_events IS
  'Append-only event log for Direct Offer lifecycle. No UPDATE or DELETE permitted.';
COMMENT ON TABLE special_offer_threads IS
  'Master Direct Offer negotiation thread. One active thread per buyer × asset × licence. Spec §10.4.';

-- §8 reverse: drop new-named policies
DROP POLICY IF EXISTS special_offer_events_participant_read ON special_offer_events;
DROP POLICY IF EXISTS special_offer_threads_participant_read ON special_offer_threads;

-- §7 reverse: drop new-named triggers
DROP TRIGGER IF EXISTS trg_special_offer_events_no_delete ON special_offer_events;
DROP TRIGGER IF EXISTS trg_special_offer_events_no_update ON special_offer_events;

-- §6b reverse: rename FK constraint back (BEFORE table rename-back,
-- because ALTER TABLE RENAME CONSTRAINT names the table)
DO $$ BEGIN
  ALTER TABLE special_offer_events
    RENAME CONSTRAINT special_offer_events_thread_id_fkey
    TO direct_offer_events_thread_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- §6a reverse: rename PK indexes back (ALTER INDEX works by OID,
-- so order vs §6 is not strictly required, but placed here for
-- a consistent leaf-up progression)
ALTER INDEX IF EXISTS special_offer_events_pkey RENAME TO direct_offer_events_pkey;
ALTER INDEX IF EXISTS special_offer_threads_pkey RENAME TO direct_offer_threads_pkey;

-- §6 reverse: rename tables back
ALTER TABLE IF EXISTS special_offer_events  RENAME TO direct_offer_events;
ALTER TABLE IF EXISTS special_offer_threads RENAME TO direct_offer_threads;

-- §5 reverse: drop the special_offer_* named function + recreate
-- under the old name with the ORIGINAL error text.
DROP FUNCTION IF EXISTS special_offer_events_immutable();

CREATE OR REPLACE FUNCTION direct_offer_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'direct_offer_events is append-only. % operations are forbidden.', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- §7 forward (on restored-name table): recreate triggers under
-- restored names. Belt-and-suspenders drop-before-create since
-- CREATE TRIGGER has no IF NOT EXISTS.
DROP TRIGGER IF EXISTS trg_direct_offer_events_no_update ON direct_offer_events;
DROP TRIGGER IF EXISTS trg_direct_offer_events_no_delete ON direct_offer_events;

CREATE TRIGGER trg_direct_offer_events_no_update
  BEFORE UPDATE ON direct_offer_events
  FOR EACH ROW EXECUTE FUNCTION direct_offer_events_immutable();
CREATE TRIGGER trg_direct_offer_events_no_delete
  BEFORE DELETE ON direct_offer_events
  FOR EACH ROW EXECUTE FUNCTION direct_offer_events_immutable();

-- §8 forward (on restored-name tables): recreate policies under
-- restored names. Belt-and-suspenders drop-before-create since
-- CREATE POLICY has no IF NOT EXISTS.
DROP POLICY IF EXISTS direct_offer_threads_participant_read ON direct_offer_threads;
DROP POLICY IF EXISTS direct_offer_events_participant_read ON direct_offer_events;

CREATE POLICY direct_offer_threads_participant_read
  ON direct_offer_threads
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY direct_offer_events_participant_read
  ON direct_offer_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM direct_offer_threads t
    WHERE t.id = direct_offer_events.thread_id
      AND (t.buyer_id = auth.uid() OR t.creator_id = auth.uid())
  ));

-- §2 reverse: rename enum value back (DO-wrapped for re-run safety)
DO $$ BEGIN
  ALTER TYPE licence_source_type RENAME VALUE 'special_offer' TO 'direct_offer';
EXCEPTION WHEN invalid_parameter_value THEN NULL;
END $$;

-- §1 reverse: rename enum types back (DO-wrapped × 3)
DO $$ BEGIN
  ALTER TYPE special_offer_auto_cancel_reason RENAME TO direct_offer_auto_cancel_reason;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE special_offer_event_type RENAME TO direct_offer_event_type;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE special_offer_status RENAME TO direct_offer_status;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

COMMIT;
