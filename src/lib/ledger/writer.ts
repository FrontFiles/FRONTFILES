import 'server-only'

/**
 * Frontfiles — Ledger event writer (P4 concern 4A.1)
 *
 * Single TS-side entry point for appending a ledger event row.
 * Runs payload Zod validation, delegates the INSERT to the
 * `rpc_append_ledger_event` RPC (see migration
 * `20260421000010_rpc_append_ledger_event.sql`), and surfaces the
 * trigger-computed `event_hash` back to the caller.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1 — writer
 *     contract: hash math is Postgres-side, TS-side runs Zod +
 *     INSERT; the caller loads `prev_event_hash` inside its own
 *     atomic RPC and passes it in.
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §6.1a — atomicity
 *     is the caller's responsibility via business-operation RPCs
 *     (deferred to 4A.2 / 4A.3 / 4A.4).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.3 — storage shape +
 *     hash preimage.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.5 — atomicity: business
 *     UPDATE + ledger INSERT wrapped in one txn at the caller.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.6 — payload versioning:
 *     every event at v=1 today; row-level `payload_version` column
 *     hard-coded to 'v1' for the lifetime of P4.
 *   - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
 *     L427-466 — `enforce_ledger_hash_chain()` BEFORE INSERT
 *     trigger: reads latest `event_hash` on the thread, validates
 *     equality with `NEW.prev_event_hash`, computes new
 *     `NEW.event_hash`. Raises with SQLSTATE `check_violation`
 *     (23514) on mismatch.
 *
 * Server-only sentinel: `import 'server-only'` (not `'use server'`)
 * — the writer is an internal server-to-Postgres helper, never a
 * Server Function surface. `'use server'` would wrongly mark every
 * export as a Server Function callable from client components;
 * `'server-only'` raises a build error if any client component
 * imports this module, which is what we want.
 */

import * as z from 'zod'

import type { SupabaseClient } from '@supabase/supabase-js'

import { EventPayloadSchemas } from './schemas'
import type { EventPayload, EventType, ThreadType } from './types'

/**
 * Arguments accepted by `emitEvent`.
 *
 * Note the `prevEventHash` field: the caller — not the writer —
 * loads the prior event hash for this thread inside the same
 * atomic transaction that holds the row-level lock on the
 * business row being mutated. Per design lock §6.1, a writer
 * that queried for `prev_event_hash` itself would race against
 * its own caller's RPC body under read-committed isolation
 * (two reads from two statements in the same RPC can see
 * different thread tips). Concentrating the read in the caller,
 * inside the same txn as the lock, eliminates the race at the
 * writer boundary.
 */
export type EmitEventArgs<T extends EventType> = {
  /** Service-role Supabase client. Caller supplies; writer does not
   *  construct its own client. */
  db: SupabaseClient
  threadType: ThreadType
  /** uuid — thread primary key (offers.id / assignments.id /
   *  disputes.dispute_id). */
  threadId: string
  eventType: T
  /** TS-typed payload matching the `eventType` discriminator. Zod-
   *  validated inside `emitEvent` before the RPC call. */
  payload: EventPayload<T>
  /** uuid — `actor_handles.handle`. Either a party handle (via
   *  `requireActor()`) or `SYSTEM_ACTOR_HANDLE` for platform-
   *  originated events. */
  actorRef: string
  /** uuid-hex or null. NULL only for the first event on a thread.
   *  Loaded by the caller inside its atomic RPC before calling
   *  the writer. */
  prevEventHash: string | null
}

export type EmitEventResult =
  | { ok: true; eventHash: string; eventId: string }
  | {
      ok: false
      reason:
        | 'PAYLOAD_VALIDATION_FAILED'
        | 'HASH_CHAIN_VIOLATION'
        | 'INSERT_FAILED'
      detail: string
    }

