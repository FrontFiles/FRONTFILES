// ═══════════════════════════════════════════════════════════════
// /api/posts — FFF Sharing collection endpoint
//
// GET  /api/posts?authorUserId=…           → posts by author
// GET  /api/posts?attachmentType=…&attachmentId=…  → reverse lookup
// POST /api/posts                          → create original or repost
//
// All paths route through `lib/post/store.ts` so the dual-mode
// mock vs Supabase swap is handled in exactly one place. Server-
// only — the service-role client is never on the client bundle.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import {
  createPost,
  getAuthorPostRows,
  getPostsByAttachment,
} from '@/lib/post/store'
import type { PostAttachmentType } from '@/lib/db/schema'
import type { PostInput } from '@/lib/post/types'
import { errorResponse, success, withInternalError } from '@/lib/post/api-helpers'
import { hasGrant } from '@/lib/identity/guards'
import { isFffSharingEnabled } from '@/lib/flags'

// ─── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  return withInternalError(async () => {
    if (!isFffSharingEnabled()) {
      return errorResponse('FEATURE_DISABLED', 'FFF Sharing is not enabled.', 404)
    }
    const { searchParams } = request.nextUrl
    const authorUserId = searchParams.get('authorUserId')
    const attachmentType = searchParams.get('attachmentType') as
      | PostAttachmentType
      | null
    const attachmentId = searchParams.get('attachmentId')

    if (authorUserId) {
      const rows = await getAuthorPostRows(authorUserId)
      return success(rows)
    }

    if (attachmentType && attachmentId) {
      if (
        attachmentType !== 'asset' &&
        attachmentType !== 'story' &&
        attachmentType !== 'article' &&
        attachmentType !== 'collection'
      ) {
        return errorResponse(
          'INVALID_ATTACHMENT_TYPE',
          `Unknown attachment type "${attachmentType}".`,
        )
      }
      const rows = await getPostsByAttachment(attachmentType, attachmentId)
      return success(rows)
    }

    return errorResponse(
      'MISSING_QUERY',
      'Provide either ?authorUserId= or ?attachmentType=&attachmentId=.',
    )
  })
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  return withInternalError(async () => {
    if (!isFffSharingEnabled()) {
      return errorResponse('FEATURE_DISABLED', 'FFF Sharing is not enabled.', 404)
    }

    const body = await request.json()

    if (
      !body ||
      typeof body !== 'object' ||
      !body.authorId ||
      !body.attachment ||
      typeof body.body !== 'string'
    ) {
      return errorResponse(
        'INVALID_INPUT',
        'Expected { authorId, body, attachment, repostOf }.',
      )
    }

    // ── Authorization ─────────────────────────────────────
    //
    // Rule: the acting user must hold the `creator` grant. The
    // viewer id comes from the `x-frontfiles-user-id` header
    // (the same header the media route already trusts in this
    // prototype) — when real auth lands, swap this for the
    // session user id from the auth cookie. Until then we still
    // require the header so the endpoint is not silently open.
    //
    // Cross-author posts are NOT allowed: a viewer can only
    // create posts authored by themselves. This matches the
    // RLS policy planned for the `posts` table.
    const viewerId = request.headers.get('x-frontfiles-user-id')
    if (!viewerId) {
      return errorResponse(
        'AUTH_REQUIRED',
        'Authentication required to publish posts.',
        401,
      )
    }
    if (viewerId !== String(body.authorId)) {
      return errorResponse(
        'FORBIDDEN_AUTHOR',
        'You can only publish posts authored by yourself.',
        403,
      )
    }
    const isCreator = await hasGrant(viewerId, 'creator')
    if (!isCreator) {
      return errorResponse(
        'MISSING_GRANT',
        'Publishing requires a creator grant.',
        403,
      )
    }

    const input: PostInput = {
      authorId: String(body.authorId),
      body: String(body.body),
      attachment: {
        kind: body.attachment.kind,
        id: String(body.attachment.id),
        creatorUserId: String(body.attachment.creatorUserId ?? ''),
      },
      repostOf: body.repostOf ?? null,
    }

    const result = await createPost(input)
    if (!result.ok) {
      // 422 — typed validation failure. Echo the canonical error
      // codes so the composer renders inline messages without
      // mapping anything itself.
      return Response.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Post failed validation.',
            details: result.validation.errors,
          },
        },
        { status: 422 },
      )
    }
    return success(result.row, 201)
  })
}
