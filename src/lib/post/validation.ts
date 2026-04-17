// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Post Input Validation
//
// Single enforcement point for the "only Frontfiles content,
// preserve attribution, no consumer-social shortcuts" rules.
// Called by the composer (Module 7, deferred) and the API routes
// (Module 8, deferred); covered by vitest right now so the rules
// are locked before any write path lands.
// ═══════════════════════════════════════════════════════════════

import { assetMap } from '@/data/assets'
import { storyMap } from '@/data/stories'
import { articleMap } from '@/data/articles'
import { collectionMap } from '@/data/collections'
import { postRows } from '@/data/posts'
import type { PostRow } from '@/lib/db/schema'
import type {
  PostInput,
  PostValidationError,
  PostValidationErrorCode,
  PostValidationResult,
} from './types'

/**
 * Max body length. Mirrors the SQL CHECK in
 * `20260416000002_post_tables.sql`. If you change this, change
 * the CHECK too or the DB will be stricter than the validator.
 */
export const POST_BODY_MAX = 600

function error(
  code: PostValidationErrorCode,
  message: string,
): PostValidationError {
  return { code, message }
}

// ─── Attachment existence / privacy checks ────────────────────
//
// For assets we can check `privacyLevel === 'PUBLIC'` against the
// seed row directly (AssetData carries it). Stories / articles /
// collections don't model privacy in the current seed shape —
// they're treated as published once they exist in the seed map.
// When those tables land (Phase 2 of the DB schema), wire the
// real privacy / publication checks here.

type AttachmentCheck =
  | { ok: true; creatorUserId: string }
  | { ok: false; code: PostValidationErrorCode; message: string }

function checkAttachment(
  kind: PostInput['attachment']['kind'],
  id: string,
): AttachmentCheck {
  switch (kind) {
    case 'asset': {
      const asset = assetMap[id]
      if (!asset)
        return {
          ok: false,
          code: 'attachment_not_found',
          message: 'This asset could not be found on Frontfiles.',
        }
      if (asset.privacyLevel !== 'PUBLIC')
        return {
          ok: false,
          code: 'attachment_not_public',
          message: 'This asset is not public and can\u2019t be shared.',
        }
      return { ok: true, creatorUserId: asset.creatorId }
    }

    case 'story': {
      const story = storyMap[id]
      if (!story)
        return {
          ok: false,
          code: 'attachment_not_found',
          message: 'This Story could not be found on Frontfiles.',
        }
      return { ok: true, creatorUserId: story.creatorId }
    }

    case 'article': {
      const article = articleMap[id]
      if (!article)
        return {
          ok: false,
          code: 'attachment_not_found',
          message: 'This Article could not be found on Frontfiles.',
        }
      // Articles can be multi-source; pick the first source creator
      // as the canonical "attachment creator". Matches how the
      // creator-content adapter binds articles to a creator.
      const primary = article.sourceCreatorIds[0]
      if (!primary)
        return {
          ok: false,
          code: 'attachment_not_published',
          message: 'This Article has no attributed creators yet.',
        }
      return { ok: true, creatorUserId: primary }
    }

    case 'collection': {
      const collection = collectionMap[id]
      if (!collection)
        return {
          ok: false,
          code: 'attachment_not_found',
          message: 'This Collection could not be found on Frontfiles.',
        }
      return { ok: true, creatorUserId: collection.curatorId }
    }

    default:
      // Exhaustiveness — TS will flag when we add a new kind.
      return {
        ok: false,
        code: 'attachment_not_found',
        message: 'Unknown attachment kind.',
      }
  }
}

// ─── Main entry point ─────────────────────────────────────────

/**
 * Validate a prospective post input. Returns a discriminated
 * union — `ok: true` is success; `ok: false` carries one or more
 * typed errors.
 *
 * The validator never throws. All failures are expressed in the
 * returned error list so the UI can render inline field errors
 * and the API can map each code to an HTTP response.
 *
 * @param input the prospective post
 * @param existingRows row set used for the duplicate-repost
 *   probe. Mock mode passes the static seed (default); Supabase
 *   mode passes a freshly-fetched snapshot of the author's
 *   repost history. The SQL `uq_posts_author_repost_unique`
 *   partial index is the ultimate guard, so this check is a
 *   user-friendly pre-flight rather than the security boundary.
 */
export function validatePostInput(
  input: PostInput,
  existingRows: PostRow[] = postRows,
): PostValidationResult {
  const errors: PostValidationError[] = []

  // 1. Body length — checked first so a too-long body surfaces
  // alongside any other issue in a single pass.
  if (input.body.length > POST_BODY_MAX) {
    errors.push(
      error(
        'body_too_long',
        `Your post is ${input.body.length} characters. The limit is ${POST_BODY_MAX}.`,
      ),
    )
  }

  // 2. Attachment existence / visibility.
  const check = checkAttachment(input.attachment.kind, input.attachment.id)
  if (!check.ok) {
    errors.push(error(check.code, check.message))
  }

  // 3. Empty-body rule for originals.
  //
  // Originals with an empty body ARE allowed (silent share) —
  // that seed case (post-005) is explicitly required by the
  // spec. However, attachment existence is mandatory for every
  // post; "empty body + invalid attachment" is the combination
  // we fail on. We encode that as `empty_original` which fires
  // when `repostOf` is null AND the attachment could not be
  // resolved AND the body is empty — i.e. there is literally
  // nothing to post.
  const bodyEmpty = input.body.trim().length === 0
  if (input.repostOf === null && bodyEmpty && !check.ok) {
    errors.push(
      error(
        'empty_original',
        'Write a message or attach a Frontfiles entity to post.',
      ),
    )
  }

  // 4. Repost-specific rules.
  if (input.repostOf !== null) {
    const parent = input.repostOf

    // 4a. Can't repost your own post.
    if (parent.author_user_id === input.authorId) {
      errors.push(
        error(
          'self_repost_forbidden',
          'You can\u2019t repost your own post.',
        ),
      )
    }

    // 4b. Can't repost the same parent twice.
    //
    // The validator runs against the row set passed by the
    // store: mock mode passes the static seed, Supabase mode
    // passes a freshly-fetched snapshot. The partial unique
    // index `uq_posts_author_repost_unique` enforces the same
    // rule at the SQL level — this client-side probe just gives
    // a typed error code instead of a 23505 constraint violation.
    const alreadyReposted = existingRows.some(
      (p) =>
        p.status === 'published' &&
        p.author_user_id === input.authorId &&
        p.repost_of_post_id === parent.id,
    )
    if (alreadyReposted) {
      errors.push(
        error(
          'duplicate_repost',
          'You have already reposted this post.',
        ),
      )
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
