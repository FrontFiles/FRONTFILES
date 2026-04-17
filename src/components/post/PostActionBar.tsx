// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Post Action Bar
//
// 4-button bar at the bottom of every PostCard. The spec is
// explicit that we must NOT chase engagement-bait styling:
//
//   - Repost  →  ACTIVE. Opens the share composer in repost-with-
//                context mode (the only mutation that really
//                matters for FFF Sharing).
//   - Share   →  ACTIVE. Copies the post's permalink to the
//                clipboard. Editorial, not viral.
//   - Like    →  Visually muted toggle. Local-only optimistic
//                state — never lies about persistence. Until
//                Module 6 wires real reactions, the local toggle
//                lets a viewer mark a post as noteworthy without
//                touching a public counter.
//   - Comment →  Visually muted. Routes to the post detail page
//                where threaded replies will land in Module 6.
//
// Every active button is uppercase + thin border so the bar reads
// as a professional toolbar, not a TikTok action stack.
// ═══════════════════════════════════════════════════════════════

'use client'

// (touched to force turbopack recompile of the SSR bundle)
import { useState } from 'react'
import Link from 'next/link'
import * as s from '@/lib/post/styles'

interface PostActionBarProps {
  postId: string
  likeCount: number
  commentCount: number
  repostCount: number
  viewerLiked: boolean
  /**
   * Open the share composer in repost-with-context mode against
   * THIS post. Always provided by feed surfaces; omitted on
   * static / non-interactive renders (e.g. composer preview).
   */
  onRepost?: () => void
}

export function PostActionBar({
  postId,
  likeCount,
  commentCount,
  repostCount,
  viewerLiked,
  onRepost,
}: PostActionBarProps) {
  const [liked, setLiked] = useState(viewerLiked)
  const [copied, setCopied] = useState(false)

  // Local-only optimistic counter. The hydrator's `likeCount` is
  // the seed baseline; toggling adds/subtracts one until Module 6
  // wires real reactions. Kept passive (no API call) so the UI
  // never lies about persistence.
  const liveLikeCount = liked ? likeCount + 1 : likeCount

  async function handleShare() {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/post/${postId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Some browsers refuse clipboard writes outside a user
      // gesture context. Silently no-op rather than misleading
      // the user with a fake "copied" state.
    }
  }

  return (
    <div className={s.actionBarShell}>
      <ActionButton
        label="Like"
        count={liveLikeCount}
        muted
        pressed={liked}
        onClick={() => setLiked((v) => !v)}
        title="Mark as noteworthy. Local to this view."
      >
        <svg
          className={s.actionIcon}
          viewBox="0 0 24 24"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </ActionButton>

      <ActionLink
        label="Comment"
        count={commentCount}
        muted
        href={`/post/${postId}`}
        title="Open the post for threaded responses."
      >
        <svg
          className={s.actionIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </ActionLink>

      <ActionButton
        label="Repost"
        count={repostCount}
        onClick={onRepost}
        disabled={!onRepost}
        title="Repost with context to your followers."
      >
        <svg
          className={s.actionIcon}
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
      </ActionButton>

      <ActionButton
        label={copied ? 'Copied' : 'Share'}
        count={null}
        onClick={handleShare}
        title="Copy the post permalink."
      >
        <svg
          className={s.actionIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </ActionButton>
    </div>
  )
}

// ─── Building blocks ─────────────────────────────────────────

function ActionButton({
  label,
  count,
  children,
  onClick,
  disabled = false,
  muted = false,
  pressed = false,
  title,
}: {
  label: string
  count: number | null
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  muted?: boolean
  pressed?: boolean
  title?: string
}) {
  const cls = buildActionClass({ disabled, muted, pressed })
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      className={cls}
    >
      {children}
      <span>{label}</span>
      {count !== null && <span className={s.actionCount}>{count}</span>}
    </button>
  )
}

function ActionLink({
  label,
  count,
  children,
  href,
  muted = false,
  title,
}: {
  label: string
  count: number | null
  children: React.ReactNode
  href: string
  muted?: boolean
  title?: string
}) {
  const cls = buildActionClass({ disabled: false, muted, pressed: false })
  return (
    <Link href={href} aria-label={label} title={title} className={cls}>
      {children}
      <span>{label}</span>
      {count !== null && <span className={s.actionCount}>{count}</span>}
    </Link>
  )
}

/**
 * Build the action button class string. Centralised here so the
 * three button variants (active / muted / pressed) read off the
 * same token surface in `@/lib/post/styles`.
 */
function buildActionClass({
  disabled,
  muted,
  pressed,
}: {
  disabled: boolean
  muted: boolean
  pressed: boolean
}): string {
  const base = [
    'flex-1 min-w-[80px]',
    'h-[var(--post-action-row-h)]',
    'inline-flex items-center justify-center',
    'gap-[var(--post-icon-label-gap)]',
    'post-type-action-label',
    'select-none transition-colors',
  ]
  if (disabled) {
    base.push('text-[var(--post-text-disabled)] cursor-not-allowed')
  } else if (pressed) {
    base.push('text-[var(--post-accent)] cursor-pointer hover:text-[var(--post-accent-hover)]')
  } else if (muted) {
    base.push(
      'text-[var(--post-text-meta)] hover:text-[var(--post-text-primary)] cursor-pointer',
    )
  } else {
    base.push(
      'text-[var(--post-text-secondary)] hover:text-[var(--post-accent)] cursor-pointer',
    )
  }
  return base.join(' ')
}
