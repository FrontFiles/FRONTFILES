// ═══════════════════════════════════════════════════════════════
// POST /api/auth/signout — route tests (P4 concern 4A.2.AUTH §F6)
//
// Signout is a no-op marker today (Supabase sign-out is browser-
// side; see the route header for the full intent). These tests
// pin the two observable outcomes:
//
//   1. Flag off  → 404 FEATURE_DISABLED   (surface posture parity)
//   2. Flag on   → 204 No Content          (no-op acknowledged)
//
// No auth mock is needed — the route does not read headers or body.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { scopeEnvVars } from '@/lib/test/env-scope'

scopeEnvVars(['FFF_AUTH_WIRED'])

import { POST } from '../route'

beforeEach(() => {
  // Default: flag off. Individual tests stub it on as needed.
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/auth/signout', () => {
  it('returns 404 FEATURE_DISABLED when FFF_AUTH_WIRED is unset', async () => {
    const res = await POST()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('FEATURE_DISABLED')
  })

  it('returns 204 No Content when FFF_AUTH_WIRED=true', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    const res = await POST()
    expect(res.status).toBe(204)
    // 204 bodies are empty by HTTP contract.
    const bodyText = await res.text()
    expect(bodyText).toBe('')
  })
})
