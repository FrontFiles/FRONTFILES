/**
 * Frontfiles — Newsroom P1 signup schema tests (NR-D5a, F6)
 *
 * Covers the nine cases required by the directive §F6 test plan.
 * Pure schema tests — no DB, no Supabase, no Next.js runtime. Run
 * under the default `node` environment in vitest.config.ts.
 *
 * Cross-reference:
 *   - docs/public-newsroom/directives/NR-D5a-p1-signup.md §F6
 *   - ../schema.ts
 */

import { describe, expect, it } from 'vitest'

import { SignupSchema } from '../schema'

const VALID = {
  orgName: 'Acme News',
  legalName: 'Acme News, Inc.',
  primaryDomain: 'acme.com',
  countryCode: 'US',
  termsAccepted: 'on',
} as const

describe('SignupSchema', () => {
  it('accepts a valid input (happy path)', () => {
    const result = SignupSchema.safeParse(VALID)
    expect(result.success).toBe(true)
  })

  it('rejects empty orgName with the "required" message', () => {
    const result = SignupSchema.safeParse({ ...VALID, orgName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'orgName')
      expect(issue?.message).toBe('Organisation name is required')
    }
  })

  it('rejects empty legalName with the "required" message', () => {
    const result = SignupSchema.safeParse({ ...VALID, legalName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'legalName',
      )
      expect(issue?.message).toBe('Registered legal name is required')
    }
  })

  it('rejects primaryDomain "not a domain"', () => {
    const result = SignupSchema.safeParse({
      ...VALID,
      primaryDomain: 'not a domain',
    })
    expect(result.success).toBe(false)
  })

  it('normalises primaryDomain "ACME.COM" -> "acme.com"', () => {
    const result = SignupSchema.safeParse({
      ...VALID,
      primaryDomain: 'ACME.COM',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.primaryDomain).toBe('acme.com')
    }
  })

  it('normalises countryCode "us" -> "US"', () => {
    const result = SignupSchema.safeParse({ ...VALID, countryCode: 'us' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.countryCode).toBe('US')
    }
  })

  it('rejects 3-char countryCode "USA"', () => {
    const result = SignupSchema.safeParse({ ...VALID, countryCode: 'USA' })
    expect(result.success).toBe(false)
  })

  it('rejects missing termsAccepted with the terms message', () => {
    const result = SignupSchema.safeParse({
      orgName: VALID.orgName,
      legalName: VALID.legalName,
      primaryDomain: VALID.primaryDomain,
      countryCode: VALID.countryCode,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'termsAccepted',
      )
      expect(issue?.message).toBe(
        'You must accept the Distributor Terms and Content Standards',
      )
    }
  })

  it('accepts termsAccepted = "on"', () => {
    const result = SignupSchema.safeParse({ ...VALID, termsAccepted: 'on' })
    expect(result.success).toBe(true)
  })
})
