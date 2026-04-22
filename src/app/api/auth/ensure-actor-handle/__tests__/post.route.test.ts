// ═══════════════════════════════════════════════════════════════
// POST /api/auth/ensure-actor-handle — route integration tests
// (P4 concern 4A.2.AUTH, F7)
//
// Mock seam: @/lib/db/client. The mock supports:
//   - auth.getUser(jwt) — authentication outcome
//   - from('actor_handles').insert(...) — insert outcome
//     (success → provisioned:true; 23505 → provisioned:false;
//      other error → 500)
//
// Six cases:
//   1. Flag off                         → 404 FEATURE_DISABLED
//   2. No Bearer header                 → 401 UNAUTHENTICATED
//   3. Invalid token                    → 401 UNAUTHENTICATED
//   4. Valid token, INSERT succeeds     → 200 { provisioned: true }
//   5. Valid token, 23505 unique-viol   → 200 { provisioned: false }
//   6. Valid token, generic DB error    → 500 INTERNAL
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { scopeEnvVars } from '@/lib/test/env-scope'

scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  // Lint exception: this is a TEST file. The eslint rule that bans
  // the literal under src/app/** exists to catch service-role leaks
  // into production client bundles; tests need to scope this env
  // var to assert the route's behavior. Same pattern as every other
  // route test under src/app/api/**/__tests__/.
  // eslint-disable-next-line no-restricted-syntax
  'SUPABASE_SERVICE_ROLE_KEY',
  'FFF_AUTH_WIRED',
])

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111'

const mockState = vi.hoisted(() => ({
  // auth.getUser(jwt) outcome.
  getUser: async (
    _jwt?: string,
  ): Promise<{
    data: { user: { id: string } } | null
    error: { message: string } | null
  }> => ({ data: null, error: { message: 'unconfigured' } }),
  // .insert(...) outcome.
  insertError: null as { code?: string; message: string } | null,
  // Spy: most recent insert payload.
  lastInsertPayload: null as unknown,
}))

vi.mock('@/lib/db/client', () => {
  const client = {
    auth: {
      getUser: (jwt?: string) => mockState.getUser(jwt),
    },
    from: (_table: string) => ({
      insert: async (payload: unknown) => {
        mockState.lastInsertPayload = payload
        return { data: null, error: mockState.insertError }
      },
    }),
  }
  return {
    getSupabaseClient: () => client,
    getSupabaseClientForUser: (_t: string) => client,
    _resetSupabaseClient: () => {},
    isSupabaseConfigured: () => true,
  }
})

import { POST } from '../route'

function makeRequest(authorization?: string): Request {
  const headers = new Headers()
  if (authorization) headers.set('authorization', authorization)
  return new Request('http://localhost/api/auth/ensure-actor-handle', {
    method: 'POST',
    headers,
  })
}

beforeEach(() => {
  // Default: unauthenticated, no insert outcome configured.
  mockState.getUser = async () => ({
    data: null,
    error: { message: 'default' },
  })
  mockState.insertError = null
  mockState.lastInsertPayload = null
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  // Lint exception: literal needed to stub the env var in this TEST.
  // The src/app/** ban exists to catch service-role leaks into the
  // production client bundle; tests must scope the var to drive the
  // route under test. See L33 for the full rationale.
  // eslint-disable-next-line no-restricted-syntax
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Tests ──────────────────────────────────────────────────────

describe('POST /api/auth/ensure-actor-handle — gate stack', () => {
  it('returns 404 FEATURE_DISABLED when FFF_AUTH_WIRED is unset', async () => {
    const res = await POST(
      makeRequest('Bearer t') as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('FEATURE_DISABLED')
    expect(mockState.lastInsertPayload).toBeNull()
  })

  it('returns 401 UNAUTHENTICATED when Authorization header is missing', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    const res = await POST(
      makeRequest() as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
    expect(mockState.lastInsertPayload).toBeNull()
  })

  it('returns 401 UNAUTHENTICATED when the Bearer token is rejected by getUser', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({
      data: null,
      error: { message: 'invalid token' },
    })
    const res = await POST(
      makeRequest('Bearer bad') as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
    expect(mockState.lastInsertPayload).toBeNull()
  })
})

describe('POST /api/auth/ensure-actor-handle — provisioning outcomes', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
  })

  it('returns 200 { provisioned: true } when the INSERT succeeds', async () => {
    mockState.insertError = null
    const res = await POST(
      makeRequest('Bearer ok') as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { provisioned: true } })

    // Wiring contract: the INSERT payload pins to the validated
    // auth.users.id and nothing else. Anything richer (e.g. caller-
    // supplied handle) would be a security hole.
    expect(mockState.lastInsertPayload).toEqual({
      auth_user_id: AUTH_USER_ID,
    })
  })

  it('returns 200 { provisioned: false } on Postgres 23505 unique_violation', async () => {
    mockState.insertError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    }
    const res = await POST(
      makeRequest('Bearer ok') as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { provisioned: false } })
  })

  it('returns 500 INTERNAL on a non-23505 DB error', async () => {
    mockState.insertError = {
      code: '23P01',
      message: 'serialization failure',
    }
    const res = await POST(
      makeRequest('Bearer ok') as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})
