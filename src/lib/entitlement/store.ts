/**
 * Frontfiles — Entitlement Repository
 *
 * Data access layer for licence_grants and company_memberships.
 *
 * DUAL MODE:
 *   When Supabase is configured → real database queries.
 *   When Supabase is not configured → in-memory Maps (dev/test).
 *   Mode is determined by isSupabaseConfigured() at call time.
 *
 * IMPORTANT: This module answers data questions only.
 * Authorization DECISIONS are made by the service layer (services.ts).
 *
 * CANONICAL RULE:
 *   licence_grants is the SOLE authorization source.
 *   Package artifacts, asset_media existence, storage paths —
 *   none of these are checked here. That is correct.
 */

import { isSupabaseConfigured } from '@/lib/db/client'
import type {
  LicenceGrantRow,
  CompanyMembershipRow,
  LicenceGrantState,
} from './types'

// ══════════════════════════════════════════════
// SUPABASE CLIENT (lazy)
// ══════════════════════════════════════════════

async function db() {
  const { getSupabaseClient } = await import('@/lib/db/client')
  return getSupabaseClient()
}

// ══════════════════════════════════════════════
// IN-MEMORY STORES (dev/test mode)
// ══════════════════════════════════════════════

const grantStore = new Map<string, LicenceGrantRow>()
const membershipStore = new Map<string, CompanyMembershipRow>()

// ══════════════════════════════════════════════
// GRANT QUERIES
// ══════════════════════════════════════════════

/**
 * Find an active, temporally valid grant for a user on an asset.
 *
 * Checks two paths:
 *   1. Personal: buyer_id = userId
 *   2. Company: grantee_company_id matches one of the user's
 *      active memberships with a download-eligible role.
 */
export async function findActiveGrant(
  assetId: string,
  userId: string,
  eligibleRoles: readonly string[],
): Promise<LicenceGrantRow | null> {
  if (!isSupabaseConfigured()) {
    return findActiveGrantMock(assetId, userId, eligibleRoles)
  }

  const companyIds = await getEligibleCompanyIds(userId, eligibleRoles)

  let ownerFilter = `buyer_id.eq.${userId}`
  if (companyIds.length > 0) {
    ownerFilter += `,grantee_company_id.in.(${companyIds.join(',')})`
  }

  const now = new Date().toISOString()

  const { data } = await (await db())
    .from('licence_grants')
    .select('*')
    .eq('asset_id', assetId)
    .eq('state', 'active')
    .or(`term_end.is.null,term_end.gt.${now}`)
    .or(ownerFilter)
    .limit(1)
    .maybeSingle()

  return (data as LicenceGrantRow | null) ?? null
}

/**
 * Find the best deny-reason grant for diagnostic purposes.
 */
export async function findBestDenyGrant(
  assetId: string,
  userId: string,
): Promise<LicenceGrantRow | null> {
  if (!isSupabaseConfigured()) {
    return findBestDenyGrantMock(assetId, userId)
  }

  const companyIds = await getAllCompanyIds(userId)

  let ownerFilter = `buyer_id.eq.${userId}`
  if (companyIds.length > 0) {
    ownerFilter += `,grantee_company_id.in.(${companyIds.join(',')})`
  }

  const { data } = await (await db())
    .from('licence_grants')
    .select('*')
    .eq('asset_id', assetId)
    .or(ownerFilter)

  if (!data || data.length === 0) return null

  return rankDenyGrants(data as LicenceGrantRow[])
}

// ══════════════════════════════════════════════
// MEMBERSHIP QUERIES
// ══════════════════════════════════════════════

/**
 * Check if user has an active membership in a specific company
 * with a download-eligible role.
 */
export async function hasEligibleMembership(
  userId: string,
  companyId: string,
  eligibleRoles: readonly string[],
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return hasEligibleMembershipMock(userId, companyId, eligibleRoles)
  }

  const { data } = await (await db())
    .from('company_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .in('role', [...eligibleRoles])
    .limit(1)
    .maybeSingle()

  return data !== null
}

/**
 * Check if user has ANY active membership in a company.
 */
export async function hasAnyActiveMembership(
  userId: string,
  companyId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return hasAnyActiveMembershipMock(userId, companyId)
  }

  const { data } = await (await db())
    .from('company_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return data !== null
}

// ══════════════════════════════════════════════
// SUPABASE HELPERS
// ══════════════════════════════════════════════

