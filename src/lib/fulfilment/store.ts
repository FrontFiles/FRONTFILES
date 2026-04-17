/**
 * Frontfiles — Fulfilment Repository
 *
 * Supabase-backed data access for certified_packages,
 * certified_package_items, and certified_package_artifacts.
 *
 * BOUNDARY:
 *   This module answers package/artifact data questions.
 *   It does NOT check licence_grants or original entitlements.
 *   Package existence does NOT imply download authorization.
 *
 * OWNERSHIP MODEL:
 *   A user can access a package if:
 *     1. owner_user_id = userId (direct ownership), OR
 *     2. owner_company_id is set AND user has active membership
 *        in that company with an eligible role.
 *
 *   Eligible roles: admin, content_commit_holder, editor.
 *   These mirror DOWNLOAD_ELIGIBLE_ROLES from the entitlement
 *   module but are declared locally to avoid cross-module coupling.
 *
 * QUERY STRATEGY:
 *   - List queries: resolve eligible company IDs first, then filter
 *     packages in SQL with .or() — ownership must live in the WHERE
 *     clause for pagination and ordering to work.
 *   - Single-package queries: fetch the package by ID, then check
 *     ownership in code. When the user is the direct owner, this
 *     avoids the extra membership query entirely.
 */

import { getSupabaseClient } from '@/lib/db/client'
import type {
  PackageItemRow,
  ArtifactRow,
  PackageSummary,
  PackageDetail,
  ItemDetail,
  ArtifactSummary,
  ArtifactWithContext,
  PackageArtifactsResult,
  PackageAccessDecision,
  PackageStatus,
} from './types'

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════

import { DOWNLOAD_ELIGIBLE_ROLES as ELIGIBLE_ROLES } from '@/lib/company-roles'

// ══════════════════════════════════════════════
// CLIENT
// ══════════════════════════════════════════════

function db() {
  return getSupabaseClient()
}

// ══════════════════════════════════════════════
// PUBLIC — PACKAGE LIST
// ══════════════════════════════════════════════

/**
 * List packages accessible to a user.
 *
 * Ownership is resolved in SQL via an OR filter: direct ownership
 * or company membership. Item and artifact counts use PostgREST
 * relationship count aggregation.
 *
 * Two queries:
 *   1. Eligible company IDs (membership lookup)
 *   2. Packages with ownership filter + counts
 */
export async function listPackagesForUser(
  userId: string,
  kindFilter?: string,
  transactionFilter?: string,
): Promise<PackageSummary[]> {
  const companyIds = await getEligibleCompanyIds(userId)

  let query = db()
    .from('certified_packages')
    .select(`
      *,
      certified_package_items(count),
      certified_package_artifacts(count)
    `)
    .or(buildOwnershipFilter(userId, companyIds))
    .order('generated_at', { ascending: false })

  if (kindFilter) query = query.eq('kind', kindFilter)
  if (transactionFilter) query = query.eq('transaction_id', transactionFilter)

  const { data, error } = await query

  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id,
    packageNumber: row.package_number,
    kind: row.kind,
    status: row.status,
    transactionId: row.transaction_id,
    ownerUserId: row.owner_user_id,
    ownerCompanyId: row.owner_company_id,
    version: row.version,
    generatedAt: row.generated_at,
    readyAt: row.ready_at,
    itemCount: row.certified_package_items?.[0]?.count ?? 0,
    artifactCount: row.certified_package_artifacts?.[0]?.count ?? 0,
  }))
}

// ══════════════════════════════════════════════
// PUBLIC — PACKAGE DETAIL
// ══════════════════════════════════════════════

/**
 * Get full package detail if user has access.
 * Returns null if package not found OR user not authorized.
 * Callers must NOT distinguish these cases to avoid leaking existence.
 *
 * Three queries:
 *   1. Package row + ownership check (code-side)
 *   2. Items (ordered by sort_order)  — parallel with 3
 *   3. All artifacts for this package — parallel with 2
 *
 * Artifacts are grouped in code: package-level (item_id = null)
 * vs item-level (grouped by item_id).
 */
