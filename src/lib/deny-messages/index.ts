/**
 * Frontfiles — Deny Messages Module
 *
 * Maps machine-readable deny codes from API responses into
 * human-readable UI messages, differentiated by audience.
 *
 * Usage:
 *   import { mapDenyReasonToUi } from '@/lib/deny-messages'
 *   const msg = mapDenyReasonToUi('GRANT_EXPIRED', 'buyer')
 *   // → { title: "Your licence has expired", body: "Renew your licence…" }
 */

export { mapDenyReasonToUi } from './messages'
export type { DenyReason, Audience, UiDenyMessage } from './types'
