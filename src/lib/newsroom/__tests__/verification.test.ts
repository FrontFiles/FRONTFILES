// ═══════════════════════════════════════════════════════════════
// Frontfiles — Newsroom verification helper tests (NR-D5b-i, F11)
//
// Unit coverage for the three pure helpers in src/lib/newsroom/
// verification.ts: deriveDnsTxtToken, expectedDnsTxtRecord, and
// computeTier. The async recomputeTier helper has a DB seam and
// is exercised via runtime smoke on the recheck endpoint — no
// unit test here (directive §F11 explicitly scopes us to the
// pure trio).
//
// Env note: vitest.config.ts loads .env.local into worker env via
// @next/env + forwardedEnv (see vitest.config.ts header). As long
// as NEWSROOM_VERIFICATION_HMAC_SECRET is set in .env.local (it is,
// populated during NR-D5b-i composition), the helpers will find it
// without additional setup. The "throws when missing" case uses
// vi.stubEnv to simulate an unset value.
// ═══════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  computeTier,
  deriveDnsTxtToken,
  expectedDnsTxtRecord,
} from '../verification'

describe('deriveDnsTxtToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is deterministic for the same companyId', () => {
    const a = deriveDnsTxtToken('11111111-1111-1111-1111-111111111111')
    const b = deriveDnsTxtToken('11111111-1111-1111-1111-111111111111')
    expect(a).toBe(b)
  })

  it('differs across companyIds', () => {
    const a = deriveDnsTxtToken('11111111-1111-1111-1111-111111111111')
    const b = deriveDnsTxtToken('22222222-2222-2222-2222-222222222222')
    expect(a).not.toBe(b)
  })

  it('returns 32 lowercase hex chars', () => {
    const t = deriveDnsTxtToken('33333333-3333-3333-3333-333333333333')
    expect(t).toMatch(/^[0-9a-f]{32}$/)
  })

  it('throws if env secret is missing', () => {
    vi.stubEnv('NEWSROOM_VERIFICATION_HMAC_SECRET', '')
    expect(() =>
      deriveDnsTxtToken('44444444-4444-4444-4444-444444444444'),
    ).toThrow(/NEWSROOM_VERIFICATION_HMAC_SECRET/)
  })
})

describe('expectedDnsTxtRecord', () => {
  it('returns recordName = domain and recordValue = frontfiles-verify=<token>', () => {
    const { recordName, recordValue } = expectedDnsTxtRecord(
      '55555555-5555-5555-5555-555555555555',
      'acme.com',
    )
    expect(recordName).toBe('acme.com')
    expect(recordValue).toMatch(/^frontfiles-verify=[0-9a-f]{32}$/)
  })

  it('embeds the deterministic token for the same companyId', () => {
    const companyId = '66666666-6666-6666-6666-666666666666'
    const token = deriveDnsTxtToken(companyId)
    const { recordValue } = expectedDnsTxtRecord(companyId, 'example.org')
    expect(recordValue).toBe(`frontfiles-verify=${token}`)
  })
})

describe('computeTier', () => {
  it('empty records → unverified', () => {
    expect(computeTier([])).toBe('unverified')
  })

  it('only dns_txt → unverified', () => {
    expect(computeTier([{ method: 'dns_txt' }])).toBe('unverified')
  })

  it('only domain_email → unverified', () => {
    expect(computeTier([{ method: 'domain_email' }])).toBe('unverified')
  })

  it('only authorized_signatory → unverified', () => {
    expect(computeTier([{ method: 'authorized_signatory' }])).toBe('unverified')
  })

  it('dns_txt + domain_email → verified_source', () => {
    expect(
      computeTier([{ method: 'dns_txt' }, { method: 'domain_email' }]),
    ).toBe('verified_source')
  })

  it('dns_txt + domain_email + authorized_signatory → verified_publisher', () => {
    expect(
      computeTier([
        { method: 'dns_txt' },
        { method: 'domain_email' },
        { method: 'authorized_signatory' },
      ]),
    ).toBe('verified_publisher')
  })

  it('dns_txt + authorized_signatory (no email) → unverified', () => {
    expect(
      computeTier([
        { method: 'dns_txt' },
        { method: 'authorized_signatory' },
      ]),
    ).toBe('unverified')
  })
})
