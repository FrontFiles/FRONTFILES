// ═══════════════════════════════════════════════════════════════
// /api/posts/feed — Most-recent-N posts across the platform
//
// GET /api/posts/feed?limit=100
//
// Bounded by `DEFAULT_FEED_LIMIT` so the wire payload stays
// small. A future pagination pass can add a `cursor` param.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import { listRecentPostRows, DEFAULT_FEED_LIMIT } from '@/lib/post/store'
import { errorResponse, success, withInternalError } from '@/lib/post/api-helpers'
import { isFffSharingEnabled } from '@/lib/flags'

export async function GET(request: NextRequest) {
  return withInternalError(async () => {
    if (!isFffSharingEnabled()) {
      return errorResponse('FEATURE_DISABLED', 'FFF Sharing is not enabled.', 404)
    }
    const { searchParams } = request.nextUrl
    const rawLimit = Number(searchParams.get('limit') ?? DEFAULT_FEED_LIMIT)
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, DEFAULT_FEED_LIMIT))
      : DEFAULT_FEED_LIMIT
    const rows = await listRecentPostRows(limit)
    return success(rows)
  })
}
