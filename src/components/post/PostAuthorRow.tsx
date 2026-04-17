// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Post Author Row
//
// Avatar + name + trust badge + title + timestamp strip at the
// top of every PostCard and nested repost embed. All chrome is
// pulled from `@/lib/post/styles` — do not add hardcoded classes
// to this file.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import type { PostAuthor } from '@/lib/types'
import * as s from '@/lib/post/styles'

interface PostAuthorRowProps {
  author: PostAuthor
  publishedAt: string
  /** Compact variant used inside nested repost embeds. */
  compact?: boolean
}

export function PostAuthorRow({
  author,
  publishedAt,
  compact = false,
}: PostAuthorRowProps) {
  const variant = compact ? 'compact' : 'default'
  const date = new Date(publishedAt)
  const dateStr = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const initials = author.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  return (
    <div className={s.authorRow[variant]}>
      {/* Avatar */}
      <Link
        href={`/creator/${author.username}`}
        className={s.authorAvatar[variant]}
        aria-label={author.displayName}
      >
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={s.authorAvatarFallback[variant]}>{initials}</span>
        )}
      </Link>

      {/* Name + professional title */}
      <div className={s.authorNameCol}>
        <div className={s.authorNameRow}>
          <Link
            href={`/creator/${author.username}`}
            className={s.authorName[variant]}
          >
            {author.displayName}
          </Link>
          {author.trustBadge && (
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className={s.authorTrustBadge[variant]}
              aria-label="Verified creator"
            >
              <path
                d="M8 1L3 3.5v4c0 3.5 2.1 6.8 5 7.5 2.9-.7 5-4 5-7.5v-4L8 1z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="currentColor"
                fillOpacity="0.15"
              />
              <path
                d="M5.5 8l2 2L10.5 6"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        {author.professionalTitle && (
          <p className={s.authorTitle[variant]}>{author.professionalTitle}</p>
        )}
      </div>

      {/* Timestamp — the meta cluster lives inline with the
          name column per spec: "Right-side timestamp strip:
          Inline with meta, not separate column". */}
      <div className={s.authorTimestamp[variant]}>
        <span className={s.authorTimestampDate[variant]}>{dateStr}</span>
        {!compact && (
          <span className={s.authorTimestampTime}>{timeStr}</span>
        )}
      </div>
    </div>
  )
}
