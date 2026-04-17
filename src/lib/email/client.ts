/**
 * FRONTFILES — Resend client (dual-mode)
 *
 * Mirrors the Supabase client pattern:
 *   - `isResendConfigured()` — env check; returns true only when
 *     the transactional key is set.
 *   - `getResendClient()` — lazy singleton, throws if called before
 *     `isResendConfigured()` returns true. Server-only.
 *
 * Never import this into client components. The SDK holds the API
 * key in memory; leaking it into the browser bundle would expose
 * the transactional lane.
 */

import { Resend } from 'resend'
import { env } from '@/lib/env'

// ─── Config check ───────────────────────────────────────────────

/**
 * True when the transactional Resend key is set. Callers MUST check
 * this before `getResendClient()` — in mock-mode (no key), email
 * sends should short-circuit to a structured log line instead.
 */
export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY_TRANSACTIONAL)
}

// ─── Lazy singleton ─────────────────────────────────────────────

let client: Resend | null = null

/**
 * Get the singleton Resend client. Throws if called when
 * `isResendConfigured()` is false — callers must gate on that first.
 */
export function getResendClient(): Resend {
  if (!isResendConfigured()) {
    throw new Error(
      'Resend is not configured. Set RESEND_API_KEY_TRANSACTIONAL in .env.local. ' +
        'Callers should gate on isResendConfigured() before calling getResendClient().',
    )
  }
  if (!client) {
    client = new Resend(env.RESEND_API_KEY_TRANSACTIONAL)
  }
  return client
}

// ─── FROM helper ────────────────────────────────────────────────

/**
 * Canonical transactional FROM address for outgoing emails.
 * Returns the configured RESEND_FROM_TRANSACTIONAL, or a development
 * fallback if unset so local dev still boots.
 *
 * Format (expected by Resend): "Name <addr@domain>" or just "addr@domain".
 */
export function getTransactionalFrom(): string {
  return (
    env.RESEND_FROM_TRANSACTIONAL ??
    'Frontfiles <onboarding@resend.dev>'
  )
}
