// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: Stripe adapter
//
// Stripe-specific implementation of the `ProviderAdapter`
// contract from `../types.ts`.
//
// Scope of THIS adapter:
//
//   - Verify Stripe webhook signatures (`Stripe-Signature` header
//     using the deployed signing secret).
//   - Normalize Stripe events into the canonical
//     `NormalizedWebhookEvent` shape.
//   - Build OAuth/Connect onboarding URLs.
//   - Map a Stripe Account object → canonical
//     `(external_account_id, account_label)` pair.
//
// What this adapter is NOT responsible for:
//
//   - Domain processing (assignment escrow, payouts, identity
//     verification). Those live in the existing modules
//     (`lib/assignment/services.ts`,
//     `lib/identity/stripe-identity.ts`,
//     `lib/funding/stripe-adapter.ts`). They become CONSUMERS
//     of the canonical event ledger in a follow-up.
//
//   - Storing tokens. The credential layer
//     (`../store.ts` + `../secrets.ts`) does that.
//
// MOCK MODE
//
// Until @stripe/stripe-js is installed, signature verification
// uses a deterministic placeholder: a `Stripe-Signature` header
// equal to the literal `mock-signature` is treated as
// `verified`. Any other value is `unverified`. This lets tests
// exercise the verification branch without standing up a real
// Stripe SDK.
// ═══════════════════════════════════════════════════════════════

import type {
  NormalizedWebhookEvent,
  ProviderAdapter,
  ProviderDescriptor,
  ProviderOwner,
  RawWebhookInput,
  WebhookSignatureResult,
} from '../types'
import { getProviderDescriptorTyped } from '../registry'

const DESCRIPTOR: ProviderDescriptor = getProviderDescriptorTyped('stripe')

// ─── Adapter implementation ──────────────────────────────────

export const stripeAdapter: ProviderAdapter = {
  descriptor: DESCRIPTOR,

  verifyWebhookSignature(input: RawWebhookInput): WebhookSignatureResult {
    const sig = input.headers['stripe-signature'] ?? input.headers['Stripe-Signature']
    if (!sig) {
      return {
        status: 'unverified',
        reason: 'missing Stripe-Signature header',
      }
    }

    // Production path — once `@stripe/stripe-js` (or rather
    // `stripe`) is installed, swap this for:
    //
    //   import Stripe from 'stripe'
    //   const stripe = new Stripe(secret, { apiVersion: '...' })
    //   try {
    //     stripe.webhooks.constructEvent(input.rawBody, sig, signingSecret)
    //     return { status: 'verified' }
    //   } catch (err) {
    //     return { status: 'rejected', reason: (err as Error).message }
    //   }
    //
    // Until then we accept a deterministic placeholder so
    // integration tests can run end-to-end without the SDK.
    // The placeholder is GATED on NODE_ENV !== 'production' so
    // a real deploy can never accept the literal string and
    // skip signature verification — that would be an unsigned-
    // ingest backdoor. In production we return 'rejected' with
    // a loud reason so the canonical webhook route returns 400
    // and an operator notices the misconfiguration.
    const isProd = process.env.NODE_ENV === 'production'
    if (!isProd && sig === 'mock-signature') {
      return { status: 'verified' }
    }
    if (isProd) {
      return {
        status: 'rejected',
        reason: 'Stripe SDK signature verification not wired in production',
      }
    }

    return {
      status: 'unverified',
      reason: 'Stripe SDK not installed; only mock-signature is accepted (dev only)',
    }
  },

  normalizeWebhookEvent(input: RawWebhookInput): NormalizedWebhookEvent {
    let parsed: unknown
    try {
      parsed = JSON.parse(input.rawBody)
    } catch (err) {
      throw new Error(
        `stripe adapter: invalid JSON body (${(err as Error).message})`,
      )
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('stripe adapter: payload must be an object')
    }

    const obj = parsed as {
      id?: unknown
      type?: unknown
      account?: unknown
      data?: { object?: { id?: unknown; object?: unknown } }
    }
    const id = typeof obj.id === 'string' ? obj.id : null
    const type = typeof obj.type === 'string' ? obj.type : null
    if (!id || !type) {
      throw new Error('stripe adapter: payload missing id or type')
    }

    // Surface a stable external account hint so the canonical
    // pipeline can resolve `connection_id` via
    // `findConnectionByExternalAccount(provider, hint)`.
    //
    // Two cases:
    //
    //   1. CONNECT EVENTS — top-level `account: 'acct_xxx'` is
    //      set by Stripe whenever the event was triggered by a
    //      connected account. This is the common path for
    //      creator payouts: `account.updated`, `payout.paid`,
    //      `transfer.failed`, etc.
    //
    //   2. PLATFORM ACCOUNT EVENTS — when a webhook is fired
    //      directly from the platform Account itself (e.g. an
    //      `account.updated` for the platform's own account),
    //      Stripe puts the account id at `data.object.id` with
    //      `data.object.object === 'account'`.
    //
    // Anything else falls through to null and the event will be
    // persisted as platform-scoped (`connection_id=null`).
    let externalAccountHint: string | null = null
    if (typeof obj.account === 'string' && obj.account) {
      externalAccountHint = obj.account
    } else if (
      obj.data &&
      typeof obj.data === 'object' &&
      obj.data.object &&
      typeof obj.data.object === 'object' &&
      obj.data.object.object === 'account' &&
      typeof obj.data.object.id === 'string'
    ) {
      externalAccountHint = obj.data.object.id
    }

    return {
      external_event_id: id,
      event_type: type,
      payload: obj as Record<string, unknown>,
      connection_id: null,
      external_account_id_hint: externalAccountHint,
    }
  },

  buildAuthorizationUrl(input: {
    owner: ProviderOwner
    redirectUri: string
    state: string
    scopes?: string[]
  }): string | null {
    // Stripe Connect OAuth URL. Real client id resolved from env
    // at the boundary; for the placeholder we emit a clearly-
    // non-functional sentinel host so dev URL-shape tests work.
    //
    // PROD GUARD: in production we MUST NOT ship the placeholder.
    // A user clicking through the placeholder URL lands on a
    // Stripe error page ("client_id ca_PLACEHOLDER not found")
    // which is a degraded UX and makes any rollout look broken.
    // Returning null here forces the route handler to surface a
    // 503 so the operator notices the missing env var.
    const isProd = process.env.NODE_ENV === 'production'
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
    if (isProd && !clientId) return null
    const url = new URL('https://connect.stripe.com/oauth/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId ?? 'ca_PLACEHOLDER')
    url.searchParams.set('scope', (input.scopes ?? ['read_write']).join(' '))
    url.searchParams.set('redirect_uri', input.redirectUri)
    url.searchParams.set('state', input.state)
    // Owner is encoded into `state` upstream so the callback
    // can resolve back to the right user/company.
    return url.toString()
  },

  normalizeAccountIdentity(rawAccount: unknown): {
    external_account_id: string
    account_label: string | null
  } {
    if (!rawAccount || typeof rawAccount !== 'object') {
      throw new Error('stripe adapter: rawAccount must be an object')
    }
    const obj = rawAccount as {
      id?: unknown
      business_profile?: { name?: unknown }
      email?: unknown
    }
    const id = typeof obj.id === 'string' ? obj.id : null
    if (!id) throw new Error('stripe adapter: rawAccount.id missing')
    const businessName =
      obj.business_profile && typeof obj.business_profile.name === 'string'
        ? obj.business_profile.name
        : null
    const email = typeof obj.email === 'string' ? obj.email : null
    return {
      external_account_id: id,
      account_label: businessName ?? email ?? null,
    }
  },
}
