// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/offers (P4 concern 4A.2 Part B1)
//
// Create a new offer. The buyer is the authenticated caller;
// `creatorId` is chosen by the buyer per the body. Validates pack
// composition against §F9 (1-20 items) via validatePackComposition,
// then hands to `rpc_create_offer`, which:
//
//   • runs the actor-auth guard (P0008 — user-JWT client makes
//     `auth.uid()` resolvable inside SECURITY DEFINER);
//   • runs the rate-limit guard (max 3 pending offers per
//     buyer/creator pair — P0002);
//   • INSERTs the offers row and the appropriate child rows
//     (offer_assets OR offer_briefs per target_type);
//   • snapshots `platform_fee_bps` per spec §F16 (the DDL enforces
//     the rate-lock; this route passes the current bps);
//   • emits the offer.created ledger event via the retry helper.
//
// ─── Error surface (directive §D4) ────────────────────────────────
// 404 FEATURE_DISABLED       — flag off (via requireActor)
// 401 UNAUTHENTICATED        — no/invalid Bearer
// 403 ACTOR_NOT_FOUND        — valid JWT, no actor_handles row
// 400 VALIDATION_ERROR       — bad body / pack composition
// 429 RATE_LIMIT             — max pending reached (P0002)
// 401 ACTOR_MISMATCH         — handle ↔ auth.uid() divergence (P0008)
// 503 LEDGER_CONTENTION      — retry exhausted (P0001)
// 500 INTERNAL               — unknown
// 201 { data: { offerId, eventId, eventHash } } on success.
//
// Buyer identity is derived from the session (directive D8). The
// route does NOT accept a `buyerId` body field.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'

import { parseBody } from '@/lib/api/validation'
import { requireActor } from '@/lib/auth/require-actor'
import { getSupabaseClientForUser } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { OfferCreatedPayloadSchema } from '@/lib/ledger/schemas'
import {
  buildOfferCreatedPayload,
  RightsSchema,
  validatePackComposition,
} from '@/lib/offer'
import type { OfferRow } from '@/lib/offer'
import { classifyRpcError } from '@/lib/offer/rpc-errors'

// ─── Zod body schema ────────────────────────────────────────────
//
// targetType is pulled from OfferCreatedPayloadSchema's shape to
// stay in lockstep with the ledger schema's DDL-bound enum. Any
// drift between the offer_target_type ENUM in migration
// 20260421000004 and the TS surface will surface here.

const CreateOfferBody = z
  .object({
    creatorId: z.string().uuid(),
    targetType: OfferCreatedPayloadSchema.shape.target_type,
    grossFee: z.number().positive(),
    platformFeeBps: z.number().int().min(0).max(10000),
    currency: z.string().length(3),
    rights: RightsSchema,
    expiresAt: z.string().datetime(),
    note: z.string().max(2000),
    items: z.array(z.unknown()),
  })
  .strict()

const ROUTE = 'POST /api/offers'

// ─── Helpers ────────────────────────────────────────────────────

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
  fields?: Record<string, string[]>,
): NextResponse {
  const body: {
    error: { code: string; message: string; fields?: Record<string, string[]> }
  } = { error: { code, message } }
  if (fields) body.error.fields = fields
  return NextResponse.json(body, { status: httpStatus })
}

