import { NextRequest, NextResponse } from 'next/server'
import { findPackageArtifactsForUser } from '@/lib/fulfilment'
import type { ArtifactRow } from '@/lib/fulfilment'
import { logDownloadEvent, getRequestMeta } from '@/lib/download-events'

/**
 * Frontfiles — Package ZIP Download Endpoint
 *
 * GET /api/packages/{packageId}/download
 *
 * Downloads the entire package as a ZIP archive containing all
 * non-original artifacts (certificates, licence agreements,
 * invoices, receipts, payout summaries).
 *
 * AUTHORIZATION SOURCE: package ownership + status = ready.
 *
 * CRITICAL RULE:
 *   original_file artifacts are EXCLUDED from the ZIP.
 *   Originals must be downloaded separately via
 *   GET /api/media/{assetId}?delivery=original, where
 *   licence_grants are independently verified.
 *   Including originals in the ZIP would bypass entitlement.
 *
 * AUDIT LOGGING:
 *   Logged only when ownership resolution succeeds (result != null).
 *   Masked 404s ("not found or not authorized") are NOT logged.
 *
 * STATUS ENFORCEMENT:
 *   Only packages with status = 'ready' can be ZIP-downloaded.
 *   building → 409 with retryAfter hint
 *   failed   → 409
 *   revoked  → 409
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

  // ── 1. Package access ────────────────────────────────────
  //
  // Uses findPackageArtifactsForUser to get raw ArtifactRow[]
  // (with storage_ref) rather than ArtifactSummary shapes.
  // Returns null for both "not found" and "not authorized".

  const result = await findPackageArtifactsForUser(userId, packageId)

  if (!result) {
    // Masked 404 — do NOT log (cannot distinguish not-found
    // from not-authorized without leaking existence).
    return NextResponse.json(
      { error: 'Package not found' },
      { status: 404 },
    )
  }

  // Ownership confirmed — extract request metadata for audit.
  const meta = getRequestMeta(request)
  const eventBase = {
    user_id: userId,
    delivery_channel: 'package_zip' as const,
    package_id: packageId,
    access_basis: 'package_owner' as const,
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
    request_id: meta.requestId,
  }

  // ── 2. Status gate ────────────────────────────────────────

  if (result.packageStatus !== 'ready') {
    const hints: Record<string, { message: string; retryAfter?: number }> = {
      building: { message: 'Package is still being generated', retryAfter: 30 },
      failed: { message: 'Package generation failed' },
      revoked: { message: 'Package has been revoked' },
    }
    const hint = hints[result.packageStatus] ?? { message: 'Package not available' }

    void logDownloadEvent({
      ...eventBase,
      outcome: 'unavailable',
      deny_reason: 'PACKAGE_NOT_READY',
      http_status: 409,
    })

    return NextResponse.json(
      {
        error: hint.message,
        code: 'PACKAGE_NOT_READY',
        status: result.packageStatus,
        ...(hint.retryAfter && { retryAfter: hint.retryAfter }),
      },
      { status: 409 },
    )
  }

  // ── 3. Collect downloadable artifacts ─────────────────────
  //
  // EXCLUDE original_file artifacts — they must go through
  // /api/media with independent entitlement verification.
  // Include only 'available' artifacts with a storage_ref.

  const downloadable = result.artifacts.filter(
    a => a.artifact_type !== 'original_file'
      && a.status === 'available'
      && a.storage_ref !== null,
  )

  if (downloadable.length === 0) {
    void logDownloadEvent({
      ...eventBase,
      outcome: 'unavailable',
      deny_reason: 'EMPTY_PACKAGE',
      http_status: 409,
    })

    return NextResponse.json(
      { error: 'No downloadable artifacts in this package', code: 'EMPTY_PACKAGE' },
      { status: 409 },
    )
  }

  // ── 4. Assemble ZIP ──────────────────────────────────────
  //
  // TODO: In production, assemble a streaming ZIP from S3 objects:
  //   1. For each artifact, resolve storage_ref to S3 key
  //   2. Stream-compress into ZIP using archiver or similar
  //   3. Pipe directly to response (no buffering entire ZIP in memory)

  const zipFilename = `frontfiles-package-${result.packageNumber}.zip`
  const totalBytes = sumBytes(downloadable)

  // Log success before streaming — transfer completion is a
  // transport concern tracked by CDN/S3 logs.
  void logDownloadEvent({
    ...eventBase,
    outcome: 'allowed',
    http_status: 200,
  })

  // ── Placeholder: return manifest until ZIP streaming is wired ──

  return new NextResponse(
    JSON.stringify({
      _placeholder: 'ZIP streaming implementation pending',
      packageNumber: result.packageNumber,
      filename: zipFilename,
      artifactCount: downloadable.length,
      estimatedBytes: totalBytes,
      artifacts: downloadable.map(a => ({
        id: a.id,
        type: a.artifact_type,
        contentType: a.content_type,
        fileSizeBytes: a.file_size_bytes,
      })),
      note: 'original_file artifacts excluded — download via /api/media/{assetId}?delivery=original',
    }),
    {
      status: 200,
      headers: {
        // Production headers (correct shape even for placeholder body):
        'Content-Type': 'application/json', // becomes application/zip in production
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Frontfiles-Package-Id': result.packageId,
        'X-Frontfiles-Artifact-Count': String(downloadable.length),
        ...(totalBytes !== null && {
          'X-Frontfiles-Estimated-Size': String(totalBytes),
        }),
      },
    },
  )
}

// ── Helpers ──────────────────────────────────────────────────

function sumBytes(artifacts: ArtifactRow[]): number | null {
  let total = 0
  for (const a of artifacts) {
    if (a.file_size_bytes === null) return null // unknown total
    total += a.file_size_bytes
  }
  return total
}
