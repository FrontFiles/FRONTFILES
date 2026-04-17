// ═══════════════════════════════════════════════════════════════
// Frontfiles — /api/v2/batch/[id]/commit (PR 1.2, dormant behind flag)
//
// POST /api/v2/batch/[id]/commit
//
// Atomically transitions the named batch from state='open' to
// state='committed'. The transition is performed by a single
// conditional UPDATE in the store so concurrent commit requests
// race for exactly one winner — the loser receives 409
// invalid_state.
//
// PR 1.2 scope:
//   - Transitions upload_batches state only
//   - Does NOT update vault_assets (assets carry no batch_id yet)
//   - Does NOT compute a V2CompletionSummary
//
// Those responsibilities land in PR 1.3 once /api/upload becomes
// batch-aware and assets actually belong to a batch.
//
// Behavior while FFF_REAL_UPLOAD=false (default): returns 503
// immediately.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

import { isRealUploadEnabled } from '@/lib/flags'
import { commitBatch } from '@/lib/upload/batch-service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Flag gate.
  if (!isRealUploadEnabled()) {
    return NextResponse.json(
      { code: 'not_enabled', detail: 'real upload pipeline is disabled' },
      { status: 503 },
    )
  }

  // 2. Validate the path parameter.
  const { id: batchId } = await ctx.params
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json(
      { code: 'bad_request', detail: 'batch id must be a UUID' },
      { status: 400 },
    )
  }

  // 3. Placeholder session.
  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) {
    return NextResponse.json(
      { code: 'unauthenticated' },
      { status: 401 },
    )
  }

  // 4. Commit.
  const result = await commitBatch({ batchId, creatorId })
  if (result.ok) {
    return NextResponse.json(
      {
        id: result.batch.id,
        state: result.batch.state,
        committed_at: result.batch.committedAt,
      },
      { status: 200 },
    )
  }

  const body: Record<string, unknown> = {
    code: result.code,
    detail: result.detail,
  }
  if (result.code === 'invalid_state' && result.currentState) {
    body.current_state = result.currentState
  }

  return NextResponse.json(body, { status: httpStatusFor(result.code) })
}

function httpStatusFor(code: 'not_found' | 'forbidden' | 'invalid_state' | 'persistence_failed'): number {
  if (code === 'not_found') return 404
  if (code === 'forbidden') return 403
  if (code === 'invalid_state') return 409
  return 500
}
