// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Service-layer types
//
// This module is the single import point for anything the
// post validator / hydrator / store / UI layer produces. Domain
// types (`Post`, `PostCard`, `PostAuthor`, …) are declared once
// in `src/lib/types.ts`; this file re-exports them alongside
// service-only types (validation errors, result unions).
// ═══════════════════════════════════════════════════════════════

import type { PostRow } from '@/lib/db/schema'
import type {
  Post,
  PostAttachmentRef,
  PostAttachmentKind,
  PostAuthor,
  PostCard,
  HydratedPostAttachment,
} from '@/lib/types'

// Re-exports so downstream code only ever imports from one place.
export type {
  Post,
  PostAttachmentRef,
  PostAttachmentKind,
  PostAuthor,
  PostCard,
  HydratedPostAttachment,
  PostRow,
}

// ─── Validation ────────────────────────────────────────────────

/**
 * Every reason the validator can refuse an input. Names match
 * the spec verbatim; API handlers (Module 8, deferred) will map
 * these 1:1 to HTTP responses so there's a stable error vocabulary.
 */
export type PostValidationErrorCode =
  | 'attachment_not_found'
  | 'attachment_not_public'
  | 'attachment_not_published'
  | 'body_too_long'
  | 'empty_original'
  | 'self_repost_forbidden'
  | 'duplicate_repost'

export interface PostValidationError {
  code: PostValidationErrorCode
  /** Human-readable message suitable for UI inline errors. */
  message: string
}

export type PostValidationResult =
  | { ok: true }
  | { ok: false; errors: PostValidationError[] }

/**
 * The shape the composer (Module 7, deferred) will pass to the
 * validator. Exposed now so the validator has a stable signature
 * before the composer lands.
 */
export interface PostInput {
  authorId: string
  body: string
  attachment: PostAttachmentRef
  /** Set when this input is a repost. */
  repostOf: PostRow | null
}

// ─── Hydration ─────────────────────────────────────────────────

/**
 * Discriminated union returned by `hydratePost`.
 *
 * Fail-closed: if the attachment can't be resolved, was removed,
 * or is no longer public, the hydrator returns `ok: false` with a
 * reason code AND a `placeholder` card the feed can render in
 * place of the missing content. The feed NEVER crashes on a
 * missing attachment.
 */
export type HydratedPostResult =
  | { ok: true; card: PostCard }
  | {
      ok: false
      reason: HydrationFailureReason
      row: PostRow
      placeholder: PostCardPlaceholder
    }

export type HydrationFailureReason =
  | 'author_missing'
  | 'attachment_missing'
  | 'attachment_not_public'

/**
 * A placeholder card body used when hydration fails but we still
 * want the feed row to render (it makes the row auditable).
 *
 * This is deliberately NOT a `PostCard` — the feed component
 * branches on the result shape and renders a short, editorial
 * "quoted attachment removed" block.
 */
export interface PostCardPlaceholder {
  id: string
  authorUserId: string
  body: string
  publishedAt: string
  repostOfPostId: string | null
}
