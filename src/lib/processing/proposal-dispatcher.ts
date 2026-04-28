/**
 * Frontfiles — AI Proposal Dispatcher (Class A worker entry, E4)
 *
 * Per AI-PIPELINE-BRIEF.md v2 §4.2 + E1.5 §3.2 + E4-DIRECTIVE.md §8.
 *
 * Called from:
 *   - commit-service.ts (fire-and-forget on asset commit)
 *   - scripts/process-derivatives.ts (loop over pending asset_proposals)
 *
 * Lifecycle:
 *   pending → processing (CAS-style claim)
 *     → fetch asset format + creator's ai_region + tag taxonomy
 *     → fetch original bytes via storage bridge
 *     → engine.generateAssetProposal (image-prep + adapter + cache + ...)
 *     → UPDATE asset_proposals → 'ready' with field values
 *     → write proposal_generated audit event
 *   on exception:
 *     retry_count < 1 → back to pending (next worker tick retries)
 *     retry_count ≥ 1 → status='failed'
 *
 * Region resolution: users.ai_region (eu/us) → VertexRegion.
 *
 * SERVER-ONLY.
 */

import type { StorageAdapter as LowLevelStorage } from '@/lib/storage'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import { generateAssetProposal } from '@/lib/ai-suggestions/engine'
import { fetchCreatorTagTaxonomy } from '@/lib/ai-suggestions/taxonomy'
import { writeAuditEvent } from '@/lib/ai-suggestions/audit'
import { getEffectiveSettings } from '@/lib/ai-suggestions/settings'
import type { UserAiRegion, VertexRegion } from '@/lib/ai-suggestions/types'
import type { AssetFormat } from '@/lib/upload/types'
import { findOriginalStorageRef } from './media-row-adapter'

const IMAGE_FORMATS: ReadonlySet<AssetFormat> = new Set([
  'photo',
  'illustration',
  'infographic',
  'vector',
])

const REGION_MAP: Record<UserAiRegion, VertexRegion> = {
  eu: 'europe-west4',
  us: 'us-central1',
}

interface ProposalDispatchLookup {
  format: AssetFormat
  creatorId: string
  aiRegion: UserAiRegion
}

export async function dispatchAssetProposalForProcessing(
  assetId: string,
  storage: LowLevelStorage,
): Promise<void> {
  // Mock-mode: nothing to dispatch (no DB rows to claim).
  if (!isSupabaseConfigured()) return

  const supabase = getSupabaseClient()

  // 1. Atomic claim: pending → processing (only if currently pending)
  const claim = await supabase
    .from('asset_proposals')
    .update({
      generation_status: 'processing',
      processing_started_at: new Date().toISOString(),
    })
    .eq('asset_id', assetId)
    .eq('generation_status', 'pending') // CAS — fails silently if status changed
    .select('asset_id, retry_count')
    .maybeSingle()

  if (claim.error || !claim.data) {
    // Either asset not found, or already processing/ready/failed.
    // No-op (idempotent).
    return
  }

  const retryCount = (claim.data as { retry_count: number }).retry_count

  try {
    // 2. Lookup asset format + creator + ai_region
    const lookup = await lookupAssetForProposalDispatch(assetId)
    if (!lookup) {
      throw new Error('asset_not_found')
    }

    // 3. Defensive image-format gate (enqueue should have set
    //    'not_applicable' for non-image formats, but double-check)
    if (!IMAGE_FORMATS.has(lookup.format)) {
      await supabase
        .from('asset_proposals')
        .update({
          generation_status: 'not_applicable',
          processing_started_at: null,
          error: `format ${lookup.format} not supported in v1`,
        })
        .eq('asset_id', assetId)
      return
    }

    // 4. Fetch original bytes (engine handles image-prep internally)
    const storageRef = await findOriginalStorageRef(assetId)
    if (!storageRef) {
      throw new Error('original_not_found')
    }
    const originalBytes = await storage.getBytes(storageRef)

    // 5. Tag taxonomy injection
    const settings = await getEffectiveSettings()
    const taxonomyTopN = await fetchCreatorTagTaxonomy(
      lookup.creatorId,
      settings.tag_taxonomy_top_n,
    )

    // 6. Resolve VertexRegion from UserAiRegion
    const vertexRegion = REGION_MAP[lookup.aiRegion]

    // 7. Engine call — full Class A orchestration
    const result = await generateAssetProposal({
      assetId,
      creatorId: lookup.creatorId,
      format: lookup.format,
      originalBytes,
      region: vertexRegion,
      taxonomyTopN,
    })

    // 8. UPDATE asset_proposals → 'ready'
    await supabase
      .from('asset_proposals')
      .update({
        generation_status: 'ready',
        processing_started_at: null,
        caption: result.visionResponse.caption,
        caption_confidence: result.visionResponse.caption_confidence,
        keywords: result.visionResponse.keywords,
        keywords_confidence: result.visionResponse.keywords_confidence,
        tags: result.visionResponse.tags,
        tags_confidence: result.visionResponse.tags_confidence,
        model_version: result.modelVersion,
        generation_cost_cents: result.costCents,
        generation_latency_ms: result.latencyMs,
        region: vertexRegion,
        error: null,
      })
      .eq('asset_id', assetId)

    // 9. Field-grain audit
    await writeAuditEvent({
      asset_id: assetId,
      creator_id: lookup.creatorId,
      event_type: 'proposal_generated',
      surface: 'system',
      after_value: {
        caption: result.visionResponse.caption,
        keywords: result.visionResponse.keywords,
        tags: result.visionResponse.tags,
      },
    })
  } catch (err) {
    // Retry-once policy per E1 v2 §3 E5
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (retryCount < 1) {
      // Reset to pending; next worker tick retries
      await supabase
        .from('asset_proposals')
        .update({
          generation_status: 'pending',
          processing_started_at: null,
          retry_count: retryCount + 1,
          error: errorMessage,
        })
        .eq('asset_id', assetId)
    } else {
      // Mark failed
      await supabase
        .from('asset_proposals')
        .update({
          generation_status: 'failed',
          processing_started_at: null,
          retry_count: retryCount + 1,
          error: errorMessage,
        })
        .eq('asset_id', assetId)
    }
  }
}

async function lookupAssetForProposalDispatch(
  assetId: string,
): Promise<ProposalDispatchLookup | null> {
  if (!isSupabaseConfigured()) {
    return {
      format: 'photo',
      creatorId: '00000000-0000-0000-0000-000000000001',
      aiRegion: 'eu',
    }
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('vault_assets')
    .select('format, creator_id, users!inner(ai_region)')
    .eq('id', assetId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    format: AssetFormat
    creator_id: string
    users:
      | { ai_region: UserAiRegion }
      | Array<{ ai_region: UserAiRegion }>
      | null
  }
  const usersRow = Array.isArray(row.users) ? row.users[0] : row.users
  return {
    format: row.format,
    creatorId: row.creator_id,
    aiRegion: usersRow?.ai_region ?? 'eu',
  }
}
