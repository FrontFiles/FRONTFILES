// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Post Row Hydration
//
// Joins a raw `PostRow` to its author + attachment preview and
// (for reposts) the hydrated parent card. Fails closed: if the
// attachment is missing / no longer public, or the author is
// missing, the hydrator returns a discriminated-union failure
// with a placeholder so the UI can render a short "removed"
// row without crashing the feed.
// ═══════════════════════════════════════════════════════════════

import type { PostRow } from '@/lib/db/schema'
import type { AssetFormat } from '@/lib/types'
import { assetMap } from '@/data/assets'
import { storyMap } from '@/data/stories'
import { articleMap } from '@/data/articles'
import { collectionMap } from '@/data/collections'
import { creatorMap } from '@/data/creators'
import { postMap, getPostRepostsOf } from '@/data/posts'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import type {
  PostAuthor,
  PostCard,
  HydratedPostAttachment,
  HydratedPostResult,
  HydrationFailureReason,
  PostCardPlaceholder,
} from './types'

// ─── Author resolution ────────────────────────────────────────

function resolveAuthor(userId: string): PostAuthor | null {
  const creator = creatorMap[userId]
  if (!creator) return null
  return {
    userId: creator.id,
    username: creator.slug,
    displayName: creator.name,
    // `Creator` has no `professionalTitle` column — it lives on
    // `CreatorProfileRow` in the identity store. The discovery
    // cards use `creator.bio` as the subtitle; for the post
    // author row we want a shorter "job title" line. Until the
    // full profile join lands we synthesise it from the first
    // bio fragment.
    professionalTitle: creator.bio.split('.')[0]?.trim() ?? '',
    trustBadge: creator.trustBadge,
    avatarUrl: creator.avatarRef ?? null,
  }
}

// ─── Attachment hydration ─────────────────────────────────────

type AttachmentHydration =
  | { ok: true; attachment: HydratedPostAttachment }
  | { ok: false; reason: 'attachment_missing' | 'attachment_not_public' }

function hydrateAttachment(row: PostRow): AttachmentHydration {
  const originalCreator = resolveAuthor(row.attachment_creator_user_id)
  if (!originalCreator) return { ok: false, reason: 'attachment_missing' }

  switch (row.attachment_type) {
    case 'asset': {
      const asset = assetMap[row.attachment_id]
      if (!asset) return { ok: false, reason: 'attachment_missing' }
      if (asset.privacyLevel !== 'PUBLIC')
        return { ok: false, reason: 'attachment_not_public' }
      return {
        ok: true,
        attachment: {
          kind: 'asset',
          id: asset.id,
          title: asset.title,
          // seed uses capitalised AssetFormat ('Photo'); the
          // domain type uses lowercase. Match the rest of the
          // codebase (creator-content.ts adapter).
          format: asset.format.toLowerCase() as AssetFormat,
          previewUrl: resolveProtectedUrl(asset.id, 'thumbnail') ?? null,
          originalCreator,
        },
      }
    }

    case 'story': {
      const story = storyMap[row.attachment_id]
      if (!story) return { ok: false, reason: 'attachment_missing' }
      const hero = assetMap[story.heroAssetId]
      return {
        ok: true,
        attachment: {
          kind: 'story',
          id: story.id,
          title: story.title,
          subtitle: story.dek,
          assetCount: story.assetIds.length,
          previewUrl: hero ? resolveProtectedUrl(hero.id, 'thumbnail') : null,
          originalCreator,
        },
      }
    }

    case 'article': {
      const article = articleMap[row.attachment_id]
      if (!article) return { ok: false, reason: 'attachment_missing' }
      const hero = assetMap[article.heroAssetId]
      return {
        ok: true,
        attachment: {
          kind: 'article',
          id: article.id,
          title: article.title,
          excerpt: article.dek,
          wordCount: article.wordCount,
          previewUrl: hero ? resolveProtectedUrl(hero.id, 'thumbnail') : null,
          originalCreator,
        },
      }
    }

    case 'collection': {
      const collection = collectionMap[row.attachment_id]
      if (!collection) return { ok: false, reason: 'attachment_missing' }
      const thumbs = collection.assetIds
        .slice(0, 4)
        .map((id) => assetMap[id])
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => resolveProtectedUrl(a.id, 'thumbnail'))
        .filter((url): url is string => !!url)
      return {
        ok: true,
        attachment: {
          kind: 'collection',
          id: collection.id,
          title: collection.title,
          itemCount: collection.assetIds.length,
          thumbnails: thumbs,
          originalCreator,
        },
      }
    }

    default:
      return { ok: false, reason: 'attachment_missing' }
  }
}

