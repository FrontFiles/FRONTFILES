/**
 * POST /api/v2/asset/[id]/proposal/regenerate — E6 §7.5
 *
 * Body: { surface: AuditSurface }
 *
 * Resets the proposal row to pending; fires fire-and-forget dispatch.
 * Returns 202.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isRealUploadEnabled } from '@/lib/flags'
import { regenerateProposal } from '@/lib/ai-suggestions/proposal-mutations'
import { dispatchAssetProposalForProcessing } from '@/lib/processing/proposal-dispatcher'
import { getStorageAdapter } from '@/lib/storage'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_SURFACES: ReadonlySet<string> = new Set([
  'upload',
  'vault_edit',
  'bulk_action',
  'system',
])

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isRealUploadEnabled()) {
    return NextResponse.json({ code: 'not_enabled' }, { status: 503 })
  }
  const { id: assetId } = await ctx.params
  if (!UUID_RE.test(assetId)) {
    return NextResponse.json({ code: 'bad_request' }, { status: 400 })
  }
  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) return NextResponse.json({ code: 'unauthenticated' }, { status: 401 })

  let body: { surface?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'bad_request' }, { status: 400 })
  }
  if (!body.surface || !VALID_SURFACES.has(body.surface)) {
    return NextResponse.json({ code: 'bad_request', detail: 'invalid surface' }, { status: 400 })
  }

  await regenerateProposal({
    assetId,
    creatorId,
    surface: body.surface as 'upload' | 'vault_edit' | 'bulk_action' | 'system',
  })

  // Fire-and-forget — the next worker tick (or this dispatch) re-runs the engine.
  dispatchAssetProposalForProcessing(assetId, getStorageAdapter()).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(
      'regenerate.dispatch: failed',
      JSON.stringify({ asset_id: assetId, error: err instanceof Error ? err.message : String(err) }),
    )
  })

  return NextResponse.json({ ok: true, asset_id: assetId }, { status: 202 })
}
