// ═══════════════════════════════════════════════════════════════
// scripts/process-derivatives.ts — PR 4
//
// CLI entry that:
//   1. Runs the reaper to reset stuck-processing rows back to pending
//   2. Queries asset_media for all generation_status='pending' rows
//   3. Dispatches each asset's pending derivatives through the pipeline
//
// Used by ops / cron / Vercel Scheduled Functions / Supabase pg_cron
// to run on a cadence. Each invocation is run-once (per IP-6: no
// long-lived process; the scheduler handles cadence).
//
// Invocation:
//   bun run scripts/process-derivatives.ts
//
// Exits with non-zero on operational failure (reaper crashed, DB
// unreachable, etc.). Per-asset processing failures are logged but
// do not exit non-zero — they're transient at the per-row level.
//
// In PR 4, NOT scheduled in any production environment. PR 5 staging
// cutover wires it into a cron / scheduled function.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import { getStorageAdapter } from '@/lib/storage'

import { reapStuckProcessingRows, reapStuckProposalRows } from '@/lib/processing/reaper'
import { dispatchAssetForProcessing } from '@/lib/processing/dispatcher'
import { dispatchAssetProposalForProcessing } from '@/lib/processing/proposal-dispatcher'

interface PendingAsset {
  assetId: string
}

async function main(): Promise<void> {
  // 1a. Reaper — derivative stuck-processing rows
  // eslint-disable-next-line no-console
  console.info('process-derivatives: starting derivative reaper')
  const reapedDerivatives = await reapStuckProcessingRows()
  // eslint-disable-next-line no-console
  console.info(
    `process-derivatives: derivative reaper reset ${reapedDerivatives.length} stuck row(s)`,
  )

  // 1b. Reaper — AI proposal stuck-processing rows (E4)
  const reapedProposals = await reapStuckProposalRows()
  // eslint-disable-next-line no-console
  console.info(
    `process-derivatives: proposal reaper reset ${reapedProposals.length} stuck row(s)`,
  )

  // 2a. Find pending derivative assets
  const pendingDerivatives = await findPendingAssets()
  // 2b. Find pending proposal assets (E4)
  const pendingProposals = await findPendingProposalAssets()
  // eslint-disable-next-line no-console
  console.info(
    `process-derivatives: pending — derivatives=${pendingDerivatives.length} proposals=${pendingProposals.length}`,
  )

  if (pendingDerivatives.length === 0 && pendingProposals.length === 0) return

  // 3. Dispatch each kind
  const storage = getStorageAdapter()

  let dispatchedDerivatives = 0
  let failedDerivatives = 0
  for (const asset of pendingDerivatives) {
    try {
      await dispatchAssetForProcessing(asset.assetId, storage)
      dispatchedDerivatives++
    } catch (err) {
      failedDerivatives++
      // eslint-disable-next-line no-console
      console.error(
        'process-derivatives: derivative_dispatch_failed',
        JSON.stringify({
          code: 'derivative_dispatch_failed',
          asset_id: asset.assetId,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    }
  }

  let dispatchedProposals = 0
  let failedProposals = 0
  for (const asset of pendingProposals) {
    try {
      await dispatchAssetProposalForProcessing(asset.assetId, storage)
      dispatchedProposals++
    } catch (err) {
      failedProposals++
      // eslint-disable-next-line no-console
      console.error(
        'process-derivatives: proposal_dispatch_failed',
        JSON.stringify({
          code: 'proposal_dispatch_failed',
          asset_id: asset.assetId,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    }
  }

  // eslint-disable-next-line no-console
  console.info(
    `process-derivatives: complete — derivatives=${dispatchedDerivatives}/${failedDerivatives} proposals=${dispatchedProposals}/${failedProposals}`,
  )
}

async function findPendingProposalAssets(): Promise<PendingAsset[]> {
  if (!isSupabaseConfigured()) return []
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('asset_proposals')
    .select('asset_id')
    .eq('generation_status', 'pending')
  if (error) {
    throw new Error(
      `process-derivatives: findPendingProposalAssets failed (${error.message})`,
    )
  }
  return ((data ?? []) as Array<{ asset_id: string }>).map(r => ({ assetId: r.asset_id }))
}

async function findPendingAssets(): Promise<PendingAsset[]> {
  if (!isSupabaseConfigured()) {
    // In mock mode, the script has nothing useful to do — there are
    // no real DB rows to find. Return empty; tests don't invoke this
    // script directly (they test reaper + dispatcher in isolation).
    return []
  }

  const client = getSupabaseClient()
  const { data, error } = await client
    .from('asset_media')
    .select('asset_id')
    .eq('generation_status', 'pending')

  if (error) {
    throw new Error(
      `process-derivatives: findPendingAssets failed (${error.message})`,
    )
  }

  // Distinct asset_ids — one asset may have multiple pending roles,
  // but dispatchAssetForProcessing handles all roles per asset.
  const seen = new Set<string>()
  const assets: PendingAsset[] = []
  for (const row of (data ?? []) as Array<{ asset_id: string }>) {
    if (seen.has(row.asset_id)) continue
    seen.add(row.asset_id)
    assets.push({ assetId: row.asset_id })
  }
  return assets
}

// Direct invocation guard — this file is meant to be run as a CLI,
// not imported. If imported, exports nothing.
if (require.main === module) {
  main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(
      'process-derivatives: fatal',
      JSON.stringify({
        code: 'fatal',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    process.exit(1)
  })
}
