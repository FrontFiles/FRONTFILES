-- ═══════════════════════════════════════════════════════════════════
-- P4 concern 4A.2 Part B2 — Stripe PI linkage + accept-commit RPC
--
-- What this migration adds:
--   • offers.stripe_payment_intent_id (text NULL)
--   • offers.stripe_idempotency_key   (text NULL)
--   • Two partial UNIQUE indexes (WHERE … IS NOT NULL).
--   • rpc_accept_offer_commit(6 args) — inner-txn half of the §8.5
--     accept straddle. Consumed by the Part B2 TS orchestrator at
--     src/lib/offer/offer-accept.ts.
--
-- References:
--   - docs/specs/ECONOMIC_FLOW_v1.md §8.5 — transition atomicity,
--     Stripe charge ordering, dual-thread emit. The §8.5 literal
--     primitive is SELECT … FOR UPDATE + outer DB txn spanning the
--     Stripe PaymentIntent round-trip. B2 D1 replaces that with an
--     optimistic conditional UPDATE inside a single inner-RPC txn,
--     paired with deterministic idempotency-key driven void-on-
--     rollback on the TS side. Same three guarantees (no double-
--     accept, no accept-without-charge, no charge-without-accept);
--     different primitive. Rationale recorded in F5 header + D1.
--   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §F1, §F5, D1–D3.
--   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1a atomicity
--     contract — single business-table mutation + single (here:
--     paired) ledger_events INSERT inside one PL/pgSQL txn.
--   - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
--     L48-58  assignment_state ENUM (first value 'active' — used
--             by this RPC's INSERT).
--     L97-113 offers DDL (this migration ADDs two nullable columns).
--     L150-157 assignments DDL (six-column table; INSERT target).
--   - supabase/migrations/20260421000011_rpc_offer_business.sql
--     L116-208 _emit_offer_event_with_retry — polymorphic helper;
--             first arg `p_thread_type text`. Consumed twice per
--             successful accept: ('offer', …) then ('assignment', …).
--             Retry exhaustion raises P0001.
--     L877-882 REVOKE/GRANT precedent for rpc_counter_offer mirrored
--             below for rpc_accept_offer_commit.
--
-- §8.5 straddle invariant preserved (D1):
--   • PaymentIntent is created OUTSIDE this RPC (TS orchestrator).
--   • On PI success, the TS layer passes the PI id + idempotency
--     key in as two text parameters.
--   • This RPC runs ONE inner txn: conditional UPDATE (flips
--     offers.state to 'accepted' iff state ∈ {'sent','countered'},
--     stamps PI linkage + updated_at), RAISEs disambiguated
--     offer_not_found vs invalid_state on zero rows, checks buyer
--     party, emits offer.accepted on the offer thread, INSERTs the
--     assignments row at state='active', emits assignment.created
--     on the new assignment thread.
--   • Any RAISE rolls the whole txn back (offer UPDATE, assignment
--     INSERT, both events). The orchestrator then voids the PI with
--     the same idempotency key. A void failure surfaces as B2 D3's
--     log-only RECONCILE_NEEDED alert; no admin_reconciliation_jobs
--     table exists in B2 (4A.3 scope).
-- ═══════════════════════════════════════════════════════════════════


BEGIN;


-- ═══════════════════════════════════════════════════════════════════
-- Error-code surface (cited by Parts B2 route-handler error
-- classification wrapper; mirrors the 20260421000011 catalogue):
--   P0008 — actor_mismatch: p_actor_ref does not resolve to auth.uid()
-- Other RAISEs carry no ERRCODE and surface via SQLERRM substring
-- match in the B1 classifier (rpc-errors.ts):
--   'offer_not_found: …'                    → 404 OFFER_NOT_FOUND
--   'invalid_state: offer is not in …'      → 409 INVALID_STATE
--   'not_party: accept is buyer-only'       → 409 NOT_PARTY
-- The helper-retry exhaustion RAISE (P0001) propagates out of
-- _emit_offer_event_with_retry unchanged; classifier maps to 503
-- LEDGER_CONTENTION per B1 pattern.
-- ═══════════════════════════════════════════════════════════════════


-- ─── offers.stripe_payment_intent_id ───────────────────────────────
ALTER TABLE public.offers ADD COLUMN stripe_payment_intent_id text NULL;

-- ─── offers.stripe_idempotency_key ─────────────────────────────────
ALTER TABLE public.offers ADD COLUMN stripe_idempotency_key text NULL;


-- ─── Partial UNIQUE indexes ────────────────────────────────────────
-- Partial predicate tolerates NULL during negotiation (sent /
-- countered / rejected / expired / cancelled states never stamp
-- these columns) and enforces uniqueness once stamped at accept.
-- The idempotency key is deterministic from offer.id, so the
-- UNIQUE constraint is belt-and-braces against a rogue writer
-- (§8.5 + B2 D10).
CREATE UNIQUE INDEX offers_stripe_pi_id_uniq
  ON public.offers (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX offers_stripe_idem_key_uniq
  ON public.offers (stripe_idempotency_key)
  WHERE stripe_idempotency_key IS NOT NULL;


COMMENT ON COLUMN public.offers.stripe_payment_intent_id IS
  'Stripe PaymentIntent id stamped by rpc_accept_offer_commit at the §8.5 accept straddle; NULL until accepted.';

COMMENT ON COLUMN public.offers.stripe_idempotency_key IS
  'Deterministic key (offer.id || '':accept'') stamped by rpc_accept_offer_commit; enables replay-safe PI create/void per §8.5 (B2 D10).';


-- ═══════════════════════════════════════════════════════════════════
-- rpc_accept_offer_commit — inner txn of the §8.5 accept straddle.
--
-- The TS orchestrator (src/lib/offer/offer-accept.ts) runs outside
-- any DB txn boundary and bookends this RPC with the Stripe
-- PaymentIntent lifecycle: (1) PI create with idempotency key →
-- (2) this RPC → (3) PI void with the SAME idempotency key if this
-- RPC raises. Void-fail is B2 D3 log-only; no DB write from that
-- branch.
--
-- Decision D1 — this RPC REPLACES §8.5's literal SELECT … FOR
-- UPDATE primitive with an optimistic conditional UPDATE. Rationale
-- in directive §DECISIONS D1: supabase-js has no connection-scoped
-- txn surface, so a FOR UPDATE lock in a prelock RPC is released
-- before Stripe is called. The conditional UPDATE + server-derived
-- idempotency key + partial UNIQUE index on PI/key + assignments
-- .offer_id UNIQUE together deliver the same three guarantees.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_accept_offer_commit(
  p_actor_ref          uuid,
  p_offer_id           uuid,
  p_payment_intent_id  text,
  p_idempotency_key    text,
  p_payload_offer      jsonb,
  p_payload_assignment jsonb
) RETURNS TABLE (
  offer_event_id        uuid,
  offer_event_hash      text,
  assignment_id         uuid,
  assignment_event_id   uuid,
  assignment_event_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer_id      uuid;
  v_row_count     int;
  v_assignment_id uuid;
BEGIN
  -- Actor-auth guard (B1 D15 discipline). Actor handle must resolve
  -- to the current auth.uid(). Raise as P0008 to match the Part A
  -- classifier surface.
  IF NOT EXISTS (
    SELECT 1 FROM public.actor_handles
    WHERE handle = p_actor_ref AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'actor_mismatch: handle does not belong to caller'
      USING ERRCODE = 'P0008';
  END IF;

  -- Optimistic conditional UPDATE — D1 replacement for §8.5's
  -- row-level lock. Stamps state flip + Stripe linkage in one write.
  -- Zero rows affected means either the offer is missing OR it is
  -- no longer in a transitionable state; disambiguated below.
  UPDATE public.offers
     SET state                    = 'accepted',
         stripe_payment_intent_id = p_payment_intent_id,
         stripe_idempotency_key   = p_idempotency_key,
         updated_at               = now()
   WHERE id = p_offer_id
     AND state IN ('sent', 'countered')
   RETURNING buyer_id INTO v_buyer_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    IF NOT EXISTS (SELECT 1 FROM public.offers WHERE id = p_offer_id) THEN
      -- P0003 + 'offer_not_found' prefix → rpc-errors.ts offer_not_found dispatch → 404 (R9).
      RAISE EXCEPTION 'offer_not_found: %', p_offer_id
        USING ERRCODE = 'P0003';
    ELSE
      -- P0003 + 'invalid_state' prefix → rpc-errors.ts invalid_state dispatch → 409 (R9).
      RAISE EXCEPTION 'invalid_state: offer is not in sent/countered'
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  -- Party check (defense in depth; RLS already gates, but SECURITY
  -- DEFINER bypasses RLS by construction). B2 D12: accept is
  -- buyer-only; no last-turn reconciliation.
  IF auth.uid() IS DISTINCT FROM v_buyer_id THEN
    -- P0004 + 'not_party' prefix → rpc-errors.ts not_party dispatch → 403 (R9).
    RAISE EXCEPTION 'not_party: accept is buyer-only'
      USING ERRCODE = 'P0004';
  END IF;

  -- Emit offer.accepted on the offer thread. Helper returns
  -- (out_event_id, out_event_hash); alias into our OUT columns.
  SELECT r.out_event_id, r.out_event_hash
    INTO offer_event_id, offer_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', p_offer_id, 'offer.accepted', p_payload_offer, p_actor_ref
    ) AS r;

  -- Insert the assignments row. Initial state = 'active' (first
  -- enum value in assignment_state per migration 20260421000004
  -- L49). offer_id UNIQUE guarantees a double-accept race surfaces
  -- as SQLSTATE 23505 at this INSERT; the orchestrator's void-on-
  -- rollback then reverses the PI.
  INSERT INTO public.assignments (offer_id, state)
    VALUES (p_offer_id, 'active')
    RETURNING id INTO v_assignment_id;

  assignment_id := v_assignment_id;

  -- Emit assignment.created on the NEW 'assignment' thread. Fresh
  -- thread → prev_event_hash resolves to NULL inside the helper.
  SELECT r.out_event_id, r.out_event_hash
    INTO assignment_event_id, assignment_event_hash
    FROM public._emit_offer_event_with_retry(
      'assignment', v_assignment_id, 'assignment.created', p_payload_assignment, p_actor_ref
    ) AS r;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.rpc_accept_offer_commit(
  uuid, uuid, text, text, jsonb, jsonb
) IS
  'Accept an offer (inner txn of the §8.5 straddle). Stamps PI linkage, '
  'flips offers.state to ''accepted'', inserts assignments row at state=''active'', '
  'emits offer.accepted + assignment.created. TS orchestrator '
  '(src/lib/offer/offer-accept.ts) owns PaymentIntent create/void bookends. '
  'Raises P0008 on actor mismatch; SQLERRM-tagged RAISEs on '
  'offer_not_found / invalid_state / not_party. Classifier mapping lives '
  'in src/lib/offer/rpc-errors.ts.';


-- ═══════════════════════════════════════════════════════════════════
-- REVOKE / GRANT — mirror the rpc_counter_offer pattern from
-- migration 20260421000011 L877-882. REVOKE FROM PUBLIC removes the
-- default PUBLIC privilege (which anon and authenticated inherit);
-- explicit GRANT EXECUTE to authenticated then restricts the surface
-- to the authenticated role only. SECURITY DEFINER + search_path
-- discipline means the function still runs with its owner's
-- privileges.
-- ═══════════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.rpc_accept_offer_commit(
  uuid, uuid, text, text, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_accept_offer_commit(
  uuid, uuid, text, text, jsonb, jsonb
) TO authenticated;


COMMIT;