// ─── Trigger error matchers ───────────────────────────────────────
//
// `enforce_ledger_hash_chain()` raises via:
//   RAISE EXCEPTION 'ledger_events hash-chain violation: ...'
//     USING ERRCODE = 'check_violation';
// (migration 20260421000004 L442-446). Postgres maps
// `check_violation` to SQLSTATE `23514`. We match the SQLSTATE
// first (stable regardless of RAISE text rewording) and fall back
// to a substring match on the RAISE text if the code is absent.
const HASH_CHAIN_VIOLATION_SQLSTATE = '23514'
const HASH_CHAIN_VIOLATION_RAISE_SUBSTR =
  'ledger_events hash-chain violation'

// Every row-level insert in P4 uses the literal 'v1' payload_version.
// Spec §8.6 pre-consumer exception: breaking payload shape changes
// can happen in-place at v=1 until the first production consumer
// ships at P5. A follow-up directive will thread a `payloadVersion`
// arg through `EmitEventArgs` when the first post-P5 bump lands.
const ROW_PAYLOAD_VERSION = 'v1' as const

type RpcErrorLike = { code?: string; message?: string }

function isHashChainViolation(err: RpcErrorLike): boolean {
  if (err.code === HASH_CHAIN_VIOLATION_SQLSTATE) return true
  const msg = err.message?.toLowerCase() ?? ''
  return msg.includes(HASH_CHAIN_VIOLATION_RAISE_SUBSTR.toLowerCase())
}

/**
 * Append one ledger event.
 *
 * 1. Look up the Zod schema by `eventType`.
 * 2. `safeParse` the payload. On failure → PAYLOAD_VALIDATION_FAILED.
 * 3. Call `rpc_append_ledger_event` with the validated payload. The
 *    BEFORE INSERT trigger validates the hash chain and computes
 *    `event_hash`.
 * 4. On error: classify as HASH_CHAIN_VIOLATION (SQLSTATE-matched)
 *    or INSERT_FAILED. On success: return the trigger-computed
 *    `event_hash` and the new row's `id`.
 *
 * The writer does NOT log payload contents at any log level —
 * spec §8 payload-discipline note + §12 PII concerns. A debug
 * breadcrumb carrying only `event_type` + `thread_type` +
 * `thread_id` + `eventId` is emitted on success; payload stays in
 * the DB.
 */
export async function emitEvent<T extends EventType>(
  args: EmitEventArgs<T>,
): Promise<EmitEventResult> {
  const schema = EventPayloadSchemas[args.eventType] as
    | z.ZodTypeAny
    | undefined
  if (!schema) {
    // Unreachable given the compile-time `satisfies` check +
    // module-load runtime check in schemas.ts, but belt-and-braces
    // for any future EventType literal that slips through.
    return {
      ok: false,
      reason: 'PAYLOAD_VALIDATION_FAILED',
      detail: `No schema for event type: ${args.eventType}`,
    }
  }

  const parsed = schema.safeParse(args.payload)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      ok: false,
      reason: 'PAYLOAD_VALIDATION_FAILED',
      detail: issues,
    }
  }

  const { data, error } = await args.db.rpc('rpc_append_ledger_event', {
    p_thread_type: args.threadType,
    p_thread_id: args.threadId,
    p_event_type: args.eventType,
    p_payload_version: ROW_PAYLOAD_VERSION,
    p_payload: parsed.data,
    p_actor_ref: args.actorRef,
    p_prev_event_hash: args.prevEventHash,
  })

  if (error) {
    if (isHashChainViolation(error as RpcErrorLike)) {
      return {
        ok: false,
        reason: 'HASH_CHAIN_VIOLATION',
        detail: error.message,
      }
    }
    return {
      ok: false,
      reason: 'INSERT_FAILED',
      detail: error.message,
    }
  }

  // RETURNS TABLE surfaces as an array even when exactly one row
  // is returned. Guard against the invariant-breaking case where
  // `error` is null but `data` is empty — downstream callers
  // must never see an undefined event_hash.
  const rows = data as Array<{ id: string; event_hash: string }> | null
  const row = rows?.[0]
  if (!row) {
    return {
      ok: false,
      reason: 'INSERT_FAILED',
      detail: 'RPC returned no row',
    }
  }

  return { ok: true, eventHash: row.event_hash, eventId: row.id }
}
