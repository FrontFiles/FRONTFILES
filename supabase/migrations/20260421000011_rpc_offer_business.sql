-- ═══════════════════════════════════════════════════════════════════
-- P4 concern 4A.2 Part A — Offer surface business RPC catalogue
--
-- References:
--   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §9.2 — offer surface
--     sub-phase scope. Part A (this migration) ships the Postgres-
--     side business RPC catalogue. Routes, pages, components, Stripe
--     straddle, and expiration cron land in Parts B1/B2/C1/C2/D.
--   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1a — atomicity
--     contract: every user-driven offer state transition is a single
--     business-table mutation + single ledger_events INSERT inside
--     one PL/pgSQL txn, per spec §8.5. This file implements that
--     catalogue.
--   - docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md — the directive
--     governing this migration. Decisions D1-D15 recorded there.
--   - docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT
--     REPORT 13(a) — retry policy for CONCURRENT_CHAIN_ADVANCE and
--     HASH_CHAIN_VIOLATION. Resolved here as D1: in-RPC bounded
--     retry (N=3, pg_sleep backoff [10ms, 30ms, 100ms]) inside the
--     shared `_emit_offer_event_with_retry` helper. TS-side route
--     handlers in Parts B1/B2 do NOT retry; they surface the final
--     classified result.
--   - docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT
--     REPORT 13(b) — isolation choice. Resolved here as D2: read-
--     committed (Postgres default) + UNIQUE (thread_type, thread_id,
--     prev_event_hash) NULLS NOT DISTINCT from migration 20260421000006
--     as the correctness backstop. NOT SERIALIZABLE.
--   - docs/specs/ECONOMIC_FLOW_v1.md §4 — offer state machine.
--     §7 L152 — max-3-pending application-layer rate-limit rule.
--     §8.1 / §8.2 — offer.* and assignment.created payload shapes.
--     §8.4 — actor handles + system sentinel
--     (00000000-0000-0000-0000-000000000001).
--     §8.5 — transition atomicity, incl. accept + assignment.created
--     dual-thread emit. Stripe PaymentIntent straddle is Part B2's
--     TS-side wrapper; this RPC is purely atomic.
--     §F9 — pack size (1-20 items).
--     §F15 — rights templates (counsel-final bodies land in Part C2).
--     §F16 — platform_fee_bps rate-LOCK on offer.created.
--   - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
--     L61-66   — `offer_target_type` enum (the RPC bodies read this).
--     L97-113  — `offers` table DDL + self-dealing CHECK.
--     L126-142 — `offer_assets`, `offer_briefs` child tables.
--     L150-170 — `assignments`, `assignment_deliverables` tables.
--     L265-416 — T1 (same-creator), T2 (target-type XOR), T4
--                (max-20-items) triggers. The RPC bodies RELY on
--                the DDL triggers rather than duplicating them in PL
--                (directive D8 — prefer DDL-side enforcement).
--     L427-468 — `enforce_ledger_hash_chain()` BEFORE-INSERT trigger.
--                RAISE at L442-446 raises SQLSTATE 23514 with message
--                `'ledger_events hash-chain violation: ...'` — the
--                substring the retry helper's 23514 branch matches.
--                THIS MIGRATION DOES NOT MODIFY THE TRIGGER.
--   - supabase/migrations/20260421000005_seed_system_actor.sql
--     — seeds the system sentinel at handle
--     `00000000-0000-0000-0000-000000000001` with auth_user_id NULL.
--     `rpc_expire_offer` guards on this literal handle.
--   - supabase/migrations/20260421000006_ledger_events_unique_prev_hash.sql
--     — UNIQUE index `ledger_events_thread_prev_hash_unique` NULLS
--     NOT DISTINCT. The retry helper's 23505 branch matches this
--     index name in the RAISE text.
--   - supabase/migrations/20260421000010_rpc_append_ledger_event.sql
--     — pure-append utility RPC (pattern reference only; NOT called
--     from inside this file's RPCs per directive D1 rationale —
--     business RPCs INSERT inline so the retry loop holds the row-
--     lock across attempts).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;


-- ═══════════════════════════════════════════════════════════════════
-- Error-code surface (cited by Parts B1/B2 route-handler error
-- classification wrapper):
--   P0001 — retry helper exhausted bounded attempts
--   P0002 — rate_limit: max 3 pending offers per buyer/creator
--   P0003 — invalid_state: offer is not in a transitionable state
--   P0004 — not_party: actor is not buyer or creator of the offer
--   P0005 — not_last_turn: cancel blocked; last party action was
--           by the creator, not the buyer
--   P0006 — not_system: rpc_expire_offer called by non-system actor
--   P0007 — not_yet_expired: expires_at is in the future
--   P0008 — actor_mismatch: p_actor_ref does not resolve to auth.uid()
-- ═══════════════════════════════════════════════════════════════════


