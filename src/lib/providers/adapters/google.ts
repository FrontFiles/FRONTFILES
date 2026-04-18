// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: Google adapter
//
// Google services share OAuth plumbing but are modeled as
// SEPARATE providers (`google_identity`, `google_drive`,
// `google_gmail`, `google_calendar`) so a Drive scope grant
// cannot silently unlock Gmail. This adapter is parameterised
// by provider key — one factory function returns a
// `ProviderAdapter` for each Google variant.
//
// Scope handling:
//
//   - `google_identity` → ['openid', 'email', 'profile']
//   - `google_drive`    → ['https://www.googleapis.com/auth/drive.file']
//   - `google_gmail`    → ['https://www.googleapis.com/auth/gmail.send', '...gmail.readonly']
//   - `google_calendar` → ['https://www.googleapis.com/auth/calendar']
//
// Webhook verification:
//
//   Google uses Pub/Sub push messages for Drive/Gmail/Calendar
//   change notifications. The verification model is JWT-based:
//   the push request carries an `Authorization: Bearer <jwt>`
//   header signed by Google. Until the real SDK is installed
//   the adapter accepts a deterministic `mock-bearer` value the
//   same way the Stripe adapter accepts `mock-signature`.
// ═══════════════════════════════════════════════════════════════

import { env } from '@/lib/env'
import type {
  NormalizedWebhookEvent,
  ProviderAdapter,
  ProviderDescriptor,
  ProviderKey,
  ProviderOwner,
  RawWebhookInput,
  WebhookSignatureResult,
} from '../types'
import { getProviderDescriptorTyped } from '../registry'

// ─── Scope map ───────────────────────────────────────────────

const SCOPES_BY_PROVIDER: Record<
  Extract<ProviderKey, `google_${string}`>,
  ReadonlyArray<string>
> = {
  google_identity: ['openid', 'email', 'profile'],
  google_drive: ['https://www.googleapis.com/auth/drive.file'],
  google_gmail: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  google_calendar: ['https://www.googleapis.com/auth/calendar'],
}

// ─── Adapter factory ─────────────────────────────────────────

/**
 * Build a Google adapter instance for a specific Google
 * provider key. The descriptor and default scopes come from the
 * registry / scope map; the verification + normalization logic
 * is shared across all four.
 */
