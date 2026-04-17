// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: canonical webhook ingestion
//
// One function — `verifyAndIngestWebhook` — that every provider
// webhook route handler delegates to. Responsibilities:
//
//   1. Resolve the adapter for the given provider key.
//   2. Run signature verification through the adapter. The raw
//      body MUST be passed in as text, not pre-parsed JSON,
//      because some providers sign the body bytes.
//   3. Normalize the event to the canonical shape.
//   4. Insert into the ledger via `recordWebhookEvent`. Dedupe
//      is automatic — duplicate (provider, external_event_id)
//      pairs short-circuit to the existing row.
//   5. Return a typed result the route handler maps to HTTP.
//
// This is the SECURITY BOUNDARY. Until this function returns
// `{ status: 'verified' }` (or `'unverified'` with a logged
// reason that an operator can investigate), downstream
// processors must not act on the event.
//
// NOT this module's job:
//
//   - Domain processing. The route handler reads the returned
//     event id and either fires off a per-provider processor
//     (background job, queue) or, for the assignment Stripe
//     webhook, calls the existing `syncEscrowCaptureFromStripe`
//     directly. Domain processing remains in the existing
//     domain modules; this module only provides the verified
//     event.
//
//   - Retry scheduling. The ledger has `retry_count` +
//     `processing_status='dead_letter'`; an operator surface
//     drives retries from there.
// ═══════════════════════════════════════════════════════════════

import { getAdapter } from './adapters'
import { isKnownProvider } from './registry'
import {
  findConnectionByExternalAccount,
  recordWebhookEvent,
} from './service'
import type {
  ExternalWebhookEventRow,
  ProviderKey,
  ProviderWebhookSignatureStatus,
  RawWebhookInput,
} from './types'

export type IngestResult =
  | {
      ok: true
      status: ProviderWebhookSignatureStatus
      event: ExternalWebhookEventRow
      was_duplicate: boolean
    }
  | {
      ok: false
      code: 'UNKNOWN_PROVIDER' | 'INVALID_PAYLOAD' | 'SIGNATURE_REJECTED'
      message: string
    }

/**
 * Verify a raw webhook request, normalize the event, and insert
 * it into the canonical ledger. Returns the persisted row so the
 * caller can hand it off to a per-provider processor.
 *
 * Behavior matrix:
 *
 *   adapter.verifyWebhookSignature → 'verified':
 *     normalize + insert with signature_status='verified'.
 *     `ok: true, status: 'verified'`.
 *
 *   → 'rejected':
 *     do NOT insert. Return `ok: false, code: 'SIGNATURE_REJECTED'`.
 *     The route handler responds 400. Rejected events are NOT
 *     stored because the payload may be hostile.
 *
 *   → 'unverified':
 *     normalize + insert with signature_status='unverified'.
 *     The event lands in the ledger so an operator can
 *     investigate, but downstream processors must check
 *     `signature_status` before acting on it. `ok: true,
 *     status: 'unverified'`.
 */
export async function verifyAndIngestWebhook(
  input: RawWebhookInput,
): Promise<IngestResult> {
  if (!isKnownProvider(input.provider)) {
    return {
      ok: false,
      code: 'UNKNOWN_PROVIDER',
      message: `Unknown provider '${input.provider}'.`,
    }
  }

  const adapter = getAdapter(input.provider as ProviderKey)
  const verification = adapter.verifyWebhookSignature(input)

  if (verification.status === 'rejected') {
    return {
      ok: false,
      code: 'SIGNATURE_REJECTED',
      message: verification.reason,
    }
  }

  let normalized
  try {
    normalized = adapter.normalizeWebhookEvent(input)
  } catch (err) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: err instanceof Error ? err.message : String(err),
    }
  }

  // Resolve `connection_id` from the adapter's external-account
  // hint. This is the missing center of the architecture: every
  // Connect/scoped event needs to bind to the Frontfiles
  // connection it belongs to so downstream processors don't
  // have to re-implement the lookup from `payload.account`. If
  // the adapter set `connection_id` directly (rare — only for
  // adapters that do their own resolution), trust it. Otherwise,
  // call the indexed lookup. A miss is acceptable: it means the
  // event is platform-scoped or the connection has not yet been
  // created (race during initial onboarding).
  let resolvedConnectionId: string | null = normalized.connection_id ?? null
  if (resolvedConnectionId === null && normalized.external_account_id_hint) {
    const conn = await findConnectionByExternalAccount(
      input.provider,
      normalized.external_account_id_hint,
    )
    resolvedConnectionId = conn?.id ?? null
  }

  const result = await recordWebhookEvent({
    provider: input.provider,
    external_event_id: normalized.external_event_id,
    event_type: normalized.event_type,
    payload: normalized.payload,
    signature_status: verification.status,
    connection_id: resolvedConnectionId,
  })

  return {
    ok: true,
    status: verification.status,
    event: result.row,
    was_duplicate: result.was_duplicate,
  }
}
