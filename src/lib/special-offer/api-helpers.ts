/**
 * Direct Offer Engine — API Route Helpers
 */

import { SpecialOfferError } from './services'
import { getThread } from './store'
import type { DirectOfferThread } from '@/lib/types'

export function success<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return Response.json(
    { error: { code, message } },
    { status },
  )
}

export function resolveThread(
  id: string,
): [DirectOfferThread, null] | [null, Response] {
  const thread = getThread(id)
  if (!thread) {
    return [null, errorResponse('THREAD_NOT_FOUND', `Offer thread ${id} not found`, 404)]
  }
  return [thread, null]
}

export async function withOfferError(
  fn: () => Response | Promise<Response>,
): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof SpecialOfferError) {
      return errorResponse(err.code, err.message)
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse('INTERNAL_ERROR', message, 500)
  }
}
