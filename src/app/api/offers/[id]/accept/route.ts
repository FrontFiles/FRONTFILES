// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/offers/[id]/accept (P4 concern 4A.2 Part B2)
//
// Accept an offer. Buyer-only (R2). Preflights canAccept against an
// unlocked row read to short-circuit obvious 403/409 cases before
// touching Stripe; the acceptOffer orchestrator at
// src/lib/offer/offer-accept.ts owns the §8.5 straddle from there
// (PI create → inner RPC → void on rollback → reconcile log on
// void fail). On success the orchestrator's seven-field result
// (R10 — includes paymentIntentId + clientSecret) is echoed back
// so the browser can drive stripe.confirmCardPayment().
//
// References:
//   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §F6 (this
//     route's contract + error-surface table), AC5 (idempotency),
//     AC6 (migration apply cleanly), AC14 (DB linkage non-NULL
//     after successful accept; the route does not verify the row
//     directly but the orchestrator's RPC call stamps both columns
//     inside the same txn).
//   - src/lib/offer/offer-accept.ts — the four-failure-kind
//     orchestrator this route delegates to. Result union was
//     extended in R10 to carry paymentIntentId + clientSecret.
//   - src/lib/offer/state.ts — canAccept preflight (R2 buyer-only).
//   - src/lib/stripe/client.ts — getStripeClient +
//     isStripeConfigured (F3 dual-mode).
//   - src/app/api/offers/[id]/counter/route.ts — B1 structural
//     pattern this route mirrors (requireActor → parseParams →
//     parseBody → user-JWT client → preload offer → state guard →
//     mutate → classified response).
//
// Response shape discipline — mirrors B1: success is
// `{ data: { ... } }` at 200, failure is
// `{ error: { code, message } }` at the classified httpStatus.
// Both envelopes match B1's counter/reject/cancel routes and the
// `@/lib/api/validation` helper. (Prompt 8 text requested
// `{ ok: boolean, ... }`; B1's established envelope wins per AC16
// + "mirror B1 verbatim". Flagged in prompt return.)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'

import { parseBody, parseParams } from '@/lib/api/validation'
import { requireActor } from '@/lib/auth/require-actor'
import { getSupabaseClientForUser } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { canAccept, type OfferRow } from '@/lib/offer'
import { acceptOffer } from '@/lib/offer/offer-accept'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'

const ParamsSchema = z.object({ id: z.string().uuid() })

// Accept takes no body fields (the decision itself IS the body per
// D11). Empty-strict so unknown keys fail loud at 400 instead of
// silently evolving the contract.
const AcceptOfferBody = z.object({}).strict()

const ROUTE = 'POST /api/offers/[id]/accept'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

function errorResponse(
  httpStatus: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status: httpStatus },
  )
}

