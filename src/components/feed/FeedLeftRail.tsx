// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Global Feed Left Rail
//
// Persistent navigation column for the /feed page. Holds the
// session user identity strip, the per-tab quick links, and a
// short list of "Saved searches" the spec hints at without
// fully scoping. Hidden below the lg breakpoint — on mobile
// the same destinations live in the existing DiscoveryNav.
//
// Chrome from `@/lib/post/styles`.
// ═══════════════════════════════════════════════════════════════

'use client'

import Link from 'next/link'
import * as s from '@/lib/post/styles'
import type { SessionUser } from '@/lib/user-context'
import type { FeedTabKey } from './FeedTabBar'

interface FeedLeftRailProps {
  sessionUser: SessionUser
  followingCount: number
  activeTab: FeedTabKey
  onSelectTab: (tab: FeedTabKey) => void
}

export function FeedLeftRail({
  sessionUser,
  followingCount,
  activeTab,
  onSelectTab,
}: FeedLeftRailProps) {
  return (
    <aside className={s.feedLeftRail}>
      {/* Identity strip ───────────────────────────────────── */}
      <div className={s.railSection}>
        <Link
          href={`/creator/${sessionUser.username}`}
          className="flex items-center gap-3 group"
        >
          <div className={s.composerEntryAvatar}>
            {sessionUser.avatarUrl ? (
              <img
                src={sessionUser.avatarUrl}
                alt={sessionUser.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={s.authorAvatarFallback.default}>
                {initials(sessionUser.displayName)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="post-type-author-name text-[var(--post-text-primary)] group-hover:text-[var(--post-accent)] transition-colors truncate">
              {sessionUser.displayName}
            </p>
            <p className="post-type-title text-[var(--post-text-secondary)] truncate">
              @{sessionUser.username}
            </p>
          </div>
        </Link>
      </div>

      {/* Tabs ────────────────────────────────────────────── */}
      <div className={s.railSection}>
        <span className={s.railSectionLabel}>Feed</span>
        <nav className={s.railNavList} aria-label="Feed tabs">
          <RailNavButton
            active={activeTab === 'following'}
            label="Following"
            count={followingCount}
            onClick={() => onSelectTab('following')}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.railNavIcon}
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 11h-6" />
                <path d="M19 8v6" />
              </svg>
            }
          />
          <RailNavButton
            active={activeTab === 'relevant'}
            label="Relevant"
            onClick={() => onSelectTab('relevant')}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.railNavIcon}
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            }
          />
          <RailNavButton
            active={activeTab === 'foryou'}
            label="For you"
            onClick={() => onSelectTab('foryou')}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.railNavIcon}
              >
                <path d="M4 4h16v16H4z" />
                <path d="M4 9h16" />
                <path d="M9 9v11" />
              </svg>
            }
          />
        </nav>
      </div>

      {/* Quick links ───────────────────────────────────────── */}
      <div className={s.railSection}>
        <span className={s.railSectionLabel}>Workspace</span>
        <nav className={s.railNavList}>
          <RailNavLink
            href={`/creator/${sessionUser.username}`}
            label="My profile"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.railNavIcon}
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
          />
          <RailNavLink
            href={`/creator/${sessionUser.username}/posts`}
            label="My posts"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.railNavIcon}
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
          />
          <RailNavLink
            href="/lightbox"
            label="Lightbox"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.railNavIcon}
              >
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
              </svg>
            }
          />
          <RailNavLink
            href="/search"
            label="Discover"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.railNavIcon}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            }
          />
        </nav>
      </div>

      {/* Footer disclaimer ─────────────────────────────────── */}
      <div className="mt-auto px-5 py-5">
        <p className="post-type-meta-compact text-[var(--post-text-disabled)] uppercase">
          FFF Sharing · Private beta
        </p>
        <p className="post-type-empty text-[var(--post-text-meta)] mt-2">
          The feed surfaces certified Frontfiles work. Provenance and attribution are preserved at every level.
        </p>
      </div>
    </aside>
  )
}

// ─── Building blocks ─────────────────────────────────────────

function RailNavButton({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={s.railNavItem(active)}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="font-mono post-type-meta-compact text-[var(--post-text-meta)]">
          {count}
        </span>
      )}
    </button>
  )
}

function RailNavLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <Link href={href} className={s.railNavItem(false)}>
      {icon}
      <span className="flex-1 truncate">{label}</span>
    </Link>
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
