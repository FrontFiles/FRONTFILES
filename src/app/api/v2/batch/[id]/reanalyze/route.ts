/**
 * POST /api/v2/batch/[id]/reanalyze — E6 §7.8
 *
 * Per E5 §6.3 re-cluster behavior + E5 §10.2 reset semantics.
 * Resets the clustering claim + fires fire-and-forget dispatch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isRealUploadEnabled } from '@/lib/flags'
import { resetBatchClusteringClaim } from '@/lib/processing/enqueue-clustering'
import { dispatchBatchClusteringForProcessing } from '@/lib/processing/batch-clustering-dispatcher'
import { getStorageAdapter } from '@/lib/storage'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isRealUploadEnabled()) return NextResponse.json({ code: 'not_enabled' }, { status: 503 })
  const { id: batchId } = await ctx.params
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json({ code: 'bad_request' }, { status: 400 })
  }
  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) return NextResponse.json({ code: 'unauthenticated' }, { status: 401 })

  // Reset the claim — only the batch's own creator can reset
  const reset = await resetBatchClusteringClaim(batchId, creatorId)
  if (!reset.ok) {
    return NextResponse.json({ code: 'not_found_or_not_owned' }, { status: 404 })
  }

  // Fire-and-forget dispatch
  dispatchBatchClusteringForProcessing(batchId, getStorageAdapter()).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(
      'reanalyze.dispatch: failed',
      JSON.stringify({ batch_id: batchId, error: err instanceof Error ? err.message : String(err) }),
    )
  })

  return NextResponse.json({ ok: true, batch_id: batchId }, { status: 202 })
}