// Map canAccept guard reasons to stable response codes. R2 tightened
// the predicate to buyer-only; `not_party` + `invalid_state` are the
// only two reason prefixes state.ts can emit for accept. NOT_PARTY
// carries 403 (matches the B1 classifier's P0004 dispatch); the
// preflight anticipates the RPC's own party check, so aligning HTTP
// status with the classifier keeps the surface coherent whether the
// denial comes from the preflight or the RPC.
function guardReasonToResponse(reason: string): {
  httpStatus: number
  code: string
  message: string
} {
  if (reason.startsWith('not_party')) {
    return {
      httpStatus: 403,
      code: 'NOT_PARTY',
      message: 'Only the buyer can accept this offer.',
    }
  }
  if (reason.startsWith('invalid_state')) {
    return {
      httpStatus: 409,
      code: 'INVALID_STATE',
      message: 'Offer cannot be accepted in its current state.',
    }
  }
  // Defensive catch-all — unreachable after R2 since canAccept only
  // emits `not_party:` or `invalid_state:` prefixes. If a future
  // state.ts edit adds a new reason and forgets to update this, we
  // surface 409 INVALID_STATE rather than 500 so the client sees a
  // non-retryable failure shape consistent with the other preflight
  // denials.
  return {
    httpStatus: 409,
    code: 'INVALID_STATE',
    message: 'Offer cannot be accepted.',
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // ── Steps 3 + 7: resolve auth + actor_handle via requireActor ──
  // requireActor combines session-JWT extraction, auth.getUser()
  // validation, and actor_handles lookup into one call (B1 pattern).
  // The four outcomes map to this route's FEATURE_DISABLED/401/403
  // surfaces; the happy path yields `{ handle, authUserId }`.
  const actorResult = await requireActor(request)
  if (!actorResult.ok) {
    switch (actorResult.reason) {
      case 'FEATURE_DISABLED':
        return errorResponse(404, 'FEATURE_DISABLED', 'Feature not enabled.')
      case 'UNAUTHENTICATED':
        return errorResponse(
          401,
          'UNAUTHENTICATED',
          'Authentication required.',
        )
      case 'ACTOR_NOT_FOUND':
        return errorResponse(
          403,
          'ACTOR_NOT_FOUND',
          'Actor profile not found.',
        )
    }
  }
  const actor = actorResult.actor

  // ── Step 1: extract offerId from dynamic route param ──────────
  const [params, paramsErr] = await parseParams(
    ctx.params,
    ParamsSchema,
    ROUTE,
  )
  if (paramsErr) return paramsErr

  // ── Step 2: parse (empty-strict) request body ─────────────────
  const [, bodyErr] = await parseBody(request, AcceptOfferBody, ROUTE)
  if (bodyErr) return bodyErr

  // Extract the caller's JWT and build a user-scoped Supabase
  // client. The service-role client (used by requireActor) bypasses
  // RLS; this user-JWT client subjects the offer preload (and the
  // eventual RPC) to `offers_party_select` RLS so an actor who is
  // not party to the offer cannot even observe its existence.
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(
      401,
      'UNAUTHENTICATED',
      'Authentication required.',
    )
  }
  const supabase = getSupabaseClientForUser(accessToken)

  // ── Step 4: load OfferRow via the user-JWT client ─────────────
  // `.maybeSingle()` treats "no visible row" and "no row at all" as
  // the same 404 from the caller's perspective — correct behaviour
  // under RLS-gated reads.
  const { data: offerRow, error: offerErr } = await supabase
    .from('offers')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (offerErr) {
    logger.error(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: params.id,
        rawCode: offerErr.code,
      },
      '[offer.accept] offer preload error',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  if (!offerRow) {
    return errorResponse(404, 'OFFER_NOT_FOUND', 'Offer not found.')
  }
  const offer = offerRow as OfferRow

  // ── Step 5: canAccept preflight (R2 buyer-only) ───────────────
  const guard = canAccept({ offer, actorUserId: actor.authUserId })
  if (!guard.allowed) {
    const { httpStatus, code, message } = guardReasonToResponse(guard.reason)
    logger.warn(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: offer.id,
        guardReason: guard.reason,
      },
      '[offer.accept] preflight denied',
    )
    return errorResponse(httpStatus, code, message)
  }

  // ── Step 6: Stripe-configured gate (AC14 / dual-mode) ─────────
  // Intentionally AFTER canAccept so unconfigured dev/test
  // deployments still return accurate 403/404/409 for structural
  // failures. A Stripe-disabled deployment surfaces 503
  // FEATURE_DISABLED only when the caller has otherwise cleared
  // all preflight gates.
  if (!isStripeConfigured()) {
    return errorResponse(
      503,
      'FEATURE_DISABLED',
      'Payments temporarily unavailable.',
    )
  }

  // ── Step 8: resolve expectedPieceCount from the child table ────
  // The piece count is the offer's snapshot of how many deliverable
  // slots the assignment will carry. F5's `assignment.created`
  // payload requires it; the orchestrator forwards it unchanged.
  // Target-type determines the child table: asset-shaped offers
  // count offer_assets rows; brief-shaped offers count offer_briefs.
  const pieceTable =
    offer.target_type === 'single_asset' || offer.target_type === 'asset_pack'
      ? 'offer_assets'
      : 'offer_briefs'

  const { count: pieceCount, error: pieceErr } = await supabase
    .from(pieceTable)
    .select('*', { count: 'exact', head: true })
    .eq('offer_id', offer.id)

  if (pieceErr || typeof pieceCount !== 'number') {
    logger.error(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: offer.id,
        table: pieceTable,
        rawCode: pieceErr?.code,
      },
      '[offer.accept] piece count load error',
    )
    return errorResponse(500, 'INTERNAL', 'Failed to load offer pieces.')
  }

  // ── Step 9: call the orchestrator ──────────────────────────────
  // All side effects (Stripe PI create, inner RPC, PI cancel on
  // rollback, reconcile log + Sentry fatal on void-fail) happen
  // inside acceptOffer. The route contributes zero additional
  // writes / Stripe calls. The orchestrator never throws; branching
  // on `result.ok` is exhaustive.
  const result = await acceptOffer({
    supabase,
    stripe: getStripeClient(),
    actorHandle: actor.handle,
    actorAuthUserId: actor.authUserId,
    offer,
    expectedPieceCount: pieceCount,
  })

  if (result.ok) {
    logger.info(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: offer.id,
        assignmentId: result.assignmentId,
      },
      '[offer.accept] ok',
    )
    return NextResponse.json(
      {
        data: {
          paymentIntentId: result.paymentIntentId,
          clientSecret: result.clientSecret,
          offerEventId: result.offerEventId,
          offerEventHash: result.offerEventHash,
          assignmentId: result.assignmentId,
          assignmentEventId: result.assignmentEventId,
          assignmentEventHash: result.assignmentEventHash,
        },
      },
      { status: 200 },
    )
  }

  // Single catch-all for every `ok: false` branch (preflight,
  // stripe_create, db_commit_voided, db_commit_reconcile, unknown).
  // The orchestrator has already classified httpStatus + code +
  // message; the route trusts that classification and does not
  // re-map or re-log. (The orchestrator logs + fires Sentry where
  // appropriate; re-logging here would double the trace.)
  return errorResponse(result.httpStatus, result.code, result.message)
}
