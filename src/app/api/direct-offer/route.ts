/**
 * POST /api/direct-offer — Create a new Direct Offer thread
 * GET  /api/direct-offer — List offer threads (optional ?buyerId= or ?creatorId= or ?assetId=)
 */

import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOffer } from '@/lib/direct-offer/services'
import { listThreads, putThread, putEvents, getThread } from '@/lib/direct-offer/store'
import { success, errorResponse, withOfferError } from '@/lib/direct-offer/api-helpers'
import { mockVaultAssets } from '@/lib/mock-data'
import { requireGrant } from '@/lib/identity/guards'
import { parseBody } from '@/lib/api/validation'
import {
  checkWriteActionRate,
  buildWriteRateLimitResponse,
} from '@/lib/rate-limit'

// ─── Request schema ──────────────────────────────────────────────
//
// Body contract for POST /api/direct-offer. Tight enough to reject
// obviously-malformed requests (wrong types, missing fields, silly
// values) without locking down fields whose canonical enums aren't
// fully resolved yet (licenceType — see D-DO lock decisions). Those
// get tightened in a follow-up once the enum is locked.

// Mirrors the LicenceType union in src/lib/types.ts. Kept local so this
// route's schema is self-describing; we'll extract a shared Zod-enum
// helper when a second route starts using it.
const LICENCE_TYPE_VALUES = [
  'editorial',
  'commercial',
  'broadcast',
  'print',
  'digital',
  'web',
  'merchandise',
] as const

const CreateDirectOfferBody = z.object({
  assetId: z.string().min(1),
  buyerId: z.string().min(1),
  creatorId: z.string().min(1).optional(),
  licenceType: z.enum(LICENCE_TYPE_VALUES),
  offerAmount: z.number().positive(),
  message: z.string().max(2000).nullable().optional(),
  responseWindowMinutes: z.number().int().positive().max(10_080).optional(),
})

export async function POST(request: NextRequest) {
  return withOfferError(async () => {
    // 1. Zod validation — types, presence, ranges.
    const [body, parseErr] = await parseBody(
      request,
      CreateDirectOfferBody,
      'POST /api/direct-offer',
    )
    if (parseErr) return parseErr

    // 2. Rate limit — protect against offer spam.
    //    Keyed by `buyerId` because that's the subject identity for
    //    this route until session-based auth lands.
    const rate = checkWriteActionRate({
      actorId: body.buyerId,
      actionType: 'direct-offer.create',
    })
    if (!rate.allowed) {
      return buildWriteRateLimitResponse(rate.retryAfterSeconds ?? 30, rate.exceededLimit)
    }

    // 3. Role gate — buyer grant required.
    const grantDenial = await requireGrant(body.buyerId, 'buyer')
    if (grantDenial) return grantDenial

    // 4. Resolve asset from authoritative source.
    const asset = mockVaultAssets.find(a => a.id === body.assetId)
    if (!asset) {
      return errorResponse('ASSET_NOT_FOUND', `Asset ${body.assetId} not found`, 404)
    }

    const existingThreads = listThreads({ buyerId: body.buyerId, assetId: body.assetId })

    const { thread, events } = createOffer(
      {
        assetId: body.assetId,
        buyerId: body.buyerId,
        creatorId: body.creatorId ?? 'sarahchen', // TODO: resolve from asset
        licenceType: body.licenceType,
        offerAmount: body.offerAmount,
        listedPrice: asset.creatorPrice ?? 0,
        message: body.message ?? null,
        responseWindowMinutes: body.responseWindowMinutes,
      },
      asset,
      existingThreads,
    )

    putThread(thread)
    putEvents(thread.id, events)

    return success({ thread, events }, 201)
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const buyerId = searchParams.get('buyerId') ?? undefined
  const creatorId = searchParams.get('creatorId') ?? undefined
  const assetId = searchParams.get('assetId') ?? undefined

  const threads = listThreads(
    buyerId || creatorId || assetId ? { buyerId, creatorId, assetId } : undefined,
  )

  return success(threads)
}
