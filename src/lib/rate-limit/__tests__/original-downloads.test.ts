/**
 * Rate Limiter — Original Downloads Tests
 *
 * Tests the rate-limiting policy for original file delivery.
 * Uses in-memory sliding window counters (no DB dependency).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { checkOriginalDownloadRate } from '../original-downloads'
import { _resetAllCounters } from '../sliding-window'

beforeEach(() => {
  _resetAllCounters()
})

const USER_ID = 'user-rate-001'
const IP = '192.168.1.1'

// ══════════════════════════════════════════════
// CREATOR EXEMPTION
// ══════════════════════════════════════════════

describe('creator exemption', () => {
  it('always allows creator self-access regardless of prior attempts', () => {
    // Exhaust the user limit first
    for (let i = 0; i < 15; i++) {
      checkOriginalDownloadRate({
        userId: USER_ID,
        ipAddress: IP,
        isCreatorSelfAccess: false,
      })
    }

    // Creator self-access should still be allowed
    const result = checkOriginalDownloadRate({
      userId: USER_ID,
      ipAddress: IP,
      isCreatorSelfAccess: true,
    })

    expect(result.allowed).toBe(true)
  })

  it('does not increment counters for creator self-access', () => {
    // Make many creator requests
    for (let i = 0; i < 20; i++) {
      checkOriginalDownloadRate({
        userId: USER_ID,
        ipAddress: IP,
        isCreatorSelfAccess: true,
      })
    }

    // Non-creator request should still be allowed (counters not affected)
    const result = checkOriginalDownloadRate({
      userId: USER_ID,
      ipAddress: IP,
      isCreatorSelfAccess: false,
    })

    expect(result.allowed).toBe(true)
  })
})

// ══════════════════════════════════════════════
// PER-USER BURST LIMIT
// ══════════════════════════════════════════════

describe('per-user burst limit', () => {
  it('allows requests within burst limit (default 10/min)', () => {
    for (let i = 0; i < 10; i++) {
      const result = checkOriginalDownloadRate({
        userId: USER_ID,
        ipAddress: IP,
        isCreatorSelfAccess: false,
      })
      expect(result.allowed).toBe(true)
    }
  })

  it('denies the 11th request within burst window', () => {
    for (let i = 0; i < 10; i++) {
      checkOriginalDownloadRate({
        userId: USER_ID,
        ipAddress: IP,
        isCreatorSelfAccess: false,
      })
    }

    const result = checkOriginalDownloadRate({
      userId: USER_ID,
      ipAddress: IP,
      isCreatorSelfAccess: false,
    })

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('does not affect a different user', () => {
    // Exhaust user-rate-001
    for (let i = 0; i < 11; i++) {
      checkOriginalDownloadRate({
        userId: USER_ID,
        ipAddress: IP,
        isCreatorSelfAccess: false,
      })
    }

    // Different user should still be allowed
    const result = checkOriginalDownloadRate({
      userId: 'user-rate-002',
      ipAddress: IP,
      isCreatorSelfAccess: false,
    })

    expect(result.allowed).toBe(true)
  })
})

// ══════════════════════════════════════════════
// PER-IP BACKSTOP
// ══════════════════════════════════════════════

describe('per-IP backstop', () => {
  it('denies when IP hourly limit is exceeded across many users', () => {
    // Default IP hourly limit is 300. Use distinct users to avoid
    // hitting per-user limits first.
    for (let i = 0; i < 300; i++) {
      checkOriginalDownloadRate({
        userId: `ip-test-user-${i}`,
        ipAddress: '10.0.0.1',
        isCreatorSelfAccess: false,
      })
    }

    const result = checkOriginalDownloadRate({
      userId: 'ip-test-user-300',
      ipAddress: '10.0.0.1',
      isCreatorSelfAccess: false,
    })

    expect(result.allowed).toBe(false)
  })

  it('allows when IP is null (no backstop check)', () => {
    // Exhaust would-be IP limit but with null IP
    for (let i = 0; i < 10; i++) {
      const result = checkOriginalDownloadRate({
        userId: USER_ID,
        ipAddress: null,
        isCreatorSelfAccess: false,
      })
      expect(result.allowed).toBe(true)
    }
  })
})

// ══════════════════════════════════════════════
// FAIL-OPEN SAFETY (never throws)
// ══════════════════════════════════════════════

describe('fail-open safety', () => {
  it('returns allowed=true and never throws on edge case inputs', () => {
    // Empty strings, weird values — must not crash
    const result = checkOriginalDownloadRate({
      userId: '',
      ipAddress: '',
      isCreatorSelfAccess: false,
    })
    // Should allow (first request for this "user")
    expect(result.allowed).toBe(true)
  })
})
