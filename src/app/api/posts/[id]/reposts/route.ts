// ═══════════════════════════════════════════════════════════════
// /api/posts/[id]/reposts — Reposts of a single post
//
// GET /api/posts/[id]/reposts → newest-first list of repost rows
//
// Powers the "Reposts" rail on the post detail page. Indexed
// by `idx_posts_repost_of` so it's a single seek even at scale.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import { getRepostsOfRows } from '@/lib/post/store'
import { errorResponse, success, withInternalError } from '@/lib/post/api-helpers'
import { isFffSharingEnabled } from '@/lib/flags'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withInternalError(async () => {
    if (!isFffSharingEnabled()) {
      return errorResponse('FEATURE_DISABLED', 'FFF Sharing is not enabled.', 404)
    }
    const { id } = await params
    const rows = await getRepostsOfRows(id)
    return success(rows)
  })
}
