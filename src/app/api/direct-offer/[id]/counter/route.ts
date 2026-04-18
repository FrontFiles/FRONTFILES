/**
 * POST /api/direct-offer/[id]/counter — Submit a counter-offer
 *
 * Body: { actorId, amount, role: 'buyer' | 'creator' }
 */

import type { NextRequest } from 'next/server'
import { creatorCounter, buyerCounter } from '@/lib/special-offer/services'
import { getThread, putThread, getEvents, putEvents } from '@/lib/special-offer/store'
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

    if (!body.actorId || !body.amount || !body.role) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: actorId, amount, role')
    }

    const events = getEvents(id)
    const counterFn = body.role === 'creator' ? creatorCounter : buyerCounter

    const result = counterFn(
      { threadId: id, actorId: body.actorId, amount: body.amount, message: body.message ?? null },
      thread,
      events,
    )

    putThread(result.thread)
    putEvents(id, result.events)

    return success({ thread: result.thread, events: result.events })
  })
}
