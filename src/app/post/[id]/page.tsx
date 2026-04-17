// ═══════════════════════════════════════════════════════════════
// /post/[id] — Post detail page
//
// Resolves a permalink to a single hydrated post. Layout:
//
//   ┌────────────────────────┐
//   │     Back · breadcrumb  │
//   │                        │
//   │       PostCard         │
//   │                        │
//   │  Reposts of this post  │
//   │     (rail of cards)    │
//   │                        │
//   │  More from {author}    │
//   │     (rail of cards)    │
//   └────────────────────────┘
//
// Reads from the unified draft+seed pool so a freshly composed
// post resolves at this URL too. Fail-closed: the same
// `PostCardUnavailable` placeholder used in PostsContent renders
// when hydration fails.
// ═══════════════════════════════════════════════════════════════

'use client'

import { use, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useDraftStore } from '@/lib/post/draft-store'
import { isFffSharingEnabled } from '@/lib/flags'
import { hydratePost } from '@/lib/post/hydrate'
import { PostCard, PostCardUnavailable } from '@/components/post/PostCard'
import { PostMetaStrip, type PostMetaChip } from '@/components/post/PostMetaStrip'
import { assetMap } from '@/data/assets'
import { storyMap } from '@/data/stories'
import { articleMap } from '@/data/articles'
import { collectionMap } from '@/data/collections'
import * as s from '@/lib/post/styles'
import type { PostRow } from '@/lib/db/schema'

