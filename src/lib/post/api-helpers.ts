// ═══════════════════════════════════════════════════════════════
// FFF Sharing — API Route Helpers
//
// Mirrors `lib/assignment/api-helpers.ts`. Tiny shared layer so
// every posts route returns identical JSON shapes:
//
//   success:  { data: <payload> }
//   error:    { error: { code, message, details? } }
//
// All errors thrown inside `withInternalError` collapse to a
// 500 with a clean JSON body — never leaking stack traces.
// ═══════════════════════════════════════════════════════════════

/** Standard success response. Defaults to 200. */
export function success<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
}

/** Standard typed error response. Defaults to 400. */
export function errorResponse(
  code: string,
  message: string,
  status = 400,
): Response {
  return Response.json({ error: { code, message } }, { status })
}

/**
 * Wrap a route handler body. Catches any thrown error and
 * collapses to a 500 JSON response. Console-errors the cause
 * server-side so failures are auditable but never leak the
 * stack to the client.
 */
export async function withInternalError(
  fn: () => Response | Promise<Response>,
): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    const clientMessage = process.env.NODE_ENV !== 'production'
      ? (err instanceof Error ? err.message : String(err))
      : 'Internal server error'
    // Server-side log only — never echoed to the client.
    console.error('[posts api] internal error:', err)
    return errorResponse('INTERNAL_ERROR', clientMessage, 500)
  }
}
