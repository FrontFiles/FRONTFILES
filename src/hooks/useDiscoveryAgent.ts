'use client'

// ═══════════════════════════════════════════════════════════════
// Frontfiles — Discovery Agent (vault-only, stub backend)
//
// The Discovery Agent narrates Frontfiles VAULT content. It is
// the conversational counterpart to the existing BOLT agent, and
// the two are deliberately complementary — never overlapping:
//
//   - BOLT  (lib/bolt + components/discovery/BoltPanel) →
//     EXTERNAL sources, citations, coverage clusters, news
//     archives. Lives in the left-rail panel.
//
//   - Discovery Agent (this hook + DiscoveryAgentPanel) →
//     INTERNAL vault content only. Top picks from the current
//     ranked Discovery feed, short narration of what's in the
//     vault for this query, and follow-up vault refinements.
//     Lives in the bottom conversation band.
//
// CONTRACT
//
// The agent never re-ranks. The grid (DiscoveryResultsGrid) is
// the source of truth for relevance — this hook just consumes
// the already-sorted `feedItems`, picks the first N, and
// derives short reasons from item metadata. When a real ML
// backend lands, swap the body of `useDiscoveryAgent` for a
// fetch to `/api/discovery-agent/answer` (or wherever) and keep
// the same return shape so consumers don't change.
//
// OUTPUT SHAPE
//
//   - `summary`: 1 short sentence describing the result set
//                (count, dominant format, dominant region)
//   - `picks`: up to MAX_PICKS items, each with a one-phrase
//              reason derived from item metadata
//   - `chips`: up to MAX_CHIPS follow-up suggestions, each with
//              a label and a target query the SearchPage can
//              `router.push` to
//
// All three are derived synchronously from props. The hook's
// `state.status` is `'idle' | 'ready' | 'empty'` only — no
// `'loading'` because the stub is sync. When the real backend
// lands, add `'loading'` and `'error'` here without touching
// any consumer.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import {
  feedItemKey,
  type DiscoveryFeedItem,
} from '@/components/discovery/DiscoveryResultsGrid'
import { creatorMap } from '@/data'

// ─── Public types ────────────────────────────────────────────

/**
 * Reasonable upper bounds for the ultra-compact mode. The
 * SearchPage user requested:
 *   - 1 sentence summary
 *   - up to 4 bullet picks
 *   - up to 3 follow-up chips
 * Tuning these constants is the right way to change density —
 * the hook re-derives on every change.
 */
export const MAX_PICKS = 4
export const MAX_CHIPS = 3

export interface DiscoveryAgentPick {
  /** Stable id matching `feedItemKey(item)` — lets the panel
   *  ↔ grid sync via the same hover/select id contract the
   *  rest of Discovery uses. */
  id: string
  /** Display label (asset/story/article title, or creator name). */
  label: string
  /** A 1–3 word reason in the agent's voice. Derived from
   *  metadata, not from any LLM call in the stub. */
  reason: string
  /** What clicking the pick navigates to (asset/story/article/etc.). */
  href: string
  /** What the panel renders as a small leading badge: 'Photo',
   *  'Story', 'Creator', etc. */
  badge: string
}

export interface DiscoveryAgentChip {
  id: string
  label: string
  /** Replacement query string (without the leading '?q='). The
   *  panel hands this back to the parent's `onRunQuery`
   *  callback, which is responsible for `router.push`. */
  nextQuery: string
}

export type DiscoveryAgentState =
  | { status: 'idle' }
  | { status: 'empty'; reason: string }
  | {
      status: 'ready'
      title: string
      summary: string
      picks: ReadonlyArray<DiscoveryAgentPick>
      chips: ReadonlyArray<DiscoveryAgentChip>
    }

