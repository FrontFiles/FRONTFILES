// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: API helpers
//
// Mirrors `lib/post/api-helpers.ts` and `lib/assignment/api-helpers.ts`
// for shape consistency, but DELIBERATELY does not mirror their
// behaviour of leaking `err.message` to the response body.
//
// The provider routes include an unauthenticated webhook
// endpoint (POST /api/providers/webhooks/[provider]) that any
// internet caller can hit. Echoing internal error strings to
// untrusted callers would expose stack-trace fragments, secret
// names, and SDK errors to whoever can flood the endpoint.
// We log the cause server-side and return a generic message.
// ═══════════════════════════════════════════════════════════════

export function success<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
): Response {
  return Response.json({ error: { code, message } }, { status })
}

export async function withInternalError(
  fn: () => Response | Promise<Response>,
): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    // Server-side log only. Never echoed to the client because
    // the providers surface includes an unauthenticated webhook
    // endpoint and we do not want to leak adapter / secret-store
    // error text to whoever can POST to it.
    console.error('[providers api] internal error:', err)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