export function createGoogleAdapter(
  key: Extract<ProviderKey, `google_${string}`>,
): ProviderAdapter {
  const descriptor: ProviderDescriptor = getProviderDescriptorTyped(key)
  const defaultScopes = SCOPES_BY_PROVIDER[key]

  return {
    descriptor,

    verifyWebhookSignature(input: RawWebhookInput): WebhookSignatureResult {
      // Google's Drive/Gmail/Calendar Pub/Sub push messages
      // include an `Authorization: Bearer <id_token>` header.
      // Real verification fetches Google's public keys and
      // checks the JWT signature + audience. Until the SDK is
      // wired we accept a deterministic placeholder GATED on
      // NODE_ENV !== 'production' so a real deploy can never
      // accept the literal `Bearer mock-bearer` and skip JWT
      // verification — that would be an unsigned-ingest backdoor.
      // In production we return 'rejected' with a loud reason so
      // the canonical webhook route returns 400 and an operator
      // notices the misconfiguration.
      const auth =
        input.headers['authorization'] ?? input.headers['Authorization']
      if (!auth) {
        return {
          status: 'unverified',
          reason: 'missing Authorization header',
        }
      }
      const isProd = env.NODE_ENV === 'production'
      if (!isProd && auth === 'Bearer mock-bearer') {
        return { status: 'verified' }
      }
      if (isProd) {
        return {
          status: 'rejected',
          reason: 'Google JWT verification not wired in production',
        }
      }
      return {
        status: 'unverified',
        reason: 'Google JWT verification not wired; only mock-bearer is accepted (dev only)',
      }
    },

    normalizeWebhookEvent(input: RawWebhookInput): NormalizedWebhookEvent {
      // Google Pub/Sub push wraps a base64 message in a
      // top-level `message` envelope. The payload type lives in
      // `message.attributes` for Drive change notifications and
      // is a JSON object for Gmail/Calendar push.
      let parsed: unknown
      try {
        parsed = JSON.parse(input.rawBody)
      } catch (err) {
        throw new Error(
          `google adapter: invalid JSON body (${(err as Error).message})`,
        )
      }
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('google adapter: payload must be an object')
      }

      const obj = parsed as {
        message?: {
          messageId?: unknown
          attributes?: Record<string, unknown>
          data?: unknown
        }
      }
      const message = obj.message
      if (!message) {
        throw new Error('google adapter: payload missing `message` envelope')
      }

      // The canonical ledger dedupes by (provider,
      // external_event_id). A clock-based fallback would defeat
      // dedupe on every retry AND can collide under concurrent
      // load. Refuse to ingest if the push payload doesn't carry
      // a stable id — the canonical webhook route maps the
      // throw to INVALID_PAYLOAD (HTTP 400) so the caller knows
      // the body is malformed.
      if (typeof message.messageId !== 'string' || !message.messageId) {
        throw new Error(
          'google adapter: payload missing message.messageId (required for dedupe)',
        )
      }
      const externalEventId = message.messageId

      // Event type comes from Pub/Sub attributes (Drive uses
      // `eventType`; Gmail uses `historyId`; Calendar uses
      // `resourceId`). We bias toward `eventType` and fall back
      // to a provider-key-stamped sentinel.
      const attributes = message.attributes ?? {}
      const eventType =
        typeof attributes.eventType === 'string'
          ? attributes.eventType
          : `${key}.notification`

      return {
        external_event_id: externalEventId,
        event_type: eventType,
        payload: obj as Record<string, unknown>,
        connection_id: null,
      }
    },

    buildAuthorizationUrl(input: {
      owner: ProviderOwner
      redirectUri: string
      state: string
      scopes?: string[]
    }): string | null {
      // PROD GUARD: in production we MUST NOT ship the placeholder
      // client id. Google's consent screen would refuse the request
      // with an `invalid_client` error and the user would see a
      // generic Google error page. Returning null forces the route
      // handler to surface a 503 so the operator notices the
      // missing env var.
      const isProd = env.NODE_ENV === 'production'
      const clientId = env.GOOGLE_OAUTH_CLIENT_ID
      if (isProd && !clientId) return null
      const scopes = (input.scopes ?? defaultScopes).join(' ')
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set(
        'client_id',
        clientId ?? 'PLACEHOLDER.apps.googleusercontent.com',
      )
      url.searchParams.set('redirect_uri', input.redirectUri)
      url.searchParams.set('scope', scopes)
      url.searchParams.set('state', input.state)
      // Offline access + refresh token rotation are required so
      // the credential row's `expires_at` actually means
      // anything.
      url.searchParams.set('access_type', 'offline')
      url.searchParams.set('prompt', 'consent')
      return url.toString()
    },

    normalizeAccountIdentity(rawAccount: unknown): {
      external_account_id: string
      account_label: string | null
    } {
      if (!rawAccount || typeof rawAccount !== 'object') {
        throw new Error('google adapter: rawAccount must be an object')
      }
      const obj = rawAccount as {
        sub?: unknown
        email?: unknown
        name?: unknown
      }
      const id = typeof obj.sub === 'string' ? obj.sub : null
      if (!id) throw new Error('google adapter: rawAccount.sub missing')
      const label =
        (typeof obj.name === 'string' ? obj.name : null) ??
        (typeof obj.email === 'string' ? obj.email : null) ??
        null
      return {
        external_account_id: id,
        account_label: label,
      }
    },
  }
}

// Pre-built singletons for each Google variant. Importing
// modules can pick the one they need without re-creating the
// adapter on every call.
export const googleIdentityAdapter = createGoogleAdapter('google_identity')
export const googleDriveAdapter = createGoogleAdapter('google_drive')
export const googleGmailAdapter = createGoogleAdapter('google_gmail')
export const googleCalendarAdapter = createGoogleAdapter('google_calendar')
