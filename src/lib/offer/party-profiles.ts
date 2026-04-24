/**
 * Frontfiles — Party-profile map builder (P4 concern 4A.2.C2 Prompt 6).
 *
 * Pure reducer over the `users[]` payload returned by
 * `GET /api/offers/party-profiles` (C1 §F1). Returns a
 * `Record<string, PartyProfile>` keyed on `auth.users.id` for O(1)
 * lookup in `OfferDetailClient`.
 *
 * Decoupled from the fetch layer so the caller can test
 * `OfferDetailClient` with hand-built fixture maps (§R6-pure — no
 * network, no jsdom).
 *
 * Tombstoned-user scrub sentinels pass through verbatim per
 * `docs/specs/ECONOMIC_FLOW_v1.md §8.7.1` — the UI treats
 * `account_state === 'tombstoned'` as an explicit display variant,
 * not as a filter.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_C1_DIRECTIVE.md §F1 (response shape).
 *   - docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md §F1 (consumer).
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.7.1 (scrub sentinels).
 */

import type { PartyProfile, PartyProfileMap } from './types'

export function buildPartyProfileMap(
  rows: readonly PartyProfile[],
): PartyProfileMap {
  const map: PartyProfileMap = {}
  for (const row of rows) {
    map[row.id] = row
  }
  return map
}
