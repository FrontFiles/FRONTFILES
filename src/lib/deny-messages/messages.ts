/**
 * Frontfiles — Deny Reason → UI Message Mapper
 *
 * Maps deny codes from API responses (entitlement probes,
 * package downloads, artifact downloads) into titled messages
 * for the buyer or creator UI.
 *
 * Usage:
 *   import { mapDenyReasonToUi } from '@/lib/deny-messages'
 *   const msg = mapDenyReasonToUi(error.code, 'buyer')
 *   // → { title: "You don't have access…", body: "Purchase a licence…" }
 */

import type { DenyReason, Audience, UiDenyMessage } from './types'

// ══════════════════════════════════════════════
// BUYER-FACING MESSAGES
// ══════════════════════════════════════════════

const BUYER_MESSAGES: Record<DenyReason, UiDenyMessage> = {
  NO_ACTIVE_GRANT: {
    title: "You don't have access to this original",
    body: 'Purchase a licence to download the full-resolution file.',
  },
  GRANT_EXPIRED: {
    title: 'Your licence has expired',
    body: 'Renew your licence or contact Frontfiles support to restore access.',
  },
  GRANT_SUSPENDED: {
    title: 'Access temporarily suspended',
    body: "There's an issue with this licence. Please contact Frontfiles support.",
  },
  GRANT_REVOKED: {
    title: 'Access revoked',
    body: 'This licence is no longer valid. You can still view your documents in the buyer pack.',
  },
  NO_READY_ORIGINAL_MEDIA: {
    title: 'Original not ready yet',
    body: "We're preparing the original file. Try again in a few minutes.",
  },
  NO_ACTIVE_COMPANY_MEMBERSHIP: {
    title: 'Ask your organisation for access',
    body: 'This licence belongs to your company. You need an active account under that company to download originals.',
  },
  INSUFFICIENT_COMPANY_ROLE: {
    title: "Your role can't download originals",
    body: 'Ask an admin to adjust your role or download on your behalf.',
  },
  PACKAGE_NOT_READY: {
    title: 'Pack is still building',
    body: "We're generating your documents. This pack will be ready to download soon.",
  },
  EMPTY_PACKAGE: {
    title: 'Pack not ready yet',
    body: "We're still generating documents for this pack. Check back shortly.",
  },
  PACKAGE_REVOKED: {
    title: 'Pack no longer available',
    body: 'This pack was revoked. Your transaction history still records that it existed.',
  },
  ARTIFACT_NOT_AVAILABLE: {
    title: 'File not available yet',
    body: 'This document is still being generated. Try again later.',
  },
}

// ══════════════════════════════════════════════
// CREATOR-FACING MESSAGES
// ══════════════════════════════════════════════

const CREATOR_MESSAGES: Partial<Record<DenyReason, UiDenyMessage>> = {
  NO_ACTIVE_GRANT: {
    title: 'This buyer has no licence',
    body: "They can't download the original file. You can still see your own original in your library.",
  },
  GRANT_EXPIRED: {
    title: "Buyer's licence expired",
    body: 'They no longer have rights to download. Your own original remains accessible to you.',
  },
  GRANT_SUSPENDED: {
    title: 'Buyer access suspended',
    body: "The buyer can't download this original. Your creator records and packs stay intact.",
  },
  GRANT_REVOKED: {
    title: 'Buyer access revoked',
    body: "The buyer can't download this original. Your creator records and packs stay intact.",
  },
}

// ══════════════════════════════════════════════
// FALLBACK
// ══════════════════════════════════════════════

const FALLBACK: UiDenyMessage = {
  title: 'Download not available',
  body: 'Something went wrong while checking your access. Please try again.',
}

const GENERIC_DENY: UiDenyMessage = {
  title: 'Download not available',
  body: 'Your licence or pack is not in a state that allows downloads right now.',
}

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/**
 * Map a deny reason code to a UI message for the given audience.
 *
 * - Known buyer codes → buyer-specific copy
 * - Known creator overrides → creator-specific copy
 * - Creator codes without override → fall back to buyer copy
 * - Unknown or undefined reason → generic fallback
 */
export function mapDenyReasonToUi(
  reason: DenyReason | string | undefined | null,
  audience: Audience,
): UiDenyMessage {
  if (!reason) return FALLBACK

  const key = reason as DenyReason

  if (audience === 'creator') {
    const creatorMsg = CREATOR_MESSAGES[key]
    if (creatorMsg) return creatorMsg
    // Fall through to buyer copy for codes without creator override
    // (package/artifact codes read the same for both audiences).
  }

  const buyerMsg = BUYER_MESSAGES[key]
  if (buyerMsg) return buyerMsg

  // Unknown code — use generic deny rather than the "something went
  // wrong" fallback, because the presence of a code means the system
  // made a deliberate decision, not an error.
  return GENERIC_DENY
}
