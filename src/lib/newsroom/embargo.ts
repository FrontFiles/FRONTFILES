/**
 * Frontfiles — Embargo zod schemas + token + URL helpers (NR-D8, F8b)
 *
 * Server-only. zod schemas for the embargo + recipient API
 * routes (F5 / F6 / F7), random access-token generation, and
 * the canonical preview URL builder.
 *
 * ─── KEY DECISIONS (ratified pre-composition) ──────────────────
 *
 *   IP-1: buildPreviewUrl uses the PRD §5.3 J5 shape:
 *         `{NEWSROOM_BASE_URL}/{orgSlug}/{packSlug}/preview?t={token}`
 *         (newsroom subdomain + slugs in path + token in query)
 *
 *   IP-2: generateRecipientToken returns RANDOM bytes
 *         (base64url(24)) — 32 chars, ≥192 bits entropy. Token
 *         stored DIRECTLY in newsroom_embargo_recipients.access_token
 *         (UNIQUE column, no token_hash column exists per schema).
 *         No HMAC. No NEWSROOM_VERIFICATION_HMAC_SECRET reuse.
 *
 *   IP-3: F6 upserts newsroom_recipients (email-keyed) before
 *         INSERTing newsroom_embargo_recipients with recipient_id.
 *         Two-INSERT atomicity caveat (orphan recipient on step 2
 *         failure accepted v1).
 *
 * Spec cross-references:
 *   - PRD.md §5.3 J5 line 1136 (preview URL shape)
 *   - PRD.md §5.1 P8 (toggle + fields + recipients)
 *   - migration newsroom_embargo_recipients line 344 (access_token
 *     stored directly; UNIQUE; ≥32 chars)
 *   - directives/NR-D8-embargo-configuration.md §F8b
 *   - src/lib/newsroom/canonical-url.ts (NEWSROOM_BASE_URL)
 */

import 'server-only'

import { randomBytes } from 'node:crypto'

import * as z from 'zod'

import { NEWSROOM_BASE_URL } from './canonical-url'
import {
  EMBARGO_POLICY_MAX,
  EMBARGO_RECIPIENT_EMAIL_MAX,
} from './embargo-form-constants'

// ── Token generation ──────────────────────────────────────────

/** Token length in chars after base64url encoding (24 bytes). */
const RECIPIENT_TOKEN_BYTES = 24

/**
 * Generate a per-recipient access token.
 *
 * Random — NOT HMAC-derived. The schema's
 * `newsroom_embargo_recipients.access_token` column stores
 * tokens directly (UNIQUE constraint at the DB layer). Random
 * generation gives ≥192 bits of entropy and is unguessable to
 * insiders who know recipient_id + embargo_id + lift_at (an HMAC
 * approach with those inputs would NOT be unguessable in that
 * threat model).
 *
 * Each call yields a distinct token. F6's revoked-recipient
 * re-add semantic rotates the token by calling this helper
 * again on UPDATE.
 */
export function generateRecipientToken(): string {
  return randomBytes(RECIPIENT_TOKEN_BYTES).toString('base64url')
}

// ── Preview URL ───────────────────────────────────────────────

/**
 * Build the canonical pre-lift preview URL embedded in the
 * invite email per PRD §5.3 J5 (line 1136):
 *
 *   newsroom.frontfiles.com/{org-slug}/{pack-slug}/preview?t={access_token}
 *
 * Reuses the `NEWSROOM_BASE_URL` constant from
 * `src/lib/newsroom/canonical-url.ts` so the consumer-domain
 * shape stays in lockstep with the canonical Pack URL builder.
 *
 * The resolver lives in NR-D11 (consumer-side). NR-D8 only
 * builds the URL string and embeds it in the invite email.
 */
export function buildPreviewUrl(
  orgSlug: string,
  packSlug: string,
  token: string,
): string {
  return `${NEWSROOM_BASE_URL}/${orgSlug}/${packSlug}/preview?t=${encodeURIComponent(token)}`
}

// ── zod schemas ───────────────────────────────────────────────

/**
 * Schema for POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo.
 *
 * lift_at is an ISO 8601 datetime string (with timezone offset).
 * The form passes the user's local datetime + selected IANA zone
 * combined into an ISO string.
 */
export const createEmbargoSchema = z.object({
  lift_at: z.string().datetime({ offset: true }),
  policy_text: z.string().min(1).max(EMBARGO_POLICY_MAX),
  notify_on_lift: z.boolean().default(true),
})

export type CreateEmbargoInput = z.infer<typeof createEmbargoSchema>

/**
 * Schema for PATCH on the same endpoint. Partial update — at
 * least one field required to reject no-op requests.
 */
export const updateEmbargoSchema = createEmbargoSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided.',
  })

export type UpdateEmbargoInput = z.infer<typeof updateEmbargoSchema>

/**
 * Schema for POST /embargo/recipients.
 *
 * Email format validation by zod's built-in `.email()`. Length
 * cap from F8a constants (RFC 5321 path limit). The route's
 * upsert flow handles the `newsroom_recipients` row
 * (lookup-by-email; INSERT if missing).
 */
export const addRecipientSchema = z.object({
  email: z.string().email().max(EMBARGO_RECIPIENT_EMAIL_MAX),
})

export type AddRecipientInput = z.infer<typeof addRecipientSchema>
