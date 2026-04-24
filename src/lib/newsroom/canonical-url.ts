/**
 * Frontfiles — Newsroom canonical URL helpers (NR-D4, F6)
 *
 * Pure URL builders. No slug validation — callers (NR-D9 publish
 * RPC, org-onboarding flow) are responsible for enforcing slug
 * shape before calling.
 *
 * Constants:
 *   NEWSROOM_BASE_URL — newsroom subdomain root
 *   RECEIPT_BASE_URL  — public receipts path on the main domain
 */

export const NEWSROOM_BASE_URL = 'https://newsroom.frontfiles.com'

export const RECEIPT_BASE_URL = 'https://frontfiles.com/receipts'

export function packCanonicalUrl(
  orgSlug: string,
  packSlug: string,
): string {
  return `${NEWSROOM_BASE_URL}/${orgSlug}/${packSlug}`
}

export function newsroomOrgUrl(orgSlug: string): string {
  return `${NEWSROOM_BASE_URL}/${orgSlug}`
}

export function receiptUrl(receiptId: string): string {
  return `${RECEIPT_BASE_URL}/${receiptId}`
}
