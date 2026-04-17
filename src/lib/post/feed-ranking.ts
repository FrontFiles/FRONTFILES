// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Feed Ranking
//
// Pure functions that turn the unified post pool into the three
// global-feed tabs the spec calls out:
//
//   - Following  → posts authored by accounts the viewer follows
//   - Relevant   → posts whose author or attached entity overlaps
//                  with the viewer's coverage / specialisations
//                  (deterministic proxy; no ML, no engagement
//                  signals — keeps the feed editorial, not viral)
//   - For you    → every published post, newest first (the
//                  "fresh from the network" feed)
//
// All ranking is deterministic and pure so the same inputs
// always yield the same order. No date-now dependencies; the
// "newest first" sort uses the `published_at` ISO timestamps
// already on the rows.
// ═══════════════════════════════════════════════════════════════

import type { PostRow } from '@/lib/db/schema'
import type { HydratedPostResult } from './types'
import { hydratePost } from './hydrate'
import { followGraph } from '@/data/social'
import { creatorMap } from '@/data/creators'

// ─── Shared helpers ──────────────────────────────────────────

/**
 * Fold a list of `PostRow` into hydrated cards. Failed rows
 * stay in the result array so the caller can render an
 * "unavailable" placeholder in their slot — matching the
 * existing PostsContent contract.
 */
export function hydrateAndSort(rows: PostRow[]): HydratedPostResult[] {
  const sorted = [...rows].sort((a, b) =>
    b.published_at.localeCompare(a.published_at),
  )
  return sorted.map(hydratePost)
}

/** Resolve a user id to its `username` slug. Returns null if unknown. */
function usernameForUserId(userId: string): string | null {
  return creatorMap[userId]?.slug ?? null
}

// ─── Following tab ───────────────────────────────────────────

/**
 * Posts authored by anyone the viewer follows. The viewer's
 * own posts are excluded — the Following tab is for *other*
 * people's voices.
 */
export function rankFollowingFeed(
  rows: PostRow[],
  viewerUsername: string,
): HydratedPostResult[] {
  const following = new Set(followGraph[viewerUsername] ?? [])
  if (following.size === 0) return []

  const filtered = rows.filter((row) => {
    if (row.status !== 'published') return false
    const authorSlug = usernameForUserId(row.author_user_id)
    if (!authorSlug) return false
    if (authorSlug === viewerUsername) return false
    return following.has(authorSlug)
  })

  return hydrateAndSort(filtered)
}

// ─── Relevant tab ────────────────────────────────────────────

/**
 * Score how "professionally proximate" a post is to the viewer.
 * Three weighted signals — all derived from already-seeded
 * fields, no engagement metrics involved:
 *
 *   +3   author shares ≥1 specialisation with the viewer
 *   +2   author shares ≥1 coverage area with the viewer
 *   +2   viewer follows the author (it's still proximity, just
 *        from the social graph instead of the topic graph)
 *   +1   author is in the viewer's geographic cluster (loose
 *        match on `locationBase` substring)
 *
 * Posts that score 0 are excluded; the rest are sorted by score
 * descending then by published_at descending for a stable tie-
 * break. The viewer's own posts are excluded.
 */
export function rankRelevantFeed(
  rows: PostRow[],
  viewerUserId: string,
  viewerUsername: string,
): HydratedPostResult[] {
  const viewer = creatorMap[viewerUserId]
  if (!viewer) return []

  const viewerSpecialties = new Set(
    viewer.specialties.map((s) => s.toLowerCase()),
  )
  const viewerRegions = new Set(
    viewer.regionsCovered.map((s) => s.toLowerCase()),
  )
  const viewerLocation = (viewer.locationBase ?? '').toLowerCase()
  const following = new Set(followGraph[viewerUsername] ?? [])

  type Scored = { row: PostRow; score: number }
  const scored: Scored[] = []

  for (const row of rows) {
    if (row.status !== 'published') continue
    if (row.author_user_id === viewerUserId) continue

    const author = creatorMap[row.author_user_id]
    if (!author) continue

    let score = 0
    if (
      author.specialties.some((s) =>
        viewerSpecialties.has(s.toLowerCase()),
      )
    ) {
      score += 3
    }
    if (
      author.regionsCovered.some((r) =>
        viewerRegions.has(r.toLowerCase()),
      )
    ) {
      score += 2
    }
    if (following.has(author.slug)) score += 2
    if (
      viewerLocation &&
      author.locationBase &&
      (author.locationBase.toLowerCase().includes(viewerLocation) ||
        viewerLocation.includes(author.locationBase.toLowerCase()))
    ) {
      score += 1
    }

    if (score > 0) scored.push({ row, score })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.row.published_at.localeCompare(a.row.published_at)
  })

  return scored.map((s) => hydratePost(s.row))
}

// ─── For you tab ─────────────────────────────────────────────

/**
 * Every published post on the platform, newest first. This is
 * the broadest feed — it does NOT exclude the viewer's own
 * posts because the spec calls out that the For-you stream
 * should reflect "fresh from the network" without filtering on
 * graph proximity. (The viewer's own posts on top is a useful
 * confirmation signal that the composer worked.)
 */
export function rankForYouFeed(rows: PostRow[]): HydratedPostResult[] {
  const filtered = rows.filter((row) => row.status === 'published')
  return hydrateAndSort(filtered)
}
