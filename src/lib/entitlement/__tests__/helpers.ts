/**
 * Entitlement test helpers — factories and canonical IDs.
 */

import type { LicenceGrantRow, CompanyMembershipRow } from '../types'

// ══════════════════════════════════════════════
// CANONICAL TEST IDS
// ══════════════════════════════════════════════

export const BUYER_ID = 'buyer-001'
export const CREATOR_ID = 'creator-001'
export const STRANGER_ID = 'stranger-001'
export const ADMIN_ID = 'admin-001'
export const COMPANY_ID = 'company-001'
export const ASSET_ID = 'asset-001'
export const GRANT_ID = 'grant-001'
export const MEMBERSHIP_ID = 'membership-001'

// ══════════════════════════════════════════════
// FACTORIES
// ══════════════════════════════════════════════

let grantCounter = 0
let membershipCounter = 0

export function makeGrant(
  overrides: Partial<LicenceGrantRow> = {},
): LicenceGrantRow {
  grantCounter++
  const now = new Date().toISOString()
  return {
    id: `grant-${grantCounter}`,
    asset_id: ASSET_ID,
    buyer_id: BUYER_ID,
    creator_id: CREATOR_ID,
    grantee_company_id: null,
    licence_type: 'editorial',
    state: 'active',
    exclusive: false,
    territory: null,
    term_start: '2025-01-01T00:00:00Z',
    term_end: null,
    entitlement_source_type: 'transaction',
    source_type: 'special_offer',
    source_id: 'source-001',
    transaction_id: 'txn-001',
    certified_package_id: null,
    granted_by_user_id: null,
    suspended_at: null,
    suspended_reason: null,
    revoked_at: null,
    revoked_reason: null,
    granted_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function makeMembership(
  overrides: Partial<CompanyMembershipRow> = {},
): CompanyMembershipRow {
  membershipCounter++
  return {
    id: `membership-${membershipCounter}`,
    company_id: COMPANY_ID,
    user_id: BUYER_ID,
    role: 'admin',
    status: 'active',
    ...overrides,
  }
}

export function resetCounters(): void {
  grantCounter = 0
  membershipCounter = 0
}
