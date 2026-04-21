/**
 * Frontfiles — Stripe client singleton (P4 concern 4A.2 Part B2)
 *
 * Single lazy factory for the server-side Stripe SDK client. The
 * B2 accept orchestrator (src/lib/offer/offer-accept.ts, F4) is the
 * only production caller today; F8's error classifier lives in a
 * sibling file and does NOT depend on this module (the classifier
 * takes a raw error and dispatches on `instanceof`; it never
 * constructs the client).
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §F3 — factory
 *     signature + header-comment requirements mirrored below.
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §D5 — `bun add
 *     stripe` resolves at install time (no version pin); apiVersion
 *     is pinned to the SDK's default. Prompt 3 resolved SDK to
 *     22.0.2 and the default API version to '2026-03-25.dahlia'.
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §D6 — B2's PI
 *     create targets the platform balance only. No Stripe Connect
 *     (`transfer_data`, `destination`, `on_behalf_of`,
 *     `application_fee_amount`). This module enforces nothing
 *     Connect-shaped; policing happens in F4.
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §D9 — PI
 *     metadata carries forensic context (offer/buyer/creator ids,
 *     actor handle, event_type). Set in F4, not here.
 *   - src/lib/db/client.ts — dual-mode singleton pattern this
 *     module mirrors (lazy, env-absent throws inside the factory
 *     rather than at module load, underscore-prefixed test helper).
 *   - src/lib/env.ts L99-103 — four Stripe env slots reserved
 *     (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *     STRIPE_CONNECT_CLIENT_ID, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
 *     all `.optional()`.
 *
 * Dual-mode contract:
 *   - STRIPE_SECRET_KEY present → `getStripeClient()` returns the
 *     cached SDK instance (constructed on first call).
 *   - STRIPE_SECRET_KEY absent  → callers are expected to
 *     short-circuit via `isStripeConfigured()` and surface a 503
 *     FEATURE_DISABLED from the route. `getStripeClient()` throws
 *     if invoked without the env so accidental misuse is loud,
 *     not silent.
 *   - The throw is INSIDE the factory, not at import time, so
 *     env-less test and dev environments can load this module
 *     without booting Stripe.
 *
 * Why module-level singleton is safe:
 *   The Stripe SDK client is effectively a stateless HTTP wrapper
 *   (credentials + a fetch helper; no open sockets, no mutable
 *   state that leaks across callers). Reuse across requests
 *   amortises TLS setup on the underlying fetch layer and avoids
 *   per-request allocation overhead. No concurrency hazard:
 *   `paymentIntents.create`, `paymentIntents.cancel`, etc. are
 *   single round-trip calls with all state carried on the request
 *   and response.
 *
 * apiVersion freeze point (R6):
 *   '2026-03-25.dahlia' is pinned verbatim. The string is the
 *   resolved value of the SDK's internal DEFAULT_API_VERSION at
 *   install time (Prompt 3). `Stripe.DEFAULT_API_VERSION` is not
 *   exposed as a top-level class static on v22 — reading it at
 *   runtime returns `undefined` — so we freeze the literal here.
 *   Future SDK major upgrades RE-RUN the install + resolution and
 *   bump both the SDK version and this string together.
 *
 * Do not:
 *   - Log, export, or stringify the secret key anywhere.
 *   - Set `maxNetworkRetries`, `timeout`, `httpAgent`, or any
 *     other non-default SDK option. F4's orchestrator explicitly
 *     does zero retries in B2 (the spec keeps all retry semantics
 *     at the DB helper `_emit_offer_event_with_retry`); adding
 *     client-layer retry here would silently change the straddle's
 *     failure modes.
 */

import Stripe from 'stripe'

import { env } from '@/lib/env'

// Module-level singleton — safe because the Stripe SDK client is
// stateless (see header). Lazy initialisation keeps env-less test
// paths from paying for a Stripe construct they will never call.
let _client: Stripe | null = null

/**
 * Returns the cached Stripe client, constructing it on first call.
 * Throws if `STRIPE_SECRET_KEY` is not set — callers are expected
 * to gate with `isStripeConfigured()` first.
 */
export function getStripeClient(): Stripe {
  if (_client) return _client
  const key = env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Stripe not configured. Set STRIPE_SECRET_KEY.')
  }
  _client = new Stripe(key, {
    apiVersion: '2026-03-25.dahlia',
    typescript: true,
  })
  return _client
}

/**
 * Check whether Stripe is configured (env var present). Used by
 * the accept route handler (F6) to short-circuit with 503
 * FEATURE_DISABLED before calling F4's orchestrator.
 */
export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY)
}

/**
 * Test-only helper: reset the cached client so subsequent
 * `getStripeClient()` calls re-read `env.STRIPE_SECRET_KEY`. Useful
 * in Vitest suites that toggle env to exercise both dual-mode
 * branches. The underscore prefix is the project convention for
 * "not part of the public surface, safe to strip in production."
 * Do not call from application code.
 */
export function _resetStripeClient(): void {
  _client = null
}
