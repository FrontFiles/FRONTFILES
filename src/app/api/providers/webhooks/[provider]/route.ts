// ═══════════════════════════════════════════════════════════════
// POST /api/providers/webhooks/[provider] — canonical webhook
// ingestion
//
// The single entry point every external provider webhook should
// post to. Behaviour:
//
//   1. Look up the provider key from the route param.
//   2. Buffer the raw request body as text — adapters that
//      verify signatures over body bytes need the unparsed
//      string.
//   3. Hand the raw input to `verifyAndIngestWebhook`, which
//      calls the right adapter, normalizes, and persists.
//   4. Map the typed result to HTTP.
//
// HTTP semantics:
//
//   200 verified         signature ok, event recorded
//   200 unverified       payload accepted but signature could
//                        not be verified — operator must
//                        investigate. We still return 200 so
//                        the provider doesn't retry.
//   200 duplicate        verified, but a row with the same
//                        (provider, external_event_id) already
//                        exists. Idempotent — return 200 so the
//                        provider stops retrying.
//   400 invalid_payload  the adapter could not parse the body
//   400 unknown_provider the route param is not in the registry
//   400 sig_rejected     the adapter explicitly rejected the
//                        signature. Hostile — return 400 so the
//                        provider keeps retrying with the right
//                        secret.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import {
  errorResponse,
  success,
  withInternalError,
} from '@/lib/providers/api-helpers'
import { verifyAndIngestWebhook } from '@/lib/providers/webhooks'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  return withInternalError(async () => {
    const { provider } = await params
    // Buffer the body as text. Reading it as text first means
    // we don't accidentally pass a parsed object to a signature
    // verifier that needs the raw bytes.
    const rawBody = await request.text()

    // Headers as a plain map so adapters don't need to import
    // the `Headers` type. Lowercase keys for adapter consistency.
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })

    const result = await verifyAndIngestWebhook({
      provider: provider as never, // narrowed inside the boundary
      headers,
      rawBody,
    })

    if (!result.ok) {
      const status =
        result.code === 'UNKNOWN_PROVIDER'
          ? 404
          : result.code === 'SIGNATURE_REJECTED'
          ? 400
          : 400
      return errorResponse(result.code, result.message, status)
    }

    return success({
      event_id: result.event.id,
      external_event_id: result.event.external_event_id,
      event_type: result.event.event_type,
      signature_status: result.event.signature_status,
      processing_status: result.event.processing_status,
      duplicate: result.was_duplicate,
    })
  })
}
