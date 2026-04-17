// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Global Feed Empty States
//
// Per-tab editorial empty states for the global feed. The copy
// is intentionally explicit about *why* the feed is empty —
// it doubles as a one-line teach moment for new users.
// ═══════════════════════════════════════════════════════════════

import * as s from '@/lib/post/styles'
import type { FeedTabKey } from './FeedTabBar'

interface FeedEmptyStateProps {
  tab: FeedTabKey
  /** Optional click handler that opens the share composer. */
  onCompose?: () => void
}

export function FeedEmptyState({ tab, onCompose }: FeedEmptyStateProps) {
  const copy = COPY[tab]
  return (
    <div className={s.emptyStateShell}>
      <span className={s.emptyStateLabel}>{copy.label}</span>
      <p className={s.emptyStateHeadline}>{copy.headline}</p>
      <p className={s.emptyStateHelper}>{copy.helper}</p>
      {onCompose && (
        <button
          type="button"
          onClick={onCompose}
          className={s.composerEntryAction + ' mt-2'}
        >
          Share to feed
        </button>
      )}
    </div>
  )
}

const COPY: Record<
  FeedTabKey,
  { label: string; headline: string; helper: string }
> = {
  following: {
    label: 'Following',
    headline: 'Your Following feed is quiet right now.',
    helper:
      'Follow more verified Frontfiles creators to fill this column. The right rail has a starting list.',
  },
  relevant: {
    label: 'Relevant',
    headline: 'Nothing matches your beats yet.',
    helper:
      'Relevance is computed from the coverage areas and specialisations on your profile. Update either to widen the net.',
  },
  foryou: {
    label: 'For you',
    headline: 'No published posts on Frontfiles yet.',
    helper:
      'Be the first to share a certified asset, Story, Article, or Collection.',
  },
}
