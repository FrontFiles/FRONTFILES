// ═══════════════════════════════════════════════════════════════
// GET /api/offers — list route integration tests (P4 4A.2 §F7)
//
// Mirrors the mock shape used by
// src/app/api/offers/[id]/__tests__/get.route.test.ts. Unified
// client supports auth.getUser + from(actor_handles | offers).
// Offers chain terminates at .limit() (not .maybeSingle()) — the
// list query is .select().order().limit().
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { scopeEnvVars } from '@/lib/test/env-scope'

scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FFF_AUTH_WIRED',
])

// ─── IDs ────────────────────────────────────────────────────────
const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111'
const ACTOR_HANDLE = '22222222-2222-4222-8222-222222222222'
const BUYER_ID = AUTH_USER_ID
const CREATOR_ID = '33333333-3333-4333-8333-333333333333'

type MockOfferRow = {
  id: string
  buyer_id: string
  creator_id: string
  target_type: string
  gross_fee: number
  platform_fee_bps: number
  currency: string
  rights: unknown
  current_note: string | null
  expires_at: string
  state: string
  cancelled_by: string | null
  created_at: string
  updated_at: string
}

const mockState = vi.hoisted(() => ({
  getUser: async (_jwt?: string): Promise<{
    data: { user: { id: string } } | null
    error: { message: string } | null
  }> => ({ data: null, error: { message: 'unconfigured' } }),
  actorRow: null as { handle: string; auth_user_id: string } | null,
  offerRows: [] as unknown[],
  offersError: null as { code?: string; message: string } | null,
}))

vi.mock('@/lib/db/client', () => {
  const client = {
    auth: {
      getUser: (jwt?: string) => mockState.getUser(jwt),
    },
    from: (table: string) => {
      const chain: {
        select: (...a: unknown[]) => typeof chain
        eq: (...a: unknown[]) => typeof chain
        is: (...a: unknown[]) => typeof chain
        order: (...a: unknown[]) => typeof chain
        limit: (...a: unknown[]) => Promise<{ data: unknown; error: unknown }>
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      } = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        limit: async () => {
          if (table === 'offers')
            return { data: mockState.offerRows, error: mockState.offersError }
          return { data: [], error: null }
        },
        maybeSingle: async () => {
          if (table === 'actor_handles')
            return { data: mockState.actorRow, error: null }
          return { data: null, error: null }
        },
      }
      return chain
    },
    rpc: async () => ({ data: null, error: null }),
  }
  return {
    getSupabaseClient: () => client,
    getSupabaseClientForUser: (_t: string) => client,
    _resetSupabaseClient: () => {},
    isSupabaseConfigured: () => true,
  }
})

import { GET } from '../route'

function makeRequest(authorization?: string): Request {
  const headers = new Headers()
  if (authorization) headers.set('authorization', authorization)
  return new Request('http://localhost/api/offers', {
    method: 'GET',
    headers,
  })
}

function makeOffer(overrides: Partial<MockOfferRow> = {}): MockOfferRow {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    buyer_id: BUYER_ID,
    creator_id: CREATOR_ID,
    target_type: 'asset_pack',
    gross_fee: 1000,
    platform_fee_bps: 1000,
    currency: 'EUR',
    rights: { template: 'editorial_one_time', params: {}, is_transfer: false },
    current_note: 'hello',
    expires_at: '2026-05-01T00:00:00.000Z',
    state: 'sent',
    cancelled_by: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
    ...overrides,
  }
}

function setAuthedActor(): void {
  mockState.getUser = async () => ({
    data: { user: { id: AUTH_USER_ID } },
    error: null,
  })
  mockState.actorRow = { handle: ACTOR_HANDLE, auth_user_id: AUTH_USER_ID }
}

beforeEach(() => {
  mockState.getUser = async () => ({
    data: null,
    error: { message: 'default' },
  })
  mockState.actorRow = null
  mockState.offerRows = []
  mockState.offersError = null
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Tests ──────────────────────────────────────────────────────

describe('GET /api/offers — flag + auth gates', () => {
  it('returns 404 FEATURE_DISABLED when flag is unset', async () => {
    const res = await GET(
      makeRequest('Bearer t') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(404)
    const b = await res.json()
    expect(b.error.code).toBe('FEATURE_DISABLED')
  })

  it('returns 401 UNAUTHENTICATED when no Authorization', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    const res = await GET(
      makeRequest() as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 UNAUTHENTICATED when JWT is rejected', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({
      data: null,
      error: { message: 'invalid' },
    })
    const res = await GET(
      makeRequest('Bearer bad') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 ACTOR_NOT_FOUND with no actor_handles row', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('ACTOR_NOT_FOUND')
  })
})

describe('GET /api/offers — list outcomes', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    setAuthedActor()
  })

  it('returns 200 with an array and truncated=false for a party with rows under the cap', async () => {
    mockState.offerRows = [
      makeOffer({ id: '55555555-5555-4555-8555-555555555551' }),
      makeOffer({ id: '55555555-5555-4555-8555-555555555552' }),
      makeOffer({ id: '55555555-5555-4555-8555-555555555553' }),
    ]
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data.offers)).toBe(true)
    expect(body.data.offers).toHaveLength(3)
    expect(body.data.truncated).toBe(false)
  })

  it('returns truncated=true when exactly 100 rows are returned', async () => {
    mockState.offerRows = Array.from({ length: 100 }, (_, i) =>
      makeOffer({
        id: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`,
      }),
    )
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.offers).toHaveLength(100)
    expect(body.data.truncated).toBe(true)
  })
})
