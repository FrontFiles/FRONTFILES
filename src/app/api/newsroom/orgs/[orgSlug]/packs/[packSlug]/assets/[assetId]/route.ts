// ═══════════════════════════════════════════════════════════════
// Frontfiles — PATCH + DELETE on
// /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets/[assetId]
//                                                      (NR-D7a, F6)
//
// PATCH: edit caption / alt_text / is_trademark_asset on a draft-
//   pack asset. F4 (asset-row.tsx) calls this on field blur.
// DELETE: remove an asset row (CASCADE drops scan_results) and
//   best-effort delete the storage object. Storage failure is
//   logged + swallowed; orphan storage objects are accepted v1.
//
// Same auth/admin posture as F5 (NR-D7a) and the NR-D6b pack
// routes: inline Bearer extraction → supabase.auth.getUser →
// direct membership query (admin-only) → service-role write. The
// `is_newsroom_editor_or_admin` RPC is broken under service-role
// (NR-D6b carry-forward); direct query is the standing pattern.
//
// Pack lookup goes through a chained query: asset → pack → company,
// asserting company_id matches the orgSlug. This catches
// cross-org assetId tampering at the route boundary even though
// the service-role client bypasses RLS.
//
// Status guard: only draft packs are editable in NR-D7a. Same
// shape as NR-D6b's pack PATCH guard.
//
// Response shape:
//   PATCH:
//     200 { ok: true,  asset }
//     400 { ok: false, reason: 'invalid-body' | 'validation', errors? }
//     401 { ok: false, reason: 'unauthenticated' }
//     403 { ok: false, reason: 'forbidden' }
//     404 { ok: false, reason: 'not-found' | 'feature-disabled' }
//     409 { ok: false, reason: 'not-editable' }
//     500 { ok: false, reason: 'internal' }
//   DELETE:
//     204 (no body)
//     401/403/404/409/500 same as PATCH
//
// Spec cross-references:
//   - directives/NR-D7a-asset-upload-storage-metadata.md §F6
//   - sibling: F5 (POST) — auth pattern + status guard
//   - src/lib/storage/* (adapter.delete contract)
//   - src/lib/newsroom/asset-form.ts (updateAssetMetadataSchema)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import type { NewsroomPackRow } from '@/lib/db/schema'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import { updateAssetMetadataSchema } from '@/lib/newsroom/asset-form'
import { getStorageAdapter } from '@/lib/storage'

export const runtime = 'nodejs'

const ROUTE_PATCH =
  'PATCH /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets/[assetId]'
const ROUTE_DELETE =
  'DELETE /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets/[assetId]'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

interface AssetContext {
  authUserId: string
  companyId: string
  packId: string
  assetId: string
  storageUrl: string
}

/**
 * Shared auth + lookup chain for PATCH and DELETE.
 *
 * Returns either a NextResponse to short-circuit with, or an
 * AssetContext containing the resolved IDs needed for the write.
 * Using a discriminated return keeps the two handlers tidy and
 * the auth/lookup pipeline DRY.
 */