async function getEligibleCompanyIds(
  userId: string,
  eligibleRoles: readonly string[],
): Promise<string[]> {
  const { data } = await (await db())
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', [...eligibleRoles])

  return (data ?? []).map((r: { company_id: string }) => r.company_id)
}

async function getAllCompanyIds(userId: string): Promise<string[]> {
  const { data } = await (await db())
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  return (data ?? []).map((r: { company_id: string }) => r.company_id)
}

// ══════════════════════════════════════════════
// SHARED LOGIC
// ══════════════════════════════════════════════

function rankDenyGrants(grants: LicenceGrantRow[]): LicenceGrantRow | null {
  const priority: Record<LicenceGrantState, number> = {
    suspended: 4,
    revoked: 3,
    expired: 2,
    pending: 1,
    active: 0,
  }

  let best: LicenceGrantRow | null = null
  let bestPriority = -1
  const now = new Date()

  for (const grant of grants) {
    if (grant.state === 'active') {
      if (grant.term_end !== null && new Date(grant.term_end) <= now) {
        if (2 > bestPriority) { best = grant; bestPriority = 2 }
      }
      continue
    }
    const p = priority[grant.state]
    if (p > bestPriority) { best = grant; bestPriority = p }
  }

  return best
}

// ══════════════════════════════════════════════
// IN-MEMORY MOCK IMPLEMENTATIONS (dev/test)
// ══════════════════════════════════════════════

function findActiveGrantMock(
  assetId: string,
  userId: string,
  eligibleRoles: readonly string[],
): LicenceGrantRow | null {
  const now = new Date()
  const userCompanyIds = getUserActiveCompanyIdsMock(userId, eligibleRoles)

  for (const grant of grantStore.values()) {
    if (grant.asset_id !== assetId) continue
    if (grant.state !== 'active') continue
    if (grant.term_end !== null && new Date(grant.term_end) <= now) continue
    if (grant.buyer_id === userId) return grant
    if (
      grant.grantee_company_id !== null &&
      userCompanyIds.includes(grant.grantee_company_id)
    ) return grant
  }
  return null
}

function findBestDenyGrantMock(
  assetId: string,
  userId: string,
): LicenceGrantRow | null {
  const userCompanyIds = getUserAllCompanyIdsMock(userId)
  const candidates: LicenceGrantRow[] = []

  for (const grant of grantStore.values()) {
    if (grant.asset_id !== assetId) continue
    const isPersonal = grant.buyer_id === userId
    const isCompany =
      grant.grantee_company_id !== null &&
      userCompanyIds.includes(grant.grantee_company_id)
    if (isPersonal || isCompany) candidates.push(grant)
  }

  return rankDenyGrants(candidates)
}

function hasEligibleMembershipMock(
  userId: string,
  companyId: string,
  eligibleRoles: readonly string[],
): boolean {
  for (const m of membershipStore.values()) {
    if (
      m.user_id === userId &&
      m.company_id === companyId &&
      m.status === 'active' &&
      eligibleRoles.includes(m.role)
    ) return true
  }
  return false
}

function hasAnyActiveMembershipMock(
  userId: string,
  companyId: string,
): boolean {
  for (const m of membershipStore.values()) {
    if (
      m.user_id === userId &&
      m.company_id === companyId &&
      m.status === 'active'
    ) return true
  }
  return false
}

function getUserActiveCompanyIdsMock(
  userId: string,
  eligibleRoles: readonly string[],
): string[] {
  const ids: string[] = []
  for (const m of membershipStore.values()) {
    if (m.user_id === userId && m.status === 'active' && eligibleRoles.includes(m.role)) {
      ids.push(m.company_id)
    }
  }
  return ids
}

function getUserAllCompanyIdsMock(userId: string): string[] {
  const ids: string[] = []
  for (const m of membershipStore.values()) {
    if (m.user_id === userId && m.status === 'active') ids.push(m.company_id)
  }
  return ids
}

// ══════════════════════════════════════════════
// STORE MANAGEMENT (test + mock seeding)
// ══════════════════════════════════════════════

export function putGrant(grant: LicenceGrantRow): void {
  grantStore.set(grant.id, grant)
}

export function putMembership(membership: CompanyMembershipRow): void {
  membershipStore.set(membership.id, membership)
}

export function _resetStore(): void {
  grantStore.clear()
  membershipStore.clear()
}
