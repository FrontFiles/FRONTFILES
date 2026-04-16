// ═══════════════════════════════════════════════════════════════
// Frontfiles — Upload API route (PR 2, dormant behind flag)
//
// POST /api/upload
//
// Accepts multipart/form-data with:
//   file              (Blob) — the original image bytes
//   metadata          (string JSON) — client-side metadata blob;
//                                     checksummed, not persisted
//
// Headers:
//   X-Upload-Token    idempotency token (UUID v4)
//   X-Creator-Id      placeholder session — see note below
//
// Behavior while FFF_REAL_UPLOAD=false (default): returns 503
// immediately. No request body is read, no auth check runs, no
// storage adapter is touched. Existing simulation path in
// v2-state.ts remains authoritative.
//
// When the flag flips in PR 5, this route becomes the real
// ingest endpoint. The session-resolution hook below is
// explicitly a placeholder; wiring the real session is its own
// PR ahead of the cutover.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

import { isRealUploadEnabled } from '@/lib/flags'
import { getStorageAdapter } from '@/lib/storage'

import { commitUpload } from '@/lib/upload/commit-service'

// UUID v4 loose match — 36 chars, 8-4-4-4-12 with hex groups.
// We allow any version digit because the contract is "UUID" not
// "UUID v4 strictly"; shape-level parsing is enough at the edge.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_MAX_LEN = 64

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Flag gate — nothing else runs while the feature is off.
  if (!isRealUploadEnabled()) {
    return NextResponse.json(
      { code: 'not_enabled', detail: 'real upload pipeline is disabled' },
      { status: 503 },
    )
  }

  // 2. Placeholder session. A real session resolver replaces
  //    this before PR 5's cutover. Until then, the flag gate
  //    above is the only thing keeping this endpoint out of
  //    production traffic.
  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) {
    return NextResponse.json(
      { code: 'unauthenticated' },
      { status: 401 },
    )
  }

  // 3. Idempotency token.
  const token = req.headers.get('x-upload-token') ?? ''
  if (!token || token.length > TOKEN_MAX_LEN || !UUID_RE.test(token)) {
    return NextResponse.json(
      { code: 'bad_token', detail: 'X-Upload-Token must be a UUID' },
      { status: 400 },
    )
  }

  // 4. Parse multipart body.
  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    return NextResponse.json(
      { code: 'bad_request', detail: toErrorMessage(err) },
      { status: 400 },
    )
  }

  const file = form.get('file')
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { code: 'bad_request', detail: 'missing file field' },
      { status: 400 },
    )
  }

  const metadataRaw = form.get('metadata')
  let metadata: unknown = {}
  if (typeof metadataRaw === 'string' && metadataRaw.length > 0) {
    try {
      metadata = JSON.parse(metadataRaw)
    } catch (err) {
      return NextResponse.json(
        {
          code: 'bad_request',
          detail: `metadata is not valid JSON: ${toErrorMessage(err)}`,
        },
        { status: 400 },
      )
    }
  }

  const filename =
    file instanceof File && typeof file.name === 'string'
      ? file.name
      : 'upload.bin'

  // 5. Read bytes. `await file.arrayBuffer()` buffers the whole
  //    body; the size ceiling is re-checked inside the commit
  //    service via validateUploadBytes.
  const bytes = Buffer.from(await file.arrayBuffer())

  // 6. Commit.
  const adapter = getStorageAdapter()
  const result = await commitUpload(
    {
      creatorId,
      clientUploadToken: token,
      filename,
      claimedMime: file.type || 'application/octet-stream',
      bytes,
      metadata,
    },
    { adapter },
  )

  if (result.ok) {
    const body: Record<string, unknown> = {
      asset_id: result.assetId,
      outcome: result.outcome,
    }
    // Token-race branch where fingerprints matched the winner
    // but the compensating delete of the loser's blob failed.
    // The business outcome is success (200 with the winner's
    // asset_id) — the cleanup failure is an operational error
    // that must be loud in both logs and the response body.
    if (result.compensatingDelete && !result.compensatingDelete.ok) {
      console.error(
        'upload.commit: compensating_delete_failed',
        JSON.stringify({
          code: 'compensating_delete_failed',
          storage_ref: result.compensatingDelete.storageRef,
          primary_error: 'lost token race with winner fingerprint match',
          delete_error: result.compensatingDelete.error,
          asset_id: result.assetId,
        }),
      )
      body.compensating_action_failed = true
    }
    return NextResponse.json(body, { status: 200 })
  }

  // 7. Map failures to HTTP. Any compensating-delete failure is
  //    logged AND reflected in the response body via the
  //    `compensating_action_failed` marker so operators and
  //    automated callers can see that a blob orphan was left.
  const compensating = result.compensatingDelete
  const compensatingFailed = compensating?.attempted === true && compensating.ok === false
  if (compensatingFailed && compensating) {
    console.error(
      'upload.commit: compensating_delete_failed',
      JSON.stringify({
        code: 'compensating_delete_failed',
        storage_ref: compensating.storageRef,
        primary_error: result.detail,
        delete_error: compensating.error,
      }),
    )
  }

  const body: Record<string, unknown> = {
    code: result.code,
    detail: result.detail,
  }
  if (result.code === 'validation' && result.validationCode) {
    body.validation_code = result.validationCode
  }
  if (result.code === 'idempotency_conflict' && result.mismatched) {
    body.mismatched = result.mismatched
  }
  if (compensatingFailed) {
    body.compensating_action_failed = true
  }

  return NextResponse.json(body, { status: httpStatusFor(result.code, result.validationCode) })
}

function httpStatusFor(
  code: string,
  validationCode?: string,
): number {
  if (code === 'validation') {
    if (validationCode === 'oversize') return 413
    if (
      validationCode === 'mime_not_allowed' ||
      validationCode === 'magic_mismatch' ||
      validationCode === 'unknown_magic'
    )
      return 415
    return 400
  }
  if (code === 'decode_failed') return 415
  if (code === 'idempotency_conflict') return 409
  if (code === 'storage_write_failed') return 500
  if (code === 'persistence_failed') return 500
  return 500
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
