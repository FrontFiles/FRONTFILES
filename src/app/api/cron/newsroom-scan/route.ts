// ═══════════════════════════════════════════════════════════════
// Frontfiles — Newsroom scan cron worker (NR-D7b, F9)
//
// Vercel Cron-driven worker. Picks up `pending`
// newsroom_asset_scan_results rows in batches of BATCH_SIZE,
// runs each through the scan pipeline (F5), and writes back the
// aggregated result via service-role.
//
// Schedule: 1-minute polling (vercel.json schedule
// "*/1 * * * *"). Each invocation processes at most BATCH_SIZE
// rows; the next tick picks up the rest. Idempotent UPDATE
// (`WHERE id = ? AND result = 'pending'`) so concurrent runs or
// repeated rows can't overwrite a finalized scan_result.
//
// Auth: Vercel Cron requests carry an `Authorization: Bearer
// ${SCANNER_CRON_SECRET}` header (Vercel's standard cron-secret
// pattern). The secret is required in production; dev allows
// missing for local testing (route returns 401, manual curl
// with the env var set passes through).
//
// Service-role for the UPDATE. The asset_scan_results table
// has no INSERT/UPDATE policies for authenticated; service-role
// bypasses RLS by default.
//
// Per-asset errors are logged and the batch continues — one bad
// asset doesn't poison subsequent ones in the same tick.
//
// Spec cross-references:
//   - directives/NR-D7b-scan-pipeline.md §F9
//   - src/lib/scanner/index.ts (F2 — factory)
//   - src/lib/newsroom/scan-pipeline.ts (F5 — orchestrator)
//   - src/lib/storage/index.ts (getStorageAdapter().getBytes)
//   - migration newsroom_asset_scan_results §2 (line 110)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { runScanPipeline } from '@/lib/newsroom/scan-pipeline'
import { getScannerAdapters } from '@/lib/scanner'
import { getStorageAdapter } from '@/lib/storage'

export const runtime = 'nodejs'

const ROUTE = 'GET /api/cron/newsroom-scan'
const BATCH_SIZE = 10

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

interface ScanRowJoin {
  id: string
  asset_id: string
  asset: {
    id: string
    pack_id: string
    kind: 'image' | 'video' | 'audio' | 'document' | 'text'
    mime_type: string
    storage_url: string
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  // ── Auth: Bearer SCANNER_CRON_SECRET ──
  const cronSecret = env.SCANNER_CRON_SECRET
  if (!cronSecret) {
    // Production env-schema requires the secret; this branch
    // fires in dev when the secret is unset. Reject so manual
    // testing requires explicit env setup.
    logger.warn(
      { route: ROUTE },
      '[newsroom.scan.cron] SCANNER_CRON_SECRET not set; rejecting',
    )
    return NextResponse.json(
      { ok: false, reason: 'unconfigured' },
      { status: 401 },
    )
  }
  const token = extractBearerToken(request)
  if (!token || token !== cronSecret) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }

  const supabase = getSupabaseClient()
  const adapters = getScannerAdapters()
  const storage = getStorageAdapter()

  // ── Fetch pending batch ──
  // PostgREST relationship-embed: scan_results → newsroom_assets
  // via the asset_id FK. Single FK (no ambiguity), so the embed
  // resolves cleanly.
  const { data: rowsRaw, error: fetchError } = await supabase
    .from('newsroom_asset_scan_results')
    .select(
      'id, asset_id, asset:newsroom_assets(id, pack_id, kind, mime_type, storage_url)',
    )
    .eq('result', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (fetchError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: fetchError.code,
        rawMessage: fetchError.message,
      },
      '[newsroom.scan.cron] pending fetch failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  const rows = (rowsRaw ?? []) as unknown as ReadonlyArray<ScanRowJoin>

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: true, processed: 0, results: [] },
      { status: 200 },
    )
  }

  // ── Per-row pipeline ──
  const results: Array<{
    assetId: string
    result: 'clean' | 'flagged' | 'error'
    flaggedCategories: ReadonlyArray<string>
    lastError?: string
  }> = []

  for (const row of rows) {
    const asset = row.asset
    if (!asset) {
      // Asset was deleted between SELECT and processing — skip.
      logger.warn(
        { route: ROUTE, scanRowId: row.id, assetId: row.asset_id },
        '[newsroom.scan.cron] asset row missing; skipping',
      )
      continue
    }
    try {
      const pipelineOutput = await runScanPipeline({
        asset: {
          kind: asset.kind,
          mime_type: asset.mime_type,
          storage_url: asset.storage_url,
        },
        adapters,
        fetchBytes: (storageRef) => storage.getBytes(storageRef),
      })

      const updatePayload: Record<string, unknown> = {
        result: pipelineOutput.result,
        flagged_categories: pipelineOutput.flaggedCategories,
        scanner_suite:
          pipelineOutput.scannerSuite || 'unscanned',
        scanner_version:
          pipelineOutput.scannerVersion || '0.0.0',
        last_error: pipelineOutput.lastError ?? null,
        scanned_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('newsroom_asset_scan_results')
        .update(updatePayload)
        // Idempotency guard: only update if still pending. A
        // concurrent run finishing the same row first leaves
        // this UPDATE matching zero rows — silent no-op.
        .eq('id', row.id)
        .eq('result', 'pending')
      if (updateError) {
        logger.error(
          {
            route: ROUTE,
            scanRowId: row.id,
            assetId: asset.id,
            rawCode: updateError.code,
            rawMessage: updateError.message,
          },
          '[newsroom.scan.cron] update failed',
        )
        results.push({
          assetId: asset.id,
          result: 'error',
          flaggedCategories: [],
          lastError: updateError.message,
        })
        continue
      }

      logger.info(
        {
          route: ROUTE,
          scanRowId: row.id,
          assetId: asset.id,
          packId: asset.pack_id,
          result: pipelineOutput.result,
          flaggedCategoriesCount:
            pipelineOutput.flaggedCategories.length,
          scannerSuite: pipelineOutput.scannerSuite,
        },
        '[newsroom.scan.cron] scanned',
      )
      results.push({
        assetId: asset.id,
        result: pipelineOutput.result as 'clean' | 'flagged' | 'error',
        flaggedCategories: pipelineOutput.flaggedCategories,
        lastError: pipelineOutput.lastError,
      })
    } catch (err) {
      // Defensive — pipeline catches per-adapter errors and
      // surfaces them as result='error', so this branch is
      // mostly for unforeseen runtime errors (network, DB
      // transient mid-pipeline). Log and continue the batch.
      const message = err instanceof Error ? err.message : String(err)
      logger.error(
        {
          route: ROUTE,
          scanRowId: row.id,
          assetId: asset.id,
          message,
        },
        '[newsroom.scan.cron] unexpected per-row error',
      )
      results.push({
        assetId: asset.id,
        result: 'error',
        flaggedCategories: [],
        lastError: message,
      })
    }
  }

  return NextResponse.json(
    { ok: true, processed: results.length, results },
    { status: 200 },
  )
}
