/**
 * Authorization Invariants — Tests
 *
 * Tests that prove the authorization model is correct and fail-closed.
 * Focuses on:
 *   - company membership edge cases not covered by services.test.ts
 *   - authorization domain separation
 *   - eligible-role consistency
 *   - fail-closed behavior on ambiguous data
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { resolveDownloadAuthorization } from '../services'
import {
  putGrant,
  putMembership,
  _resetStore,
  hasEligibleMembership,
  hasAnyActiveMembership,
} from '../store'
import {
  makeGrant,
  makeMembership,
  resetCounters,
  BUYER_ID,
  ASSET_ID,
  COMPANY_ID,
} from './helpers'
import { DOWNLOAD_ELIGIBLE_ROLES } from '@/lib/company-roles'

beforeEach(() => {
  _resetStore()
  resetCounters()
})

// ══════════════════════════════════════════════
// COMPANY MEMBERSHIP EDGE CASES
// ══════════════════════════════════════════════

describe('company membership — all non-active statuses deny', () => {
  const nonActiveStatuses = ['invited', 'revoked', 'left'] as const

  for (const status of nonActiveStatuses) {
    it(`denies company grant when membership status is '${status}'`, async () => {
      const memberId = `member-${status}`
      putGrant(
        makeGrant({
          buyer_id: BUYER_ID,
          grantee_company_id: COMPANY_ID,
        }),
      )
      putMembership(
        makeMembership({
          user_id: memberId,
          company_id: COMPANY_ID,
          role: 'admin',
          status,
        }),
      )

      const decision = await resolveDownloadAuthorization(memberId, ASSET_ID)
      expect(decision.allowed).toBe(false)
    })
  }
})

describe('company membership — role eligibility', () => {
  it('allows each eligible role individually', async () => {
    for (const role of DOWNLOAD_ELIGIBLE_ROLES) {
      _resetStore()
      resetCounters()
      const memberId = `member-${role}`
      putGrant(
        makeGrant({
          buyer_id: BUYER_ID,
          grantee_company_id: COMPANY_ID,
        }),
      )
      putMembership(
        makeMembership({
          user_id: memberId,
          company_id: COMPANY_ID,
          role,
          status: 'active',
        }),
      )

      const decision = await resolveDownloadAuthorization(memberId, ASSET_ID)
      expect(decision.allowed).toBe(true)
      if (decision.allowed) {
        expect(decision.granteeType).toBe('company')
      }
    }
  })
})

describe('company membership — missing membership row', () => {
  it('denies when no membership row exists at all', async () => {
    const noMemberId = 'no-membership-user'
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        grantee_company_id: COMPANY_ID,
      }),
    )
    // No putMembership call — row doesn't exist

    const decision = await resolveDownloadAuthorization(noMemberId, ASSET_ID)
    expect(decision.allowed).toBe(false)
  })

  it('denies when membership is for a different company', async () => {
    const memberId = 'wrong-company-member'
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        grantee_company_id: COMPANY_ID,
      }),
    )
    putMembership(
      makeMembership({
        user_id: memberId,
        company_id: 'other-company-999',
        role: 'admin',
        status: 'active',
      }),
    )

    const decision = await resolveDownloadAuthorization(memberId, ASSET_ID)
    expect(decision.allowed).toBe(false)
  })
})

// ══════════════════════════════════════════════
// ELIGIBLE ROLES — SINGLE SOURCE OF TRUTH
// ══════════════════════════════════════════════

describe('eligible roles consistency', () => {
  it('DOWNLOAD_ELIGIBLE_ROLES contains exactly admin, content_commit_holder, editor', () => {
    expect([...DOWNLOAD_ELIGIBLE_ROLES].sort()).toEqual([
      'admin',
      'content_commit_holder',
      'editor',
    ])
  })

  it('entitlement store uses the same roles as the shared constant', async () => {
    // Verify that hasEligibleMembership with the shared constant
    // matches what the store actually checks
    putMembership(
      makeMembership({
        user_id: 'role-test-user',
        company_id: COMPANY_ID,
        role: 'editor',
        status: 'active',
      }),
    )

    const result = await hasEligibleMembership(
      'role-test-user',
      COMPANY_ID,
      DOWNLOAD_ELIGIBLE_ROLES,
    )
    expect(result).toBe(true)
  })
})

// ══════════════════════════════════════════════
// AUTHORIZATION DOMAIN SEPARATION
// ══════════════════════════════════════════════

describe('authorization domain separation', () => {
  it('entitlement decision does not include package-related fields', async () => {
    putGrant(makeGrant({ buyer_id: BUYER_ID }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      // The decision should contain ONLY entitlement-domain fields
      const keys = Object.keys(decision).sort()
      expect(keys).toEqual([
        'allowed',
        'companyId',
        'exclusive',
        'grantId',
        'granteeType',
        'licenceType',
      ])
      // No packageId, no artifactId, no storageRef, no assetMediaId
    }
  })

  it('deny decision does not include package-related fields', async () => {
    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      const keys = Object.keys(decision).sort()
      expect(keys).toEqual(['allowed', 'grantId', 'reason'])
    }
  })
})

// ══════════════════════════════════════════════
// MODULE BOUNDARY — NO DOMAIN CROSSING
// ══════════════════════════════════════════════

describe('module boundary — no domain crossing', () => {
  // These tests read source files directly to verify that no
  // import crosses the entitlement ↔ fulfilment boundary.
  // This is a structural regression guard.

  const fs = require('fs')
  const path = require('path')
  // `__dirname` is `src/lib/entitlement/__tests__`. Walking up
  // two levels lands at `src/lib`, which is the canonical root
  // for these module-boundary checks.
  const libRoot = path.resolve(__dirname, '../..')

  it('fulfilment store does not import from entitlement module', () => {
    const source = fs.readFileSync(
      path.join(libRoot, 'fulfilment/store.ts'),
      'utf-8',
    )
    expect(source).not.toMatch(/from ['"]@\/lib\/entitlement/)
  })

  it('entitlement store does not import from fulfilment module', () => {
    const source = fs.readFileSync(
      path.join(libRoot, 'entitlement/store.ts'),
      'utf-8',
    )
    expect(source).not.toMatch(/from ['"]@\/lib\/fulfilment/)
  })

  it('entitlement service does not import from fulfilment module', () => {
    const source = fs.readFileSync(
      path.join(libRoot, 'entitlement/services.ts'),
      'utf-8',
    )
    expect(source).not.toMatch(/from ['"]@\/lib\/fulfilment/)
  })
})

// ══════════════════════════════════════════════
// FAIL-CLOSED ON AMBIGUOUS DATA
// ══════════════════════════════════════════════

describe('fail-closed on ambiguous data', () => {
  it('denies when grant has null grantee_company_id and buyer_id does not match', async () => {
    putGrant(
      makeGrant({
        buyer_id: 'someone-else',
        grantee_company_id: null,
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)
    expect(decision.allowed).toBe(false)
  })

  it('hasEligibleMembership returns false for non-existent company', async () => {
    const result = await hasEligibleMembership(
      BUYER_ID,
      'nonexistent-company',
      DOWNLOAD_ELIGIBLE_ROLES,
    )
    expect(result).toBe(false)
  })

  it('hasAnyActiveMembership returns false for non-existent company', async () => {
    const result = await hasAnyActiveMembership(
      BUYER_ID,
      'nonexistent-company',
    )
    expect(result).toBe(false)
  })

  it('hasEligibleMembership returns false for non-existent user', async () => {
    const result = await hasEligibleMembership(
      'nonexistent-user',
      COMPANY_ID,
      DOWNLOAD_ELIGIBLE_ROLES,
    )
    expect(result).toBe(false)
  })
})
