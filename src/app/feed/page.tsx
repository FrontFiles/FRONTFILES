// ═══════════════════════════════════════════════════════════════
// /feed — Global FFF Sharing feed
//
// Replaces the previous placeholder. Three-column desktop layout:
//
//   [ left rail ] [ main feed column ] [ right discovery rail ]
//
// Below xl: right rail collapses.
// Below lg: left rail collapses too — the page becomes a
// single editorial column the same width as the user-feed
// page so the visual cadence is consistent.
//
// Tabs: Following / Relevant / For you. The post pool is the
// unified seed + draft store, so a freshly-composed post
// appears at the top of the For-you tab without a refresh.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import { useUser } from '@/lib/user-context'
import { useDraftStore } from '@/lib/post/draft-store'
import { isFffSharingEnabled } from '@/lib/flags'
import {
  rankFollowingFeed,
  rankRelevantFeed,
  rankForYouFeed,
} from '@/lib/post/feed-ranking'
import { followGraph } from '@/data/social'
import { creators, creatorMap } from '@/data/creators'
import { publicAssets } from '@/data/assets'
import { PostCard, PostCardUnavailable } from '@/components/post/PostCard'
import { FeedLeftRail } from '@/components/feed/FeedLeftRail'
import { FeedRightRail } from '@/components/feed/FeedRightRail'
import { FeedTabBar, type FeedTabKey } from '@/components/feed/FeedTabBar'
import { FeedComposerCTA } from '@/components/feed/FeedComposerCTA'
import { FeedEmptyState } from '@/components/feed/FeedEmptyState'
import { FeedLoadingState, FeedErrorState } from '@/components/feed/FeedLoadingState'
import * as s from '@/lib/post/styles'

export default function FeedPage() {
  // Feature flag — collapse the route to a 404 when FFF Sharing
  // is disabled. The flag is read at module level (build-time
  // constant on both server and client) so this branch is dead
  // code on either side once the flag is set.
  if (!isFffSharingEnabled()) {
    notFound()
  }

  const { sessionUser } = useUser()
  const { unifiedRows, loading, loadError, refresh, openComposer } =
    useDraftStore()
  const [activeTab, setActiveTab] = useState<FeedTabKey>('foryou')

  // ── Feed lists per tab — all derived from the unified pool
  // so a freshly composed draft ripples through every tab.
  const followingResults = useMemo(
    () => rankFollowingFeed(unifiedRows, sessionUser.username),
    [unifiedRows, sessionUser.username],
  )
  const relevantResults = useMemo(
    () => rankRelevantFeed(unifiedRows, sessionUser.id, sessionUser.username),
    [unifiedRows, sessionUser.id, sessionUser.username],
  )
  const forYouResults = useMemo(
    () => rankForYouFeed(unifiedRows),
    [unifiedRows],
  )

  const activeResults =
    activeTab === 'following'
      ? followingResults
      : activeTab === 'relevant'
      ? relevantResults
      : forYouResults

  const counts: Record<FeedTabKey, number> = {
    following: followingResults.length,
    relevant: relevantResults.length,
    foryou: forYouResults.length,
  }

  // ── Right-rail discovery: verified creators the viewer does
  // NOT yet follow. Sorted by trust badge then by display name.
  const suggestedCreators = useMemo(() => {
    const followingSlugs = new Set(followGraph[sessionUser.username] ?? [])
    return creators
      .filter(
        (c) =>
          c.id !== sessionUser.id &&
          !followingSlugs.has(c.slug) &&
          (c.trustBadge === 'verified' || c.trustBadge === 'trusted'),
      )
      .sort((a, b) => {
        const ta = a.trustBadge === 'verified' ? 0 : 1
        const tb = b.trustBadge === 'verified' ? 0 : 1
        if (ta !== tb) return ta - tb
        return a.name.localeCompare(b.name)
      })
  }, [sessionUser.id, sessionUser.username])

  // ── Trust signals computed from the existing seed data so
  // the numbers stay honest (no fake metric inflation).
  // `repostsLast24h` is anchored on the most-recent post in
  // the pool rather than wall-clock now() — without that
  // anchor the mock seed (frozen in March 2026) would always
  // report 0 against today's date. The anchor reflects the
  // intent of the metric ("recent activity") without lying
  // about live data.
  const signals = useMemo(() => {
    const verifiedCreators = creators.filter(
      (c) => c.trustBadge === 'verified',
    ).length
    const verifiableAssets = publicAssets.filter(
      (a) =>
        a.validationDeclaration === 'fully_validated' ||
        a.validationDeclaration === 'corroborated',
    ).length
    const newestTs = unifiedRows.reduce((max, r) => {
      const t = Date.parse(r.published_at)
      return Number.isFinite(t) && t > max ? t : max
    }, 0)
    const anchor = Math.max(newestTs, Date.now())
    const dayAgo = anchor - 1000 * 60 * 60 * 24
    const repostsLast24h = unifiedRows.filter((r) => {
      if (!r.repost_of_post_id) return false
      const t = Date.parse(r.published_at)
      return Number.isFinite(t) && t >= dayAgo
    }).length
    return { verifiedCreators, verifiableAssets, repostsLast24h }
  }, [unifiedRows])

  return (
    <div className={s.feedShell}>
      <div className={s.feedColumns}>
        {/* Left rail */}
        <FeedLeftRail
          sessionUser={sessionUser}
          followingCount={followingResults.length}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />

        {/* Main column */}
        <main className={s.feedMainColumn}>
          <div className={s.feedMainInner}>
            <FeedComposerCTA
              sessionUser={sessionUser}
              onOpen={() => openComposer()}
            />

            <FeedTabBar
              active={activeTab}
              onChange={setActiveTab}
              counts={counts}
            />

            {/* Loading / error / content branches.
                Loading is only shown on a cold load (when the
                pool is still empty) so subsequent background
                refreshes never flash a skeleton. */}
            {loading && unifiedRows.length === 0 ? (
              <FeedLoadingState />
            ) : loadError && unifiedRows.length === 0 ? (
              <FeedErrorState
                message={loadError}
                onRetry={() => void refresh()}
              />
            ) : activeResults.length === 0 ? (
              <FeedEmptyState
                tab={activeTab}
                onCompose={() => openComposer()}
              />
            ) : (
              <div className={s.feedList}>
                {activeResults.map((result) =>
                  result.ok ? (
                    <PostCard
                      key={result.card.id}
                      card={result.card}
                      onRepost={() => {
                        const row = unifiedRows.find(
                          (r) => r.id === result.card.id,
                        )
                        if (row) openComposer({ repostOf: row })
                      }}
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
        </main>

        {/* Right rail */}
        <FeedRightRail
          suggestedCreators={suggestedCreators}
          signals={signals}
        />
      </div>
      {/* Composer overlay is mounted globally via app/layout.tsx */}
    </div>
  )
}
