// ═══════════════════════════════════════════════════════════════
// Frontfiles — GET /api/offers/[id] (P4 concern 4A.2 Part B1)
//
// Party-only read of a single offer. Returns the offer row plus
// its child rows (offer_assets for asset-packs, offer_briefs for
// brief-packs — exactly one of the two populated per §7 XOR).
//
// ─── Party-surface parity with 404 (directive D6) ───────────────
//
// A non-party who guesses an offer id receives HTTP 404 — not
// 403. Two reasons:
//
//   1. Privacy. Surface parity with "not found" prevents a
//      third party from enumerating offer IDs to discover
//      which buyer/creator pairs are negotiating.
//   2. RLS-by-construction. Under the user-JWT Supabase client
//      the `offers_party_select` policy (migration
//      20260421000004 L506-508) already returns zero rows to a
//      non-party, so the SELECT produces "not found" on its
//      own. The route-level party check below is belt-and-
//      braces: it documents the contract and guards against a
//      future drift where a service-role client slips in by
//      mistake. It cannot fire in production on the user-JWT
//      path.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'

import { parseParams } from '@/lib/api/validation'
import { requireActor } from '@/lib/auth/require-actor'
import { getSupabaseClientForUser } from '@/lib/db/client'
import { SYSTEM_ACTOR_HANDLE } from '@/lib/ledger/system-actor'
import { logger } from '@/lib/logger'
import type {
  OfferAssetRow,
  OfferBriefRow,
  OfferEventActorRole,
  OfferEventViewRow,
  OfferRow,
} from '@/lib/offer'

const ParamsSchema = z.object({ id: z.string().uuid() })

const ROUTE = 'GET /api/offers/[id]'

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

export async function GET(
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

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const supabase = getSupabaseClientForUser(accessToken)

  // 1. Load the offer row. RLS restricts visibility to parties.
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
      '[offer.get] offer read error',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }
  if (!offerRow) {
    return errorResponse(404, 'OFFER_NOT_FOUND', 'Offer not found.')
  }
  const offer = offerRow as OfferRow

  // 2. Belt-and-braces party guard. Unreachable under user-JWT +
  //    offers_party_select RLS, but fails closed if a future
  //    caller slips the service-role client in here by mistake.
  if (
    actor.authUserId !== offer.buyer_id &&
    actor.authUserId !== offer.creator_id
  ) {
    // 404 for surface parity (D6).
    return errorResponse(404, 'OFFER_NOT_FOUND', 'Offer not found.')
  }

  // 3. Load child rows for the appropriate target_type branch.
  let assets: OfferAssetRow[] | null = null
  let briefs: OfferBriefRow[] | null = null

  if (
    offer.target_type === 'single_asset' ||
    offer.target_type === 'asset_pack'
  ) {
    const { data: assetRows, error: assetsErr } = await supabase
      .from('offer_assets')
      .select('offer_id, asset_id, position')
      .eq('offer_id', offer.id)
      .order('position', { ascending: true })
    if (assetsErr) {
      logger.error(
        {
          route: ROUTE,
          actorHandle: actor.handle,
          offerId: offer.id,
          rawCode: assetsErr.code,
        },
        '[offer.get] offer_assets read error',
      )
      return errorResponse(500, 'INTERNAL', 'Internal server error.')
    }
    assets = (assetRows ?? []) as OfferAssetRow[]
  } else {
    const { data: briefRows, error: briefsErr } = await supabase
      .from('offer_briefs')
      .select('offer_id, position, spec')
      .eq('offer_id', offer.id)
      .order('position', { ascending: true })
    if (briefsErr) {
      logger.error(
        {
          route: ROUTE,
          actorHandle: actor.handle,
          offerId: offer.id,
          rawCode: briefsErr.code,
        },
        '[offer.get] offer_briefs read error',
      )
      return errorResponse(500, 'INTERNAL', 'Internal server error.')
    }
    briefs = (briefRows ?? []) as OfferBriefRow[]
  }

  // 4. Load the offer thread's ledger events. RLS restricts visibility
  //    to parties via the `ledger_events_party_select` policy.
  //    Returned chronological (oldest first) so the UI can render
  //    §UI_DESIGN_GATE criterion 6 (round history / event trail)
  //    directly and derive `lastEventActorRef` by filtering out the
  //    system sentinel.
  type RawEventRow = {
    id: string
    event_type: string
    actor_ref: string
    created_at: string
    payload: unknown
  }
  const { data: eventRows, error: eventsErr } = await supabase
    .from('ledger_events')
    .select('id, event_type, actor_ref, created_at, payload')
    .eq('thread_type', 'offer')
    .eq('thread_id', offer.id)
    .order('created_at', { ascending: true })

  if (eventsErr) {
    logger.error(
      {
        route: ROUTE,
        actorHandle: actor.handle,
        offerId: offer.id,
        rawCode: eventsErr.code,
      },
      '[offer.get] ledger_events read error',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }

  // Viewer's party role on THIS offer. RLS already enforced the
  // party check above; this is pure routing into the role label.
  const viewerRole: 'buyer' | 'creator' =
    actor.authUserId === offer.buyer_id ? 'buyer' : 'creator'
  const counterpartyRole: 'buyer' | 'creator' =
    viewerRole === 'buyer' ? 'creator' : 'buyer'

  const events: OfferEventViewRow[] = ((eventRows ?? []) as RawEventRow[]).map(
    (row) => {
      let actor_role: OfferEventActorRole
      if (row.actor_ref === SYSTEM_ACTOR_HANDLE) {
        actor_role = 'system'
      } else if (row.actor_ref === actor.handle) {
        actor_role = viewerRole
      } else {
        // Under RLS + the party guard above, the only non-system
        // actor_ref that is NOT the viewer's handle must be the
        // counterparty's. Any other value would indicate a policy
        // misconfiguration and is labelled by role-inversion rather
        // than failing the request — the event itself remains part
        // of the audit trail.
        actor_role = counterpartyRole
      }
      return {
        id: row.id,
        event_type: row.event_type,
        actor_role,
        created_at: row.created_at,
        payload: row.payload,
      }
    },
  )

  logger.info(
    {
      route: ROUTE,
      actorHandle: actor.handle,
      offerId: offer.id,
      targetType: offer.target_type,
      eventCount: events.length,
    },
    '[offer.get] ok',
  )

  return NextResponse.json(
    { data: { offer, assets, briefs, events } },
    { status: 200 },
  )
}
