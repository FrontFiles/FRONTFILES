// ═══════════════════════════════════════════════════════════════
// /creator/[handle]/posts — User feed page (FFF Sharing)
//
// Sibling of `/creator/[handle]/frontfolio`. Mirrors its live
// portfolio-shell fetch + stale-handle pattern exactly so that
// navigating between `/creator/a/posts` and `/creator/b/posts`
// never flashes the previous creator's content.
//
// This is a public-facing professional publishing surface — the
// single page where a creator's entire FFF Sharing identity
// shows up. The header strip calls that out explicitly so the
// page reads as "this is where {creator} publishes" rather than
// a generic profile tab.
// ═══════════════════════════════════════════════════════════════

'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProfileLeftRail } from '@/components/platform/ProfileLeftRail'
import { PostsContent } from '@/components/platform/PostsContent'
import { useUser } from '@/lib/user-context'
import { useDraftStore } from '@/lib/post/draft-store'
import { isFffSharingEnabled } from '@/lib/flags'
import { getConnectionState } from '@/data'
import { buildCreatorProfileFromShell } from '@/data/profiles'
import { getCreatorPortfolioShellByHandle } from '@/lib/identity/store'
import type { UserWithFacets } from '@/lib/identity/types'
import type { CreatorProfile } from '@/lib/types'
import type { HydratedPostResult } from '@/lib/post/types'
import { hydratePosts } from '@/lib/post/hydrate'
import {
  FeedLoadingState,
  FeedErrorState,
} from '@/components/feed/FeedLoadingState'
import * as s from '@/lib/post/styles'

export default function CreatorPostsPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  // Feature flag — collapse to a 404 when FFF Sharing is
  // disabled. Build-time constant; safe before hooks.
  if (!isFffSharingEnabled()) {
    notFound()
  }

  const { handle } = use(params)
  const { sessionUser } = useUser()
  const { unifiedRows, loading: feedLoading, loadError: feedError, refresh, openComposer } =
    useDraftStore()

  // ── ALL hooks declared up front. Early returns happen at the
  // bottom of this hooks block so the hooks order is stable
  // across the loading → loaded transition. React enforces
  // hooks-order invariance and a `useMemo` after a conditional
  // return will trip the rules-of-hooks linter at runtime.
  const [shell, setShell] = useState<UserWithFacets | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCreatorPortfolioShellByHandle(handle).then((s) => {
      if (cancelled) return
      setShell(s)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [handle])

  // Stale-handle guard — see frontfolio/page.tsx for the full
  // rationale. Derive staleness during render; never reset state
  // inside the effect body.
  const isStale = shell !== null && shell.user.username !== handle

  const profile: CreatorProfile | null = shell
    ? buildCreatorProfileFromShell(shell)
    : null
  const creatorId: string | null = shell?.user.id ?? null

  // Hydrate the author feed from the unified pool. Memoised so
  // identity is cheap on every re-render.
  const rows = useMemo(() => {
    if (!creatorId) return []
    return unifiedRows
      .filter(
        (r) =>
          r.author_user_id === creatorId && r.status === 'published',
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
  }, [unifiedRows, creatorId])

  const results: HydratedPostResult[] = useMemo(
    () => hydratePosts(rows),
    [rows],
  )

  const counts = useMemo(() => {
    let originals = 0
    let reposts = 0
    for (const row of rows) {
      if (row.repost_of_post_id) reposts++
      else originals++
    }
    return { originals, reposts, total: rows.length }
  }, [rows])

  const handleRepost = useCallback(
    (postId: string) => {
      const row = unifiedRows.find((r) => r.id === postId)
      if (row) openComposer({ repostOf: row })
    },
    [unifiedRows, openComposer],
  )

  // ── Early returns AFTER all hooks ─────────────────────────
  if (!loaded || isStale) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Loading posts…
          </p>
        </div>
      </div>
    )
  }

  if (!profile || !creatorId) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-sm font-bold uppercase tracking-widest text-black">
            Creator not found
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            No profile matches the handle &ldquo;{handle}&rdquo;
          </p>
        </div>
      </div>
    )
  }

  const connectionState = getConnectionState(sessionUser.username, handle)
  const isOwnFeed = sessionUser.id === creatorId

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <div className="flex flex-1 lg:flex-row flex-col overflow-y-auto lg:overflow-hidden">
        {/* Left rail — desktop. Mobile: collapses entirely. */}
        <div className="hidden lg:block">
          <ProfileLeftRail profile={profile} connectionState={connectionState} />
        </div>

        {/* Mobile compact identity strip — shown only below lg
            so the user feed page still feels like a profile-
            owned surface on phones without dragging the whole
            ProfileLeftRail into the viewport. */}
        <div className="lg:hidden border-b border-slate-200 bg-white">
          <div className="px-4 py-3 flex items-center gap-3">
            {profile.avatarUrl && (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-10 h-10 object-cover bg-slate-100 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-black truncate">
                {profile.displayName}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {profile.professionalTitle}
              </p>
            </div>
            <Link
              href={`/creator/${handle}`}
              className="post-type-meta-compact text-[var(--post-text-meta)] uppercase shrink-0"
            >
              Profile →
            </Link>
          </div>
        </div>

        <div className="flex-1 lg:overflow-y-auto">
          <div className="w-full max-w-[var(--post-card-max-w)] mx-auto lg:mx-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
            {/* ── Publishing-identity strip ─────────────────────
                The header is what makes this page read as a
                public publishing surface. It names the creator,
                stamps the page with "Publishing on Frontfiles",
                and gives an at-a-glance breakdown of originals
                vs. reposts so a visitor can immediately judge
                editorial cadence. */}
            <header className="flex flex-col gap-3 pb-4 border-b border-[var(--post-divider)]">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3">
                  <span className="post-type-meta text-[var(--post-text-meta)] uppercase">
                    Publishing on Frontfiles
                  </span>
                  <span className="font-mono post-type-meta-compact text-[var(--post-text-disabled)]">
                    @{handle}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {isOwnFeed && (
                    <button
                      type="button"
                      onClick={() => openComposer()}
                      className="inline-flex items-center h-7 px-3 rounded-[var(--post-chip-radius)] bg-[var(--post-accent)] text-white post-type-chip uppercase hover:bg-[var(--post-accent-hover)] transition-colors"
                    >
                      Share to feed
                    </button>
                  )}
                  <Link href={`/creator/${handle}`} className={s.feedBackLink}>
                    ← Back to profile
                  </Link>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-[var(--post-text-primary)] tracking-tight">
                {profile.displayName}
              </h1>

              <div className="flex items-baseline gap-5 flex-wrap">
                <Stat label="Posts" value={counts.total} />
                <Stat label="Originals" value={counts.originals} />
                <Stat label="Reposts" value={counts.reposts} />
              </div>
            </header>

            {feedLoading && unifiedRows.length === 0 ? (
              <FeedLoadingState />
            ) : feedError && unifiedRows.length === 0 ? (
              <FeedErrorState
                message={feedError}
                onRetry={() => void refresh()}
              />
            ) : (
              <PostsContent
                results={results}
                creatorDisplayName={profile.displayName}
                onRepost={handleRepost}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-base font-bold text-[var(--post-text-primary)] tabular-nums">
        {value}
      </span>
      <span className="post-type-meta text-[var(--post-text-meta)] uppercase">
        {label}
      </span>
    </div>
  )
}
