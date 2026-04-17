/**
 * Frontfiles — Fulfilment Types
 *
 * Type definitions for package access, artifact delivery,
 * and fulfilment API responses.
 *
 * BOUNDARY:
 *   This module owns package/artifact visibility.
 *   It does NOT own original-file authorization — that is
 *   exclusively licence_grants via the entitlement module.
 *   A package existing does NOT imply download rights.
 */

import type { LicenceType } from '@/lib/types'

// ══════════════════════════════════════════════
// PACKAGE STATUS (mirrors PostgreSQL enums)
// ══════════════════════════════════════════════

export type PackageKind = 'buyer_pack' | 'creator_pack'

export type PackageStatus = 'building' | 'ready' | 'failed' | 'revoked'

export type ArtifactStatus =
  | 'pending'
  | 'generated'
  | 'available'
  | 'failed'
  | 'revoked'

export type ArtifactType =
  | 'certificate'
  | 'licence_agreement'
  | 'original_file'
  | 'contract_with_frontfiles'
  | 'invoice'
  | 'payment_receipt'
  | 'payout_summary'

// ══════════════════════════════════════════════
// STORE ROW TYPES (mirrors SQL rows)
// ══════════════════════════════════════════════

export interface PackageRow {
  id: string
  package_number: string
  transaction_id: string
  kind: PackageKind
  status: PackageStatus
  owner_user_id: string
  owner_company_id: string | null
  total_buyer_pays_cents: number
  total_creator_receives_cents: number
  total_platform_earns_cents: number
  version: number
  generated_at: string
  ready_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface PackageItemRow {
  id: string
  package_id: string
  licence_grant_id: string
  asset_id: string
  creator_id: string
  licence_type: LicenceType
  negotiated_amount_cents: number
  listed_price_at_grant_cents: number
  territory: string | null
  term_start: string
  term_end: string | null
  exclusive: boolean
  declaration_state_at_issue: string
  c2pa_version_at_issue: string | null
  c2pa_manifest_valid_at_issue: boolean | null
  certification_hash_at_issue: string | null
  sort_order: number
  created_at: string
}

export interface ArtifactRow {
  id: string
  package_id: string
  item_id: string | null
  artifact_type: ArtifactType
  status: ArtifactStatus
  storage_ref: string | null
  asset_media_id: string | null
  content_type: string | null
  file_size_bytes: number | null
  checksum_sha256: string | null
  generated_by: string | null
  generated_at: string | null
  available_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

// ══════════════════════════════════════════════
// API RESPONSE SHAPES
// ══════════════════════════════════════════════

export interface PackageSummary {
  id: string
  packageNumber: string
  kind: PackageKind
  status: PackageStatus
  transactionId: string
  ownerUserId: string
  ownerCompanyId: string | null
  version: number
  generatedAt: string
  readyAt: string | null
  itemCount: number
  artifactCount: number
}

export interface ArtifactSummary {
  id: string
  artifactType: ArtifactType
  status: ArtifactStatus
  contentType: string | null
  fileSizeBytes: number | null
}

export interface ItemDetail {
  id: string
  assetId: string
  creatorId: string
  licenceType: LicenceType
  exclusive: boolean
  territory: string | null
  termStart: string
  termEnd: string | null
  provenance: {
    declarationStateAtIssue: string
    c2paVersionAtIssue: string | null
    c2paManifestValidAtIssue: boolean | null
    certificationHashAtIssue: string | null
  }
  artifacts: ArtifactSummary[]
}

export interface PackageDetail {
  id: string
  packageNumber: string
  kind: PackageKind
  status: PackageStatus
  transactionId: string
  version: number
  generatedAt: string
  readyAt: string | null
  financials: {
    totalBuyerPaysCents: number
    totalCreatorReceivesCents: number
    totalPlatformEarnsCents: number
  }
  items: ItemDetail[]
  packageArtifacts: ArtifactSummary[]
}

// ══════════════════════════════════════════════
// PACKAGE ACCESS DECISION
// ══════════════════════════════════════════════

export type PackageAccessDecision =
  | { allowed: true; accessType: 'owner' | 'company_member'; packageStatus: PackageStatus; companyId: string | null }
  | { allowed: false }

export interface ArtifactWithContext {
  artifact: ArtifactRow
  packageId: string
  packageStatus: PackageStatus
  /** Set only for item-level artifacts */
  assetId: string | null
}

/**
 * Raw artifact rows with package metadata for ZIP assembly.
 * Used by the package download endpoint.
 */
export interface PackageArtifactsResult {
  packageId: string
  packageNumber: string
  packageStatus: PackageStatus
  artifacts: ArtifactRow[]
}
