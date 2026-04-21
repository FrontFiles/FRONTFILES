-- ════════════════════════════════════════════════════════════════
-- P4 concern 4A.1 — rpc_append_ledger_event
--
-- Directive: docs/audits/P4_CONCERN_4A_1_DIRECTIVE.md §11
-- Design lock: docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1 + §6.1a
-- Spec: docs/specs/ECONOMIC_FLOW_v1.md §8.3 (storage shape),
--                                       §8.5 (atomicity)
-- Referenced: supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
--             — `enforce_ledger_hash_chain()` BEFORE INSERT trigger
--             computes `event_hash` and validates `prev_event_hash`.
--             Not modified here.
--
-- Purpose: the single utility RPC that wraps the raw INSERT into
-- `public.ledger_events`. Called by:
--   - TS-side `src/lib/ledger/writer.ts` `emitEvent()` (for
--     payload-only appends such as `dispute.evidence_submitted`,
--     which has no paired business UPDATE — see spec §8.2a); and
--   - the business-operation RPCs that 4A.2 / 4A.3 / 4A.4 will
--     ship (each wraps a row-lock + business UPDATE + this
--     helper in one `BEGIN/COMMIT`, per design lock §6.1a).
--
-- The helper itself is NOT wrapped in BEGIN/COMMIT: a single
-- INSERT is already atomic under Postgres, and inlining a txn
-- here would create nested-transaction ambiguity when this RPC
-- is eventually called from inside another function. Caller
-- manages txn scope.
--
-- Hash math is NOT computed here — the BEFORE INSERT trigger
-- `enforce_ledger_hash_chain()` on `public.ledger_events` writes
-- `NEW.event_hash` and validates the chain (see migration
-- 20260421000004 L427-466). The `RETURNING` clause surfaces the
-- trigger's output back to TS.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_append_ledger_event(
  p_thread_type     text,
  p_thread_id       uuid,
  p_event_type      text,
  p_payload_version text,
  p_payload         jsonb,
  p_actor_ref       uuid,
  p_prev_event_hash text
) RETURNS TABLE (id uuid, event_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.ledger_events (
    thread_type, thread_id, event_type,
    payload_version, payload, actor_ref,
    prev_event_hash
  )
  VALUES (
    p_thread_type, p_thread_id, p_event_type,
    p_payload_version, p_payload, p_actor_ref,
    p_prev_event_hash
  )
  RETURNING ledger_events.id, ledger_events.event_hash;
END;
$$;

-- Service-role only. This RPC is called from server-side
-- writer.ts using the service-role client. It must NOT be
-- reachable from the anon or authenticated roles — public
-- clients go through the 4A.2+ business RPCs, which each wrap
-- this helper inside their own txn after validating the
-- caller's actor/authorization.
REVOKE ALL ON FUNCTION public.rpc_append_ledger_event(
  text, uuid, text, text, jsonb, uuid, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_append_ledger_event(
  text, uuid, text, text, jsonb, uuid, text
) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_append_ledger_event(
  text, uuid, text, text, jsonb, uuid, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_append_ledger_event(
  text, uuid, text, text, jsonb, uuid, text
) TO service_role;
