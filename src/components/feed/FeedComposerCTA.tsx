// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Feed Composer Entry
//
// The compact "Share something" card pinned to the top of the
// global feed (and embeddable on the user feed page). Clicking
// it opens the share composer overlay.
//
// This component is presentation-only — the parent owns the
// open state and passes `onOpen`. It does not import the
// composer module directly so it stays cheap to render and
// safe to embed multiple times on a page.
// ═══════════════════════════════════════════════════════════════

'use client'

import * as s from '@/lib/post/styles'
import type { SessionUser } from '@/lib/user-context'

interface FeedComposerCTAProps {
  sessionUser: SessionUser
  onOpen: () => void
}

export function FeedComposerCTA({
  sessionUser,
  onOpen,
}: FeedComposerCTAProps) {
  return (
    <div className={s.composerEntryShell}>
      <button
        type="button"
        onClick={onOpen}
        className={s.composerEntryAvatar}
        aria-label="Open share composer"
      >
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
      </button>
      <button
        type="button"
        onClick={onOpen}
        className={s.composerEntryButton}
      >
        Share a Frontfiles asset, Story, Article or Collection…
      </button>
      <button
        type="button"
        onClick={onOpen}
        className={s.composerEntryAction}
      >
        Share
      </button>
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
