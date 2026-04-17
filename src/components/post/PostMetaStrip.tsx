// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Optional Post Metadata Strip
//
// Editorial chip row that lives below an embed when a feed
// surface wants to expose extra context about a post: beat,
// location, rights state, certification level. Reused on:
//   - the post detail page (under the hero card)
//   - the global feed (when the spec turns chips on)
//
// All chrome from `@/lib/post/styles` — no hardcoded color or
// size. Each chip is a passive container; clicks are upstream's
// concern (today the chips are non-interactive).
// ═══════════════════════════════════════════════════════════════

import * as s from '@/lib/post/styles'

export interface PostMetaChip {
  /** Short label, uppercased automatically by the chip class. */
  label: string
  /** Optional small icon node (16px box). */
  icon?: React.ReactNode
}

interface PostMetaStripProps {
  chips: PostMetaChip[]
}

export function PostMetaStrip({ chips }: PostMetaStripProps) {
  if (chips.length === 0) return null
  return (
    <div className={s.metaStrip} aria-label="Post metadata">
      {chips.map((chip, i) => (
        <span key={i} className={s.metaChip}>
          {chip.icon}
          <span>{chip.label}</span>
        </span>
      ))}
    </div>
  )
}
