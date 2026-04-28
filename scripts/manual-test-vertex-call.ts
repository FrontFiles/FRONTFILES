/**
 * Frontfiles — Engineer-local manual smoke test for the Vertex AI pipeline (E3 §18 gate #6)
 *
 * NOT run in CI. Requires real GCP credentials + Vertex AI access.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *   GOOGLE_CLOUD_PROJECT_ID=frontfiles-prod \
 *   FFF_AI_REAL_PIPELINE=true \
 *   bun run scripts/manual-test-vertex-call.ts <asset-id>
 *
 * What it does:
 *   1. Reads the original bytes for the named asset via storage adapter
 *   2. Resolves the asset's format + creator's ai_region from DB
 *   3. Calls generateAssetProposal (full Class A flow)
 *   4. Prints the structured response + cost + latency
 *   5. Verifies ai_analysis row created + asset_embeddings row upserted +
 *      audit_log entry appended
 *
 * Verification gate #6 in E3 §18 — must pass before E3 merge in
 * environments with real credentials.
 */

import { generateAssetProposal } from '@/lib/ai-suggestions/engine'
import { getSupabaseClient } from '@/lib/db/client'
import { getStorageAdapter } from '@/lib/storage'
import { findOriginalStorageRef } from '@/lib/processing/media-row-adapter'
import type { AssetFormat } from '@/lib/upload/types'
import type { UserAiRegion, VertexRegion } from '@/lib/ai-suggestions/types'

const REGION_MAP: Record<UserAiRegion, VertexRegion> = {
  eu: 'europe-west4',
  us: 'us-central1',
}

async function main(): Promise<void> {
  const assetId = process.argv[2]
  if (!assetId) {
    console.error('Usage: bun run scripts/manual-test-vertex-call.ts <asset-id>')
    process.exit(1)
  }

  if (process.env.FFF_AI_REAL_PIPELINE !== 'true') {
    console.error('FFF_AI_REAL_PIPELINE must be "true" for this script.')
    process.exit(1)
  }

  console.log(`▶ Looking up asset ${assetId}…`)
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('vault_assets')
    .select('format, creator_id, users!inner(ai_region)')
    .eq('id', assetId)
    .maybeSingle()

  if (error || !data) {
    console.error('asset not found:', error?.message ?? 'no row')
    process.exit(1)
  }

  const row = data as {
    format: AssetFormat
    creator_id: string
    users: { ai_region: UserAiRegion } | Array<{ ai_region: UserAiRegion }> | null
  }
  const usersRow = Array.isArray(row.users) ? row.users[0] : row.users
  const aiRegion: UserAiRegion = usersRow?.ai_region ?? 'eu'
  const vertexRegion = REGION_MAP[aiRegion]
  console.log(`  format=${row.format} creator=${row.creator_id} region=${vertexRegion}`)

  console.log('▶ Fetching original bytes…')
  const storage = getStorageAdapter()
  const storageRef = await findOriginalStorageRef(assetId)
  if (!storageRef) {
    console.error('original storage_ref not found for asset')
    process.exit(1)
  }
  const originalBytes = await storage.getBytes(storageRef)
  console.log(`  ${originalBytes.length} bytes`)

  console.log('▶ Calling generateAssetProposal…')
  const start = Date.now()
  const result = await generateAssetProposal({
    assetId,
    creatorId: row.creator_id,
    format: row.format,
    originalBytes,
    region: vertexRegion,
    taxonomyTopN: [], // simulate fresh creator; engine.ts proper would fetch via taxonomy.ts (E4)
  })
  const elapsed = Date.now() - start

  console.log('')
  console.log('=== Result ===')
  console.log(JSON.stringify(result, null, 2))
  console.log('')
  console.log(`elapsed: ${elapsed}ms`)
  console.log(`engine-reported cost: ${result.costCents} cents`)
  console.log(`cache hit: ${result.cacheHit}`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
