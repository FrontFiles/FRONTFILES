// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/
//                                              assets   (NR-D7a, F5)
//
// Creates a Pack-asset row + an initial pending scan-result row,
// and issues a presigned PUT URL the client uses to upload the
// file bytes directly to storage.
//
// Two-INSERT shape (newsroom_assets, then newsroom_asset_scan_results):
// PostgREST doesn't expose multi-table transactions, so the writes
// are sequential. If the second INSERT fails, the first INSERT
// leaves an orphan asset row with no scan_result. Accepted as v1
// per the directive (NR-D7a §F5 step 9 / IP-3 ratification). A
// v1.1 cleanup sweep can flag asset rows lacking a sibling
// scan_result and either backfill or remove them. The sentinel
// values for the scan-result row (`scanner_suite='unscanned'`,
// `scanner_version='0.0.0'`, `result='pending'` by default) keep
// the schema's NOT NULL constraints satisfied; NR-D7b overwrites
// them with real scanner values when the AV pipeline lands.
//
// Storage path scheme: newsroom assets live under a
// `newsroom/packs/{packId}/assets/{assetId}/original.{ext}` prefix
// distinct from the Frontfiles vault's `originals/{assetId}/...`
// namespace. See `newsroomOriginalPath` in
// `src/lib/newsroom/asset-form-constants.ts`.
//
// Storage driver: `getStorageAdapter()` selects fs vs supabase via
// FFF_STORAGE_DRIVER. The fs adapter throws on `signedPutUrl` (IP-1
// Option A1 — dev workflow uses the Supabase docker stack instead).
// Operators flipping to fs in dev get a clean error message
// pointing at the env var, not a 500.
//
// Response shape:
//   201 { ok: true, asset, signedUploadUrl, uploadHeaders? }
//   400 { ok: false, reason: 'invalid-body' | 'validation', errors? }
//   401 { ok: false, reason: 'unauthenticated' }
//   403 { ok: false, reason: 'forbidden' | 'unverified' }
//   404 { ok: false, reason: 'not-found' | 'feature-disabled' }
//   409 { ok: false, reason: 'not-editable' }
//   500 { ok: false, reason: 'internal' | 'storage-driver' }
//
// Spec cross-references:
//   - directives/NR-D7a-asset-upload-storage-metadata.md §F5
//   - sibling routes: NR-D6b packs POST + PATCH (auth pattern)
//   - src/lib/storage/* (adapter contract)
//   - src/lib/newsroom/asset-form*.ts (schema + path helper)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomAssetRow,
  NewsroomPackRow,
} from '@/lib/db/schema'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import {
  extensionForMime,
  newsroomOriginalPath,
} from '@/lib/newsroom/asset-form-constants'
import { createAssetSchema } from '@/lib/newsroom/asset-form'
import { getStorageAdapter } from '@/lib/storage'

export const runtime = 'nodejs'

const ROUTE =
  'POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets'

// IP-3 sentinel values for the scan_results NOT-NULL columns.
// NR-D7b will overwrite both fields when its scanner pipeline runs.
const SCAN_SENTINEL_SUITE = 'unscanned'
const SCAN_SENTINEL_VERSION = '0.0.0'

