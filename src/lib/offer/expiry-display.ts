/**
 * Frontfiles — Expiry-display pure renderer (P4 concern 4A.2.C2).
 *
 * Pure function `formatExpiry(expires_at, now)` renders the
 * human-relative expiry line per directive §SCOPE item 3. Consumed
 * by `OfferDetailClient` (Prompt 6).
 *
 * Render branches (by delta = expires_at − now):
 *
 *   - delta >  +30d     → YYYY-MM-DD fallback (IP-G).
 *   - delta ≥ +24h      → "expires in N days, M hours" /
 *                         "expires in N days" (hours == 0).
 *   - delta in (0, 24h) → "expires today" (IP-F).
 *   - delta in (-1h, 0) → "expired less than an hour ago" (IP-I.a).
 *   - delta ≤ -1h       → "expired N days ago" /
 *                         "expired M hours ago".
 *   - delta <  -30d     → YYYY-MM-DD fallback.
 *
 * Rounding: floor (IP-E) — never overstates time remaining.
 * Plural: standard English (IP-H).
 * Past-tense copy: verbatim from §SCOPE item 3 (IP-I).
 *
 * Time-mock: tests pass an explicit `now: Date` at each call site
 * per IP-M. No `vi.setSystemTime` / `vi.useFakeTimers` — mirrors
 * `src/lib/offer/tests/state.test.ts:212-228` canonical pattern.
 *
 * Spec anchors:
 *   - docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md §SCOPE item 3.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §7 — `expires_at timestamptz`
 *     (ISO-8601 UTC with `Z` suffix; the first 10 characters are
 *     the UTC date, which is what IP-G takes for the fallback).
 */

// ─── Constants ────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const THIRTY_DAYS_MS = 30 * DAY_MS

// ─── Public entry ─────────────────────────────────────────────────

export function formatExpiry(expires_at: string, now: Date): string {
  const delta_ms = Date.parse(expires_at) - now.getTime()

  // Fallback beyond ±30 days. IP-G: `timestamptz` persists in UTC
  // and the first 10 chars of an ISO-8601 string are the UTC date.
  if (delta_ms > THIRTY_DAYS_MS || delta_ms < -THIRTY_DAYS_MS) {
    return expires_at.slice(0, 10)
  }

  // Past branches.
  if (delta_ms < 0) {
    const abs_ms = -delta_ms
    if (abs_ms < HOUR_MS) {
      // IP-I.a — sub-hour past.
      return 'expired less than an hour ago'
    }
    const abs_days = Math.floor(abs_ms / DAY_MS)
    if (abs_days > 0) {
      return `expired ${abs_days} ${plural(abs_days, 'day')} ago`
    }
    const abs_hours = Math.floor(abs_ms / HOUR_MS)
    return `expired ${abs_hours} ${plural(abs_hours, 'hour')} ago`
  }

  // Future branches. IP-F: delta in (0, 24h) → "expires today".
  if (delta_ms < DAY_MS) {
    return 'expires today'
  }

  // delta in [24h, 30d] — multi-unit future.
  const days = Math.floor(delta_ms / DAY_MS)
  const remainder_ms = delta_ms - days * DAY_MS
  const hours = Math.floor(remainder_ms / HOUR_MS)

  if (hours === 0) {
    return `expires in ${days} ${plural(days, 'day')}`
  }
  return `expires in ${days} ${plural(days, 'day')}, ${hours} ${plural(hours, 'hour')}`
}

// ─── Internal helpers ─────────────────────────────────────────────

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`
}
