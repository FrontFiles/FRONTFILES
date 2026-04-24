// ═══════════════════════════════════════════════════════════════
// expiry-display — pure-helper tests (§R6-pure / §F10)
//
// 6 test cases per §F10: past / future / today / day-plural / hour
// / fallback. `past` and `day-plural` bundle related sub-assertions
// per Prompt 3 ratification §F10 bundling discipline (IP-3 lesson
// carried forward).
//
// Time-mock: explicit `now: Date` at each call site per IP-M. No
// `vi.setSystemTime` — mirrors `state.test.ts:212-228` canonical
// pattern. All test deltas computed relative to a fixed `NOW`
// constant via `expiresAtFromDelta(delta_ms)`.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import { formatExpiry } from '@/lib/offer/expiry-display'

// ─── Fixtures ───────────────────────────────────────────────────

const NOW = new Date('2026-04-23T12:00:00.000Z')

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function expiresAtFromDelta(delta_ms: number): string {
  return new Date(NOW.getTime() + delta_ms).toISOString()
}

// ─── Tests ──────────────────────────────────────────────────────

describe('formatExpiry — past (IP-I verbatim, IP-I.a sub-hour)', () => {
  it('renders days-past, hours-past, and sub-hour-past branches', () => {
    // Sub-assertion (a) — days-past: `expired 2 days ago`.
    const expiresA = expiresAtFromDelta(-2 * DAY_MS - 3 * HOUR_MS)
    expect(formatExpiry(expiresA, NOW)).toBe('expired 2 days ago')

    // Sub-assertion (b) — hours-past (plural): `expired 5 hours ago`.
    const expiresB = expiresAtFromDelta(-5 * HOUR_MS - 30 * 60 * 1000)
    expect(formatExpiry(expiresB, NOW)).toBe('expired 5 hours ago')

    // Sub-assertion (c) — sub-hour-past (IP-I.a).
    const expiresC = expiresAtFromDelta(-30 * 60 * 1000)
    expect(formatExpiry(expiresC, NOW)).toBe(
      'expired less than an hour ago',
    )
  })
})

describe('formatExpiry — future multi-unit', () => {
  it('renders "expires in 3 days, 4 hours" for a 3d4h-plus-tail delta (IP-E floor)', () => {
    // 3d 4h 30m — floor to 3d 4h per IP-E.
    const expires = expiresAtFromDelta(
      3 * DAY_MS + 4 * HOUR_MS + 30 * 60 * 1000,
    )
    expect(formatExpiry(expires, NOW)).toBe('expires in 3 days, 4 hours')
  })
})

describe('formatExpiry — today (IP-F: delta < 24h)', () => {
  it('renders "expires today" for a +5h delta', () => {
    const expires = expiresAtFromDelta(5 * HOUR_MS)
    expect(formatExpiry(expires, NOW)).toBe('expires today')
  })
})

describe('formatExpiry — day-plural boundary (IP-H)', () => {
  it('renders "1 day" singular at +24h and "2 days" plural at +48h', () => {
    // Sub-assertion (a) — singular boundary at 24h exact.
    const expiresA = expiresAtFromDelta(DAY_MS)
    expect(formatExpiry(expiresA, NOW)).toBe('expires in 1 day')

    // Sub-assertion (b) — plural at 48h.
    const expiresB = expiresAtFromDelta(2 * DAY_MS)
    expect(formatExpiry(expiresB, NOW)).toBe('expires in 2 days')
  })
})

describe('formatExpiry — hour singular past (IP-H)', () => {
  it('renders "expired 1 hour ago" for a -1h delta', () => {
    // -1h exactly exercises the singular boundary of the hour unit
    // in the past branch, which the "past" bundle's plural
    // ("5 hours ago") does not cover.
    const expires = expiresAtFromDelta(-1 * HOUR_MS)
    expect(formatExpiry(expires, NOW)).toBe('expired 1 hour ago')
  })
})

describe('formatExpiry — fallback beyond ±30d (IP-G)', () => {
  it('renders YYYY-MM-DD date portion of the ISO string', () => {
    // +40d from 2026-04-23T12:00:00Z → 2026-06-02T12:00:00Z.
    const expires = expiresAtFromDelta(40 * DAY_MS)
    expect(formatExpiry(expires, NOW)).toBe('2026-06-02')
  })
})
