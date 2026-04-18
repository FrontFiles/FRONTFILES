/**
 * POST /api/special-offer/[id]/decline — Creator declines the offer
 *
 * Body: { actorId }
 */

import type { NextRequest } from 'next/server'
import { creatorDecline } from '@/lib/special-offer/services'
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

    if (!body.actorId) {
      return errorResponse('VALIDATION_ERROR', 'Missing required field: actorId')
    }

    const events = getEvents(id)

    const result = creatorDecline(
      { threadId: id, actorId: body.actorId, message: body.message ?? null },
      thread,
      events,
    )

    putThread(result.thread)
    putEvents(id, result.events)

    return success({ thread: result.thread, events: result.events })
  })
}
