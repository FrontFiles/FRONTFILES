// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/offers/[id]/counter (P4 concern 4A.2 Part B1)
//
// Counter an offer. Preflights canCounter on an unlocked row read
// to short-circuit obvious 409/403 cases; the RPC is the
// authoritative boundary for any race. Mutates the offers row +
// child rows + emits offer.countered via `_emit_offer_event_with_retry`.
//
// Pack-composition diff (addedItems / removedItems) is enforced at
// the DDL layer by T1 (same-creator), T2 (target-type XOR) and T4
// (max-20-items). The route does NOT re-run validatePackComposition
// on counters — the composition shape "delta" is outside that
// helper's contract.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'

import { parseBody, parseParams } from '@/lib/api/validation'
import { requireActor } from '@/lib/auth/require-actor'
import { getSupabaseClientForUser } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import {
  buildOfferCounteredPayload,
  canCounter,
  RightsSchema,
  type OfferRow,
  type Rights,
} from '@/lib/offer'
import { classifyRpcError } from '@/lib/offer/rpc-errors'

const ParamsSchema = z.object({ id: z.string().uuid() })

const CounterOfferBody = z
  .object({
    newGrossFee: z.number().positive(),
    newNote: z.string().max(2000),
    newExpiresAt: z.string().datetime(),
    addedItems: z.array(z.unknown()).optional(),
    removedItems: z.array(z.unknown()).optional(),
    newRights: RightsSchema,
  })
  .strict()

const ROUTE = 'POST /api/offers/[id]/counter'

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

// Map state.ts guard reasons to stable response codes. The guard's
// `reason` carries a literal prefix ('invalid_state' | 'not_party')
// which directly maps to the classifier's code vocabulary.
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

  const [body, bodyErr] = await parseBody(request, CounterOfferBody, ROUTE)
  if (bodyErr) return bodyErr

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const supabase = getSupabaseClientForUser(accessToken)

  // Preflight: load the current offer to run state.ts canCounter
  // + gather before-state for the counter payload diff. The RPC
  // re-runs the same guard under FOR UPDATE — this preflight just
  // saves the round-trip on the common 409/403 paths.
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
      '[offer.counter] offer preload error',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  if (!offerRow) {
    return errorResponse(404, 'OFFER_NOT_FOUND', 'Offer not found.')
  }
  const offer = offerRow as OfferRow

  const guard = canCounter({ offer, actorUserId: actor.authUserId })
  if (!guard.allowed) {
    const { code, message } = guardReasonToCode(guard.reason)
    logger.warn(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: offer.id,
        guardReason: guard.reason,
      },
      '[offer.counter] preflight denied',
    )
    return errorResponse(409, code, message)
  }

  // Load the pre-counter item identifiers so the payload diff has
  // a before-snapshot to compute added/removed against. For asset
  // packs this is the asset UUIDs; for brief packs it's the
  // position strings (§8.2 piece_ref-compatible slot refs).
  let beforeItems: string[] = []
  if (
    offer.target_type === 'single_asset' ||
    offer.target_type === 'asset_pack'
  ) {
    const { data: rows } = await supabase
      .from('offer_assets')
      .select('asset_id, position')
      .eq('offer_id', offer.id)
      .order('position', { ascending: true })
    beforeItems = (rows ?? []).map((r) => (r as { asset_id: string }).asset_id)
  } else {
    const { data: rows } = await supabase
      .from('offer_briefs')
      .select('position')
      .eq('offer_id', offer.id)
      .order('position', { ascending: true })
    beforeItems = (rows ?? []).map((r) =>
      String((r as { position: number }).position),
    )
  }

  // After-items for the payload diff. The DB-side `p_added_items`
  // / `p_removed_items` are the mutation directives; the payload's
  // items snapshot is the buyer's/creator's eventual composition
  // after those directives apply. We don't actually need to
  // resolve "after" precisely for the `added_items` / `removed_items`
  // payload fields — the composer's diff expects before/after item
  // lists and derives added/removed itself. Build the after list by
  // removing body.removedItems and appending body.addedItems.
  const removedIds = new Set(
    (body.removedItems ?? []).map((x) => extractItemId(x, offer.target_type)),
  )
  const afterItems = beforeItems.filter((id) => !removedIds.has(id))
  for (const addition of body.addedItems ?? []) {
    afterItems.push(extractItemId(addition, offer.target_type))
  }

  const payload = buildOfferCounteredPayload({
    byActorId: actor.handle,
    before: {
      gross_fee: offer.gross_fee,
      items: beforeItems,
      rights: offer.rights as Rights,
      current_note: offer.current_note ?? '',
    },
    after: {
      grossFee: body.newGrossFee,
      items: afterItems,
      rights: body.newRights,
      note: body.newNote,
      expiresAt: body.newExpiresAt,
    },
  })

  const { data, error } = await supabase.rpc('rpc_counter_offer', {
    p_actor_ref: actor.handle,
    p_offer_id: params.id,
    p_payload: payload,
    p_new_gross_fee: body.newGrossFee,
    p_new_note: body.newNote,
    p_new_expires_at: body.newExpiresAt,
    p_added_items: body.addedItems ?? [],
    p_removed_items: body.removedItems ?? [],
    p_new_rights: body.newRights,
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
      '[offer.counter] rpc error',
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
      '[offer.counter] rpc returned no row',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  const r = row as { event_id: string; event_hash: string }

  logger.info(
    {
      route: ROUTE,
      actorHandle: actor.handle,
      offerId: params.id,
      eventId: r.event_id,
    },
    '[offer.counter] ok',
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

// Extract a stable item id from a raw body item. For asset packs
// the item may be a bare UUID string or an object with `asset_id`.
// For brief packs the item may be a bare object (the brief spec)
// or a wrapper with `position`. The RPC accepts both shapes (see
// migration L316-339 / L430-442) — we mirror that here so the
// payload diff stays consistent with what the DB will actually
// see. For brief packs without an explicit position, fall back to
// the raw body order by returning empty — the diff then treats
// the item as "added" which matches the DB's append-at-max+1
// semantics for brief packs.
function extractItemId(
  item: unknown,
  targetType: OfferRow['target_type'],
): string {
  if (targetType === 'single_asset' || targetType === 'asset_pack') {
    if (typeof item === 'string') return item
    if (item && typeof item === 'object' && 'asset_id' in item) {
      return String((item as { asset_id: unknown }).asset_id)
    }
    return ''
  }
  // brief pack: prefer explicit position, fall back to '' so the
  // diff records a new slot ref.
  if (item && typeof item === 'object' && 'position' in item) {
    return String((item as { position: unknown }).position)
  }
  return ''
}