export async function findPackageForUser(
  userId: string,
  packageId: string,
): Promise<PackageDetail | null> {
  // Query 1: Fetch package, verify ownership in code
  const { data: pkg } = await db()
    .from('certified_packages')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()

  if (!pkg) return null
  if (!(await checkPackageOwnership(userId, pkg))) return null

  // Queries 2–3: Items + artifacts in parallel
  const [itemsResult, artifactsResult] = await Promise.all([
    db()
      .from('certified_package_items')
      .select('*')
      .eq('package_id', packageId)
      .order('sort_order', { ascending: true }),
    db()
      .from('certified_package_artifacts')
      .select('*')
      .eq('package_id', packageId),
  ])

  const items = (itemsResult.data ?? []) as PackageItemRow[]
  const allArtifacts = (artifactsResult.data ?? []) as ArtifactRow[]

  // Package-level artifacts (not linked to any item)
  const packageArtifacts = allArtifacts
    .filter(a => a.item_id === null)
    .map(toArtifactSummary)

  // Item details with their nested artifacts
  const itemDetails: ItemDetail[] = items.map(item => {
    const itemArtifacts = allArtifacts
      .filter(a => a.item_id === item.id)
      .map(toArtifactSummary)

    return {
      id: item.id,
      assetId: item.asset_id,
      creatorId: item.creator_id,
      licenceType: item.licence_type,
      exclusive: item.exclusive,
      territory: item.territory,
      termStart: item.term_start,
      termEnd: item.term_end,
      provenance: {
        declarationStateAtIssue: item.declaration_state_at_issue,
        c2paVersionAtIssue: item.c2pa_version_at_issue,
        c2paManifestValidAtIssue: item.c2pa_manifest_valid_at_issue,
        certificationHashAtIssue: item.certification_hash_at_issue,
      },
      artifacts: itemArtifacts,
    }
  })

  return {
    id: pkg.id,
    packageNumber: pkg.package_number,
    kind: pkg.kind,
    status: pkg.status,
    transactionId: pkg.transaction_id,
    version: pkg.version,
    generatedAt: pkg.generated_at,
    readyAt: pkg.ready_at,
    financials: {
      totalBuyerPaysCents: pkg.total_buyer_pays_cents,
      totalCreatorReceivesCents: pkg.total_creator_receives_cents,
      totalPlatformEarnsCents: pkg.total_platform_earns_cents,
    },
    items: itemDetails,
    packageArtifacts,
  }
}

// ══════════════════════════════════════════════
// PUBLIC — ARTIFACT LOOKUP
// ══════════════════════════════════════════════

/**
 * Get a single artifact with its package context.
 * Returns null if artifact not found, package not found,
 * or user not authorized. Same null for all — no leakage.
 *
 * Two–three queries:
 *   1. Package row + ownership check
 *   2. Artifact row (scoped to package_id)
 *   3. Item row — only when artifact.item_id is set,
 *      to resolve asset_id for original_file redirect
 */
export async function findArtifactForUser(
  userId: string,
  packageId: string,
  artifactId: string,
): Promise<ArtifactWithContext | null> {
  // Query 1: Verify package access
  const { data: pkg } = await db()
    .from('certified_packages')
    .select('id, status, owner_user_id, owner_company_id')
    .eq('id', packageId)
    .maybeSingle()

  if (!pkg) return null
  if (!(await checkPackageOwnership(userId, pkg))) return null

  // Query 2: Get artifact (must belong to this package)
  const { data: artifact } = await db()
    .from('certified_package_artifacts')
    .select('*')
    .eq('id', artifactId)
    .eq('package_id', packageId)
    .maybeSingle()

  if (!artifact) return null

  // Query 3: Resolve asset_id for original_file redirect
  let assetId: string | null = null
  if (artifact.item_id) {
    const { data: item } = await db()
      .from('certified_package_items')
      .select('asset_id')
      .eq('id', artifact.item_id)
      .maybeSingle()
    assetId = item?.asset_id ?? null
  }

  return {
    artifact: artifact as ArtifactRow,
    packageId: pkg.id,
    packageStatus: pkg.status as PackageStatus,
    assetId,
  }
}

// ══════════════════════════════════════════════
// PUBLIC — PACKAGE ARTIFACTS (for ZIP download)
// ══════════════════════════════════════════════

/**
 * Get all artifact rows for a package, with package metadata.
 * Used by the ZIP download endpoint to assemble the archive.
 * Returns null if package not found or user not authorized.
 *
 * Two queries:
 *   1. Package row + ownership check
 *   2. All artifacts for this package
 */
