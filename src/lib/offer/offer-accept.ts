/**
 * Frontfiles — Offer accept orchestrator (P4 concern 4A.2 Part B2)
 *
 * The §8.5 straddle's command centre. Owns: idempotency-key derivation,
 * Zod-validated dual-thread payload construction, currency / amount
 * preflight, Stripe PaymentIntent create, inner RPC call
 * (`rpc_accept_offer_commit`), void-on-rollback, and the reconcile-
 * fail critical log.
 *
 * References:
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.5 — transition atomicity,
 *     Stripe charge ordering, dual-thread emit.
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §F4 — orchestrator
 *     contract + four failure shapes + flow ordering.
 *   - directive D1 — conditional-UPDATE replaces §8.5's SELECT …
 *     FOR UPDATE; this module's flow is the TS half of that R1
 *     straddle.
 *   - directive D3 — reconcile is LOG-ONLY in B2. No DB write on the
 *     reconcile-fail branch; admin_reconciliation_jobs is 4A.3 scope.
 *   - directive D6 — B2's PI create targets the platform balance.
 *     No `destination`, `transfer_data`, `on_behalf_of`,
 *     `application_fee_amount`.
 *   - directive D7 — amount = Math.round(offer.gross_fee * 100);
 *     currency whitelist = USD / EUR / GBP.
 *   - directive D9 — metadata carries forensic context for the
 *     Stripe dashboard + future 4A.3 webhook handlers.
 *   - directive D10 — idempotency key is server-derived, never
 *     client-supplied; persisted to offers.stripe_idempotency_key
 *     inside the inner RPC for audit.
 *   - directive R7 — unsupported currency is a RETURNED preflight
 *     result (`ok: false, kind: 'preflight'`), NOT a thrown
 *     exception. Orchestrator does not throw.
 *   - directive R8 — F8 does NOT modify `src/lib/offer/rpc-errors.ts`.
 *     If the B1 classifier returns `'unknown'` for a DB error (e.g.
 *     the 23505 double-accept race), the orchestrator surfaces that
 *     fall-through as-is; it does not paper over.
 *   - src/lib/offer/rpc-errors.ts — B1 `classifyRpcError`, consumed
 *     on the RPC-error branch.
 *   - src/lib/stripe/client.ts + src/lib/stripe/errors.ts — F3 +
 *     F8. Client is passed in by the route; classifier is consumed
 *     here.
 *   - src/lib/ledger/schemas.ts L100-106 + L133-141 —
 *     OfferAcceptedPayloadSchema + AssignmentCreatedPayloadSchema,
 *     both `.strict()`.
 *
 * Four failure kinds (exhaustive):
 *   - 'preflight'            — currency whitelist miss OR derived
 *                              amount non-finite / non-positive OR
 *                              Zod schema parse failure. No Stripe
 *                              call. Offer state untouched.
 *   - 'stripe_create'        — PaymentIntent create threw. Offer
 *                              state untouched. Classified via F8.
 *   - 'db_commit_voided'     — inner RPC raised; PI cancel succeeded.
 *                              Offer state is still pre-accept.
 *                              Classified via B1 classifier.
 *   - 'db_commit_reconcile'  — inner RPC raised AND PI cancel ALSO
 *                              threw. Structured `severity: 'critical'`
 *                              log + Sentry fatal fire. The ONLY
 *                              non-idempotent failure mode in B2.
 *   - 'unknown'              — schema-parse failure or other truly
 *                              unexpected throw. Sentry.captureException
 *                              fired with the raw error.
 *
 * Straddle flow (exact order, never changes):
 *   1. Derive idempotencyKey = `${offer.id}:accept`.
 *   2. Build offerAcceptedPayload (Zod .parse).
 *   3. Build assignmentCreatedPayload (Zod .parse).
 *   4. Currency whitelist check → preflight on miss (D7 / R7).
 *   5. Amount compute + validity guard → preflight on miss.
 *   6. stripe.paymentIntents.create (idempotency-key scoped).
 *   7. supabase.rpc('rpc_accept_offer_commit', …).
 *   8. RPC raised → stripe.paymentIntents.cancel with the SAME key.
 *   9. Void failed → reconcile log + Sentry fatal + RECONCILE_NEEDED.
 *  10. Happy path → validated RETURNING-TABLE shape.
 *
 * Invariants:
 *   - The orchestrator NEVER throws. Every branch returns
 *     `{ ok: false, ... }` or `{ ok: true, ... }`. Schema-parse
 *     failures, which are programmer errors, are caught and
 *     returned as 'unknown' after Sentry.captureException.
 *   - The idempotency key is derived, never client-supplied. The
 *     PI create call and the PI cancel call use the SAME key.
 *   - The PI is created OUTSIDE any DB txn. The inner RPC is the
 *     only DB txn; it does not span the Stripe call.
 *   - Stripe `metadata` stays under 500 chars per value + ≤ 50
 *     keys (D9). The five fields here total ~200-300 chars
 *     including JSON overhead — safe.
 *   - No import from `@/lib/special-offer`. That surface is slated
 *     for retirement in follow-up concern 4A.2.C (deferred from B2
 *     per directive §F11-DEFER-RATIONALE); F4 has no business
 *     referencing it.
 *
 * Reconcile-fail log schema (9 fields, AC11):
 *   offerId, buyerId, creatorId, paymentIntentId, idempotencyKey,
 *   dbCommitErrorCode, stripeVoidErrorCode, severity: 'critical',
 *   event: 'accept.reconcile_needed'.
 *   Plus `route: 'offer-accept'` as scaffolding — not counted in
 *   the 9 but required for the B1 logger convention.
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

import { logger } from '@/lib/logger'
import {
  AssignmentCreatedPayloadSchema,
  OfferAcceptedPayloadSchema,
} from '@/lib/ledger/schemas'
import { classifyRpcError } from '@/lib/offer/rpc-errors'
import type { OfferRow } from '@/lib/offer/types'
import { classifyStripeError } from '@/lib/stripe/errors'

// ─── Result shape ─────────────────────────────────────────────────

export type OfferAcceptResult =
  | {
      ok: true
      // R10 — paymentIntentId + clientSecret surface to F6, which
      // returns clientSecret to the browser so the client-side
      // `stripe.confirmCardPayment()` can complete the charge.
      // clientSecret is non-nullable: a fresh PI without
      // confirm:true is a Stripe invariant that always yields one;
      // a null value here is treated as a 502 STRIPE_UNAVAILABLE at
      // PI-create time (see R10 defensive branch below).
      paymentIntentId: string
      clientSecret: string
      offerEventId: string
      offerEventHash: string
      assignmentId: string
      assignmentEventId: string
      assignmentEventHash: string
    }
  | {
      ok: false
      kind:
        | 'preflight'
        | 'stripe_create'
        | 'db_commit_voided'
        | 'db_commit_reconcile'
        | 'unknown'
      httpStatus: number
      code: string
      message: string
    }

// ─── Currency whitelist (D7) ──────────────────────────────────────
//
// B2 ships with a hardcoded three-currency whitelist. 4A.3 replaces
// this with a proper currencies table (currencies.code, minor_unit,
// display_symbol). The `* 100` amount formula assumes minor_unit=100
// so JPY (minor_unit=1) and KWD (minor_unit=1000) are explicitly
// out-of-scope at this stage.
const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP']) // D7

// ─── RPC RETURNING row-shape narrowing ────────────────────────────

type RpcAcceptRow = {
  offer_event_id: string
  offer_event_hash: string
  assignment_id: string
  assignment_event_id: string
  assignment_event_hash: string
}

function isRpcAcceptRow(v: unknown): v is RpcAcceptRow {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.offer_event_id === 'string' &&
    typeof r.offer_event_hash === 'string' &&
    typeof r.assignment_id === 'string' &&
    typeof r.assignment_event_id === 'string' &&
    typeof r.assignment_event_hash === 'string'
  )
}

// ─── Orchestrator ─────────────────────────────────────────────────

/**
 * Run the §8.5 accept straddle. Never throws — every failure mode
 * returns a classified `{ ok: false, … }` shape.
 */
