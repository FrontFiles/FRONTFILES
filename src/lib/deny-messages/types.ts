/**
 * Frontfiles — Deny Reason UI Message Types
 *
 * Maps machine-readable deny codes from the API layer into
 * human-readable UI messages, differentiated by audience.
 *
 * BOUNDARY:
 *   This module is presentation-only. It does not make
 *   authorization decisions. It maps deny codes that were
 *   already decided by the entitlement module (for originals)
 *   or the fulfilment module (for packages/artifacts) into
 *   copy that the UI can display.
 */

/**
 * Canonical deny reason codes emitted by the API.
 *
 * Entitlement (originals):
 *   NO_ACTIVE_GRANT, GRANT_EXPIRED, GRANT_SUSPENDED,
 *   GRANT_REVOKED, NO_READY_ORIGINAL_MEDIA,
 *   NO_ACTIVE_COMPANY_MEMBERSHIP, INSUFFICIENT_COMPANY_ROLE
 *
 * Fulfilment (packages/artifacts):
 *   PACKAGE_NOT_READY, EMPTY_PACKAGE, PACKAGE_REVOKED,
 *   ARTIFACT_NOT_AVAILABLE
 */
export type DenyReason =
  | 'NO_ACTIVE_GRANT'
  | 'GRANT_EXPIRED'
  | 'GRANT_SUSPENDED'
  | 'GRANT_REVOKED'
  | 'NO_READY_ORIGINAL_MEDIA'
  | 'NO_ACTIVE_COMPANY_MEMBERSHIP'
  | 'INSUFFICIENT_COMPANY_ROLE'
  | 'PACKAGE_NOT_READY'
  | 'EMPTY_PACKAGE'
  | 'PACKAGE_REVOKED'
  | 'ARTIFACT_NOT_AVAILABLE'

export type Audience = 'buyer' | 'creator'

export interface UiDenyMessage {
  title: string
  body: string
}
