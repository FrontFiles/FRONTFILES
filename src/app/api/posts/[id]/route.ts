// ═══════════════════════════════════════════════════════════════
// /api/posts/[id] — Single post resolver
//
// GET    /api/posts/[id]   → raw row (404 if missing)
// DELETE /api/posts/[id]   → soft delete (status='removed')
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import { getPostRow, removePost } from '@/lib/post/store'
import {
  errorResponse,
  success,
  withInternalError,
} from '@/lib/post/api-helpers'
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
    const row = await getPostRow(id)
    if (!row) {
      return errorResponse('POST_NOT_FOUND', `Post ${id} not found.`, 404)
    }
    return success(row)
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withInternalError(async () => {
    if (!isFffSharingEnabled()) {
      return errorResponse('FEATURE_DISABLED', 'FFF Sharing is not enabled.', 404)
    }

    const { id } = await params

    // ── Authorization ─────────────────────────────────────
    //
    // Soft delete is author-scoped: only the post's author
    // can flip it to `removed`. We resolve the row first
    // because the owner check needs `author_user_id`.
    const viewerId = request.headers.get('x-frontfiles-user-id')
    if (!viewerId) {
      return errorResponse(
        'AUTH_REQUIRED',
        'Authentication required to delete posts.',
        401,
      )
    }
    const row = await getPostRow(id)
    if (!row) {
      return errorResponse('POST_NOT_FOUND', `Post ${id} not found.`, 404)
    }
    if (row.author_user_id !== viewerId) {
      return errorResponse(
        'FORBIDDEN_OWNER',
        'You can only delete posts you authored.',
        403,
      )
    }

    await removePost(id)
    return success({ id, status: 'removed' })
  })
}