const SIGNED_UPLOAD_TTL_SECONDS = 900 // 15 min — see SignedPutUrlInput.ttlSeconds

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string }> },
): Promise<NextResponse> {
  if (!isAuthWired()) {
    return NextResponse.json(
      { ok: false, reason: 'feature-disabled' },
      { status: 404 },
    )
  }

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }

  const { orgSlug, packSlug } = await context.params

  // ── body parse ───────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }

  const supabase = getSupabaseClient()

  // ── auth ─────────────────────────────────────────────────────
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }
  const authUserId = userData.user.id

  // ── company lookup ───────────────────────────────────────────
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (companyError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: companyError.code,
        rawMessage: companyError.message,
      },
      '[newsroom.assets.create] companies lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!company) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  const companyId = company.id as string

  // ── admin gate (direct membership, admin-only — IP-3 of NR-D6b) ──
  const { data: membership, error: membershipError } = await supabase
    .from('company_memberships')
    .select('role, status')
    .eq('company_id', companyId)
    .eq('user_id', authUserId)
    .maybeSingle()
  if (membershipError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: membershipError.code,
        rawMessage: membershipError.message,
      },
      '[newsroom.assets.create] membership lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (
    !membership ||
    membership.role !== 'admin' ||
    membership.status !== 'active'
  ) {
    return NextResponse.json(
      { ok: false, reason: 'forbidden' },
      { status: 403 },
    )
  }

  // ── pack lookup + status guard ───────────────────────────────
  const { data: packRow, error: packError } = await supabase
    .from('newsroom_packs')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('slug', packSlug)
    .maybeSingle()
  if (packError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: packError.code,
        rawMessage: packError.message,
      },
      '[newsroom.assets.create] pack lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!packRow) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  const packId = packRow.id as string
  const packStatus = packRow.status as NewsroomPackRow['status']
  if (packStatus !== 'draft') {
    return NextResponse.json(
      { ok: false, reason: 'not-editable' },
      { status: 409 },
    )
  }

  // ── zod validation ───────────────────────────────────────────
  const parsed = createAssetSchema.safeParse(rawBody)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || '_root'
      if (!errors[path]) errors[path] = issue.message
    }
    return NextResponse.json(
      { ok: false, reason: 'validation', errors },
      { status: 400 },
    )
  }
  const data = parsed.data

  // ── extension + storage path ─────────────────────────────────
  const extension = extensionForMime(data.mime_type)
  if (!extension) {
    // Defensive — createAssetSchema accepted a MIME that's not in
    // EXTENSION_FOR_MIME. Should be impossible if the two maps stay
    // in sync, but log loudly so the drift is visible.
    logger.error(
      { route: ROUTE, companyId, mime: data.mime_type },
      '[newsroom.assets.create] no extension for accepted MIME — drift between ACCEPTED_MIME_TYPES and EXTENSION_FOR_MIME',
    )
    return NextResponse.json(
      {
        ok: false,
        reason: 'validation',
        errors: { mime_type: 'mime type not supported by storage layer' },
      },
      { status: 400 },
    )
  }

  const newAssetId = randomUUID()
  const storageRef = newsroomOriginalPath(packId, newAssetId, extension)

  // ── INSERT newsroom_assets ───────────────────────────────────
  const { data: assetRow, error: insertAssetError } = await supabase
    .from('newsroom_assets')
    .insert({
      id: newAssetId,
      pack_id: packId,
      kind: data.kind,
      mime_type: data.mime_type,
      original_filename: data.filename,
      storage_url: storageRef,
      file_size_bytes: data.file_size_bytes,
      width: data.width ?? null,
      height: data.height ?? null,
      duration_seconds: data.duration_seconds ?? null,
      checksum_sha256: data.checksum_sha256,
      // Caption / alt_text / is_trademark_asset default to NULL /
      // false per the migration; the user fills them in via F4
      // after the upload completes.
    })
    .select()
    .single()
  if (insertAssetError || !assetRow) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        packId,
        rawCode: insertAssetError?.code,
        rawMessage: insertAssetError?.message,
      },
      '[newsroom.assets.create] asset INSERT failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── INSERT newsroom_asset_scan_results (pending sentinel) ────
  // IP-3 ratified: scanner_suite + scanner_version are NOT NULL on
  // the migration. NR-D7a has no real scanner; we write sentinel
  // values that NR-D7b's scanner pipeline overwrites when it runs.
  // Failure here leaves an orphan asset row with no scan_result —
  // accepted v1 per directive.
  const { error: scanInsertError } = await supabase
    .from('newsroom_asset_scan_results')
    .insert({
      asset_id: newAssetId,
      scanner_suite: SCAN_SENTINEL_SUITE,
      scanner_version: SCAN_SENTINEL_VERSION,
      // result defaults to 'pending' per the migration
    })
  if (scanInsertError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        packId,
        assetId: newAssetId,
        rawCode: scanInsertError.code,
        rawMessage: scanInsertError.message,
      },
      '[newsroom.assets.create] scan_result INSERT failed (orphan asset retained)',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── signed upload URL ────────────────────────────────────────
  const adapter = getStorageAdapter()
  let signedUrl: string
  let uploadHeaders: Record<string, string> | undefined
  try {
    const result = await adapter.signedPutUrl({
      storageRef,
      ttlSeconds: SIGNED_UPLOAD_TTL_SECONDS,
      contentType: data.mime_type,
    })
    signedUrl = result.url
    uploadHeaders = result.headers
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(
      { route: ROUTE, companyId, packId, assetId: newAssetId, message },
      '[newsroom.assets.create] signedPutUrl failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'storage-driver' },
      { status: 500 },
    )
  }

  logger.info(
    {
      route: ROUTE,
      companyId,
      packId,
      assetId: newAssetId,
      authUserId,
      kind: data.kind,
      sizeBytes: data.file_size_bytes,
    },
    '[newsroom.assets.create] asset created',
  )
  return NextResponse.json(
    {
      ok: true,
      asset: assetRow as NewsroomAssetRow,
      signedUploadUrl: signedUrl,
      uploadHeaders,
    },
    { status: 201 },
  )
}