async function resolveAssetContext(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string; assetId: string }> },
  routeLabel: string,
): Promise<AssetContext | NextResponse> {
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

  const { orgSlug, packSlug, assetId } = await context.params
  const supabase = getSupabaseClient()

  // ── auth ──
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }
  const authUserId = userData.user.id

  // ── company ──
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (companyError) {
    logger.error(
      {
        route: routeLabel,
        rawCode: companyError.code,
        rawMessage: companyError.message,
      },
      '[newsroom.assets.detail] companies lookup failed',
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

  // ── admin gate ──
  const { data: membership, error: membershipError } = await supabase
    .from('company_memberships')
    .select('role, status')
    .eq('company_id', companyId)
    .eq('user_id', authUserId)
    .maybeSingle()
  if (membershipError) {
    logger.error(
      {
        route: routeLabel,
        rawCode: membershipError.code,
        rawMessage: membershipError.message,
      },
      '[newsroom.assets.detail] membership lookup failed',
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

  // ── pack ──
  const { data: pack, error: packError } = await supabase
    .from('newsroom_packs')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('slug', packSlug)
    .maybeSingle()
  if (packError) {
    logger.error(
      {
        route: routeLabel,
        companyId,
        rawCode: packError.code,
        rawMessage: packError.message,
      },
      '[newsroom.assets.detail] pack lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!pack) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  const packId = pack.id as string
  const packStatus = pack.status as NewsroomPackRow['status']
  if (packStatus !== 'draft') {
    return NextResponse.json(
      { ok: false, reason: 'not-editable' },
      { status: 409 },
    )
  }

  // ── asset (also confirms pack_id matches — cross-org tamper guard) ──
  const { data: asset, error: assetError } = await supabase
    .from('newsroom_assets')
    .select('id, storage_url, pack_id')
    .eq('id', assetId)
    .maybeSingle()
  if (assetError) {
    logger.error(
      {
        route: routeLabel,
        companyId,
        packId,
        assetId,
        rawCode: assetError.code,
        rawMessage: assetError.message,
      },
      '[newsroom.assets.detail] asset lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!asset || asset.pack_id !== packId) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }

  return {
    authUserId,
    companyId,
    packId,
    assetId,
    storageUrl: asset.storage_url as string,
  }
}

// ─── PATCH ─────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string; assetId: string }> },
): Promise<NextResponse> {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }

  const ctx = await resolveAssetContext(request, context, ROUTE_PATCH)
  if (ctx instanceof NextResponse) return ctx

  const parsed = updateAssetMetadataSchema.safeParse(rawBody)
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

  // Build payload that omits keys not present in the body — matches
  // the NR-D6b pack PATCH posture so .update() doesn't null-out
  // columns the user didn't touch.
  const payload: Record<string, unknown> = {}
  if (data.caption !== undefined) {
    payload.caption =
      data.caption !== null && data.caption.length > 0 ? data.caption : null
  }
  if (data.alt_text !== undefined) {
    payload.alt_text =
      data.alt_text !== null && data.alt_text.length > 0
        ? data.alt_text
        : null
  }
  if (data.is_trademark_asset !== undefined) {
    payload.is_trademark_asset = data.is_trademark_asset
  }

  const supabase = getSupabaseClient()
  const { data: updated, error: updateError } = await supabase
    .from('newsroom_assets')
    .update(payload)
    .eq('id', ctx.assetId)
    .select()
    .single()
  if (updateError || !updated) {
    logger.error(
      {
        route: ROUTE_PATCH,
        companyId: ctx.companyId,
        assetId: ctx.assetId,
        rawCode: updateError?.code,
        rawMessage: updateError?.message,
      },
      '[newsroom.assets.update] update failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  logger.info(
    {
      route: ROUTE_PATCH,
      companyId: ctx.companyId,
      packId: ctx.packId,
      assetId: ctx.assetId,
      authUserId: ctx.authUserId,
    },
    '[newsroom.assets.update] asset updated',
  )
  return NextResponse.json({ ok: true, asset: updated }, { status: 200 })
}

// ─── DELETE ────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; packSlug: string; assetId: string }> },
): Promise<NextResponse> {
  const ctx = await resolveAssetContext(request, context, ROUTE_DELETE)
  if (ctx instanceof NextResponse) return ctx

  const supabase = getSupabaseClient()

  // ── delete the row first; CASCADE drops scan_results ──
  // We delete the row before the storage object so a transient
  // storage failure leaves DB-side state correct and the orphan
  // bytes can be cleaned up by a future sweep. The reverse order
  // (storage delete first) would be worse: a DB-delete failure
  // after a successful storage-delete leaves a row pointing at
  // bytes that no longer exist.
  const { error: deleteError } = await supabase
    .from('newsroom_assets')
    .delete()
    .eq('id', ctx.assetId)
  if (deleteError) {
    logger.error(
      {
        route: ROUTE_DELETE,
        companyId: ctx.companyId,
        assetId: ctx.assetId,
        rawCode: deleteError.code,
        rawMessage: deleteError.message,
      },
      '[newsroom.assets.delete] db delete failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── best-effort storage cleanup ──
  // A storage-side failure here is logged + swallowed: the row is
  // gone, the asset is no longer referenceable, and orphan bytes
  // in object storage are an acceptable v1 cost (cleanup sweep is
  // a future housekeeping job).
  try {
    const adapter = getStorageAdapter()
    await adapter.delete(ctx.storageUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn(
      {
        route: ROUTE_DELETE,
        companyId: ctx.companyId,
        assetId: ctx.assetId,
        storageUrl: ctx.storageUrl,
        message,
      },
      '[newsroom.assets.delete] storage cleanup failed (orphan bytes accepted v1)',
    )
  }

  logger.info(
    {
      route: ROUTE_DELETE,
      companyId: ctx.companyId,
      packId: ctx.packId,
      assetId: ctx.assetId,
      authUserId: ctx.authUserId,
    },
    '[newsroom.assets.delete] asset deleted',
  )
  return new NextResponse(null, { status: 204 })
}
