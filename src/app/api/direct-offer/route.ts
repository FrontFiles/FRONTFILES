/**
 * POST /api/direct-offer — Create a new Direct Offer thread
 * GET  /api/direct-offer — List offer threads (optional ?buyerId= or ?creatorId= or ?assetId=)
 */

import type { NextRequest } from 'next/server'
import { createOffer } from '@/lib/direct-offer/services'
import { listThreads, putThread, putEvents, getThread } from '@/lib/direct-offer/store'
import { success, errorResponse, withOfferError } from '@/lib/direct-offer/api-helpers'
import { mockVaultAssets } from '@/lib/mock-data'
import { requireGrant } from '@/lib/identity/guards'

export async function POST(request: NextRequest) {
  return withOfferError(async () => {
    const body = await request.json()

    if (!body.assetId || !body.buyerId || !body.licenceType || !body.offerAmount) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: assetId, buyerId, licenceType, offerAmount')
    }

    // Phase B — server-side role gate.
    // Creating a direct offer is a buyer-scoped action, so the
    // acting `buyerId` must hold the 'buyer' grant. `requireGrant`
    // resolves the grant through the identity store (dual-mode).
    const grantDenial = await requireGrant(body.buyerId, 'buyer')
    if (grantDenial) return grantDenial

    // Resolve asset from authoritative source
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
