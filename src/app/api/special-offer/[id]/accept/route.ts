/**
 * POST /api/special-offer/[id]/accept — Accept the current offer
 *
 * Body: { actorId, role: 'buyer' | 'creator' }
 */

import type { NextRequest } from 'next/server'
import { creatorAccept, buyerAccept } from '@/lib/special-offer/services'
import { getThread, putThread, getEvents, putEvents, putCheckoutIntent } from '@/lib/special-offer/store'
import { success, errorResponse, resolveThread, withOfferError } from '@/lib/special-offer/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOfferError(async () => {
    const { id } = await params
    const [thread, err] = resolveThread(id)
    if (err) return err

    const body = await request.json()

    if (!body.actorId || !body.role) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: actorId, role')
    }

    const events = getEvents(id)
    const acceptFn = body.role === 'creator' ? creatorAccept : buyerAccept

    const result = acceptFn(
      { threadId: id, actorId: body.actorId },
      thread,
      events,
    )

    putThread(result.thread)
    putEvents(id, result.events)
    putCheckoutIntent(result.checkoutIntent)

    return success({
      thread: result.thread,
      events: result.events,
      checkoutIntent: result.checkoutIntent,
    })
  })
}
