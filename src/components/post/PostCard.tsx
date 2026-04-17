// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Post Card
//
// Top-level feed row for a single hydrated post. Composes:
//   - optional repost label (for reposts)
//   - PostAuthorRow (outer)
//   - optional body text (omitted entirely when empty — spec
//     "PostCard / Empty Body")
//   - either the attached Frontfiles entity (originals) or a
//     nested repost quote (1 level deep) + optional "removed"
//     placeholder
//   - PostActionBar (read-only)
//
// All chrome is centralized in `@/lib/post/styles`.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import type { PostCard as PostCardType } from '@/lib/types'
import type { PostCardPlaceholder } from '@/lib/post/types'
import * as s from '@/lib/post/styles'
import { PostAuthorRow } from './PostAuthorRow'
import { PostAttachmentEmbed } from './PostAttachmentEmbed'
import { PostActionBar } from './PostActionBar'

interface PostCardProps {
  card: PostCardType
  /**
   * When provided, the action bar's Repost button is active and
   * fires this callback. Feed surfaces wire it to
   * `useDraftStore().openComposer({ repostOf })`. Static / preview
   * surfaces (e.g. the composer's own live preview) omit it.
   */
  onRepost?: () => void
}

export function PostCard({ card, onRepost }: PostCardProps) {
  const isRepost = card.repostOf !== null || card.repostOfRemoved
  const hasBody = card.body.trim().length > 0

  // Choose the top-region gap based on frame variant:
  //   - original + body → 16px (spec section-gap)
  //   - original + empty body → 14px (spec empty-body collapse)
  //   - repost → 14px (spec body→nested)
  const topRegionClass = isRepost
    ? s.cardTopRegionRepost
    : hasBody
    ? s.cardTopRegion
    : s.cardTopRegionEmptyBody

  return (
    <article className={s.cardShell}>
      {isRepost && <RepostLabel />}

      <div className={topRegionClass}>
        <PostAuthorRow
          author={card.author}
          publishedAt={card.publishedAt}
        />

        {hasBody && (
          <div>
            <p className={s.postBody}>{card.body}</p>
          </div>
        )}

        {card.repostOf ? (
          <NestedRepost card={card.repostOf} />
        ) : card.repostOfRemoved ? (
          <>
            <RemovedQuote />
            <PostAttachmentEmbed attachment={card.attachment} />
          </>
        ) : (
          <PostAttachmentEmbed attachment={card.attachment} />
        )}
      </div>

      <PostActionBar
        postId={card.id}
        likeCount={card.likeCount}
        commentCount={card.commentCount}
        repostCount={card.repostCount}
        viewerLiked={card.viewerLiked}
        onRepost={onRepost}
      />
    </article>
  )
}

// ─── Repost label ────────────────────────────────────────────

function RepostLabel() {
  return (
    <div className={s.repostLabelWrap}>
      <svg
        className="w-3 h-3 text-[var(--post-text-meta)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m17 1 4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="m7 23-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
      <span className={s.repostLabelText}>Reposted on Frontfiles</span>
    </div>
  )
}

// ─── Nested repost block ─────────────────────────────────────
//
// Intentionally NOT wrapped in a single <Link> — the inner
// PostAuthorRow and PostAttachmentEmbed each contain their own
// <a> elements, and HTML forbids nesting <a> inside <a>. Nav
// to the post permalink happens via the "View post →" chip at
// the bottom of the card instead.

function NestedRepost({ card }: { card: PostCardType }) {
  const hasBody = card.body.trim().length > 0
  return (
    <div className={s.nestedShell}>
      <PostAuthorRow
        author={card.author}
        publishedAt={card.publishedAt}
        compact
      />

      {hasBody && <p className={s.postBodyCompact}>{card.body}</p>}

      <PostAttachmentEmbed attachment={card.attachment} compact />

      <div className={s.viewPostChipWrap}>
        <Link href={`/post/${card.id}`} className={s.viewPostChip.compact}>
          View post →
        </Link>
      </div>
    </div>
  )
}

// ─── Removed quote placeholder ───────────────────────────────

function RemovedQuote() {
  return (
    <div className={s.removedQuote}>
      <svg
        className={s.removedQuoteIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className={s.removedQuoteText}>Quoted post removed</p>
    </div>
  )
}

// ─── Failed-hydration fallback ───────────────────────────────

/**
 * Renders a minimal "post unavailable" row from a placeholder.
 * Used by feeds when `hydratePost` returned `ok: false`. Keeps
 * the feed auditable without pretending to show content that is
 * no longer public.
 */
export function PostCardUnavailable({
  placeholder,
  reason,
}: {
  placeholder: PostCardPlaceholder
  reason: string
}) {
  return (
    <article className={s.unavailableCard}>
      <p className={s.unavailableTitle}>Post unavailable</p>
      <p className={s.unavailableBody}>
        This post can no longer be rendered ({reason.replace(/_/g, ' ')}).
      </p>
      <p className={s.unavailableId}>
        {placeholder.id} · {placeholder.publishedAt}
      </p>
    </article>
  )
}
