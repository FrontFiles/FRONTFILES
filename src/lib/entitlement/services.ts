/**
 * Frontfiles — Entitlement Service
 *
 * The application-layer authorization decision for original-file delivery.
 * Every original-delivery endpoint MUST call resolveDownloadAuthorization()
 * before serving content.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  CANONICAL AUTHORIZATION RULE                            │
 * │                                                          │
 * │  licence_grants is the SOLE source of truth.             │
 * │  Storage existence (asset_media) ≠ authorization.        │
 * │  Package existence (certified_packages) ≠ authorization. │
 * │  Fail closed: no grant → 404. No exceptions.             │
 * └──────────────────────────────────────────────────────────┘
 *
 * DECISION PIPELINE:
 *   1. Find active grant (personal or company path)
 *   2. If no active grant, find the best deny reason
 *   3. If active grant found, resolve original media
 *   4. Return structured decision
 *
 * This service does NOT:
 *   - Generate signed URLs
 *   - Stream files
 *   - Write audit logs
 *   - Check certified_packages or package artifacts
 */

import type { EntitlementDecision, DenyReason, GranteeType } from './types'
import { DOWNLOAD_ELIGIBLE_ROLES } from './types'
import {
  findActiveGrant,
  findBestDenyGrant,
  hasEligibleMembership,
  hasAnyActiveMembership,
} from './store'

// ══════════════════════════════════════════════
// CORE AUTHORIZATION FUNCTION
// ══════════════════════════════════════════════

/**
 * Resolve whether a user may download the original file for a vault asset.
 *
 * This is the single function every delivery endpoint calls.
 * It returns a structured decision — never throws for authorization failures.
 *
 * This function answers ONLY: "is the user entitled?"
 * It does NOT check media availability (does the file exist?).
 * Media availability is a delivery concern, checked by the route
 * handler after this function returns allowed=true.
 *
 * FAIL CLOSED: default is deny. No active grant → most specific
 * deny reason. No grant found at all → NO_ACTIVE_GRANT.
 */
export async function resolveDownloadAuthorization(
  userId: string,
  vaultAssetId: string,
): Promise<EntitlementDecision> {
  const activeGrant = await findActiveGrant(
    vaultAssetId,
    userId,
    DOWNLOAD_ELIGIBLE_ROLES,
  )

  if (!activeGrant) {
    return await buildDenyDecision(vaultAssetId, userId)
  }

  const granteeType: GranteeType =
    activeGrant.buyer_id === userId ? 'personal' : 'company'

  return {
    allowed: true,
    grantId: activeGrant.id,
    granteeType,
    companyId: activeGrant.grantee_company_id,
    licenceType: activeGrant.licence_type,
    exclusive: activeGrant.exclusive,
  }
}

// ══════════════════════════════════════════════
// DENY REASON RESOLUTION
// ══════════════════════════════════════════════

/**
 * Build the most informative deny decision.
 *
 * When no active grant exists, we look for non-active grants
 * to produce a specific reason rather than generic NO_ACTIVE_GRANT.
 *
 * Priority: SUSPENDED > REVOKED > EXPIRED > PENDING > NO_ACTIVE_GRANT
 *
 * For company grants where the user has a membership but the wrong
 * role, we return INSUFFICIENT_COMPANY_ROLE. If they have no
 * membership at all, NO_ACTIVE_COMPANY_MEMBERSHIP.
 */
async function buildDenyDecision(
  assetId: string,
  userId: string,
): Promise<EntitlementDecision> {
  const denyGrant = await findBestDenyGrant(assetId, userId)

  if (!denyGrant) {
    return { allowed: false, reason: 'NO_ACTIVE_GRANT', grantId: null }
  }

  // Active grant with expired term
  if (denyGrant.state === 'active') {
    return { allowed: false, reason: 'GRANT_EXPIRED', grantId: denyGrant.id }
  }

  // Map state to deny reason
  const stateReasons: Record<string, DenyReason> = {
    suspended: 'GRANT_SUSPENDED',
    revoked: 'GRANT_REVOKED',
    expired: 'GRANT_EXPIRED',
    pending: 'GRANT_PENDING',
  }

  const reason = stateReasons[denyGrant.state] ?? 'NO_ACTIVE_GRANT'

  // For company grants, check if denial is due to membership issues
  if (
    denyGrant.grantee_company_id !== null &&
    denyGrant.buyer_id !== userId
  ) {
    if (!(await hasAnyActiveMembership(userId, denyGrant.grantee_company_id))) {
      return {
        allowed: false,
        reason: 'NO_ACTIVE_COMPANY_MEMBERSHIP',
        grantId: denyGrant.id,
      }
    }
    if (
      !(await hasEligibleMembership(
        userId,
        denyGrant.grantee_company_id,
        DOWNLOAD_ELIGIBLE_ROLES,
      ))
    ) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_COMPANY_ROLE',
        grantId: denyGrant.id,
      }
    }
  }

  return { allowed: false, reason, grantId: denyGrant.id }
}
