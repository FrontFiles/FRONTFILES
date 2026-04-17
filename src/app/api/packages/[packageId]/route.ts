import { NextRequest, NextResponse } from 'next/server'
import { findPackageForUser } from '@/lib/fulfilment'

/**
 * Frontfiles — Package Detail Endpoint
 *
 * GET /api/packages/{packageId}
 *
 * Returns full package detail: items with provenance snapshots,
 * artifact manifest (package-level and item-level).
 *
 * AUTHORIZATION SOURCE: package ownership.
 *   Returns 404 for both "not found" and "not authorized" —
 *   prevents probing package IDs to discover other users' purchases.
 *   This endpoint NEVER checks licence_grants.
 *
 * PENDING STATES:
 *   status=building: items/artifacts may be partial. UI shows progress.
 *   status=failed: shown with status field. UI shows retry/support.
 *   status=revoked: shown with revokedAt. UI shows greyed out.
 *   Individual artifacts with status=pending/failed: shown in manifest
 *   but not downloadable via the artifact endpoint.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params
  const userId = request.headers.get('x-frontfiles-user-id') ?? null

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  // findPackageForUser returns null for both "not found" and
  // "not authorized". This is intentional — do not leak existence.
  const detail = await findPackageForUser(userId, packageId)

  if (!detail) {
    return NextResponse.json(
      { error: 'Package not found' },
      { status: 404 },
    )
  }

  return NextResponse.json(detail)
}
