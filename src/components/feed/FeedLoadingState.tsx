// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Feed loading + error skeletons
//
// Two small, editorial states for the global feed and user feed
// while the API call is in flight or has failed. Reuses the
// existing emptyStateShell token surface so the skeletons feel
// like part of the same system.
// ═══════════════════════════════════════════════════════════════

import * as s from '@/lib/post/styles'

export function FeedLoadingState() {
  return (
    <div className={s.emptyStateShell}>
      <span className={s.emptyStateLabel}>Loading</span>
      <p className={s.emptyStateHeadline}>
        Fetching the latest posts from Frontfiles…
      </p>
    </div>
  )
}

export function FeedErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className={s.emptyStateShell}>
      <span className={s.emptyStateLabel}>Couldn&rsquo;t load the feed</span>
      <p className={s.emptyStateHeadline}>{message}</p>
      <p className={s.emptyStateHelper}>
        The Frontfiles API may be temporarily unavailable. Try again in a moment.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={s.composerEntryAction + ' mt-2'}
        >
          Retry
        </button>
      )}
    </div>
  )
}
