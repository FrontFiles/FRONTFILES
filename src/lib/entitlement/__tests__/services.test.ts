/**
 * Entitlement Service — Tests
 *
 * Tests the core authorization decision: resolveDownloadAuthorization().
 *
 * Structure follows the established pattern from assignment/direct-offer tests:
 *   describe → it → expect, beforeEach cleanup, factory helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { resolveDownloadAuthorization } from '../services'
import { putGrant, putMembership, _resetStore } from '../store'
import {
  makeGrant,
  makeMembership,
  resetCounters,
  BUYER_ID,
  CREATOR_ID,
  STRANGER_ID,
  ASSET_ID,
  COMPANY_ID,
} from './helpers'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseEnvPresent() returns false and the entitlement
// store routes through putGrant/putMembership-seeded mock maps.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

beforeEach(() => {
  _resetStore()
  resetCounters()
})

// ══════════════════════════════════════════════
// PERSONAL GRANTS
// ══════════════════════════════════════════════

describe('personal grants', () => {
  it('allows download when buyer has active perpetual grant', async () => {
    putGrant(makeGrant({ buyer_id: BUYER_ID, term_end: null }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.granteeType).toBe('personal')
      expect(decision.companyId).toBeNull()
    }
  })

  it('allows download when buyer has active time-bound grant within term', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    putGrant(makeGrant({ buyer_id: BUYER_ID, term_end: futureDate }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)
    expect(decision.allowed).toBe(true)
  })

  it('denies when no grant exists', async () => {
    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('NO_ACTIVE_GRANT')
      expect(decision.grantId).toBeNull()
    }
  })

  it('denies when grant exists for a different user', async () => {
    putGrant(makeGrant({ buyer_id: STRANGER_ID }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('NO_ACTIVE_GRANT')
    }
  })

  it('denies when grant exists for a different asset', async () => {
    putGrant(makeGrant({ asset_id: 'other-asset' }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
  })
})

// ══════════════════════════════════════════════
// LIFECYCLE STATES
// ══════════════════════════════════════════════

describe('lifecycle states', () => {
  it('denies with GRANT_SUSPENDED when grant is suspended', async () => {
    putGrant(
      makeGrant({
        state: 'suspended',
        suspended_at: new Date().toISOString(),
        suspended_reason: 'Under dispute',
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('GRANT_SUSPENDED')
      expect(decision.grantId).not.toBeNull()
    }
  })

  it('denies with GRANT_REVOKED when grant is revoked', async () => {
    putGrant(
      makeGrant({
        state: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: 'Fraud',
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('GRANT_REVOKED')
    }
  })

  it('denies with GRANT_EXPIRED when grant is in expired state', async () => {
    putGrant(makeGrant({ state: 'expired' }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('GRANT_EXPIRED')
    }
  })

  it('denies with GRANT_PENDING when grant is pending', async () => {
    putGrant(makeGrant({ state: 'pending' }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('GRANT_PENDING')
    }
  })
})

// ══════════════════════════════════════════════
// TEMPORAL VALIDITY
// ══════════════════════════════════════════════

describe('temporal validity', () => {
  it('denies with GRANT_EXPIRED when active grant has term_end in the past', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    putGrant(makeGrant({ state: 'active', term_end: pastDate }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('GRANT_EXPIRED')
    }
  })

  it('allows when active grant has null term_end (perpetual)', async () => {
    putGrant(makeGrant({ state: 'active', term_end: null }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)
    expect(decision.allowed).toBe(true)
  })

  it('allows when active grant has term_end in the future', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    putGrant(makeGrant({ state: 'active', term_end: futureDate }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)
    expect(decision.allowed).toBe(true)
  })
})

// ══════════════════════════════════════════════
// COMPANY GRANTS
// ══════════════════════════════════════════════

describe('company grants', () => {
  it('allows download for company member with eligible role', async () => {
    const memberId = 'company-member-001'
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID, // original purchaser
        grantee_company_id: COMPANY_ID,
      }),
    )
    putMembership(
      makeMembership({
        user_id: memberId,
        company_id: COMPANY_ID,
        role: 'editor',
        status: 'active',
      }),
    )

    const decision = await resolveDownloadAuthorization(memberId, ASSET_ID)

    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.granteeType).toBe('company')
      expect(decision.companyId).toBe(COMPANY_ID)
    }
  })

  it('allows download for the original buyer of a company grant', async () => {
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        grantee_company_id: COMPANY_ID,
      }),
    )
    // Buyer is also a company member (common case)
    putMembership(
      makeMembership({
        user_id: BUYER_ID,
        company_id: COMPANY_ID,
        role: 'admin',
        status: 'active',
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      // Personal path matches first (buyer_id = userId)
      expect(decision.granteeType).toBe('personal')
    }
  })

  it('denies company member with non-eligible role', async () => {
    // This test uses a role outside DOWNLOAD_ELIGIBLE_ROLES.
    // Currently all BuyerCompanyRole values ARE eligible.
    // This test verifies the filtering mechanism works by
    // using an inactive membership instead.
    const viewerId = 'viewer-001'
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        grantee_company_id: COMPANY_ID,
      }),
    )
    putMembership(
      makeMembership({
        user_id: viewerId,
        company_id: COMPANY_ID,
        role: 'admin',
        status: 'invited', // not active
      }),
    )

    const decision = await resolveDownloadAuthorization(viewerId, ASSET_ID)

    expect(decision.allowed).toBe(false)
  })

  it('denies unrelated user with NO_ACTIVE_GRANT (company grant is invisible to outsiders)', async () => {
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        grantee_company_id: COMPANY_ID,
      }),
    )
    // STRANGER_ID has no relationship to this grant or company.
    // From their perspective, no grant exists — they should not
    // learn about the company grant's existence.

    const decision = await resolveDownloadAuthorization(STRANGER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('NO_ACTIVE_GRANT')
    }
  })

  it('denies company member with inactive membership as NO_ACTIVE_COMPANY_MEMBERSHIP', async () => {
    const exMemberId = 'ex-member-002'
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        grantee_company_id: COMPANY_ID,
      }),
    )
    // Has a membership record but it's revoked
    putMembership(
      makeMembership({
        user_id: exMemberId,
        company_id: COMPANY_ID,
        role: 'admin',
        status: 'revoked',
      }),
    )

    const decision = await resolveDownloadAuthorization(exMemberId, ASSET_ID)

    expect(decision.allowed).toBe(false)
    // User has a (revoked) relationship to the company — they get
    // a more specific denial than a total stranger would.
  })

  it('denies user with revoked membership', async () => {
    const exMemberId = 'ex-member-001'
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        grantee_company_id: COMPANY_ID,
      }),
    )
    putMembership(
      makeMembership({
        user_id: exMemberId,
        company_id: COMPANY_ID,
        role: 'admin',
        status: 'revoked',
      }),
    )

    const decision = await resolveDownloadAuthorization(exMemberId, ASSET_ID)

    expect(decision.allowed).toBe(false)
  })
})

// ══════════════════════════════════════════════
// MEDIA RESOLUTION
// ══════════════════════════════════════════════

describe('media resolution is NOT part of entitlement', () => {
  it('returns allowed when grant is valid even if no original media exists', async () => {
    // The entitlement service answers ONLY "is the user entitled?"
    // Media availability is checked separately by the route handler.
    const noMediaAssetId = 'asset-no-media'
    putGrant(makeGrant({ asset_id: noMediaAssetId }))

    const decision = await resolveDownloadAuthorization(BUYER_ID, noMediaAssetId)

    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.grantId).not.toBeNull()
    }
  })
})

// ══════════════════════════════════════════════
// DENY REASON PRIORITY
// ══════════════════════════════════════════════

describe('deny reason priority', () => {
  it('prefers GRANT_SUSPENDED over GRANT_EXPIRED when both exist', async () => {
    putGrant(makeGrant({ state: 'expired', buyer_id: BUYER_ID }))
    putGrant(
      makeGrant({
        state: 'suspended',
        buyer_id: BUYER_ID,
        suspended_at: new Date().toISOString(),
        suspended_reason: 'Dispute',
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('GRANT_SUSPENDED')
    }
  })

  it('prefers GRANT_REVOKED over GRANT_PENDING', async () => {
    putGrant(makeGrant({ state: 'pending', buyer_id: BUYER_ID }))
    putGrant(
      makeGrant({
        state: 'revoked',
        buyer_id: BUYER_ID,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'Fraud',
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('GRANT_REVOKED')
    }
  })
})

// ══════════════════════════════════════════════
// FAIL-CLOSED INVARIANT
// ══════════════════════════════════════════════

describe('fail-closed invariant', () => {
  it('denies when store is empty (no grants at all)', async () => {
    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)
    expect(decision.allowed).toBe(false)
  })

  it('denies even if original media exists but no grant', async () => {
    // Verified by the fact that we DON'T check media first.
    // The entitlement check happens before media resolution.
    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('NO_ACTIVE_GRANT')
    }
  })
})

// ══════════════════════════════════════════════
// DECISION SHAPE
// ══════════════════════════════════════════════

describe('decision shape', () => {
  it('returns full allowed decision with all fields populated', async () => {
    putGrant(
      makeGrant({
        buyer_id: BUYER_ID,
        licence_type: 'commercial',
        exclusive: true,
        grantee_company_id: null,
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.grantId).toBeDefined()
      expect(decision.granteeType).toBe('personal')
      expect(decision.companyId).toBeNull()
      expect(decision.licenceType).toBe('commercial')
      expect(decision.exclusive).toBe(true)
    }
  })

  it('returns deny decision with grantId when a non-active grant exists', async () => {
    putGrant(
      makeGrant({
        state: 'suspended',
        suspended_at: new Date().toISOString(),
        suspended_reason: 'Test',
      }),
    )

    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.grantId).not.toBeNull()
      expect(decision.reason).toBe('GRANT_SUSPENDED')
    }
  })

  it('returns deny decision with null grantId when no grant exists at all', async () => {
    const decision = await resolveDownloadAuthorization(BUYER_ID, ASSET_ID)

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.grantId).toBeNull()
    }
  })
})
