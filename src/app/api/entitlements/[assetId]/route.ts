import { NextRequest, NextResponse } from 'next/server'
import { resolveDownloadAuthorization } from '@/lib/entitlement'
import { getAssetGovernance } from '@/lib/media/asset-media-repo'

/**
 * Frontfiles — Entitlement Check Endpoint
 *
 * GET /api/entitlements/{assetId}
 *
 * Returns the current user's download-authorization status for an asset.
 * Used by the UI to decide whether to show "Download Original",
 * "Purchase", or "Unavailable" — before the user clicks.
 *
 * This is a read-only authorization PROBE. It does not initiate delivery.
 *
 * AUTHORIZATION SOURCE: licence_grants (via entitlement module).
 *   This endpoint NEVER checks packages, artifacts, or storage.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params
  const userId = request.headers.get('x-frontfiles-user-id') ?? null

  // ── 1. Authentication ─────────────────────────────────────

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  // ── 2. Asset existence ────────────────────────────────────

  const governance = await getAssetGovernance(assetId)
  if (!governance) {
    return NextResponse.json(
      { error: 'Asset not found' },
      { status: 404 },
    )
  }

  // ── 3. Creator self-access (always entitled) ──────────────

  if (userId === governance.creatorId) {
    return NextResponse.json({
      entitled: true,
      granteeType: 'creator',
      licenceType: null,
      exclusive: false,
      grantId: null,
      companyId: null,
    })
  }

  // ── 4. Entitlement check ──────────────────────────────────
  //
  // Delegates to resolveDownloadAuthorization which checks
  // ONLY licence_grants. Packages are not consulted.

  const decision = await resolveDownloadAuthorization(userId, assetId)

  if (decision.allowed) {
    return NextResponse.json({
      entitled: true,
      grantId: decision.grantId,
      granteeType: decision.granteeType,
      licenceType: decision.licenceType,
      exclusive: decision.exclusive,
      companyId: decision.companyId,
    })
  }

  // Deny reasons are safe to return to the requesting user —
  // they describe the user's OWN authorization status.
  return NextResponse.json({
    entitled: false,
    reason: decision.reason,
  })
}
