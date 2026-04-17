// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Global Feed Right Rail
//
// Discovery + signals column for the /feed page. Three blocks:
//
//   1. Suggested creators — verified Frontfilers the viewer
//      does NOT currently follow, ordered by trust badge then
//      number of certified assets they have on the platform.
//   2. Trust signals — a short panel of platform-level numbers
//      (verified creators, certified assets, reposts today).
//      Editorial typography, subdued numerals — NOT a vanity
//      counter.
//   3. Disclaimer — a one-liner reminder that ranking is based
//      on professional proximity, not engagement.
//
// Hidden below the xl breakpoint. Chrome from `@/lib/post/styles`.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as s from '@/lib/post/styles'
import type { Creator } from '@/data/creators'

interface FeedRightRailProps {
  suggestedCreators: Creator[]
  signals: {
    verifiedCreators: number
    certifiedAssets: number
    repostsLast24h: number
  }
}

export function FeedRightRail({
  suggestedCreators,
  signals,
}: FeedRightRailProps) {
  return (
    <aside className={s.feedRightRail}>
      {/* Suggested creators ─────────────────────────────────── */}
      <div className={s.railSection}>
        <span className={s.railSectionLabel}>People to follow</span>
        <div className="flex flex-col gap-4 mt-2">
          {suggestedCreators.slice(0, 4).map((creator) => (
            <SuggestedCreator key={creator.id} creator={creator} />
          ))}
        </div>
      </div>

      {/* Trust signals ──────────────────────────────────────── */}
      <div className={s.railSection}>
        <span className={s.railSectionLabel}>On Frontfiles</span>
        <div className="flex flex-col gap-2 mt-2">
          <SignalRow
            label="Verified creators"
            value={signals.verifiedCreators.toLocaleString('en-US')}
          />
          <SignalRow
            label="Certified assets"
            value={signals.certifiedAssets.toLocaleString('en-US')}
          />
          <SignalRow
            label="Reposts · 24h"
            value={signals.repostsLast24h.toLocaleString('en-US')}
          />
        </div>
      </div>

      {/* How ranking works ──────────────────────────────────── */}
      <div className={s.railSection}>
        <span className={s.railSectionLabel}>How ranking works</span>
        <p className="post-type-empty text-[var(--post-text-secondary)] mt-2">
          Frontfiles ranks posts by professional proximity, not by likes or reposts. Your beats, your follow graph, and the trust badge of the original source decide what surfaces here.
        </p>
        <Link
          href="/account"
          className="post-type-meta text-[var(--post-accent)] uppercase mt-3 inline-block hover:text-[var(--post-accent-hover)] transition-colors"
        >
          Tune your feed →
        </Link>
      </div>
    </aside>
  )
}

// ─── Suggested creator row ───────────────────────────────────

function SuggestedCreator({ creator }: { creator: Creator }) {
  const [followed, setFollowed] = useState(false)
  return (
    <div className={s.discoveryItem}>
      <Link
        href={`/creator/${creator.slug}`}
        className={s.discoveryAvatar}
        aria-label={creator.name}
      >
        {creator.avatarRef ? (
          <img
            src={creator.avatarRef}
            alt={creator.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={s.authorAvatarFallback.compact}>
            {initials(creator.name)}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/creator/${creator.slug}`}
          className={s.discoveryName}
        >
          {creator.name}
        </Link>
        <p className={s.discoveryTitle}>{creator.locationBase}</p>
        <button
          type="button"
          onClick={() => setFollowed((v) => !v)}
          className={
            s.discoveryFollowChip +
            (followed
              ? ' border-[var(--post-accent)] text-[var(--post-accent)]'
              : '')
          }
          aria-pressed={followed}
        >
          {followed ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  )
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.signalRow}>
      <span className={s.signalLabel}>{label}</span>
      <span className={s.signalValue}>{value}</span>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
}
