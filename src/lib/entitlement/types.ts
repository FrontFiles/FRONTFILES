/**
 * Frontfiles — Entitlement Types
 *
 * Type definitions for the download-authorization decision system.
 *
 * CANONICAL RULE:
 *   licence_grants is the SOLE source of truth for original delivery.
 *   Storage existence (asset_media) does NOT imply authorization.
 *   Package existence (certified_packages) does NOT imply authorization.
 */

import type { LicenceType, BuyerCompanyRole } from '@/lib/types'

// ══════════════════════════════════════════════
// LICENCE GRANT STATE (mirrors PostgreSQL enum)
// ══════════════════════════════════════════════

export type LicenceGrantState =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'revoked'

export type EntitlementSource =
  | 'transaction'
  | 'admin_grant'
  | 'system_grant'

// ══════════════════════════════════════════════
// DB ROW TYPES
// ══════════════════════════════════════════════

/** 1:1 with licence_grants SQL row (post-hardening). */
export interface LicenceGrantRow {
  id: string
  asset_id: string
  buyer_id: string
  creator_id: string
  grantee_company_id: string | null
  licence_type: LicenceType
  state: LicenceGrantState
  exclusive: boolean
  territory: string | null
  term_start: string   // ISO 8601
  term_end: string | null
  entitlement_source_type: EntitlementSource
  source_type: string | null
  source_id: string | null
  transaction_id: string | null
  certified_package_id: string | null
  granted_by_user_id: string | null
  suspended_at: string | null
  suspended_reason: string | null
  revoked_at: string | null
  revoked_reason: string | null
  granted_at: string
  created_at: string
  updated_at: string
}

/** 1:1 with company_memberships SQL row (relevant fields only). */
export interface CompanyMembershipRow {
  id: string
  company_id: string
  user_id: string
  role: BuyerCompanyRole
  status: 'active' | 'invited' | 'revoked' | 'left'
}

// ══════════════════════════════════════════════
// DECISION TYPES
// ══════════════════════════════════════════════

/** Why a download was denied. */
export type DenyReason =
  | 'NO_ACTIVE_GRANT'
  | 'GRANT_EXPIRED'
  | 'GRANT_SUSPENDED'
  | 'GRANT_REVOKED'
  | 'GRANT_PENDING'
  | 'NO_ACTIVE_COMPANY_MEMBERSHIP'
  | 'INSUFFICIENT_COMPANY_ROLE'
  | 'NO_READY_ORIGINAL_MEDIA'
  | 'ASSET_NOT_FOUND'

/** How the user is authorized — personal or via company. */
export type GranteeType = 'personal' | 'company'

/**
 * Structured authorization decision.
 *
 * This type answers ONLY "is the user entitled?"
 * Media availability (does the original file exist?) is a
 * separate concern checked by the route handler after this
 * decision passes.
 */
export type EntitlementDecision =
  | {
      allowed: true
      grantId: string
      granteeType: GranteeType
      companyId: string | null
      licenceType: LicenceType
      exclusive: boolean
    }
  | {
      allowed: false
      reason: DenyReason
      /** The grant that was found but not usable (expired, suspended, etc.) */
      grantId: string | null
    }

// ══════════════════════════════════════════════
// COMPANY ROLE POLICY
// ══════════════════════════════════════════════

/**
 * Re-exported from the shared source of truth (@/lib/company-roles).
 * Both the entitlement module and the fulfilment module import from
 * the same constant to prevent eligible-role divergence.
 */
export { DOWNLOAD_ELIGIBLE_ROLES } from '@/lib/company-roles'
