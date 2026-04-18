import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import {
  getAssetGovernance,
  getReadyMedia,
  resolveMediaRole,
} from '@/lib/media/asset-media-repo'
import type { MediaRole } from '@/lib/media/asset-media-repo'
import { resolveDownloadAuthorization } from '@/lib/entitlement'
import { logDownloadEvent, getRequestMeta } from '@/lib/download-events'
import type { DownloadAccessBasis, DownloadEventInsert } from '@/lib/download-events'
import { checkOriginalDownloadRate, buildRateLimitResponse } from '@/lib/rate-limit'

/**
 * Frontfiles — Protected Media Delivery Endpoint
 *
 * GET /api/media/{assetId}
 *
 * Resolves files SERVER-SIDE via the asset-media repository.
 * The browser never sends or receives original storage paths.
 *
 * DELIVERY CONTRACT:
 *   Preview contexts (?ctx=...) — governance check + derivative existence.
 *     No entitlement required. Previews are the commercial display layer.
 *   Original delivery (?delivery=original) — governance + entitlement + media.
 *     Requires creator self-access OR active licence grant.
 *
 * AUTHORIZATION SOURCE: licence_grants (via entitlement module).
 *   This endpoint NEVER checks certified_packages or package artifacts.
 *   Package existence is invisible here.
 *
 * AUDIT LOGGING:
 *   Only original delivery attempts by authenticated users are logged.
 *   Preview/derivative requests are NOT audit events.
 *   Governance 404s (asset private/unpublished/invalidated) are NOT logged.
 *
 * FAIL CLOSED:
 *   404 if asset not found, derivative not ready, or asset taken down.
 *   403 if original requested without authorization (body has deny reason).
 *   Never falls back to original when a derivative is missing.
 *   Never exposes storage paths to the browser.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = request.nextUrl
  const delivery = searchParams.get('delivery')
  const ctx = searchParams.get('ctx') || 'preview'
  const variant = searchParams.get('variant')
  const isOriginalRequest = delivery === 'original'

  // ── 1. Asset governance check ─────────────────────────────

  const governance = await getAssetGovernance(id)

  if (!governance) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  if (governance.privacyState === 'PRIVATE') {
    return NextResponse.json({ error: 'Asset is private' }, { status: 404 })
  }

  if (governance.publicationState === 'UNPUBLISHED') {
    return NextResponse.json({ error: 'Asset is unpublished' }, { status: 404 })
  }

  if (governance.declarationState === 'invalidated') {
    return NextResponse.json({ error: 'Asset has been invalidated' }, { status: 404 })
  }

  // ── 2. Resolve media role ─────────────────────────────────

  const mediaRole = resolveMediaRole(delivery, variant, ctx)

  // ── 3. Entitlement check (originals only) ─────────────────
  //
  // Uses the structured decision from the entitlement module.
  // licence_grants is the SOLE authorization source.
  // Package existence, artifact existence, and storage presence
  // are NOT checked and MUST NOT be checked here.

  if (isOriginalRequest) {
    const viewerId = request.headers.get('x-frontfiles-user-id') ?? null

    if (!viewerId) {
      // No authenticated user — not an audit event.
      return NextResponse.json(
        { error: 'Authentication required for original delivery', code: 'AUTH_REQUIRED' },
        { status: 403 },
      )
    }

    // Extract request metadata once for all audit branches.
    const meta = getRequestMeta(request)

    // Shared base for all audit events on this request.
    const eventBase = {
      user_id: viewerId,
      delivery_channel: 'original_media' as const,
      asset_id: id,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      request_id: meta.requestId,
    }

    // Creator always has access to their own originals
    const isCreator = viewerId === governance.creatorId

    if (!isCreator) {
      // ── 3b. Rate-limit check (before entitlement) ──────────
      //
      // Fires before entitlement resolution to protect server
      // resources. Creator self-access is already excluded above.
      const rateCheck = checkOriginalDownloadRate({
        userId: viewerId,
        ipAddress: meta.ipAddress,
        isCreatorSelfAccess: false,
      })

      if (!rateCheck.allowed) {
        void logDownloadEvent({
          ...eventBase,
          access_basis: 'none',
          outcome: 'denied',
          deny_reason: 'RATE_LIMITED',
          http_status: 429,
        })
        return buildRateLimitResponse(rateCheck.retryAfterSeconds ?? 30)
      }

      // ── 3c. Entitlement check ─────────────────────────────
      const decision = await resolveDownloadAuthorization(viewerId, id)

      if (!decision.allowed) {
        void logDownloadEvent({
          ...eventBase,
          licence_grant_id: decision.grantId,
          access_basis: 'none',
          outcome: 'denied',
          deny_reason: decision.reason,
          http_status: 403,
        })
        return NextResponse.json(
          { error: denyReasonMessage(decision.reason), code: decision.reason },
          { status: 403 },
        )
      }

      // Decision is allowed — resolve access basis and carry grant context
      // through to the media check and file serve below.
      const accessBasis: DownloadAccessBasis =
        decision.granteeType === 'company' ? 'company_grant' : 'personal_grant'

      return await serveOriginal(id, mediaRole, ctx, {
        ...eventBase,
        licence_grant_id: decision.grantId,
        company_id: decision.companyId,
        access_basis: accessBasis,
      })
    }

    // Creator self-access path
    return await serveOriginal(id, mediaRole, ctx, {
      ...eventBase,
      access_basis: 'creator_self_access',
    })
  }

  // ── 4. Non-original path (previews/derivatives) ───────────
  // No entitlement check. No audit logging.

  const media = await getReadyMedia(id, mediaRole)

  if (!media) {
    return NextResponse.json(
      { error: `No ${mediaRole} derivative available for this asset` },
      { status: 404 },
    )
  }

  return await serveFile(id, media, false, ctx, mediaRole)
}

// ══════════════════════════════════════════════
// ORIGINAL DELIVERY — media check + serve + audit
// ══════════════════════════════════════════════

/**
 * Check media existence and serve the original file.
 * Logs an audit event for every outcome.
 * File is read ONCE — the buffer is passed to serveFileFromBuffer.
 */
