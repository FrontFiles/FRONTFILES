import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { findArtifactForUser } from '@/lib/fulfilment'
import { logDownloadEvent, getRequestMeta } from '@/lib/download-events'
import { resolveDownloadAuthorization } from '@/lib/entitlement'
import {
  getAssetGovernance,
  getReadyMedia,
} from '@/lib/media/asset-media-repo'
import type { DownloadAccessBasis } from '@/lib/download-events'
import { checkOriginalDownloadRate, buildRateLimitResponse } from '@/lib/rate-limit'

/**
 * Frontfiles — Package Artifact Download Endpoint
 *
 * GET /api/packages/{packageId}/artifacts/{artifactId}
 *
 * Downloads a single artifact file from a certified package.
 *
 * AUTHORIZATION SOURCE: package ownership (same as package detail).
 *
 * CRITICAL BRIDGE — original_file artifacts:
 *   When artifact_type = 'original_file', this endpoint performs an
 *   INTERNAL SERVER-SIDE DELEGATION to the original delivery logic.
 *   It does NOT issue a 302 redirect — custom auth headers are lost
 *   on browser-followed redirects.
 *
 *   The delegation:
 *     1. Logs a package_artifact event with outcome='redirected'
 *        (records that the user accessed the original via their pack)
 *     2. Runs the entitlement check (resolveDownloadAuthorization)
 *     3. Logs an original_media event with the entitlement outcome
 *     4. Serves the file bytes or returns 403
 *
 *   This preserves two distinct authorization checks (package
 *   ownership + licence entitlement) and two distinct audit records
 *   in one HTTP request, without relying on browser redirect
 *   behavior.
 *
 * AUDIT LOGGING:
 *   Logged only when ownership resolution succeeds (result != null).
 *   Masked 404s ("not found or not authorized") are NOT logged.
 *   original_file downloads produce TWO audit events (package_artifact
 *   + original_media) from the same request.
 *
 * STATUS ENFORCEMENT:
 *   Only 'available' artifacts can be downloaded.
 *   pending   → 409 "artifact is being generated"
 *   generated → 409 "artifact is being verified"
 *   failed    → 409 "artifact generation failed"
 *   revoked   → 409 "artifact has been revoked"
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string; artifactId: string }> },
) {
  const { packageId, artifactId } = await params
  const userId = request.headers.get('x-frontfiles-user-id') ?? null

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  // ── 1. Artifact + package access ──────────────────────────
  //
  // findArtifactForUser returns null for "not found" AND
  // "not authorized". Same null — no existence leakage.

  const result = await findArtifactForUser(userId, packageId, artifactId)

  if (!result) {
    // Masked 404 — do NOT log.
    return NextResponse.json(
      { error: 'Artifact not found' },
      { status: 404 },
    )
  }

  const { artifact, packageStatus, assetId } = result

  // Ownership confirmed — extract request metadata for audit.
  const meta = getRequestMeta(request)
  const eventBase = {
    user_id: userId,
    delivery_channel: 'package_artifact' as const,
    package_id: packageId,
    artifact_id: artifactId,
    artifact_type: artifact.artifact_type,
    access_basis: 'package_owner' as const,
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
    request_id: meta.requestId,
  }

  // ── 2. Package status gate ────────────────────────────────

  if (packageStatus === 'revoked') {
    void logDownloadEvent({
      ...eventBase,
      outcome: 'unavailable',
      deny_reason: 'PACKAGE_REVOKED',
      http_status: 409,
    })

    return NextResponse.json(
      { error: 'Package has been revoked', code: 'PACKAGE_REVOKED' },
      { status: 409 },
    )
  }

  // ── 3. Artifact status gate ───────────────────────────────

  if (artifact.status !== 'available') {
    const messages: Record<string, string> = {
      pending: 'Artifact is being generated',
      generated: 'Artifact is being verified',
      failed: 'Artifact generation failed',
      revoked: 'Artifact has been revoked',
    }

    void logDownloadEvent({
      ...eventBase,
      outcome: 'unavailable',
      deny_reason: 'ARTIFACT_NOT_AVAILABLE',
      http_status: 409,
    })

    return NextResponse.json(
      {
        error: messages[artifact.status] ?? 'Artifact not available',
        code: 'ARTIFACT_NOT_AVAILABLE',
        artifactStatus: artifact.status,
      },
      { status: 409 },
    )
  }

  // ── 4. original_file → internal delegation ────────────────
  //
  // Instead of a 302 redirect (which loses custom auth headers),
  // we perform the entitlement check and file delivery inline.
  //
  // Two audit events are written from this single request:
  //   1. package_artifact with outcome='redirected' — records that
  //      the user accessed the original via their pack
  //   2. original_media with the entitlement outcome — records the
  //      independent licence check result
  //
  // The authorization domains remain separate: package ownership
  // was checked above (step 1), original entitlement is checked
  // below via resolveDownloadAuthorization.

  if (artifact.artifact_type === 'original_file') {
    if (!assetId) {
      void logDownloadEvent({
        ...eventBase,
        outcome: 'not_found',
        http_status: 404,
      })

      return NextResponse.json(
        { error: 'Original file artifact has no linked asset' },
        { status: 404 },
      )
    }

    // Log the package-artifact event (the user navigated here via
    // their pack — this is the "package side" of the audit trail).
    void logDownloadEvent({
      ...eventBase,
      asset_id: assetId,
      outcome: 'redirected',
      http_status: 200, // the request will complete as 200 or 403, not 302
    })

    // ── Entitlement check (original delivery domain) ──────────
    //
    // This is conceptually the same check /api/media/:assetId
    // would perform. Package ownership does NOT authorize originals.

    const originalEventBase = {
      user_id: userId,
      delivery_channel: 'original_media' as const,
      asset_id: assetId,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      request_id: meta.requestId,
    }

    // Governance check
    const governance = await getAssetGovernance(assetId)
    if (!governance || governance.privacyState === 'PRIVATE'
      || governance.publicationState === 'UNPUBLISHED'
      || governance.declarationState === 'invalidated') {
      void logDownloadEvent({
        ...originalEventBase,
        access_basis: 'none',
        outcome: 'not_found',
        http_status: 404,
      })
      return NextResponse.json({ error: 'Asset not available' }, { status: 404 })
    }

    // Creator self-access check
    const isCreator = userId === governance.creatorId

    if (isCreator) {
      return await serveOriginalInline(assetId, {
        ...originalEventBase,
        access_basis: 'creator_self_access',
      })
    }

    // ── Rate-limit check (before entitlement) ──────────────
    const rateCheck = checkOriginalDownloadRate({
      userId,
      ipAddress: meta.ipAddress,
      isCreatorSelfAccess: false,
    })

    if (!rateCheck.allowed) {
      void logDownloadEvent({
        ...originalEventBase,
        access_basis: 'none',
        outcome: 'denied',
        deny_reason: 'RATE_LIMITED',
        http_status: 429,
      })
      return buildRateLimitResponse(rateCheck.retryAfterSeconds ?? 30)
    }

    // Entitlement check via licence_grants
    const decision = await resolveDownloadAuthorization(userId, assetId)

    if (!decision.allowed) {
      void logDownloadEvent({
        ...originalEventBase,
        licence_grant_id: decision.grantId,
        access_basis: 'none',
        outcome: 'denied',
        deny_reason: decision.reason,
        http_status: 403,
      })
      return NextResponse.json(
        { error: 'Not entitled to original delivery', code: decision.reason },
        { status: 403 },
      )
    }

    const accessBasis: DownloadAccessBasis =
      decision.granteeType === 'company' ? 'company_grant' : 'personal_grant'

    return await serveOriginalInline(assetId, {
      ...originalEventBase,
      licence_grant_id: decision.grantId,
      company_id: decision.companyId,
      access_basis: accessBasis,
    })
  }

  // ── 5. Non-original artifact → serve file ─────────────────

  if (!artifact.storage_ref) {
    void logDownloadEvent({
      ...eventBase,
      outcome: 'not_found',
      http_status: 404,
    })

    return NextResponse.json(
      { error: 'Artifact file not available' },
      { status: 404 },
    )
  }

  // TODO: In production, resolve storage_ref to S3 presigned URL
  // and return a 302 redirect. For mock phase, serve from disk.

  try {
    const absPath = join(process.cwd(), 'public', artifact.storage_ref)
    const fileBuffer = await readFile(absPath)
    const ext = artifact.storage_ref.split('.').pop()?.toLowerCase() ?? 'bin'
    const contentType = artifact.content_type ?? 'application/octet-stream'

    // Log success before streaming.
    void logDownloadEvent({
      ...eventBase,
      outcome: 'allowed',
      http_status: 200,
    })

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="frontfiles-${artifact.artifact_type}-${artifactId}.${ext}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Frontfiles-Package-Id': packageId,
        'X-Frontfiles-Artifact-Id': artifact.id,
        'X-Frontfiles-Artifact-Type': artifact.artifact_type,
      },
    })
  } catch {
    void logDownloadEvent({
      ...eventBase,
      outcome: 'error',
      http_status: 404,
    })

    return NextResponse.json(
      { error: 'Artifact file unavailable' },
      { status: 404 },
    )
  }
}

// ══════════════════════════════════════════════
// INTERNAL ORIGINAL DELIVERY
//
// Serves the original file inline from the artifact route.
// Replaces the old 302 redirect. Runs getReadyMedia + file
// read, logs the original_media audit event.
// ══════════════════════════════════════════════

import type { DownloadEventInsert } from '@/lib/download-events'

async function serveOriginalInline(
  assetId: string,
  auditCtx: Omit<DownloadEventInsert, 'outcome' | 'deny_reason' | 'http_status'>,
): Promise<NextResponse> {
  const media = await getReadyMedia(assetId, 'original')

  if (!media) {
    void logDownloadEvent({
      ...auditCtx,
      outcome: 'unavailable',
      deny_reason: 'NO_READY_ORIGINAL_MEDIA',
      http_status: 404,
    })
    return NextResponse.json(
      { error: 'Original file not available', code: 'NO_READY_ORIGINAL_MEDIA' },
      { status: 404 },
    )
  }

  if (!media.storageRef.startsWith('/assets/') || media.storageRef.includes('/avatars/')) {
    void logDownloadEvent({
      ...auditCtx,
      outcome: 'error',
      http_status: 403,
    })
    return NextResponse.json({ error: 'Invalid storage reference' }, { status: 403 })
  }

  try {
    const absPath = join(process.cwd(), 'public', media.storageRef)
    const fileBuffer = await readFile(absPath)
    const ext = media.storageRef.split('.').pop()?.toLowerCase() ?? 'bin'

    void logDownloadEvent({
      ...auditCtx,
      outcome: 'allowed',
      http_status: 200,
    })

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': media.contentType,
        'Content-Disposition': `attachment; filename="frontfiles-${assetId}.${ext}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Frontfiles-Delivery': 'original',
        'X-Frontfiles-Asset-Id': assetId,
        'X-Frontfiles-Media-Role': 'original',
        'X-Frontfiles-Via': 'package-artifact',
      },
    })
  } catch {
    void logDownloadEvent({
      ...auditCtx,
      outcome: 'error',
      http_status: 404,
    })
    return NextResponse.json({ error: 'Original file unavailable' }, { status: 404 })
  }
}
