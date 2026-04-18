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
import * as z from 'zod' // namespace import — see src/lib/env.ts comment
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
import { parseBody } from '@/lib/api/validation'
import {
  checkWriteActionRate,
  buildWriteRateLimitResponse,
} from '@/lib/rate-limit'

// ─── Request schema ──────────────────────────────────────────────
//
// Body contract for POST /api/posts. Enforces the canonical
// attachment kinds (asset | story | article | collection) at
// parse time so the handler doesn't need a secondary enum check.

const CreatePostBody = z.object({
  authorId: z.string().min(1),
  body: z.string().max(5000),
  attachment: z.object({
    kind: z.enum(['asset', 'story', 'article', 'collection']),
    id: z.string().min(1),
    creatorUserId: z.string(),
  }),
  // `repostOf` is a full PostRow snapshot the client sends with the
  // request (see src/lib/post/client.ts). It's accepted as-is here
  // and passed through to createPost, which uses
  // `input.repostOf.id` + `input.repostOf.author_user_id` etc.
  // TODO: extract a shared PostRow Zod schema so this becomes a
  // structural validation instead of a passthrough.
  repostOf: z.any().nullable().optional(),
})

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

    // 1. Identity: viewer must be authenticated.
    //    Header-based for now; replaced by session cookie when
    //    real auth lands in Phase 4.
    const viewerId = request.headers.get('x-frontfiles-user-id')
    if (!viewerId) {
      return errorResponse(
        'AUTH_REQUIRED',
        'Authentication required to publish posts.',
        401,
      )
    }

    // 2. Rate limit — protect against post spam by known actor.
    const rate = checkWriteActionRate({
      actorId: viewerId,
      actionType: 'post.create',
    })
    if (!rate.allowed) {
      return buildWriteRateLimitResponse(rate.retryAfterSeconds ?? 30, rate.exceededLimit)
    }

    // 3. Zod validation — types, presence, attachment kind enum.
    const [body, parseErr] = await parseBody(
      request,
      CreatePostBody,
      'POST /api/posts',
    )
    if (parseErr) return parseErr

    // 4. Authorization:
    //    - Cross-author posts are NOT allowed (viewer === authorId).
    //    - Viewer must hold the `creator` grant.
    //    Matches the planned RLS policy for the `posts` table.
    if (viewerId !== body.authorId) {
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
      authorId: body.authorId,
      body: body.body,
      attachment: {
        kind: body.attachment.kind,
        id: body.attachment.id,
        creatorUserId: body.attachment.creatorUserId,
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
