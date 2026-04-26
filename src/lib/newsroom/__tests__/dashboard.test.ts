// ═══════════════════════════════════════════════════════════════
// Frontfiles — Newsroom dashboard helpers tests (NR-D6a, F9)
//
// Pure-helper coverage for src/lib/newsroom/dashboard.ts:
//   - deriveBannerState  (banner-state derivation per PRD §5.2 P5)
//   - canCreatePack       (CTA gate per PRD §3.4 invariant 2)
//   - parseFilterParams   (URL search-param validation)
//
// Time math is deterministic — `now` is injected into
// deriveBannerState rather than read from system time.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import {
  canCreatePack,
  deriveBannerState,
  parseFilterParams,
} from '../dashboard'

const NOW = new Date('2026-04-25T00:00:00.000Z')
const IN_DAYS = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString()

describe('deriveBannerState', () => {
  it("tier='unverified' wins regardless of records", () => {
    const out = deriveBannerState({
      tier: 'unverified',
      records: [
        {
          method: 'dns_txt',
          verified_at: NOW.toISOString(),
          expires_at: null,
        },
      ],
      now: NOW,
    })
    expect(out.state).toBe('unverified')
  })

  it("returns 'none' when verified_source and no records expire within 30 days", () => {
    const out = deriveBannerState({
      tier: 'verified_source',
      records: [
        {
          method: 'dns_txt',
          verified_at: NOW.toISOString(),
          expires_at: IN_DAYS(60),
        },
        {
          method: 'domain_email',
          verified_at: NOW.toISOString(),
          expires_at: null,
        },
      ],
      now: NOW,
    })
    expect(out.state).toBe('none')
  })

  it("returns 'expiring' with the soonest method when a record expires within 30 days", () => {
    const out = deriveBannerState({
      tier: 'verified_source',
      records: [
        {
          method: 'dns_txt',
          verified_at: NOW.toISOString(),
          expires_at: IN_DAYS(20),
        },
        {
          method: 'domain_email',
          verified_at: NOW.toISOString(),
          expires_at: IN_DAYS(60),
        },
      ],
      now: NOW,
    })
    expect(out.state).toBe('expiring')
    expect(out.method).toBe('dns_txt')
    expect(out.expiresAt).toBe(IN_DAYS(20))
  })

  it("picks the soonest among multiple expiring records", () => {
    const out = deriveBannerState({
      tier: 'verified_source',
      records: [
        {
          method: 'domain_email',
          verified_at: NOW.toISOString(),
          expires_at: IN_DAYS(25),
        },
        {
          method: 'dns_txt',
          verified_at: NOW.toISOString(),
          expires_at: IN_DAYS(5),
        },
      ],
      now: NOW,
    })
    expect(out.state).toBe('expiring')
    expect(out.method).toBe('dns_txt')
    expect(out.expiresAt).toBe(IN_DAYS(5))
  })

  it("does not flag 'expiring' when expires_at is null on every record", () => {
    const out = deriveBannerState({
      tier: 'verified_publisher',
      records: [
        {
          method: 'dns_txt',
          verified_at: NOW.toISOString(),
          expires_at: null,
        },
        {
          method: 'domain_email',
          verified_at: NOW.toISOString(),
          expires_at: null,
        },
        {
          method: 'authorized_signatory',
          verified_at: NOW.toISOString(),
          expires_at: null,
        },
      ],
      now: NOW,
    })
    expect(out.state).toBe('none')
  })

  it("handles an empty records list gracefully (verified tier → 'none')", () => {
    const out = deriveBannerState({
      tier: 'verified_source',
      records: [],
      now: NOW,
    })
    expect(out.state).toBe('none')
  })
})

describe('canCreatePack', () => {
  it("returns false for 'unverified'", () => {
    expect(canCreatePack('unverified')).toBe(false)
  })

  it("returns true for 'verified_source'", () => {
    expect(canCreatePack('verified_source')).toBe(true)
  })

  it("returns true for 'verified_publisher'", () => {
    expect(canCreatePack('verified_publisher')).toBe(true)
  })
})

describe('parseFilterParams', () => {
  it('returns an empty object when no params are present', () => {
    expect(parseFilterParams({})).toEqual({})
  })

  it('passes through valid status / licence / from / to', () => {
    expect(
      parseFilterParams({
        status: 'draft',
        licence: 'press_release_verbatim',
        from: '2026-04-01',
        to: '2026-04-25',
      }),
    ).toEqual({
      status: 'draft',
      licence: 'press_release_verbatim',
      from: '2026-04-01',
      to: '2026-04-25',
    })
  })

  it('drops invalid status silently', () => {
    expect(
      parseFilterParams({ status: 'not-a-real-status' }),
    ).toEqual({})
  })

  it('drops invalid licence silently', () => {
    expect(
      parseFilterParams({ licence: 'editorial_extended' }),
    ).toEqual({})
  })

  it('drops malformed date silently', () => {
    expect(
      parseFilterParams({ from: '2026/04/01', to: 'tomorrow' }),
    ).toEqual({})
  })

  it('treats empty-string values as no-value', () => {
    expect(
      parseFilterParams({
        status: '',
        licence: '',
        from: '',
        to: '',
      }),
    ).toEqual({})
  })

  it('trims whitespace before validation', () => {
    expect(parseFilterParams({ status: '  scheduled  ' })).toEqual({
      status: 'scheduled',
    })
  })
})