// ─── Handler ────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Resolve the actor. requireActor owns the flag gate, token
  //    extraction, JWT validation, and actor_handles lookup.
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

  // 2. Validate body shape.
  const [body, bodyErr] = await parseBody(request, CreateOfferBody, ROUTE)
  if (bodyErr) return bodyErr

  // 3. Validate pack composition (item count + shape vs target_type).
  const compo = validatePackComposition({
    targetType: body.targetType,
    items: body.items,
  })
  if (!compo.ok) {
    logger.warn(
      { route: ROUTE, kind: compo.code, actorHandle: actor.handle },
      '[offer.create] pack composition rejected',
    )
    return errorResponse(
      400,
      'VALIDATION_ERROR',
      `Request body failed validation`,
      { items: [`${compo.code}: ${compo.message}`] },
    )
  }

  // 4. Build the offer.created payload (§8.1). For brief-packs the
  //    payload carries slot-ref strings ('1', '2', …, 'N'); for
  //    asset-packs it carries the asset UUIDs. These identifiers
  //    must match what the RPC writes so a downstream replay can
  //    reconcile the payload items against the DB rows.
  let payloadItems: string[]
  if (
    compo.value.targetType === 'single_asset' ||
    compo.value.targetType === 'asset_pack'
  ) {
    payloadItems = [...compo.value.items]
  } else {
    payloadItems = compo.value.items.map((_, idx) => String(idx + 1))
  }

  const payload = buildOfferCreatedPayload({
    targetType: body.targetType,
    items: payloadItems,
    grossFee: body.grossFee,
    platformFeeBps: body.platformFeeBps,
    currency: body.currency,
    rights: body.rights,
    expiresAt: body.expiresAt,
    note: body.note,
  })

  // 5. Build a user-JWT Supabase client. Re-extracting the bearer
  //    here is a micro-duplication of requireActor's own read, but
  //    keeps this module from reaching into require-actor internals
  //    (directive §SCOPE: ZERO changes to require-actor.ts).
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    // Defensive: requireActor returned ok, so a token was present
    // on the request. If it's gone now it indicates a middleware
    // mutated the headers — fail closed rather than call the RPC
    // with a mismatched identity.
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const supabase = getSupabaseClientForUser(accessToken)

  // 6. Call the RPC. The user-JWT client's forwarded Bearer
  //    populates auth.uid() inside the SECURITY DEFINER body so
  //    the P0008 actor-auth guard compares like-for-like.
  const { data, error } = await supabase.rpc('rpc_create_offer', {
    p_actor_ref: actor.handle,
    p_buyer_id: actor.authUserId,
    p_creator_id: body.creatorId,
    p_target_type: body.targetType,
    p_gross_fee: body.grossFee,
    p_platform_fee_bps: body.platformFeeBps,
    p_currency: body.currency,
    p_rights: body.rights,
    p_current_note: body.note,
    p_expires_at: body.expiresAt,
    p_items: body.items,
    p_payload: payload,
  })

  if (error) {
    const classified = classifyRpcError(error)
    const level =
      classified.httpStatus >= 500 ? 'error' : 'warn'
    logger[level](
      {
        route: ROUTE,
        kind: classified.kind,
        code: classified.code,
        rawCode: classified.raw.code,
        actorHandle: actor.handle,
      },
      '[offer.create] rpc error',
    )
    return errorResponse(
      classified.httpStatus,
      classified.code,
      classified.message,
    )
  }

  // Supabase RPC TABLE-returning functions surface rows as an array.
  // rpc_create_offer returns exactly one row.
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    logger.error(
      { route: ROUTE, actorHandle: actor.handle },
      '[offer.create] rpc returned no row',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }

  const r = row as {
    offer_id: string
    event_id: string
    event_hash: string
  }

  logger.info(
    {
      route: ROUTE,
      actorHandle: actor.handle,
      offerId: r.offer_id,
      eventId: r.event_id,
    },
    '[offer.create] ok',
  )

  return NextResponse.json(
    {
      data: {
        offerId: r.offer_id,
        eventId: r.event_id,
        eventHash: r.event_hash,
      },
    },
    { status: 201 },
  )
}

// ═══════════════════════════════════════════════════════════════
// GET /api/offers — party-only list (P4 concern 4A.2 §F1)
//
// Contract (mirrors GET /api/offers/[id] — see ./[id]/route.ts):
//   - requireActor() → 404 FEATURE_DISABLED / 401 UNAUTHENTICATED
//     / 403 ACTOR_NOT_FOUND (directive §D6 surface parity).
//   - Bearer token re-extracted for getSupabaseClientForUser(t).
//   - No query params in v1. RLS (`offers_party_select`, migration
//     20260421000004 L506-508) filters to rows where
//     auth.uid() ∈ {buyer_id, creator_id}.
//   - ORDER BY created_at DESC. Hard cap 100 rows — `truncated`
//     set when the cap is hit; pagination is a follow-up.
//   - Belt-and-braces party guard from the by-id handler is NOT
//     needed here: no specific offer to assert against, RLS is
//     sufficient and correct for a list query (directive §F1).
//
// Error surface — must match GET /api/offers/[id] exactly:
//   404 FEATURE_DISABLED   · flag off (via requireActor)
//   401 UNAUTHENTICATED    · no/invalid Bearer
//   403 ACTOR_NOT_FOUND    · valid JWT, no actor_handles row
//   500 INTERNAL           · Supabase error
// ═══════════════════════════════════════════════════════════════

const LIST_ROUTE = 'GET /api/offers'
const LIST_LIMIT = 100

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.')
  }
  const supabase = getSupabaseClientForUser(accessToken)

  const { data: rows, error: offersErr } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)

  if (offersErr) {
    logger.error(
      {
        route: LIST_ROUTE,
        actorHandle: actor.handle,
        rawCode: offersErr.code,
      },
      '[offer.list] offers read error',
    )
    return errorResponse(500, 'INTERNAL', 'Internal server error.')
  }

  const offers = (rows ?? []) as OfferRow[]
  const truncated = offers.length >= LIST_LIMIT

  logger.info(
    {
      route: LIST_ROUTE,
      actorHandle: actor.handle,
      count: offers.length,
      truncated,
    },
    '[offer.list] ok',
  )

  return NextResponse.json(
    { data: { offers, truncated } },
    { status: 200 },
  )
}
