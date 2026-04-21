// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/offers/[id]/cancel (P4 concern 4A.2 Part B1)
//
// Cancel an offer. Buyer-only per spec §4.
//
// ─── Preflight scope (directive D2 / D12) ──────────────────────
//
// The route-side preflight calls canCancel WITHOUT
// `lastEventActorRef`. Rationale: under the user-JWT Supabase
// client, the `ledger_events_party_select` policy (migration
// 20260421000004 L613-622) filters ledger rows to events whose
// `actor_ref` resolves to the caller's own `auth.uid()`. The
// buyer's client cannot see the creator's `offer.countered`
// event, so any route-side lookup of "most recent non-system
// actor" always returns the buyer's own handle and the short-
// circuit is structurally unreachable in production. NOT_LAST_TURN
// is caught exclusively by the RPC (P0005 → 409 via the
// classifier). The preflight still short-circuits INVALID_STATE
// and NOT_PARTY cleanly from the offer row (visible via
// `offers_party_select`).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'

import { parseBody, parseParams } from '@/lib/api/validation'
import { requireActor } from '@/lib/auth/require-actor'
import { getSupabaseClientForUser } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { canCancel, type OfferRow } from '@/lib/offer'
import { classifyRpcError } from '@/lib/offer/rpc-errors'

const ParamsSchema = z.object({ id: z.string().uuid() })

const CANCEL_REASONS = ['buyer_withdrew', 'duplicate', 'other'] as const

const CancelOfferBody = z
  .object({
    reasonCode: z.enum(CANCEL_REASONS),
    note: z.string().max(2000).optional(),
  })
  .strict()

const ROUTE = 'POST /api/offers/[id]/cancel'

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

function guardReasonToCode(reason: string): {
  code: string
  message: string
} {
  if (reason.startsWith('invalid_state')) {
    return {
      code: 'INVALID_STATE',
      message: 'Offer is not in a transitionable state.',
    }
  }
  if (reason.startsWith('not_party')) {
    return {
      code: 'NOT_PARTY',
      message: 'Not a party on this offer.',
    }
  }
  return { code: 'CONFLICT', message: reason }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const actorResult = await requireActor(request)
  if (!actorResult.ok) {
    switch (actorResult.reason) {
      case 'FEATURE_DISABLED':
        return errorResponse(404, 'FEATURE_DISABLED', 'Feature not enabled.')
      case 'UNAUTHENTICATED':
        return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
      case 'ACTOR_NOT_FOUND':
        return errorResponse(403, 'ACTOR_NOT_FOUND', 'Actor profile not found.')
    }
  }
  const actor = actorResult.actor

  const [params, paramsErr] = await parseParams(
    ctx.params,
    ParamsSchema,
    ROUTE,
  )
  if (paramsErr) return paramsErr

  const [body, bodyErr] = await parseBody(request, CancelOfferBody, ROUTE)
  if (bodyErr) return bodyErr

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const supabase = getSupabaseClientForUser(accessToken)

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
      '[offer.cancel] offer preload error',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  if (!offerRow) {
    return errorResponse(404, 'OFFER_NOT_FOUND', 'Offer not found.')
  }
  const offer = offerRow as OfferRow

  // Preflight canCancel WITHOUT lastEventActorRef (D12).
  const guard = canCancel({ offer, actorUserId: actor.authUserId })
  if (!guard.allowed) {
    const { code, message } = guardReasonToCode(guard.reason)
    logger.warn(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: offer.id,
        guardReason: guard.reason,
      },
      '[offer.cancel] preflight denied',
    )
    return errorResponse(409, code, message)
  }

  // Build the §8.1 offer.cancelled payload. Matches
  // OfferCancelledPayloadSchema: { v, by_actor_id }. The schema is
  // strict; reasonCode / note are route-level observability only.
  const payload = {
    v: 1 as const,
    by_actor_id: actor.handle,
  }

  const { data, error } = await supabase.rpc('rpc_cancel_offer', {
    p_actor_ref: actor.handle,
    p_offer_id: params.id,
    p_payload: payload,
  })

  if (error) {
    const classified = classifyRpcError(error)
    const level = classified.httpStatus >= 500 ? 'error' : 'warn'
    logger[level](
      {
        route: ROUTE,
        kind: classified.kind,
        code: classified.code,
        rawCode: classified.raw.code,
        actorHandle: actor.handle,
        offerId: params.id,
      },
      '[offer.cancel] rpc error',
    )
    return errorResponse(
      classified.httpStatus,
      classified.code,
      classified.message,
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    logger.error(
      { route: ROUTE, actorHandle: actor.handle, offerId: params.id },
      '[offer.cancel] rpc returned no row',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  const r = row as { event_id: string; event_hash: string }

  logger.info(
    {
      route: ROUTE,
      actorHandle: actor.handle,
      offerId: params.id,
      reasonCode: body.reasonCode,
      hasNote: Boolean(body.note),
      eventId: r.event_id,
    },
    '[offer.cancel] ok',
  )

  return NextResponse.json(
    {
      data: {
        eventId: r.event_id,
        eventHash: r.event_hash,
      },
    },
    { status: 200 },
  )
}
