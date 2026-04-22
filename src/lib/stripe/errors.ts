/**
 * Frontfiles — Stripe error classifier (P4 concern 4A.2 Part B2)
 *
 * Classifies an arbitrary error thrown from the Stripe SDK into a
 * `ClassifiedStripeError` shape parallel to B1's `ClassifiedRpcError`
 * in src/lib/offer/rpc-errors.ts. The route handler (F6) reads the
 * classified shape and emits a matching HTTP response.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §F8 — mapping
 *     table + static message strings (this module is the literal
 *     implementation of that table).
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §D8 — D8 locks
 *     this as a separate file from rpc-errors.ts. Rationale:
 *     Stripe errors dispatch on SDK-typed instanceof checks
 *     (`err instanceof Stripe.errors.StripeCardError`), while
 *     Postgres RPC errors dispatch on SQLSTATE + SQLERRM substring
 *     — two unrelated vocabularies. Mixing them couples the two
 *     into one file and invites drift when either SDK or migration
 *     layer changes.
 *   - node_modules/stripe/esm/Error.d.ts — authoritative class
 *     declarations in v22.0.2. All seven class names used below
 *     (StripeCardError, StripeInvalidRequestError,
 *     StripeRateLimitError, StripeAPIError, StripeConnectionError,
 *     StripeAuthenticationError, StripeIdempotencyError) match the
 *     F8 mapping table exactly.
 *
 * PII / disclosure discipline:
 *   The `message` field on the returned shape is STATIC per kind
 *   (see `MESSAGES` below) — it is NEVER `err.message` and never
 *   pass-through Stripe text. Stripe's raw messages can contain
 *   card last-4 digits, BIN ranges, cardholder names, and other
 *   data that the application must not render to the buyer's
 *   browser or log at info level. The `raw` field captures only
 *   three narrow properties (`code`, `type`, `statusCode`) for
 *   server-side correlation / log lines; it is ALSO not safe to
 *   echo into an HTTP body.
 *
 * This module has no dependency on F3's client.ts: the classifier
 * accepts an `unknown` and dispatches; it never constructs or
 * invokes a client.
 */

import Stripe from 'stripe'

// ─── Classified shape ─────────────────────────────────────────────

export type ClassifiedStripeError = {
  kind:
    | 'card_declined'
    | 'invalid_request'
    | 'rate_limit'
    | 'unavailable'
    | 'authentication'
    | 'idempotency_mismatch'
    | 'unknown'
  /** HTTP status the route handler should emit. */
  httpStatus: number
  /** Stable SCREAMING_SNAKE_CASE identifier for response bodies. */
  code: string
  /** Client-safe, static-per-kind. NEVER Stripe's raw err.message. */
  message: string
  /** Narrowed for log correlation only. Not safe to echo to clients. */
  raw: { code?: string; type?: string; statusCode?: number }
}

// ─── Static user-facing messages (PII-safe) ───────────────────────
//
// One string per kind. These are the ONLY strings the route handler
// may surface to the caller's browser. Do not interpolate Stripe's
// err.message into these — the raw message may carry card last-4,
// BIN, or cardholder details.
const MESSAGES: Record<ClassifiedStripeError['kind'], string> = {
  card_declined: 'Your card was declined.',
  invalid_request: 'Payment request rejected by processor.',
  rate_limit: 'Too many requests. Try again shortly.',
  unavailable: 'Payment provider temporarily unavailable.',
  authentication: 'Payment provider authentication error.',
  idempotency_mismatch: 'Idempotency key mismatch on replay.',
  unknown: 'An unexpected payment error occurred.',
}

// ─── Raw-field extraction ─────────────────────────────────────────
//
// Stripe SDK errors expose `code`, `type`, and `statusCode` as
// optional properties on the base StripeError class. Pull only
// those three; spreading the whole object risks leaking PII.
function extractRaw(err: unknown): ClassifiedStripeError['raw'] {
  if (err && typeof err === 'object') {
    const e = err as {
      code?: unknown
      type?: unknown
      statusCode?: unknown
    }
    const raw: ClassifiedStripeError['raw'] = {}
    if (typeof e.code === 'string') raw.code = e.code
    if (typeof e.type === 'string') raw.type = e.type
    if (typeof e.statusCode === 'number') raw.statusCode = e.statusCode
    return raw
  }
  return {}
}

// ─── Classifier ───────────────────────────────────────────────────
//
// Dispatch on the v22 SDK class hierarchy. All classes extend
// StripeError directly (no cross-inheritance among the seven
// mapped here), so order of the instanceof checks does not affect
// precedence. Anything that falls through → 'unknown' / 500 /
// INTERNAL.

/**
 * Map a Stripe SDK error (or any value thrown from a Stripe call)
 * into the classified shape the route handler and orchestrator
 * consume. Never throws.
 */
export function classifyStripeError(err: unknown): ClassifiedStripeError {
  const raw = extractRaw(err)

  if (err instanceof Stripe.errors.StripeCardError) {
    return {
      kind: 'card_declined',
      httpStatus: 402,
      code: 'CARD_DECLINED',
      message: MESSAGES.card_declined,
      raw,
    }
  }
  if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    return {
      kind: 'invalid_request',
      httpStatus: 400,
      code: 'STRIPE_INVALID_REQUEST',
      message: MESSAGES.invalid_request,
      raw,
    }
  }
  if (err instanceof Stripe.errors.StripeRateLimitError) {
    return {
      kind: 'rate_limit',
      httpStatus: 429,
      code: 'RATE_LIMIT',
      message: MESSAGES.rate_limit,
      raw,
    }
  }
  if (err instanceof Stripe.errors.StripeAPIError) {
    return {
      kind: 'unavailable',
      httpStatus: 502,
      code: 'STRIPE_UNAVAILABLE',
      message: MESSAGES.unavailable,
      raw,
    }
  }
  if (err instanceof Stripe.errors.StripeConnectionError) {
    return {
      kind: 'unavailable',
      httpStatus: 502,
      code: 'STRIPE_UNAVAILABLE',
      message: MESSAGES.unavailable,
      raw,
    }
  }
  if (err instanceof Stripe.errors.StripeAuthenticationError) {
    // 500 INTERNAL — treat as config drift / platform-side bug.
    // Route handler / orchestrator should log this at critical
    // severity; buyer-facing surface stays generic per D8.
    return {
      kind: 'authentication',
      httpStatus: 500,
      code: 'INTERNAL',
      message: MESSAGES.authentication,
      raw,
    }
  }
  if (err instanceof Stripe.errors.StripeIdempotencyError) {
    return {
      kind: 'idempotency_mismatch',
      httpStatus: 409,
      code: 'IDEMPOTENCY_MISMATCH',
      message: MESSAGES.idempotency_mismatch,
      raw,
    }
  }

  return {
    kind: 'unknown',
    httpStatus: 500,
    code: 'INTERNAL',
    message: MESSAGES.unknown,
    raw,
  }
}