// ─── Social counter stubs ─────────────────────────────────────
//
// Module 4 renders a read-only PostActionBar with counts. Until
// Module 6 wires real comments and Module 7 wires writes, we
// derive simple deterministic counts from the seed: like count
// from a hash, repost count from the seed itself, comment count
// fixed to zero (no posts-comments yet).

function stubLikeCount(postId: string): number {
  let h = 0
  for (let i = 0; i < postId.length; i++) {
    h = (h * 31 + postId.charCodeAt(i)) >>> 0
  }
  return 4 + (h % 37)
}

// ─── Placeholder for failed hydration ─────────────────────────

function toPlaceholder(row: PostRow): PostCardPlaceholder {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    body: row.body,
    publishedAt: row.published_at,
    repostOfPostId: row.repost_of_post_id,
  }
}

// ─── Public entry points ─────────────────────────────────────

/**
 * Hydrate a single post row into a feed-ready `PostCard`.
 * For reposts, the parent is hydrated recursively one level
 * deep; a missing parent degrades gracefully to
 * `repostOf = null, repostOfRemoved = true` (the outer attachment
 * still renders because it is denormalised onto the repost row).
 */
export function hydratePost(row: PostRow): HydratedPostResult {
  const author = resolveAuthor(row.author_user_id)
  if (!author) {
    return {
      ok: false,
      reason: 'author_missing' as HydrationFailureReason,
      row,
      placeholder: toPlaceholder(row),
    }
  }

  const attachment = hydrateAttachment(row)
  if (!attachment.ok) {
    return {
      ok: false,
      reason: attachment.reason as HydrationFailureReason,
      row,
      placeholder: toPlaceholder(row),
    }
  }

  // Repost chain: one level deep. If the parent fails to hydrate,
  // we don't fail the outer card — we mark `repostOfRemoved` so
  // the UI can render a "quoted post removed" chip.
  let repostOf: PostCard | null = null
  let repostOfRemoved = false
  if (row.repost_of_post_id) {
    const parentRow = postMap[row.repost_of_post_id]
    if (!parentRow || parentRow.status !== 'published') {
      repostOfRemoved = true
    } else {
      const parentResult = hydratePost(parentRow)
      if (parentResult.ok) {
        // Drop the grandparent to keep nesting capped at 1 level.
        repostOf = { ...parentResult.card, repostOf: null }
      } else {
        repostOfRemoved = true
      }
    }
  }

  const repostCount = getPostRepostsOf(row.id).length

  const card: PostCard = {
    id: row.id,
    author,
    body: row.body,
    attachment: attachment.attachment,
    repostOf,
    repostOfRemoved,
    visibility: row.visibility,
    publishedAt: row.published_at,
    likeCount: stubLikeCount(row.id),
    commentCount: 0,
    repostCount,
    viewerLiked: false,
  }

  return { ok: true, card }
}

/**
 * Hydrate an array of rows. Failed rows become
 * `HydratedPostResult` failures in the same slot; callers can
 * filter them out or render placeholders.
 */
export function hydratePosts(rows: PostRow[]): HydratedPostResult[] {
  return rows.map(hydratePost)
}
