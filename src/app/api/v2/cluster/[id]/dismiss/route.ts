/**
 * POST /api/v2/cluster/[id]/dismiss — E6 §7.7
 */

import { NextRequest, NextResponse } from 'next/server'
import { isRealUploadEnabled } from '@/lib/flags'
import { dismissCluster } from '@/lib/ai-suggestions/cluster-mutations'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isRealUploadEnabled()) return NextResponse.json({ code: 'not_enabled' }, { status: 503 })
  const { id: clusterId } = await ctx.params
  if (!UUID_RE.test(clusterId)) {
    return NextResponse.json({ code: 'bad_request' }, { status: 400 })
  }
  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) return NextResponse.json({ code: 'unauthenticated' }, { status: 401 })

  try {
    await dismissCluster({ clusterId, creatorId, surface: 'upload' })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not_found') || msg.includes('not_owned')) {
      return NextResponse.json({ code: 'not_found_or_not_owned' }, { status: 404 })
    }
    return NextResponse.json({ code: 'persistence_failed', detail: msg }, { status: 500 })
  }
}
