// ═══════════════════════════════════════════════════════════════
// FFF Sharing — PostsContent
//
// Tabbed feed component used by:
//   - `/creator/[handle]/posts` (full page)
//   - Eventually the post detail rail and home feed.
//
// Tabs (v1): Posts | Reposts | All — client-side filter over
// the hydrated feed the caller passes in.
//
// All chrome comes from `@/lib/post/styles`.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useMemo, useState } from 'react'
import type { HydratedPostResult } from '@/lib/post/types'
import * as s from '@/lib/post/styles'
import { PostCard, PostCardUnavailable } from '@/components/post/PostCard'

type PostsTab = 'posts' | 'reposts' | 'media' | 'all'

interface PostsContentProps {
  /** Hydrated feed for the creator this tab belongs to. */
  results: HydratedPostResult[]
  /** Display name — shown in the empty state copy. */
  creatorDisplayName: string
  /** When true, the tab bar is suppressed (embedded in another shell). */
  embedded?: boolean
  /**
   * Called with the post id when the viewer clicks Repost on a
   * card. Wiring is delegated to the parent so PostsContent
   * stays decoupled from the draft store; the page-level
   * component looks up the row and opens the composer.
   */
  onRepost?: (postId: string) => void
}

const TABS: { key: PostsTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'reposts', label: 'Reposts' },
  { key: 'media', label: 'Media' },
  { key: 'all', label: 'All' },
]

function matchesTab(result: HydratedPostResult, tab: PostsTab): boolean {
  if (tab === 'all') return true
  const repostOfId = result.ok
    ? result.card.repostOf?.id ?? (result.card.repostOfRemoved ? 'removed' : null)
    : result.placeholder.repostOfPostId
  const isRepost = repostOfId !== null
  if (tab === 'posts') return !isRepost
  if (tab === 'reposts') return isRepost
  if (tab === 'media') {
    // Media = posts whose attachment is visual (asset / story /
    // collection). Reposts are included when the attachment kind
    // matches — the criterion is about *what's being shared*,
    // not whether it originated with the author.
    if (!result.ok) return false
    const k = result.card.attachment.kind
    return k === 'asset' || k === 'story' || k === 'collection'
  }
  return true
}

export function PostsContent({
  results,
  creatorDisplayName,
  embedded = false,
  onRepost,
}: PostsContentProps) {
  const [activeTab, setActiveTab] = useState<PostsTab>('all')

  const counts = useMemo(() => {
    let posts = 0
    let reposts = 0
    let media = 0
    for (const r of results) {
      const repostOfId = r.ok
        ? r.card.repostOf?.id ?? (r.card.repostOfRemoved ? 'removed' : null)
        : r.placeholder.repostOfPostId
      if (repostOfId === null) posts++
      else reposts++
      if (r.ok) {
        const k = r.card.attachment.kind
        if (k === 'asset' || k === 'story' || k === 'collection') media++
      }
    }
    return { posts, reposts, media, all: results.length }
  }, [results])

  const filtered = useMemo(
    () => results.filter((r) => matchesTab(r, activeTab)),
    [results, activeTab],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      {!embedded && (
        <div className={s.tabBar}>
          <div className={s.tabBarInner}>
            {TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? counts.all
                  : tab.key === 'posts'
                  ? counts.posts
                  : tab.key === 'reposts'
                  ? counts.reposts
                  : counts.media
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={s.tabButton(activeTab === tab.key)}
                >
                  <span>{tab.label}</span>
                  <span className={s.tabButtonCount}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Feed */}
      {filtered.length === 0 ? (
        <PostsEmptyState
          tab={activeTab}
          creatorDisplayName={creatorDisplayName}
        />
      ) : (
        <div className={s.feedList}>
          {filtered.map((result) =>
            result.ok ? (
              <PostCard
                key={result.card.id}
                card={result.card}
                onRepost={onRepost ? () => onRepost(result.card.id) : undefined}
              />
            ) : (
              <PostCardUnavailable
                key={result.placeholder.id}
                placeholder={result.placeholder}
                reason={result.reason}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function PostsEmptyState({
  tab,
  creatorDisplayName,
}: {
  tab: PostsTab
  creatorDisplayName: string
}) {
  const message =
    tab === 'reposts'
      ? `${creatorDisplayName} hasn\u2019t reposted anything yet.`
      : tab === 'posts'
      ? `${creatorDisplayName} hasn\u2019t published any posts yet.`
      : tab === 'media'
      ? `${creatorDisplayName} hasn\u2019t shared any visual work yet.`
      : `No posts from ${creatorDisplayName} yet.`

  return (
    <div className={s.emptyStateShell}>
      <span className={s.emptyStateLabel}>No posts</span>
      <p className={s.emptyStateHeadline}>{message}</p>
      <p className={s.emptyStateHelper}>
        FFF Sharing posts must attach to a verified Frontfiles entity — an
        asset, Story, Article, or Collection.
      </p>
    </div>
  )
}
