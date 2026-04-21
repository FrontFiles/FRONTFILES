// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/offers/[id]/reject (P4 concern 4A.2 Part B1)
//
// Reject an offer. Either party may reject. Preflights canReject
// on the loaded offer row; the RPC is the authoritative boundary
// for any race. Emits offer.rejected.
//
// Payload shape per spec §8.1: { v, by_actor_id?, reason,
// affected_item_ids? }. The `reason` field carries the Zod-
// enforced enum literal from the body (spec-compatible with the
// F10 'asset_no_longer_available' creator-asset-withdrawal path,
// which is system-initiated and not handled by this route). The
// optional note (operator context) is logged server-side but NOT
// stored in the payload — `OfferRejectedPayloadSchema` is
// `.strict()` and rejects additional keys.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'

import { parseBody, parseParams } from '@/lib/api/validation'
import { requireActor } from '@/lib/auth/require-actor'
import { getSupabaseClientForUser } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { canReject, type OfferRow } from '@/lib/offer'
import { classifyRpcError } from '@/lib/offer/rpc-errors'

const ParamsSchema = z.object({ id: z.string().uuid() })

const REJECT_REASONS = [
  'terms_rejected',
  'price_too_low',
  'rights_mismatch',
  'deadline_infeasible',
  'other',
] as const

const RejectOfferBody = z
  .object({
    reasonCode: z.enum(REJECT_REASONS),
    note: z.string().max(2000).optional(),
  })
  .strict()

const ROUTE = 'POST /api/offers/[id]/reject'

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

  const [body, bodyErr] = await parseBody(request, RejectOfferBody, ROUTE)
  if (bodyErr) return bodyErr

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const supabase = getSupabaseClientForUser(accessToken)

  // Preflight canReject on the current offer row.
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
      '[offer.reject] offer preload error',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  if (!offerRow) {
    return errorResponse(404, 'OFFER_NOT_FOUND', 'Offer not found.')
  }
  const offer = offerRow as OfferRow

  const guard = canReject({ offer, actorUserId: actor.authUserId })
  if (!guard.allowed) {
    const { code, message } = guardReasonToCode(guard.reason)
    logger.warn(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: offer.id,
        guardReason: guard.reason,
      },
      '[offer.reject] preflight denied',
    )
    return errorResponse(409, code, message)
  }

  // Build the §8.1 offer.rejected payload. Matches
  // OfferRejectedPayloadSchema in src/lib/ledger/schemas.ts:
  // { v, by_actor_id?, reason, affected_item_ids? }. The schema
  // is `.strict()`, so the operator-context note does not go
  // here — it's logged below instead.
  const payload = {
    v: 1 as const,
    by_actor_id: actor.handle,
    reason: body.reasonCode,
  }

  const { data, error } = await supabase.rpc('rpc_reject_offer', {
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
      '[offer.reject] rpc error',
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
      '[offer.reject] rpc returned no row',
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
    '[offer.reject] ok',
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