// Build a small chip row from the underlying entity. Pure
// helper — keeps the page render clean and lets future surfaces
// reuse the same logic when they want a meta strip.
function buildMetaChips(row: PostRow): PostMetaChip[] {
  const chips: PostMetaChip[] = []

  switch (row.attachment_type) {
    case 'asset': {
      const a = assetMap[row.attachment_id]
      if (!a) break
      if (a.locationLabel) chips.push({ label: a.locationLabel })
      if (a.format) chips.push({ label: a.format })
      if (a.validationDeclaration === 'fully_validated') {
        chips.push({ label: 'Fully validated' })
      } else if (a.validationDeclaration === 'corroborated') {
        chips.push({ label: 'Corroborated' })
      }
      break
    }
    case 'story': {
      const s = storyMap[row.attachment_id]
      if (!s) break
      chips.push({ label: 'Story' })
      chips.push({ label: `${s.assetIds.length} assets` })
      break
    }
    case 'article': {
      const a = articleMap[row.attachment_id]
      if (!a) break
      chips.push({ label: 'Article' })
      if (a.wordCount) chips.push({ label: `${a.wordCount.toLocaleString('en-US')} words` })
      break
    }
    case 'collection': {
      const c = collectionMap[row.attachment_id]
      if (!c) break
      chips.push({ label: 'Collection' })
      chips.push({ label: `${c.assetIds.length} items` })
      break
    }
  }

  if (row.repost_of_post_id) chips.push({ label: 'Repost' })
  return chips
}

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Feature flag — collapse the route to a 404 when FFF
  // Sharing is disabled. Build-time constant; safe before hooks.
  if (!isFffSharingEnabled()) {
    notFound()
  }

  const { id } = use(params)
  const { unifiedRows, loading, loadError, refresh, openComposer } =
    useDraftStore()

  const handleRepost = useCallback(
    (postId: string) => {
      const row = unifiedRows.find((r) => r.id === postId)
      if (row) openComposer({ repostOf: row })
    },
    [unifiedRows, openComposer],
  )

  const detail = useMemo(() => {
    const row = unifiedRows.find((r) => r.id === id) ?? null
    if (!row) return { found: false as const }
    return { found: true as const, row, hydrated: hydratePost(row) }
  }, [unifiedRows, id])

  // Find every published repost of this post (one level up).
  const repostsOfThis = useMemo(() => {
    if (!detail.found) return []
    return unifiedRows
      .filter(
        (r) => r.status === 'published' && r.repost_of_post_id === id,
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .map(hydratePost)
  }, [unifiedRows, id, detail])

  // "More from {author}" — recent posts from the same author,
  // excluding the current one. Capped at 3 for editorial weight.
  const moreFromAuthor = useMemo(() => {
    if (!detail.found) return []
    return unifiedRows
      .filter(
        (r) =>
          r.status === 'published' &&
          r.author_user_id === detail.row.author_user_id &&
          r.id !== id,
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, 3)
      .map(hydratePost)
  }, [unifiedRows, id, detail])

  // Loading + error gate: show a skeleton while the unified
  // pool fetches for the first time, and surface a retry chip
  // if the API call failed. After the pool is loaded the
  // existing `NotFound` branch handles a genuinely missing id.
  if (loading && unifiedRows.length === 0) {
    return <DetailLoading id={id} />
  }
  if (loadError && unifiedRows.length === 0) {
    return <DetailError id={id} message={loadError} onRetry={() => void refresh()} />
  }
  if (!detail.found) {
    return <NotFound id={id} />
  }

  const authorUsername =
    detail.hydrated.ok ? detail.hydrated.card.author.username : null
  const authorDisplayName =
    detail.hydrated.ok ? detail.hydrated.card.author.displayName : 'this creator'

  return (
    <div className={s.feedShell}>
      <main className={s.feedMainColumn}>
        <div className={s.feedMainInner}>
          {/* Breadcrumb ─────────────────────────── */}
          <div className={s.feedHeader}>
            <div className={s.feedHeaderLabel}>
              <span>Post</span>
              <span className={s.feedHeaderCount}>· {id}</span>
            </div>
            <Link href="/feed" className={s.feedBackLink}>
              ← Back to feed
            </Link>
          </div>

          {/* The post itself ─────────────────────── */}
          {detail.hydrated.ok ? (
            <>
              <PostCard
                card={detail.hydrated.card}
                onRepost={() => handleRepost(detail.row.id)}
              />
              <PostMetaStrip chips={buildMetaChips(detail.row)} />
            </>
          ) : (
            <PostCardUnavailable
              placeholder={detail.hydrated.placeholder}
              reason={detail.hydrated.reason}
            />
          )}

          {/* Reposts of this post ───────────────── */}
          {repostsOfThis.length > 0 && (
            <section className="flex flex-col gap-3 mt-4">
              <div className={s.feedHeader}>
                <div className={s.feedHeaderLabel}>
                  <span>Reposts</span>
                  <span className={s.feedHeaderCount}>
                    {repostsOfThis.length}
                  </span>
                </div>
              </div>
              <div className={s.feedList}>
                {repostsOfThis.map((r) =>
                  r.ok ? (
                    <PostCard
                      key={r.card.id}
                      card={r.card}
                      onRepost={() => handleRepost(r.card.id)}
                    />
                  ) : (
                    <PostCardUnavailable
                      key={r.placeholder.id}
                      placeholder={r.placeholder}
                      reason={r.reason}
                    />
                  ),
                )}
              </div>
            </section>
          )}

          {/* More from this author ──────────────── */}
          {moreFromAuthor.length > 0 && authorUsername && (
            <section className="flex flex-col gap-3 mt-4">
              <div className={s.feedHeader}>
                <div className={s.feedHeaderLabel}>
                  <span>More from {authorDisplayName}</span>
                  <span className={s.feedHeaderCount}>
                    {moreFromAuthor.length}
                  </span>
                </div>
                <Link
                  href={`/creator/${authorUsername}/posts`}
                  className={s.feedBackLink}
                >
                  See all posts →
                </Link>
              </div>
              <div className={s.feedList}>
                {moreFromAuthor.map((r) =>
                  r.ok ? (
                    <PostCard
                      key={r.card.id}
                      card={r.card}
                      onRepost={() => handleRepost(r.card.id)}
                    />
                  ) : (
                    <PostCardUnavailable
                      key={r.placeholder.id}
                      placeholder={r.placeholder}
                      reason={r.reason}
                    />
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Not-found state ─────────────────────────────────────────

function NotFound({ id }: { id: string }) {
  return (
    <DetailShell id={id}>
      <div className={s.emptyStateShell}>
        <span className={s.emptyStateLabel}>Post not found</span>
        <p className={s.emptyStateHeadline}>
          We couldn&rsquo;t find a post with this id.
        </p>
        <p className={s.emptyStateHelper}>
          It may have been removed by the author, or the link may be stale. The Frontfiles feed never silently rewrites permalinks &mdash; if a post is no longer here, it has been intentionally taken down.
        </p>
      </div>
    </DetailShell>
  )
}

// ─── Loading + error ─────────────────────────────────────────

function DetailLoading({ id }: { id: string }) {
  return (
    <DetailShell id={id}>
      <div className={s.emptyStateShell}>
        <span className={s.emptyStateLabel}>Loading</span>
        <p className={s.emptyStateHeadline}>
          Fetching the post from Frontfiles…
        </p>
      </div>
    </DetailShell>
  )
}

function DetailError({
  id,
  message,
  onRetry,
}: {
  id: string
  message: string
  onRetry: () => void
}) {
  return (
    <DetailShell id={id}>
      <div className={s.emptyStateShell}>
        <span className={s.emptyStateLabel}>Couldn&rsquo;t load the post</span>
        <p className={s.emptyStateHeadline}>{message}</p>
        <p className={s.emptyStateHelper}>
          The Frontfiles API may be temporarily unavailable. Try again in a moment.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={s.composerEntryAction + ' mt-2'}
        >
          Retry
        </button>
      </div>
    </DetailShell>
  )
}

// Small wrapper so the three placeholder branches share the
// same breadcrumb chrome.
function DetailShell({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className={s.feedShell}>
      <main className={s.feedMainColumn}>
        <div className={s.feedMainInner}>
          <div className={s.feedHeader}>
            <div className={s.feedHeaderLabel}>
              <span>Post</span>
              <span className={s.feedHeaderCount}>· {id}</span>
            </div>
            <Link href="/feed" className={s.feedBackLink}>
              ← Back to feed
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