export interface UseDiscoveryAgentInput {
  /** The committed query (URL `?q=`). Empty string → idle state. */
  query: string
  /** The already-ranked feed items (post-area-filter) the grid
   *  is rendering. The agent picks from the head of this list. */
  feedItems: ReadonlyArray<DiscoveryFeedItem>
  /** Active format-filter chips. Used to suggest 'Try other
   *  formats' chip when the result set is dominated by one. */
  formatFilters: ReadonlySet<string>
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useDiscoveryAgent(
  input: UseDiscoveryAgentInput,
): DiscoveryAgentState {
  return useMemo(() => buildAgentState(input), [
    input.query,
    input.feedItems,
    input.formatFilters,
  ])
}

// ─── Stub backend (synchronous, deterministic) ───────────────

function buildAgentState(input: UseDiscoveryAgentInput): DiscoveryAgentState {
  const { query, feedItems } = input
  const trimmed = query.trim()

  // Idle: no query yet. The panel renders a soft prompt.
  if (!trimmed) {
    return { status: 'idle' }
  }

  // Empty: query but no matches. The panel renders a one-line
  // explanation and a 'try broader search' chip — no picks.
  if (feedItems.length === 0) {
    return {
      status: 'empty',
      reason: `Nothing in the vault matches "${trimmed}" yet.`,
    }
  }

  const picks = derivePicks(feedItems)
  const summary = deriveSummary(trimmed, feedItems)
  const chips = deriveChips(trimmed, feedItems, input.formatFilters)
  const title = `Top picks for "${trimmed}"`

  return { status: 'ready', title, summary, picks, chips }
}

// ─── Pick derivation ─────────────────────────────────────────

function derivePicks(
  feedItems: ReadonlyArray<DiscoveryFeedItem>,
): ReadonlyArray<DiscoveryAgentPick> {
  return feedItems.slice(0, MAX_PICKS).map((item) => itemToPick(item))
}

function itemToPick(item: DiscoveryFeedItem): DiscoveryAgentPick {
  const id = feedItemKey(item)
  switch (item.type) {
    case 'asset': {
      const a = item.data
      const creator = creatorMap[a.creatorId]
      // Reason format: "{Format} · {Location label fragment}"
      // e.g. "Photo · Lisbon", "Video · East Africa". Falls back
      // to creator name when location is missing.
      const locationFragment = shortLocation(a.locationLabel)
      const reason = locationFragment
        ? `${a.format} · ${locationFragment}`
        : creator
          ? `${a.format} · ${creator.name}`
          : a.format
      return {
        id,
        label: a.title,
        reason,
        href: `/asset/${a.id}`,
        badge: a.format,
      }
    }
    case 'story': {
      const s = item.data
      const creator = creatorMap[s.creatorId]
      return {
        id,
        label: s.title,
        reason: creator
          ? `Story · ${creator.name}`
          : `Story · ${s.assetIds.length} assets`,
        href: `/story/${s.id}`,
        badge: 'Story',
      }
    }
    case 'article': {
      const ar = item.data
      const author = ar.editorName ?? ar.creatorName ?? null
      return {
        id,
        label: ar.title,
        reason: author ? `Article · ${author}` : 'Article',
        href: `/article/${ar.id}`,
        badge: 'Article',
      }
    }
    case 'creator': {
      const c = item.data
      // Creators are people, not works — reason highlights what
      // they cover. Specialty-first if available, otherwise base.
      const speciality = c.specialties[0]
      const reason = speciality
        ? `${speciality} · ${c.locationBase}`
        : c.locationBase
      return {
        id,
        label: c.name,
        reason,
        href: `/creator/${c.slug}/frontfolio`,
        badge: 'Creator',
      }
    }
    case 'collection': {
      const col = item.data
      return {
        id,
        label: col.title,
        reason: `Collection · ${col.assetIds.length} assets`,
        href: `/collection/${col.id}`,
        badge: 'Collection',
      }
    }
  }
}

/**
 * Pull a short location fragment out of a longer label. Many
 * Frontfiles location labels are formatted like
 *   "Lisbon, Portugal" or "Maputo, Mozambique"
 * — we want just the first segment so the pick reason stays
 * compact at 1-3 words. Returns null if the label is empty.
 */
function shortLocation(label: string): string | null {
  if (!label) return null
  const trimmed = label.trim()
  if (!trimmed) return null
  // Take everything before the first comma, capped at 24 chars.
  const head = trimmed.split(',')[0].trim()
  return head.length > 24 ? head.slice(0, 24) : head
}

// ─── Summary derivation (1 sentence) ─────────────────────────

function deriveSummary(
  query: string,
  feedItems: ReadonlyArray<DiscoveryFeedItem>,
): string {
  const counts = countByType(feedItems)
  const total = feedItems.length

  // What dominates? Pick the type with the largest share.
  const dominant = (Object.entries(counts) as Array<[string, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0]

  if (!dominant) {
    return `${total} results in the vault.`
  }

  const [type, n] = dominant
  const share = Math.round((n / total) * 100)

  // Common patterns:
  //   "23 results — mostly photos."
  //   "8 results across 4 frontfilers."
  //   "12 stories on East Africa."
  if (type === 'creator') {
    return `${n} ${n === 1 ? 'frontfiler' : 'frontfilers'} match — explore their work below.`
  }
  if (share >= 70) {
    return `${total} results — mostly ${pluralizeType(type, n)}.`
  }
  return `${total} results across ${describeMix(counts)}.`
}

function countByType(
  feedItems: ReadonlyArray<DiscoveryFeedItem>,
): Record<DiscoveryFeedItem['type'], number> {
  const out: Record<DiscoveryFeedItem['type'], number> = {
    asset: 0,
    story: 0,
    article: 0,
    creator: 0,
    collection: 0,
  }
  for (const item of feedItems) {
    out[item.type] += 1
  }
  return out
}

function pluralizeType(type: string, n: number): string {
  if (type === 'asset') return n === 1 ? 'asset' : 'assets'
  if (type === 'story') return n === 1 ? 'story' : 'stories'
  if (type === 'article') return n === 1 ? 'article' : 'articles'
  if (type === 'creator') return n === 1 ? 'frontfiler' : 'frontfilers'
  if (type === 'collection') return n === 1 ? 'collection' : 'collections'
  return type
}

function describeMix(counts: Record<DiscoveryFeedItem['type'], number>): string {
  const parts: string[] = []
  if (counts.asset) parts.push(`${counts.asset} ${pluralizeType('asset', counts.asset)}`)
  if (counts.story) parts.push(`${counts.story} ${pluralizeType('story', counts.story)}`)
  if (counts.article) parts.push(`${counts.article} ${pluralizeType('article', counts.article)}`)
  if (counts.collection) parts.push(`${counts.collection} ${pluralizeType('collection', counts.collection)}`)
  if (counts.creator) parts.push(`${counts.creator} ${pluralizeType('creator', counts.creator)}`)
  if (parts.length === 0) return 'the vault'
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

// ─── Chip derivation (≤ MAX_CHIPS follow-ups) ────────────────

function deriveChips(
  query: string,
  feedItems: ReadonlyArray<DiscoveryFeedItem>,
  // formatFilters is reserved for future chip rules ('try other
  // formats' when only one format is selected, 'remove all
  // filters' when many are selected). Keeping the input shape
  // stable so the real backend that lands later doesn't change
  // the call site. Underscore prefix tells eslint we know.
  _formatFilters: ReadonlySet<string>,
): ReadonlyArray<DiscoveryAgentChip> {
  const chips: DiscoveryAgentChip[] = []
  const counts = countByType(feedItems)
  const total = feedItems.length

  // Chip 1 — "See only frontfilers" when there's a creator
  // signal but the query isn't already creator-focused.
  if (counts.creator > 0 && counts.asset > counts.creator) {
    chips.push({
      id: 'only-creators',
      label: 'See only frontfilers',
      nextQuery: query, // same query, panel will pass + format filter
    })
  }

  // Chip 2 — "Try a broader search" when results are sparse
  // (< 6) OR "Narrow to verified" when results are abundant.
  if (total < 6) {
    chips.push({
      id: 'broader',
      label: 'Try a broader search',
      // Naive broaden: drop the last word.
      nextQuery: query.split(/\s+/).slice(0, -1).join(' ') || query,
    })
  } else if (total >= 12) {
    chips.push({
      id: 'verified',
      label: 'Narrow to verified',
      nextQuery: query, // same query — the parent applies the verified facet
    })
  }

  // Chip 3 — "More from {dominant creator}" when one creator
  // dominates the pick list (≥ 2 of the top picks share an
  // author). This is the "I see a pattern, want me to follow
  // it?" chip.
  const dominantCreator = findDominantCreator(feedItems.slice(0, MAX_PICKS))
  if (dominantCreator) {
    chips.push({
      id: `more-from-${dominantCreator.slug}`,
      label: `More from ${dominantCreator.name}`,
      nextQuery: dominantCreator.name,
    })
  }

  // Cap at MAX_CHIPS.
  return chips.slice(0, MAX_CHIPS)
}

function findDominantCreator(
  items: ReadonlyArray<DiscoveryFeedItem>,
): { name: string; slug: string } | null {
  const counts = new Map<string, number>()
  for (const item of items) {
    let creatorId: string | null = null
    if (item.type === 'asset') creatorId = item.data.creatorId
    if (item.type === 'story') creatorId = item.data.creatorId
    if (creatorId) counts.set(creatorId, (counts.get(creatorId) ?? 0) + 1)
  }
  let best: [string, number] | null = null
  for (const [id, n] of counts) {
    if (n >= 2 && (!best || n > best[1])) best = [id, n]
  }
  if (!best) return null
  const creator = creatorMap[best[0]]
  if (!creator) return null
  return { name: creator.name, slug: creator.slug }
}