export async function findPackageArtifactsForUser(
  userId: string,
  packageId: string,
): Promise<PackageArtifactsResult | null> {
  const { data: pkg } = await db()
    .from('certified_packages')
    .select('id, package_number, status, owner_user_id, owner_company_id')
    .eq('id', packageId)
    .maybeSingle()

  if (!pkg) return null
  if (!(await checkPackageOwnership(userId, pkg))) return null

  const { data: artifacts } = await db()
    .from('certified_package_artifacts')
    .select('*')
    .eq('package_id', packageId)

  return {
    packageId: pkg.id,
    packageNumber: pkg.package_number,
    packageStatus: pkg.status as PackageStatus,
    artifacts: (artifacts ?? []) as ArtifactRow[],
  }
}

// ══════════════════════════════════════════════
// PUBLIC — ACCESS DECISION
// ══════════════════════════════════════════════

/**
 * Structured package access decision.
 *
 * Answers: does this package exist and can this user access it?
 * Returns { allowed: false } for both "not found" and "not authorized"
 * — callers must NOT distinguish these to avoid leaking existence.
 *
 * One–two queries:
 *   1. Package row (lightweight select)
 *   2. Company membership check (only if company-owned and not direct owner)
 */
export async function resolvePackageAccess(
  userId: string,
  packageId: string,
): Promise<PackageAccessDecision> {
  const { data: pkg } = await db()
    .from('certified_packages')
    .select('id, status, owner_user_id, owner_company_id')
    .eq('id', packageId)
    .maybeSingle()

  if (!pkg) return { allowed: false }

  if (pkg.owner_user_id === userId) {
    return {
      allowed: true,
      accessType: 'owner',
      packageStatus: pkg.status as PackageStatus,
      companyId: pkg.owner_company_id,
    }
  }

  if (pkg.owner_company_id) {
    const { data: membership } = await db()
      .from('company_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', pkg.owner_company_id)
      .eq('status', 'active')
      .in('role', [...ELIGIBLE_ROLES])
      .limit(1)
      .maybeSingle()

    if (membership) {
      return {
        allowed: true,
        accessType: 'company_member',
        packageStatus: pkg.status as PackageStatus,
        companyId: pkg.owner_company_id,
      }
    }
  }

  return { allowed: false }
}

// ══════════════════════════════════════════════
// INTERNAL — OWNERSHIP HELPERS
// ══════════════════════════════════════════════

/**
 * Check if a user can access a specific package.
 *
 * Returns the access type ('owner' | 'company_member') or null.
 *
 * When package is user-owned: zero additional queries.
 * When package is company-owned: one query to company_memberships.
 */
async function checkPackageOwnership(
  userId: string,
  pkg: { owner_user_id: string; owner_company_id: string | null },
): Promise<'owner' | 'company_member' | null> {
  if (pkg.owner_user_id === userId) return 'owner'

  if (pkg.owner_company_id) {
    const { data } = await db()
      .from('company_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', pkg.owner_company_id)
      .eq('status', 'active')
      .in('role', [...ELIGIBLE_ROLES])
      .limit(1)
      .maybeSingle()

    if (data) return 'company_member'
  }

  return null
}

/**
 * Get all company IDs where user has an active eligible membership.
 *
 * Used by list queries that need to filter packages in SQL.
 * For single-package lookups, use checkPackageOwnership instead —
 * it avoids this query when the user is the direct owner.
 */
async function getEligibleCompanyIds(userId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', [...ELIGIBLE_ROLES])

  if (error || !data) return []
  return data.map((row: { company_id: string }) => row.company_id)
}

/**
 * Build a PostgREST OR filter string for package ownership.
 *
 * Output: "owner_user_id.eq.<userId>,owner_company_id.in.(<ids>)"
 * When companyIds is empty, only filters on direct ownership.
 */
function buildOwnershipFilter(userId: string, companyIds: string[]): string {
  const conditions = [`owner_user_id.eq.${userId}`]
  if (companyIds.length > 0) {
    conditions.push(`owner_company_id.in.(${companyIds.join(',')})`)
  }
  return conditions.join(',')
}

// ══════════════════════════════════════════════
// INTERNAL — RESPONSE MAPPING
// ══════════════════════════════════════════════

function toArtifactSummary(a: ArtifactRow): ArtifactSummary {
  return {
    id: a.id,
    artifactType: a.artifact_type,
    status: a.status,
    contentType: a.content_type,
    fileSizeBytes: a.file_size_bytes,
  }
}