async function serveOriginal(
  assetId: string,
  mediaRole: MediaRole,
  ctx: string,
  auditCtx: Omit<DownloadEventInsert, 'outcome' | 'deny_reason' | 'http_status'>,
): Promise<NextResponse> {
  const media = await getReadyMedia(assetId, mediaRole)

  if (!media) {
    void logDownloadEvent({
      ...auditCtx,
      outcome: 'unavailable',
      deny_reason: 'NO_READY_ORIGINAL_MEDIA',
      http_status: 404,
    })
    return NextResponse.json(
      { error: `No ${mediaRole} derivative available for this asset`, code: 'NO_READY_ORIGINAL_MEDIA' },
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

    // Log success before streaming — transfer completion is a
    // transport concern tracked by CDN/S3 logs.
    void logDownloadEvent({
      ...auditCtx,
      outcome: 'allowed',
      http_status: 200,
    })

    // Pass the already-read buffer — no second disk read.
    return buildFileResponse(assetId, media, fileBuffer, true, ctx, mediaRole)
  } catch {
    void logDownloadEvent({
      ...auditCtx,
      outcome: 'error',
      http_status: 404,
    })
    return NextResponse.json(
      { error: 'Derivative unavailable' },
      { status: 404 },
    )
  }
}

// ══════════════════════════════════════════════
// FILE SERVING
// ══════════════════════════════════════════════

/**
 * Read file from disk and return a response.
 * Used for non-original paths (previews/derivatives) where the
 * file hasn't been pre-read.
 */
async function serveFile(
  assetId: string,
  media: { storageRef: string; contentType: string },
  isOriginal: boolean,
  ctx: string,
  mediaRole: MediaRole,
): Promise<NextResponse> {
  const absPath = join(process.cwd(), 'public', media.storageRef)
  const fileBuffer = await readFile(absPath)
  return buildFileResponse(assetId, media, fileBuffer, isOriginal, ctx, mediaRole)
}

/**
 * Build the HTTP response from an already-read file buffer.
 * Pure function — no disk I/O.
 */
function buildFileResponse(
  assetId: string,
  media: { storageRef: string; contentType: string },
  fileBuffer: Buffer,
  isOriginal: boolean,
  ctx: string,
  mediaRole: MediaRole,
): NextResponse {
  const ext = media.storageRef.split('.').pop()?.toLowerCase() ?? 'bin'

  // TODO: In production, replace with signed URL redirect or S3 presigned GET.

  // Node Buffer<ArrayBufferLike> is not structurally assignable to Web
  // BodyInit (which requires ArrayBufferView<ArrayBuffer>) since the
  // Next.js 16 / @types/node generic tightening. Wrap in a fresh
  // Uint8Array<ArrayBuffer> at the Node↔Web boundary. Copy is transient
  // and will be eliminated when this path moves to signed-URL redirects.
  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      'Content-Type': media.contentType,
      'Cache-Control': isOriginal
        ? 'private, no-store, max-age=0'
        : 'private, max-age=300',
      'Content-Disposition': isOriginal
        ? `attachment; filename="frontfiles-${assetId}.${ext}"`
        : `inline; filename="frontfiles-${ctx}-${assetId}.${ext}"`,
      'X-Frontfiles-Delivery': isOriginal ? 'original' : ctx,
      'X-Frontfiles-Asset-Id': assetId,
      'X-Frontfiles-Media-Role': mediaRole,
    },
  })
}

// ── Deny reason → human message ─────────────────────────────

function denyReasonMessage(reason: string): string {
  const messages: Record<string, string> = {
    NO_ACTIVE_GRANT: 'No active licence grant for this asset',
    GRANT_EXPIRED: 'Licence grant has expired',
    GRANT_SUSPENDED: 'Licence grant is suspended',
    GRANT_REVOKED: 'Licence grant has been revoked',
    GRANT_PENDING: 'Licence grant is pending activation',
    NO_ACTIVE_COMPANY_MEMBERSHIP: 'No active company membership',
    INSUFFICIENT_COMPANY_ROLE: 'Company role does not permit original downloads',
    NO_READY_ORIGINAL_MEDIA: 'Original file is not yet available',
  }
  return messages[reason] ?? 'Not authorized'
}
