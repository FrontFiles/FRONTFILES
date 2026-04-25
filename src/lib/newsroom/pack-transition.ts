/**
 * Frontfiles — Pack state-machine RPC wrapper (NR-D9a, F3)
 *
 * Server-only async wrapper around the
 * `newsroom_pack_transition(...)` SECURITY DEFINER function
 * created in migration 20260425000007.
 *
 * Distinct from `src/lib/newsroom/state-machine.ts` (NR-D4) —
 * that file is the pure validator used by UI for disabled-state
 * computation. This file is the executor: makes the actual DB
 * transition via service-role RPC. The two share the transition
 * matrix conceptually but live separately because mixing them
 * would force the UI-facing validator into the `'server-only'`
 * boundary.
 *
 * Both layers must agree on the transition matrix. Hand-synced
 * in v1; v1.1 backlog item "Transition matrix codegen" tracks
 * the duplication risk.
 *
 * ─── Caller posture ──────────────────────────────────────────────
 *
 * This wrapper is the canonical entry point for downstream
 * directives:
 *
 *   - NR-D9b (publish UI flow) — calls `transitionPack` on the
 *     P9 confirmation submit.
 *   - NR-D9c (lift worker) — calls `transitionPack(scheduled →
 *     published)` for each pack at `publish_at`.
 *   - NR-D11 (consumer-side) — read-only; does not mutate state.
 *
 * No other code path is permitted to write
 * `newsroom_packs.status`. The migration's REVOKE ALL FROM PUBLIC
 * enforces this at the DB layer (only service-role can call).
 *
 * Spec cross-references:
 *   - PRD.md §3.3 (transition matrix + preconditions)
 *   - directives/NR-D9a-state-machine-rpc.md §F3
 *   - migration 20260425000007_newsroom_pack_transition_rpc.sql
 */

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  NewsroomPackStatus,
  NewsroomPackVisibility,
} from '@/lib/db/schema'

// ── Types ───────────────────────────────────────────────────────

/**
 * Discriminated union of failure modes the RPC can return.
 *
 *   pack-not-found            — packId did not match any row
 *   illegal-transition        — current status doesn't permit the
 *                               requested target (e.g. published →
 *                               draft, or any → takedown which is
 *                               admin-side)
 *   preconditions-not-met     — at least one publish-checklist
 *                               item missing (see
 *                               missingPreconditions[])
 *   embargo-already-accessed  — scheduled → draft pullback while a
 *                               recipient has accessed the embargo
 *                               (PRD §3.3); pass overrideEmbargoCancel
 *                               to bypass
 */
export type TransitionErrorCode =
  | 'pack-not-found'
  | 'illegal-transition'
  | 'preconditions-not-met'
  | 'embargo-already-accessed'

/**
 * String tags returned by the RPC on `preconditions-not-met`.
 * Each tag corresponds to a PRD §3.3 publish-checklist item.
 * Ordered by checklist sequence for predictable UI rendering.
 */
export type MissingPrecondition =
  | 'title'
  | 'credit_line'
  | 'no_assets'
  | 'asset_alt_text_missing'
  | 'asset_scan_pending_or_flagged'
  | 'rights_warranty_missing_or_incomplete'
  | 'no_active_signing_key'
  | 'scheduled_requires_embargo_or_publish_at'
  | 'immediate_publish_disallows_embargo_or_publish_at'

export interface TransitionInput {
  packId: string
  targetStatus: NewsroomPackStatus
  /** Caller's user ID — captured by the RPC for future audit logging. */
  callerUserId: string
  /**
   * Bypass the "embargo already accessed" guard on
   * `scheduled → draft` pullback. Default `false`.
   *
   * v1: not surfaced in any UI; reserved for an eventual admin-
   * override path (NR-D17). Tests in F4 exercise both branches.
   */
  overrideEmbargoCancel?: boolean
}

/**
 * Discriminated success/failure shape. Match on `result.ok`.
 *
 * On success, `newPublishedAt` and `newArchivedAt` reflect the
 * post-update timestamps. They may be ISO strings or null
 * depending on the transition (e.g. `archived → published`
 * preserves the original published_at and clears archived_at to
 * null).
 *
 * On failure, `errorCode` discriminates the failure mode. The
 * `missingPreconditions[]` field is populated only when
 * `errorCode === 'preconditions-not-met'`. The `from`/`to` fields
 * appear only on `illegal-transition`. The `hint` field appears
 * only on `embargo-already-accessed` (carries the override
 * instruction).
 */
export type TransitionResult =
  | {
      ok: true
      newStatus: NewsroomPackStatus
      newVisibility: NewsroomPackVisibility
      newPublishedAt: string | null
      newArchivedAt: string | null
    }
  | {
      ok: false
      errorCode: TransitionErrorCode
      missingPreconditions?: ReadonlyArray<MissingPrecondition>
      from?: NewsroomPackStatus
      to?: NewsroomPackStatus
      hint?: string
    }

// ── Wrapper ─────────────────────────────────────────────────────

/**
 * Internal jsonb shape the RPC returns. Snake_case from the SQL
 * function. Mapped to camelCase at the boundary so the rest of
 * the TS codebase doesn't carry the schema-naming convention.
 */
interface RpcSuccessShape {
  ok: true
  new_status: NewsroomPackStatus
  new_visibility: NewsroomPackVisibility
  new_published_at: string | null
  new_archived_at: string | null
}

interface RpcFailureShape {
  ok: false
  error_code: TransitionErrorCode
  missing_preconditions?: ReadonlyArray<MissingPrecondition>
  from?: NewsroomPackStatus
  to?: NewsroomPackStatus
  hint?: string
}

type RpcShape = RpcSuccessShape | RpcFailureShape

/**
 * Call the `newsroom_pack_transition` RPC.
 *
 * The supplied client must be the service-role client
 * (`getSupabaseClient()` from `@/lib/db/client`). The RPC's
 * REVOKE ALL FROM PUBLIC means user-JWT clients receive a
 * permission-denied error.
 *
 * Throws on transport-level errors (RPC unreachable, malformed
 * response). Returns a structured failure for business-logic
 * failures (illegal transition, missing preconditions, etc.) so
 * callers can pattern-match on `result.ok` instead of catching
 * exceptions for predictable failure modes.
 */
export async function transitionPack(
  client: SupabaseClient,
  input: TransitionInput,
): Promise<TransitionResult> {
  const { data, error } = await client.rpc('newsroom_pack_transition', {
    p_pack_id: input.packId,
    p_target_status: input.targetStatus,
    p_caller_user_id: input.callerUserId,
    p_override_embargo_cancel: input.overrideEmbargoCancel ?? false,
  })

  if (error) {
    throw new Error(
      `transitionPack: RPC error: ${error.message ?? String(error)}`,
    )
  }
  if (data === null || data === undefined) {
    throw new Error('transitionPack: RPC returned null/undefined')
  }

  // The RPC's jsonb is parsed by supabase-js into a plain object.
  // Map snake_case → camelCase at the boundary.
  const rpc = data as RpcShape
  if (rpc.ok) {
    return {
      ok: true,
      newStatus: rpc.new_status,
      newVisibility: rpc.new_visibility,
      newPublishedAt: rpc.new_published_at,
      newArchivedAt: rpc.new_archived_at,
    }
  }
  return {
    ok: false,
    errorCode: rpc.error_code,
    missingPreconditions: rpc.missing_preconditions,
    from: rpc.from,
    to: rpc.to,
    hint: rpc.hint,
  }
}