-- ── _emit_offer_event_with_retry ───────────────────────────────────
--
-- Internal retry helper consumed by every business RPC in this file.
-- Runs a bounded (N=3) retry loop around the `ledger_events` INSERT.
-- Two error surfaces cause retry (both mean "re-read thread tail"):
--
--   (a) SQLSTATE 23514 `check_violation` whose SQLERRM contains
--       `'ledger_events hash-chain violation'`. Raised by the
--       BEFORE-INSERT trigger `enforce_ledger_hash_chain()` (migration
--       20260421000004 L427-468) when the caller's `prev_event_hash`
--       no longer equals the current thread tail.
--
--   (b) SQLSTATE 23505 `unique_violation` whose SQLERRM contains
--       `'ledger_events_thread_prev_hash_unique'`. Raised by the
--       UNIQUE index from migration 20260421000006 when two
--       concurrent INSERTs both passed the trigger but only one can
--       actually land. Infrastructure-level race, per design lock
--       §6.1b.
--
-- Any other 23514 or 23505 → not our race; RAISE through unchanged.
-- Exhausted retries → RAISE with ERRCODE P0001 citing the thread +
-- attempt count (Parts B1/B2 surface as HTTP 503 with retry-after).
--
-- Backoff table ARRAY[0.01, 0.03, 0.10] seconds (≤150ms worst case)
-- holds the row-lock acquired by the caller's SELECT … FOR UPDATE
-- for the whole retry loop — see D1 rationale in the directive.
-- Decision R1: the row-lock is NEVER held across the Stripe
-- PaymentIntent RTT in Part B2's accept path; the straddle flow
-- acquires the lock inside `rpc_accept_offer` only AFTER the
-- PaymentIntent succeeds.
CREATE OR REPLACE FUNCTION public._emit_offer_event_with_retry(
  p_thread_type text,
  p_thread_id   uuid,
  p_event_type  text,
  p_payload     jsonb,
  p_actor_ref   uuid
) RETURNS TABLE (out_event_id uuid, out_event_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_hash    text;
  v_attempt      int := 0;
  v_max_attempts constant int := 3;
  v_backoff      constant numeric[] := ARRAY[0.01, 0.03, 0.10];
  v_sqlstate     text;
  v_sqlerrm      text;
  v_new_id       uuid;
  v_new_hash     text;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;

    -- Re-read thread tail every iteration. First event on a thread
    -- returns NULL (LEFT JOIN-like semantics via COALESCE at the
    -- trigger side).
    SELECT le.event_hash
      INTO v_prev_hash
      FROM public.ledger_events le
      WHERE le.thread_type = p_thread_type
        AND le.thread_id   = p_thread_id
      ORDER BY le.created_at DESC, le.id DESC
      LIMIT 1;

    BEGIN
      INSERT INTO public.ledger_events (
        thread_type, thread_id, event_type,
        payload_version, payload, actor_ref,
        prev_event_hash
      ) VALUES (
        p_thread_type, p_thread_id, p_event_type,
        'v1', p_payload, p_actor_ref,
        v_prev_hash
      )
      RETURNING ledger_events.id, ledger_events.event_hash
      INTO v_new_id, v_new_hash;

      -- INSERT succeeded; publish result to OUT columns and return.
      out_event_id   := v_new_id;
      out_event_hash := v_new_hash;
      RETURN NEXT;
      RETURN;

    EXCEPTION
      WHEN check_violation THEN
        -- Only our trigger's hash-chain RAISE retries; any other
        -- check_violation (e.g. note-cap trigger, max-items) is a
        -- programming error and propagates unchanged.
        GET STACKED DIAGNOSTICS
          v_sqlstate = RETURNED_SQLSTATE,
          v_sqlerrm  = MESSAGE_TEXT;
        IF v_sqlerrm NOT LIKE '%ledger_events hash-chain violation%' THEN
          RAISE;
        END IF;
        -- Fall through to backoff / retry.

      WHEN unique_violation THEN
        -- Only the ledger_events thread-prev-hash UNIQUE index
        -- retries; any other UNIQUE collision propagates unchanged.
        GET STACKED DIAGNOSTICS
          v_sqlstate = RETURNED_SQLSTATE,
          v_sqlerrm  = MESSAGE_TEXT;
        IF v_sqlerrm NOT LIKE '%ledger_events_thread_prev_hash_unique%' THEN
          RAISE;
        END IF;
        -- Fall through to backoff / retry.
    END;

    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION
        '_emit_offer_event_with_retry exhausted % attempts on thread %/% (event_type=%)',
        v_max_attempts, p_thread_type, p_thread_id, p_event_type
        USING ERRCODE = 'P0001';
    END IF;

    -- Backoff before next iteration. Index is 1-based; v_attempt
    -- already incremented above, so use v_attempt directly to pick
    -- the delay for the NEXT wait (0.01 → 0.03 → 0.10).
    PERFORM pg_sleep(v_backoff[v_attempt]);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public._emit_offer_event_with_retry(text, uuid, text, jsonb, uuid) IS
  'Internal helper: bounded retry (N=3) around ledger_events INSERT. Catches SQLSTATE 23514 + '
  '"ledger_events hash-chain violation" and SQLSTATE 23505 + "ledger_events_thread_prev_hash_unique" '
  'only. Exhausted retries raise P0001. Closes P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE §EXIT REPORT '
  '13(a). Called by every offer-surface business RPC in migration 20260421000011.';

-- Helper is internal; only the business RPCs call it. Revoke from
-- public roles so it cannot be invoked directly from PostgREST.
REVOKE ALL ON FUNCTION public._emit_offer_event_with_retry(text, uuid, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._emit_offer_event_with_retry(text, uuid, text, jsonb, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._emit_offer_event_with_retry(text, uuid, text, jsonb, uuid) FROM authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- Business RPCs. Each:
--   • SECURITY DEFINER with search_path pinned to public, pg_temp
--     (directive D4; Postgres SECURITY DEFINER guidance).
--   • Runs the actor-auth guard (D5) or — only `rpc_expire_offer` —
--     the system-actor guard.
--   • Acquires a row-lock via SELECT … FOR UPDATE on the target
--     offers row (except `rpc_create_offer` which INSERTs).
--   • Runs state / party / domain guards.
--   • Mutates the business table (offers / assignments /
--     assignment_deliverables).
--   • Calls `_emit_offer_event_with_retry` to append the
--     corresponding ledger_events row inside the same txn.
-- ═══════════════════════════════════════════════════════════════════


-- ── rpc_create_offer ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_create_offer(
  p_actor_ref        uuid,
  p_buyer_id         uuid,
  p_creator_id       uuid,
  p_target_type      public.offer_target_type,
  p_gross_fee        numeric,
  p_platform_fee_bps int,
  p_currency         char(3),
  p_rights           jsonb,
  p_current_note     text,
  p_expires_at       timestamptz,
  p_items            jsonb,
  p_payload          jsonb
) RETURNS TABLE (offer_id uuid, event_id uuid, event_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer_id    uuid;
  v_pending     int;
  v_event_id    uuid;
  v_event_hash  text;
  v_item        jsonb;
  v_idx         int;
BEGIN
  -- Actor-auth guard (D5). IS DISTINCT FROM so NULL auth_user_id
  -- (system actor / tombstoned) never matches a real auth.uid().
  IF (
    SELECT auth_user_id FROM public.actor_handles
      WHERE handle = p_actor_ref
        AND tombstoned_at IS NULL
  ) IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_mismatch'
      USING ERRCODE = 'P0008';
  END IF;

  -- Rate-limit guard (spec §7 L152; directive D7). Asymmetric race:
  -- a concurrent fourth insert can slip through this COUNT, but
  -- tightening to an advisory lock is deferred unless observed
  -- abuse. Distinct from §F16 which is the platform-fee rate-LOCK
  -- enforced at the INSERT itself.
  SELECT count(*) INTO v_pending
    FROM public.offers
    WHERE buyer_id   = p_buyer_id
      AND creator_id = p_creator_id
      AND state IN ('sent', 'countered');
  IF v_pending >= 3 THEN
    RAISE EXCEPTION
      'rate_limit: max 3 pending offers per buyer/creator (current=%)',
      v_pending
      USING ERRCODE = 'P0002';
  END IF;

  -- INSERT the offer. platform_fee_bps snapshotted here per §F16.
  INSERT INTO public.offers (
    buyer_id, creator_id, target_type,
    gross_fee, platform_fee_bps, currency,
    rights, current_note, expires_at, state
  ) VALUES (
    p_buyer_id, p_creator_id, p_target_type,
    p_gross_fee, p_platform_fee_bps, p_currency,
    p_rights, p_current_note, p_expires_at, 'sent'
  )
  RETURNING id INTO v_offer_id;

  -- Populate child table per target_type. The DDL triggers T1
  -- (same-creator), T2 (target-type XOR), and T4 (max-20-items)
  -- from migration 20260421000004 L265-416 fire on INSERT here;
  -- we rely on DDL-side enforcement rather than duplicating in PL
  -- (directive D8).
  IF p_target_type IN ('single_asset', 'asset_pack') THEN
    -- p_items expected to be a JSON array of { asset_id, position }
    -- objects (or bare UUID strings — both forms supported for
    -- composability with Part B1 route-handler callers).
    v_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_idx := v_idx + 1;
      INSERT INTO public.offer_assets (offer_id, asset_id, position)
      VALUES (
        v_offer_id,
        CASE
          WHEN jsonb_typeof(v_item) = 'string' THEN (v_item #>> '{}')::uuid
          ELSE (v_item->>'asset_id')::uuid
        END,
        COALESCE((v_item->>'position')::int, v_idx)
      );
    END LOOP;
  ELSE
    -- single_brief | brief_pack → offer_briefs
    v_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_idx := v_idx + 1;
      INSERT INTO public.offer_briefs (offer_id, position, spec)
      VALUES (
        v_offer_id,
        COALESCE((v_item->>'position')::int, v_idx),
        COALESCE(v_item->'spec', v_item)
      );
    END LOOP;
  END IF;

  -- Emit offer.created on the fresh 'offer' thread. prev_event_hash
  -- resolves to NULL on first attempt (handled inside the helper).
  SELECT r.out_event_id, r.out_event_hash
    INTO v_event_id, v_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', v_offer_id, 'offer.created', p_payload, p_actor_ref
    ) AS r;

  offer_id   := v_offer_id;
  event_id   := v_event_id;
  event_hash := v_event_hash;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.rpc_create_offer(
  uuid, uuid, uuid, public.offer_target_type, numeric, int,
  char, jsonb, text, timestamptz, jsonb, jsonb
) IS
  'Create a new offer. Inserts into offers + child table, '
  'rate-limit guard (max 3 pending per buyer/creator, spec §7 L152), '
  'platform_fee_bps snapshot per §F16, emits offer.created.';


-- ── rpc_counter_offer ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_counter_offer(
  p_actor_ref        uuid,
  p_offer_id         uuid,
  p_payload          jsonb,
  p_new_gross_fee    numeric,
  p_new_note         text,
  p_new_expires_at   timestamptz,
  p_added_items      jsonb,
  p_removed_items    jsonb,
  p_new_rights       jsonb
) RETURNS TABLE (event_id uuid, event_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer       record;
  v_actor_user  uuid;
  v_target      public.offer_target_type;
  v_item        jsonb;
  v_event_id    uuid;
  v_event_hash  text;
BEGIN
  -- Actor-auth guard.
  SELECT auth_user_id INTO v_actor_user
    FROM public.actor_handles
    WHERE handle = p_actor_ref AND tombstoned_at IS NULL;
  IF v_actor_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_mismatch'
      USING ERRCODE = 'P0008';
  END IF;

  -- Row-lock + state guard.
  SELECT id, buyer_id, creator_id, target_type, state
    INTO v_offer
    FROM public.offers
    WHERE id = p_offer_id
    FOR UPDATE;
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'offer_not_found: %', p_offer_id
      USING ERRCODE = 'P0003';
  END IF;
  IF v_offer.state NOT IN ('sent', 'countered') THEN
    RAISE EXCEPTION 'invalid_state: offer is %', v_offer.state
      USING ERRCODE = 'P0003';
  END IF;

  -- Party guard.
  IF v_actor_user IS NULL
     OR v_actor_user NOT IN (v_offer.buyer_id, v_offer.creator_id) THEN
    RAISE EXCEPTION 'not_party'
      USING ERRCODE = 'P0004';
  END IF;

  v_target := v_offer.target_type;

  -- Mutate composition. Composition-type change (asset ↔ brief)
  -- across the target_type boundary is NOT allowed in v1: if the
  -- JSON shape mismatches the stored target_type, the DDL T2
  -- trigger raises 23514 at INSERT time.
  IF p_removed_items IS NOT NULL
     AND jsonb_typeof(p_removed_items) = 'array' THEN
    IF v_target IN ('single_asset', 'asset_pack') THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_removed_items) LOOP
        DELETE FROM public.offer_assets
          WHERE offer_id = p_offer_id
            AND asset_id = CASE
              WHEN jsonb_typeof(v_item) = 'string' THEN (v_item #>> '{}')::uuid
              ELSE (v_item->>'asset_id')::uuid
            END;
      END LOOP;
    ELSE
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_removed_items) LOOP
        DELETE FROM public.offer_briefs
          WHERE offer_id = p_offer_id
            AND position = (v_item->>'position')::int;
      END LOOP;
    END IF;
  END IF;

  IF p_added_items IS NOT NULL
     AND jsonb_typeof(p_added_items) = 'array' THEN
    IF v_target IN ('single_asset', 'asset_pack') THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_added_items) LOOP
        INSERT INTO public.offer_assets (offer_id, asset_id, position)
        VALUES (
          p_offer_id,
          CASE
            WHEN jsonb_typeof(v_item) = 'string' THEN (v_item #>> '{}')::uuid
            ELSE (v_item->>'asset_id')::uuid
          END,
          COALESCE(
            (v_item->>'position')::int,
            (SELECT COALESCE(max(position), 0) + 1
               FROM public.offer_assets WHERE offer_id = p_offer_id)
          )
        );
      END LOOP;
    ELSE
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_added_items) LOOP
        INSERT INTO public.offer_briefs (offer_id, position, spec)
        VALUES (
          p_offer_id,
          COALESCE(
            (v_item->>'position')::int,
            (SELECT COALESCE(max(position), 0) + 1
               FROM public.offer_briefs WHERE offer_id = p_offer_id)
          ),
          COALESCE(v_item->'spec', v_item)
        );
      END LOOP;
    END IF;
  END IF;

  UPDATE public.offers
     SET state        = 'countered',
         gross_fee    = p_new_gross_fee,
         current_note = p_new_note,
         rights       = p_new_rights,
         expires_at   = p_new_expires_at
   WHERE id = p_offer_id;

  SELECT r.out_event_id, r.out_event_hash
    INTO v_event_id, v_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', p_offer_id, 'offer.countered', p_payload, p_actor_ref
    ) AS r;

  event_id   := v_event_id;
  event_hash := v_event_hash;
  RETURN NEXT;
END;
$$;


-- ── rpc_accept_offer ───────────────────────────────────────────────
-- Atomic across TWO threads: appends offer.accepted on 'offer' and
-- assignment.created on the new 'assignment' thread, plus creates
-- the assignments row and populates assignment_deliverables for
-- brief-packs (D14 — the atomic cross-phase populate stays inside
-- the accept txn so the "assignment.created event implies deliverable
-- scaffold exists" invariant holds). 4A.3 owns the mutation RPCs on
-- assignment_deliverables; this RPC owns ONLY the create-time populate.
--
-- Stripe is NOT invoked here. The Part B2 TS-side wrapper runs the
-- §8.5 straddle: outer state read → PaymentIntent create (no DB
-- row-lock held) → THIS RPC (row-lock acquired and released within
-- <150ms) → void on RPC failure. See D1 R1 row-lock scope lock-in.
CREATE OR REPLACE FUNCTION public.rpc_accept_offer(
  p_actor_ref uuid,
  p_offer_id  uuid,
  p_payload   jsonb
) RETURNS TABLE (
  assignment_id           uuid,
  offer_event_id          uuid,
  offer_event_hash        text,
  assignment_event_id     uuid,
  assignment_event_hash   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer              record;
  v_actor_user         uuid;
  v_assignment_id      uuid;
  v_expected_pieces    int;
  v_asn_payload        jsonb;
  v_offer_event_id     uuid;
  v_offer_event_hash   text;
  v_asn_event_id       uuid;
  v_asn_event_hash     text;
  v_brief              record;
BEGIN
  -- Actor-auth guard.
  SELECT auth_user_id INTO v_actor_user
    FROM public.actor_handles
    WHERE handle = p_actor_ref AND tombstoned_at IS NULL;
  IF v_actor_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_mismatch'
      USING ERRCODE = 'P0008';
  END IF;

  -- Row-lock + state guard.
  SELECT id, buyer_id, creator_id, target_type, state
    INTO v_offer
    FROM public.offers
    WHERE id = p_offer_id
    FOR UPDATE;
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'offer_not_found: %', p_offer_id
      USING ERRCODE = 'P0003';
  END IF;
  IF v_offer.state NOT IN ('sent', 'countered') THEN
    RAISE EXCEPTION 'invalid_state: offer is %', v_offer.state
      USING ERRCODE = 'P0003';
  END IF;

  -- Party guard.
  IF v_actor_user IS NULL
     OR v_actor_user NOT IN (v_offer.buyer_id, v_offer.creator_id) THEN
    RAISE EXCEPTION 'not_party'
      USING ERRCODE = 'P0004';
  END IF;

  -- Business mutation: offers.state → 'accepted'.
  UPDATE public.offers SET state = 'accepted' WHERE id = p_offer_id;

  -- Emit offer.accepted on 'offer' thread.
  SELECT r.out_event_id, r.out_event_hash
    INTO v_offer_event_id, v_offer_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', p_offer_id, 'offer.accepted', p_payload, p_actor_ref
    ) AS r;

  -- Create the assignments row. expected_piece_count derived from
  -- child-table row count per §8.5.
  IF v_offer.target_type IN ('single_brief', 'brief_pack') THEN
    SELECT count(*) INTO v_expected_pieces
      FROM public.offer_briefs WHERE offer_id = p_offer_id;
  ELSE
    SELECT count(*) INTO v_expected_pieces
      FROM public.offer_assets WHERE offer_id = p_offer_id;
  END IF;

  INSERT INTO public.assignments (offer_id, state)
  VALUES (p_offer_id, 'active')
  RETURNING id INTO v_assignment_id;

  -- D14: atomic populate of assignment_deliverables for brief-packs.
  -- One row per offer_briefs row. revision_cap copied from the
  -- brief spec. Asset-pack offers skip this populate — delivery of
  -- pre-existing assets does not use the deliverable scaffold.
  IF v_offer.target_type IN ('single_brief', 'brief_pack') THEN
    FOR v_brief IN
      SELECT position, spec FROM public.offer_briefs
        WHERE offer_id = p_offer_id
        ORDER BY position
    LOOP
      INSERT INTO public.assignment_deliverables (
        assignment_id, piece_ref, revision_cap
      ) VALUES (
        v_assignment_id,
        v_brief.position::text,
        COALESCE((v_brief.spec->>'revision_cap')::int, 0)
      );
    END LOOP;
  END IF;

  -- Build assignment.created payload per §8.2. The payload is
  -- constructed inline here (not taken from p_payload) because
  -- the fields are all derived from the offer, not from caller
  -- input.
  v_asn_payload := jsonb_build_object(
    'v', 1,
    'offer_id', p_offer_id,
    'target_type', v_offer.target_type,
    'expected_piece_count', v_expected_pieces
  );

  -- Emit assignment.created on the NEW 'assignment' thread (fresh
  -- thread → prev_event_hash resolves to NULL in the helper).
  SELECT r.out_event_id, r.out_event_hash
    INTO v_asn_event_id, v_asn_event_hash
    FROM public._emit_offer_event_with_retry(
      'assignment', v_assignment_id, 'assignment.created',
      v_asn_payload, p_actor_ref
    ) AS r;

  assignment_id         := v_assignment_id;
  offer_event_id        := v_offer_event_id;
  offer_event_hash      := v_offer_event_hash;
  assignment_event_id   := v_asn_event_id;
  assignment_event_hash := v_asn_event_hash;
  RETURN NEXT;
END;
$$;


-- ── rpc_reject_offer ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_reject_offer(
  p_actor_ref uuid,
  p_offer_id  uuid,
  p_payload   jsonb
) RETURNS TABLE (event_id uuid, event_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer       record;
  v_actor_user  uuid;
  v_event_id    uuid;
  v_event_hash  text;
BEGIN
  SELECT auth_user_id INTO v_actor_user
    FROM public.actor_handles
    WHERE handle = p_actor_ref AND tombstoned_at IS NULL;
  IF v_actor_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_mismatch'
      USING ERRCODE = 'P0008';
  END IF;

  SELECT id, buyer_id, creator_id, state
    INTO v_offer
    FROM public.offers
    WHERE id = p_offer_id
    FOR UPDATE;
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'offer_not_found: %', p_offer_id
      USING ERRCODE = 'P0003';
  END IF;
  IF v_offer.state NOT IN ('sent', 'countered') THEN
    RAISE EXCEPTION 'invalid_state: offer is %', v_offer.state
      USING ERRCODE = 'P0003';
  END IF;

  IF v_actor_user IS NULL
     OR v_actor_user NOT IN (v_offer.buyer_id, v_offer.creator_id) THEN
    RAISE EXCEPTION 'not_party'
      USING ERRCODE = 'P0004';
  END IF;

  UPDATE public.offers SET state = 'rejected' WHERE id = p_offer_id;

  SELECT r.out_event_id, r.out_event_hash
    INTO v_event_id, v_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', p_offer_id, 'offer.rejected', p_payload, p_actor_ref
    ) AS r;

  event_id   := v_event_id;
  event_hash := v_event_hash;
  RETURN NEXT;
END;
$$;


-- ── rpc_cancel_offer ───────────────────────────────────────────────
-- Buyer-only per spec §4. "Last turn was buyer's" guard excludes
-- system-actor events from the lookup (D15) so a mid-thread system
-- event does not trap the buyer in the offer.
CREATE OR REPLACE FUNCTION public.rpc_cancel_offer(
  p_actor_ref uuid,
  p_offer_id  uuid,
  p_payload   jsonb
) RETURNS TABLE (event_id uuid, event_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer              record;
  v_actor_user         uuid;
  v_last_actor_ref     uuid;
  v_last_actor_user    uuid;
  v_event_id           uuid;
  v_event_hash         text;
  c_system_actor constant uuid :=
    '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  SELECT auth_user_id INTO v_actor_user
    FROM public.actor_handles
    WHERE handle = p_actor_ref AND tombstoned_at IS NULL;
  IF v_actor_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_mismatch'
      USING ERRCODE = 'P0008';
  END IF;

  SELECT id, buyer_id, creator_id, state
    INTO v_offer
    FROM public.offers
    WHERE id = p_offer_id
    FOR UPDATE;
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'offer_not_found: %', p_offer_id
      USING ERRCODE = 'P0003';
  END IF;
  IF v_offer.state NOT IN ('sent', 'countered') THEN
    RAISE EXCEPTION 'invalid_state: offer is %', v_offer.state
      USING ERRCODE = 'P0003';
  END IF;

  -- Buyer-only guard.
  IF v_actor_user IS DISTINCT FROM v_offer.buyer_id THEN
    RAISE EXCEPTION 'not_party: cancel is buyer-only'
      USING ERRCODE = 'P0004';
  END IF;

  -- D15: last-turn guard filters system-actor events. Look at the
  -- most recent NON-SYSTEM event on the offer thread. For the first
  -- event (offer.created by buyer) the query returns the buyer's
  -- actor_ref and the guard trivially passes.
  SELECT actor_ref INTO v_last_actor_ref
    FROM public.ledger_events
    WHERE thread_type = 'offer'
      AND thread_id   = p_offer_id
      AND actor_ref  <> c_system_actor
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

  IF v_last_actor_ref IS NOT NULL THEN
    SELECT auth_user_id INTO v_last_actor_user
      FROM public.actor_handles WHERE handle = v_last_actor_ref;
    IF v_last_actor_user IS DISTINCT FROM v_offer.buyer_id THEN
      RAISE EXCEPTION 'not_last_turn'
        USING ERRCODE = 'P0005';
    END IF;
  END IF;

  UPDATE public.offers
     SET state        = 'cancelled',
         cancelled_by = v_offer.buyer_id
   WHERE id = p_offer_id;

  SELECT r.out_event_id, r.out_event_hash
    INTO v_event_id, v_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', p_offer_id, 'offer.cancelled', p_payload, p_actor_ref
    ) AS r;

  event_id   := v_event_id;
  event_hash := v_event_hash;
  RETURN NEXT;
END;
$$;


-- ── rpc_expire_offer ───────────────────────────────────────────────
-- System-only. Cron caller lands in Part D; this RPC exists now so
-- Part C1 can render 'expired' rows from test fixtures correctly
-- (D12).
CREATE OR REPLACE FUNCTION public.rpc_expire_offer(
  p_actor_ref uuid,
  p_offer_id  uuid,
  p_payload   jsonb
) RETURNS TABLE (event_id uuid, event_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer       record;
  v_event_id    uuid;
  v_event_hash  text;
  c_system_actor constant uuid :=
    '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- System-actor-only guard (D5 alt branch). Direct equality
  -- against the literal sentinel handle — auth.uid() path does
  -- not apply because cron invokes via service_role.
  IF p_actor_ref <> c_system_actor THEN
    RAISE EXCEPTION 'not_system'
      USING ERRCODE = 'P0006';
  END IF;

  SELECT id, state, expires_at
    INTO v_offer
    FROM public.offers
    WHERE id = p_offer_id
    FOR UPDATE;
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'offer_not_found: %', p_offer_id
      USING ERRCODE = 'P0003';
  END IF;
  IF v_offer.state NOT IN ('sent', 'countered') THEN
    RAISE EXCEPTION 'invalid_state: offer is %', v_offer.state
      USING ERRCODE = 'P0003';
  END IF;

  -- Protects against cron race: buyer may have just extended
  -- expires_at past now().
  IF v_offer.expires_at >= now() THEN
    RAISE EXCEPTION 'not_yet_expired: expires_at=%', v_offer.expires_at
      USING ERRCODE = 'P0007';
  END IF;

  UPDATE public.offers SET state = 'expired' WHERE id = p_offer_id;

  SELECT r.out_event_id, r.out_event_hash
    INTO v_event_id, v_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', p_offer_id, 'offer.expired', p_payload, p_actor_ref
    ) AS r;

  event_id   := v_event_id;
  event_hash := v_event_hash;
  RETURN NEXT;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- GRANTS.
--   • Five user-driven RPCs → authenticated role (Parts B1/B2 route
--     handlers call these via user-JWT Supabase client).
--   • rpc_expire_offer → service_role only (Part D cron uses
--     service-role client).
-- ═══════════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.rpc_create_offer(
  uuid, uuid, uuid, public.offer_target_type, numeric, int,
  char, jsonb, text, timestamptz, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_create_offer(
  uuid, uuid, uuid, public.offer_target_type, numeric, int,
  char, jsonb, text, timestamptz, jsonb, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_counter_offer(
  uuid, uuid, jsonb, numeric, text, timestamptz, jsonb, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_counter_offer(
  uuid, uuid, jsonb, numeric, text, timestamptz, jsonb, jsonb, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_accept_offer(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_accept_offer(uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_reject_offer(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reject_offer(uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_cancel_offer(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_offer(uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_expire_offer(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_expire_offer(uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_expire_offer(uuid, uuid, jsonb) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- Inline assertion: create → counter → cancel smoke triad.
--
-- Mirrors the sentinel-scoped pattern in migration 20260421000006
-- (L131-212). Every row emitted by this block carries a unique
-- sentinel in payload.note / offers.current_note so cleanup can
-- identify its own writes by exact match, regardless of any existing
-- ledger_events / offers baseline.
--
-- Creates disposable auth.users + public.users + actor_handles rows
-- for a buyer/creator pair, swaps the session's request.jwt.claim.sub
-- GUC via set_config(..., is_local => true) to drive auth.uid()
-- during each RPC call, runs the triad, asserts the three ledger
-- events landed on the offer thread with a correct prev-hash chain,
-- then cleans up by sentinel match (reverse FK order, NOT blanket).
--
-- Does NOT exercise rpc_accept_offer (assignment_deliverables row
-- setup in an assertion block is infrastructurally heavier than the
-- smoke triad warrants) or rpc_expire_offer (requires pg_sleep >
-- expires_at). Those paths are covered by Part B1/B2 route-level
-- integration tests.
-- ═══════════════════════════════════════════════════════════════════

DO $verify$
DECLARE
  v_sentinel         text;
  v_buyer_user_id    uuid := gen_random_uuid();
  v_creator_user_id  uuid := gen_random_uuid();
  v_buyer_handle     uuid;
  v_creator_handle   uuid;
  v_offer_id         uuid;
  v_ev1_id           uuid;
  v_ev1_hash         text;
  v_ev2_id           uuid;
  v_ev2_hash         text;
  v_row_count        int;
  v_brief_id         uuid := gen_random_uuid();
  v_orig_jwt_sub     text;
BEGIN
  v_sentinel := 'P4_4A_2_ASSERTION_SENTINEL_' || gen_random_uuid()::text;

  -- Capture prior jwt-sub GUC so we can restore it at the end.
  v_orig_jwt_sub := current_setting('request.jwt.claim.sub', true);

  -- Disposable auth.users + public.users pair (buyer). Minimal
  -- shape — only id / is_sso_user / is_anonymous are NOT NULL in
  -- auth.users; the rest default or are nullable. username is
  -- constrained by public.users.users_username_format
  -- (`^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$`); derive a
  -- format-valid suffix from md5(sentinel) so the whole string
  -- stays ≤30 chars and uses only [a-z0-9-].
  INSERT INTO auth.users (id) VALUES (v_buyer_user_id);
  INSERT INTO public.users (id, username, display_name, email)
    VALUES (v_buyer_user_id,
            'p4-4a2-b-'  || substr(md5(v_sentinel), 1, 10),
            'P4 4A.2 Buyer',
            substr(md5(v_sentinel), 1, 10) || '+buyer@frontfiles.test');

  -- Disposable auth.users + public.users pair (creator).
  INSERT INTO auth.users (id) VALUES (v_creator_user_id);
  INSERT INTO public.users (id, username, display_name, email)
    VALUES (v_creator_user_id,
            'p4-4a2-c-' || substr(md5(v_sentinel), 1, 10),
            'P4 4A.2 Creator',
            substr(md5(v_sentinel), 1, 10) || '+creator@frontfiles.test');

  -- actor_handles for each.
  INSERT INTO public.actor_handles (auth_user_id, tombstoned_at)
    VALUES (v_buyer_user_id, NULL)
    RETURNING handle INTO v_buyer_handle;
  INSERT INTO public.actor_handles (auth_user_id, tombstoned_at)
    VALUES (v_creator_user_id, NULL)
    RETURNING handle INTO v_creator_handle;

  -- ─ Step 1: rpc_create_offer as buyer ─
  PERFORM set_config('request.jwt.claim.sub',
                     v_buyer_user_id::text, true);

  SELECT r.offer_id, r.event_id, r.event_hash
    INTO v_offer_id, v_ev1_id, v_ev1_hash
    FROM public.rpc_create_offer(
      v_buyer_handle,
      v_buyer_user_id,
      v_creator_user_id,
      'brief_pack'::public.offer_target_type,
      10000::numeric,
      1500,
      'EUR',
      jsonb_build_object('template', 'editorial_one_time',
                         'params', '{}'::jsonb,
                         'is_transfer', false),
      v_sentinel,                                            -- current_note
      (now() + interval '7 days'),
      jsonb_build_array(
        jsonb_build_object(
          'position', 1,
          'spec', jsonb_build_object(
            'title',                 'Assertion brief ' || v_sentinel,
            'deadline_offset_days',  7,
            'deliverable_format',    'article',
            'revision_cap',          2,
            'notes',                 'seeded via migration assertion'
          )
        )
      ),
      jsonb_build_object(
        'v',                 1,
        'target_type',       'brief_pack',
        'items',             jsonb_build_array(v_brief_id::text),
        'gross_fee',         10000,
        'platform_fee_bps',  1500,
        'currency',          'EUR',
        'rights',            jsonb_build_object(
                               'template',    'editorial_one_time',
                               'params',      '{}'::jsonb,
                               'is_transfer', false),
        'expires_at',        to_char(
                               (now() + interval '7 days') AT TIME ZONE 'UTC',
                               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'note',              v_sentinel
      )
    ) AS r;

  IF v_offer_id IS NULL OR v_ev1_hash IS NULL OR v_ev1_hash = '' THEN
    RAISE EXCEPTION
      'P4 4A.2 assertion: rpc_create_offer returned offer_id=% event_hash=% — expected non-null',
      v_offer_id, v_ev1_hash;
  END IF;

  -- ─ Step 2: rpc_counter_offer as creator ─
  PERFORM set_config('request.jwt.claim.sub',
                     v_creator_user_id::text, true);

  SELECT r.event_id, r.event_hash
    INTO v_ev2_id, v_ev2_hash
    FROM public.rpc_counter_offer(
      v_creator_handle,
      v_offer_id,
      jsonb_build_object(
        'v',             1,
        'by_actor_id',   v_creator_handle::text,
        'fee_before',    10000,
        'fee_after',     12000,
        'added_items',   jsonb_build_array(),
        'removed_items', jsonb_build_array(),
        'rights_diff',   jsonb_build_object(),
        'note_before',   v_sentinel,
        'note_after',    v_sentinel || ' (countered)',
        'expires_at',    to_char(
                           (now() + interval '5 days') AT TIME ZONE 'UTC',
                           'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      ),
      12000::numeric,
      v_sentinel || ' (countered)',
      (now() + interval '5 days'),
      NULL,                                                  -- p_added_items
      NULL,                                                  -- p_removed_items
      jsonb_build_object('template',    'commercial_restricted',
                         'params',      '{}'::jsonb,
                         'is_transfer', false)
    ) AS r;

  IF v_ev2_hash IS NULL OR v_ev2_hash = '' THEN
    RAISE EXCEPTION 'P4 4A.2 assertion: rpc_counter_offer event_hash missing';
  END IF;

  -- ─ Assertion: exactly 2 events on the offer thread, chain preserved. ─
  --
  -- Draft 5 narrows this DO-block to the create → counter smoke
  -- pair. Cancel is excluded per §DELIVERABLES TXN-TIME CONSTRAINT:
  -- Postgres `now()` is txn-pinned, so all rows inside this
  -- migration txn share an identical `created_at`; the
  -- `ORDER BY created_at DESC, id DESC LIMIT 1` tiebreaker falls
  -- through to random `gen_random_uuid()` IDs, making the 3+ event
  -- lookup non-deterministic. The 2-event pair is safe because
  -- every "last event" lookup resolves against at most 1 prior row.
  -- Cancel coverage lands in Part B1 route integration tests, where
  -- each RPC runs in its own HTTP txn and event ordering is
  -- deterministic.
  SELECT count(*) INTO v_row_count
    FROM public.ledger_events
    WHERE thread_type = 'offer' AND thread_id = v_offer_id;
  IF v_row_count <> 2 THEN
    RAISE EXCEPTION
      'P4 4A.2 assertion: expected 2 offer events on thread, got %',
      v_row_count;
  END IF;

  -- Chain linkage asserted by content, not by ordering:
  --   (a) exactly 1 event has prev_event_hash IS NULL (the head);
  --   (b) exactly 1 event has prev_event_hash EQUAL to the head's
  --       event_hash (the follower);
  --   (c) those two events are distinct.
  --
  -- This form is immune to UUID-tied ordering because it reads the
  -- chain by content, not by ROW_NUMBER().
  PERFORM 1
    FROM public.ledger_events le_head
    JOIN public.ledger_events le_follow
      ON le_follow.thread_type = le_head.thread_type
     AND le_follow.thread_id   = le_head.thread_id
     AND le_follow.prev_event_hash = le_head.event_hash
     AND le_follow.id <> le_head.id
    WHERE le_head.thread_type = 'offer'
      AND le_head.thread_id   = v_offer_id
      AND le_head.prev_event_hash IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION
      'P4 4A.2 assertion: chain linkage on thread % not intact (head-follower pair missing)',
      v_offer_id;
  END IF;

  -- ─ Cleanup (sentinel-scoped, reverse FK order) ─
  --
  -- ledger_events FIRST (ON DELETE RESTRICT on actor_ref forces
  -- this ordering). Sentinel match on payload->>'note' +
  -- payload->>'note_after' to catch both offer.created / cancel
  -- (which set `note`) and offer.countered (which sets
  -- `note_after`).
  DELETE FROM public.ledger_events
    WHERE thread_type = 'offer'
      AND thread_id   = v_offer_id
      AND (payload->>'note'       LIKE v_sentinel || '%'
        OR payload->>'note_after' LIKE v_sentinel || '%');

  DELETE FROM public.offer_briefs
    WHERE offer_id IN (SELECT id FROM public.offers
                        WHERE current_note LIKE v_sentinel || '%');
  DELETE FROM public.offer_assets
    WHERE offer_id IN (SELECT id FROM public.offers
                        WHERE current_note LIKE v_sentinel || '%');
  DELETE FROM public.offers
    WHERE current_note LIKE v_sentinel || '%';

  DELETE FROM public.actor_handles WHERE handle = v_buyer_handle;
  DELETE FROM public.actor_handles WHERE handle = v_creator_handle;

  DELETE FROM public.users     WHERE id = v_buyer_user_id;
  DELETE FROM public.users     WHERE id = v_creator_user_id;
  DELETE FROM auth.users       WHERE id = v_buyer_user_id;
  DELETE FROM auth.users       WHERE id = v_creator_user_id;

  -- Restore prior jwt-sub GUC (empty string resets the setting).
  PERFORM set_config('request.jwt.claim.sub',
                     COALESCE(v_orig_jwt_sub, ''), true);

  RAISE NOTICE
    'P4 4A.2 Part A assertion verified: create → counter smoke pair emitted 2 events on offer thread % with intact prev-hash chain; sentinel-scoped cleanup complete. Cancel coverage deferred to Part B1 integration tests per §DELIVERABLES TXN-TIME CONSTRAINT. Sentinel=%',
    v_offer_id, v_sentinel;
END
$verify$;


COMMIT;
