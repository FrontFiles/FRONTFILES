// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Global Feed Tab Bar
//
// Three-tab segmented control sitting under the composer entry
// on the global feed. Mirrors the existing PostsContent tab bar
// pattern so the visual language is consistent across:
//   - the global feed (this file)
//   - the user feed (`PostsContent` in components/platform)
//
// Chrome from `@/lib/post/styles`.
// ═══════════════════════════════════════════════════════════════

'use client'

import * as s from '@/lib/post/styles'

export type FeedTabKey = 'following' | 'relevant' | 'foryou'

export const FEED_TAB_LABELS: Record<FeedTabKey, string> = {
  following: 'Following',
  relevant: 'Relevant',
  foryou: 'For you',
}

interface FeedTabBarProps {
  active: FeedTabKey
  onChange: (tab: FeedTabKey) => void
  counts: Record<FeedTabKey, number>
}

const ORDER: FeedTabKey[] = ['following', 'relevant', 'foryou']

export function FeedTabBar({ active, onChange, counts }: FeedTabBarProps) {
  return (
    <div className={s.tabBar} role="tablist" aria-label="Feed">
      <div className={s.tabBarInner}>
        {ORDER.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={active === key}
            onClick={() => onChange(key)}
            className={s.tabButton(active === key)}
          >
            <span>{FEED_TAB_LABELS[key]}</span>
            <span className={s.tabButtonCount}>{counts[key]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
