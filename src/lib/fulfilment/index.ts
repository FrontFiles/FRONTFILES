/**
 * Frontfiles — Fulfilment Module
 *
 * Public API for package listing, detail, and artifact access.
 *
 * BOUNDARY:
 *   This module decides package/artifact VISIBILITY.
 *   It does NOT decide original-file AUTHORIZATION.
 *   Original authorization is exclusively licence_grants
 *   via the entitlement module.
 */

export {
  listPackagesForUser,
  findPackageForUser,
  findArtifactForUser,
  findPackageArtifactsForUser,
  resolvePackageAccess,
} from './store'

export type {
  PackageSummary,
  PackageDetail,
  ItemDetail,
  ArtifactSummary,
  ArtifactWithContext,
  PackageArtifactsResult,
  PackageAccessDecision,
  PackageKind,
  PackageStatus,
  ArtifactStatus,
  ArtifactType,
  PackageRow,
  PackageItemRow,
  ArtifactRow,
} from './types'