export async function acceptOffer(args: {
  supabase: SupabaseClient
  stripe: Stripe
  actorHandle: string
  actorAuthUserId: string
  offer: OfferRow
  expectedPieceCount: number
}): Promise<OfferAcceptResult> {
  const { supabase, stripe, actorHandle, offer, expectedPieceCount } = args
  // actorAuthUserId is kept in the signature for symmetry with B1
  // route patterns; no direct use inside F4. Referenced here to
  // silence the unused-arg lint rule without adding a suppression.
  void args.actorAuthUserId

  // ── 1. Derive the idempotency key ────────────────────────────
  // Deterministic from offer.id — same value used for PI create AND
  // PI cancel (D10). Never accepted from the request body.
  const idempotencyKey = `${offer.id}:accept`

  // ── 2+3. Build both payloads through the Zod schemas ─────────
  // .strict() on both schemas guarantees unknown-keys fail loud.
  // A parse failure here is a programmer error (e.g. the shape of
  // OfferAcceptedPayloadSchema changed under us); log + Sentry +
  // return unknown.
  let offerAcceptedPayload: ReturnType<typeof OfferAcceptedPayloadSchema.parse>
  let assignmentCreatedPayload: ReturnType<
    typeof AssignmentCreatedPayloadSchema.parse
  >
  try {
    offerAcceptedPayload = OfferAcceptedPayloadSchema.parse({
      v: 1,
      by_actor_id: actorHandle,
    })
    assignmentCreatedPayload = AssignmentCreatedPayloadSchema.parse({
      v: 1,
      offer_id: offer.id,
      target_type: offer.target_type,
      expected_piece_count: expectedPieceCount,
    })
  } catch (parseErr) {
    Sentry.captureException(parseErr, {
      level: 'error',
      extra: {
        route: 'offer-accept',
        stage: 'payload-parse',
        offerId: offer.id,
        targetType: offer.target_type,
      },
    })
    logger.error(
      {
        route: 'offer-accept',
        offerId: offer.id,
        err:
          parseErr instanceof Error ? parseErr.message : String(parseErr),
      },
      '[offer-accept] payload schema parse failed',
    )
    return {
      ok: false,
      kind: 'unknown',
      httpStatus: 500,
      code: 'INTERNAL',
      message: 'Internal server error.',
    }
  }

  // ── 4. Currency whitelist (D7 / R7 — preflight return, not throw) ─
  if (!SUPPORTED_CURRENCIES.has(offer.currency.toUpperCase())) {
    return {
      ok: false,
      kind: 'preflight',
      httpStatus: 400,
      code: 'UNSUPPORTED_CURRENCY',
      message: 'Currency not supported at this stage. Contact support.',
    }
  }

  // ── 5. Amount compute + validity guard ───────────────────────
  // Belt-and-braces. The offers.gross_fee column is numeric(12,2)
  // NOT NULL, but a NaN could slip through if a row-shape cast
  // drifted upstream. A zero or negative amount should never reach
  // Stripe either.
  const amountInMinorUnits = Math.round(offer.gross_fee * 100)
  if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) {
    return {
      ok: false,
      kind: 'preflight',
      httpStatus: 400,
      code: 'INVALID_AMOUNT',
      message: 'Offer amount is invalid.',
    }
  }

  // ── 6. Create the PaymentIntent ──────────────────────────────
  // Idempotency-keyed; no Connect params (D6). Metadata carries
  // forensic context per D9 — ≤ 50 keys, each value ≤ 500 chars.
  // R10: capture pi.client_secret alongside pi.id so F6 can return
  // it to the browser for `stripe.confirmCardPayment()`.
  let paymentIntentId: string
  let clientSecret: string
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountInMinorUnits,
        currency: offer.currency.toLowerCase(),
        capture_method: 'automatic',
        metadata: {
          offer_id: offer.id,
          buyer_id: offer.buyer_id,
          creator_id: offer.creator_id,
          actor_handle: actorHandle,
          event_type: 'offer.accepted',
        },
      },
      { idempotencyKey },
    )
    paymentIntentId = pi.id
    // R10 defensive null-check. Stripe types `client_secret` as
    // `string | null`, but a freshly created PI without
    // `confirm: true` must have one — a null here means Stripe
    // returned a malformed PI. The DB has not been touched yet, so
    // no reconcile is needed; the PI is orphaned but never charged
    // since the caller gets 502 and never confirms. Log at `error`
    // severity (NOT `critical` / `fatal` — this is not a reconcile
    // situation).
    if (!pi.client_secret) {
      logger.error(
        {
          route: 'offer-accept',
          offerId: offer.id,
          paymentIntentId: pi.id,
          event: 'accept.null_client_secret',
        },
        '[offer-accept] null client_secret on fresh PI',
      )
      Sentry.captureMessage(
        '[offer-accept] null client_secret on fresh PI',
        {
          level: 'error',
          extra: {
            offerId: offer.id,
            paymentIntentId: pi.id,
          },
        },
      )
      return {
        ok: false,
        kind: 'stripe_create',
        httpStatus: 502,
        code: 'STRIPE_UNAVAILABLE',
        message: 'Payment provider temporarily unavailable.',
      }
    }
    clientSecret = pi.client_secret
  } catch (stripeErr) {
    const classified = classifyStripeError(stripeErr)
    logger.warn(
      {
        route: 'offer-accept',
        offerId: offer.id,
        stripeKind: classified.kind,
        stripeCode: classified.raw.code,
        stripeType: classified.raw.type,
        stripeStatus: classified.raw.statusCode,
      },
      '[offer-accept] paymentIntents.create failed',
    )
    return {
      ok: false,
      kind: 'stripe_create',
      httpStatus: classified.httpStatus,
      code: classified.code,
      message: classified.message,
    }
  }

  // ── 7. Call the inner-txn RPC ────────────────────────────────
  const { data, error } = await supabase.rpc('rpc_accept_offer_commit', {
    p_actor_ref: actorHandle,
    p_offer_id: offer.id,
    p_payment_intent_id: paymentIntentId,
    p_idempotency_key: idempotencyKey,
    p_payload_offer: offerAcceptedPayload,
    p_payload_assignment: assignmentCreatedPayload,
  })

  // Determine if the RPC surfaced an error. Supabase returns a
  // PostgrestError on `error`; data is null in that case. Even if
  // `error` is null, a missing / malformed row is treated as the
  // error path (we cannot complete without the five event ids).
  const row = Array.isArray(data) ? data[0] : data
  const rpcFailed = Boolean(error) || !isRpcAcceptRow(row)

  if (rpcFailed) {
    // ── 8. Classify the RPC error ─────────────────────────────
    // R8: if the B1 classifier returns 'unknown' (e.g. for the
    // 23505 double-accept race from assignments.offer_id UNIQUE
    // violation), let it surface as-is. rpc-errors.ts is frozen.
    const classifiedRpcError = classifyRpcError(
      error ?? { code: undefined, message: 'empty RPC result' },
    )

    // ── 9a. Attempt void-on-rollback ──────────────────────────
    try {
      await stripe.paymentIntents.cancel(
        paymentIntentId,
        {},
        { idempotencyKey },
      )
    } catch (voidErr) {
      // ── 9b. Void ALSO failed — reconcile log + Sentry fatal ─
      // Structured `severity: 'critical'` per AC11. The nine
      // required fields are all present. `route` is scaffolding.
      const classifiedVoidErr = classifyStripeError(voidErr)
      const reconcilePayload = {
        route: 'offer-accept',
        event: 'accept.reconcile_needed',
        severity: 'critical' as const,
        offerId: offer.id,
        buyerId: offer.buyer_id,
        creatorId: offer.creator_id,
        paymentIntentId,
        idempotencyKey,
        dbCommitErrorCode: classifiedRpcError.code,
        stripeVoidErrorCode: classifiedVoidErr.code,
      }
      logger.error(reconcilePayload, '[offer-accept] reconcile required')
      Sentry.captureMessage('[offer-accept] reconcile required', {
        level: 'fatal',
        extra: reconcilePayload,
      })
      return {
        ok: false,
        kind: 'db_commit_reconcile',
        httpStatus: 500,
        code: 'RECONCILE_NEEDED',
        message: 'Payment-to-state reconciliation required.',
      }
    }

    // ── 9c. Void succeeded — return classified RPC error ──────
    logger.warn(
      {
        route: 'offer-accept',
        offerId: offer.id,
        rpcKind: classifiedRpcError.kind,
        rpcCode: classifiedRpcError.code,
        paymentIntentId,
      },
      '[offer-accept] rpc error; PI voided',
    )
    return {
      ok: false,
      kind: 'db_commit_voided',
      httpStatus: classifiedRpcError.httpStatus,
      code: classifiedRpcError.code,
      message: classifiedRpcError.message,
    }
  }

  // ── 10. Happy path — validated row shape ─────────────────────
  // `row` is narrowed to RpcAcceptRow by the isRpcAcceptRow guard
  // inside rpcFailed above. Re-narrow here for the type checker.
  if (!isRpcAcceptRow(row)) {
    // Unreachable — `rpcFailed` would have been true. Keep the
    // explicit guard so TS narrows `row` and so an accidental
    // refactor that inverts the guard cannot silently return
    // malformed data.
    logger.error(
      {
        route: 'offer-accept',
        offerId: offer.id,
        paymentIntentId,
      },
      '[offer-accept] rpc returned malformed row after guard',
    )
    return {
      ok: false,
      kind: 'unknown',
      httpStatus: 500,
      code: 'INTERNAL',
      message: 'Internal server error.',
    }
  }

  logger.info(
    {
      route: 'offer-accept',
      offerId: offer.id,
      paymentIntentId,
      assignmentId: row.assignment_id,
    },
    '[offer-accept] ok',
  )

  return {
    ok: true,
    paymentIntentId,
    clientSecret,
    offerEventId: row.offer_event_id,
    offerEventHash: row.offer_event_hash,
    assignmentId: row.assignment_id,
    assignmentEventId: row.assignment_event_id,
    assignmentEventHash: row.assignment_event_hash,
  }
}
