/**
 * GET /api/v2/batch/[id]/ai-proposals — E6 §7.1
 *
 * Returns hydrated proposal + cluster state for a batch.
 * Honors users.ai_suggestions_opt_out (returns empty arrays + optedOut flag).
 */

import { NextRequest, NextResponse } from 'next/server'
import { isRealUploadEnabled } from '@/lib/flags'
import { hydrateBatchAiProposals } from '@/lib/ai-suggestions/hydration'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isRealUploadEnabled()) {
    return NextResponse.json(
      { code: 'not_enabled', detail: 'real upload pipeline is disabled' },
      { status: 503 },
    )
  }

  const { id: batchId } = await ctx.params
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json({ code: 'bad_request', detail: 'batch id must be a UUID' }, { status: 400 })
  }

  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) {
    return NextResponse.json({ code: 'unauthenticated' }, { status: 401 })
  }

  const result = await hydrateBatchAiProposals(batchId, creatorId)
  return NextResponse.json(result, { status: 200 })
}
