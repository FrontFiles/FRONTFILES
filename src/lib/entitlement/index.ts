/**
 * Frontfiles — Entitlement Module
 *
 * Public API for original-delivery authorization.
 *
 * Usage:
 *   import { resolveDownloadAuthorization } from '@/lib/entitlement'
 *   const decision = resolveDownloadAuthorization(userId, assetId)
 *   if (!decision.allowed) return deny(decision.reason)
 */

export { resolveDownloadAuthorization } from './services'
export type {
  EntitlementDecision,
  DenyReason,
  GranteeType,
  LicenceGrantRow,
  LicenceGrantState,
  EntitlementSource,
  CompanyMembershipRow,
  DOWNLOAD_ELIGIBLE_ROLES,
} from './types'
export { DOWNLOAD_ELIGIBLE_ROLES as downloadEligibleRoles } from './types'
