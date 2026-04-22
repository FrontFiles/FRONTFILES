// ═══════════════════════════════════════════════════════════════
// POST /api/offers — route integration tests (P4 4A.2 Part B1 F8)
//
// All Supabase contact is mocked at the `@/lib/db/client` module
// seam. requireActor uses getSupabaseClient (service-role) for
// JWT + actor_handles lookup; the create route uses
// getSupabaseClientForUser for the rpc call. Both resolve into
// the same mock state here.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { scopeEnvVars } from '@/lib/test/env-scope'

scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FFF_AUTH_WIRED',
])

// Hoisted mock state — mutated per test.
const mockState = vi.hoisted(() => ({
  getUser: async (_jwt?: string): Promise<{
    data: { user: { id: string } } | null
    error: { message: string } | null
  }> => ({ data: null, error: { message: 'default — unconfigured' } }),
  actorRow: null as { handle: string; auth_user_id: string } | null,
  rpcResult: null as
    | { data: unknown; error: null }
    | { data: null; error: { code: string; message: string } }
    | null,
  rpcCalls: [] as { name: string; params: unknown }[],
}))

vi.mock('@/lib/db/client', () => {
  const buildActorChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      maybeSingle: async () => ({
        data: mockState.actorRow,
        error: null,
      }),
    }
    return chain
  }
  const client = {
    auth: {
      getUser: (jwt?: string) => mockState.getUser(jwt),
    },
    from: (_table: string) => buildActorChain(),
    rpc: async (name: string, params: unknown) => {
      mockState.rpcCalls.push({ name, params })
      return (
        mockState.rpcResult ?? {
          data: null,
          error: { code: 'XX000', message: 'mock not configured' },
        }
      )
    },
  }
  return {
    getSupabaseClient: () => client,
    getSupabaseClientForUser: (_token: string) => client,
    _resetSupabaseClient: () => {},
    isSupabaseConfigured: () => true,
  }
})

import { POST } from '../route'

// ─── helpers ────────────────────────────────────────────────────

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111'
const ACTOR_HANDLE = '22222222-2222-4222-8222-222222222222'
const CREATOR_ID = '33333333-3333-4333-8333-333333333333'
const ASSET_A = '44444444-4444-4444-8444-444444444444'
const ASSET_B = '55555555-5555-4555-8555-555555555555'
const EXPIRES_AT = '2026-05-01T00:00:00.000Z'

function makeRequest(opts: {
  headers?: Record<string, string>
  body?: unknown
}): Request {
  const headers = new Headers(opts.headers ?? {})
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return new Request('http://localhost/api/offers', {
    method: 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
}

function goodBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    creatorId: CREATOR_ID,
    targetType: 'asset_pack',
    grossFee: 1000,
    platformFeeBps: 1000,
    currency: 'EUR',
    rights: { template: 'editorial_one_time', params: {}, is_transfer: false },
    expiresAt: EXPIRES_AT,
    note: 'hello',
    items: [ASSET_A, ASSET_B],
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
    error: { message: 'default — no session' },
  })
  mockState.actorRow = null
  mockState.rpcResult = null
  mockState.rpcCalls = []
  // Satisfy env.ts required-server subset.
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── tests ──────────────────────────────────────────────────────

describe('POST /api/offers — flag gate', () => {
  it('returns 404 FEATURE_DISABLED when FFF_AUTH_WIRED is unset', async () => {
    // flag left unstubbed — scopeEnvVars deletes it before the test
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer t' },
        body: goodBody(),
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('FEATURE_DISABLED')
  })
})

describe('POST /api/offers — auth', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
  })

  it('returns 401 UNAUTHENTICATED when no Authorization header', async () => {
    const res = await POST(
      makeRequest({ body: goodBody() }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 UNAUTHENTICATED when Supabase rejects the JWT', async () => {
    mockState.getUser = async () => ({
      data: null,
      error: { message: 'invalid JWT' },
    })
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer bad.jwt' },
        body: goodBody(),
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 ACTOR_NOT_FOUND when auth succeeds but no actor_handles row', async () => {
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
    mockState.actorRow = null
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer good.jwt' },
        body: goodBody(),
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACTOR_NOT_FOUND')
  })
})

describe('POST /api/offers — body validation', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    setAuthedActor()
  })

  it('returns 400 VALIDATION_ERROR when required fields are missing', async () => {
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer good.jwt' },
        body: { creatorId: CREATOR_ID },
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.fields).toBeDefined()
  })

  it('returns 400 VALIDATION_ERROR when items is empty (pack composition)', async () => {
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer good.jwt' },
        body: goodBody({ items: [] }),
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.fields.items?.[0]).toMatch(/item_count_out_of_range/)
  })
})

describe('POST /api/offers — RPC outcomes', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    setAuthedActor()
  })

  it('returns 201 { data: {offerId, eventId, eventHash} } on RPC success', async () => {
    mockState.rpcResult = {
      data: [
        {
          offer_id: '99999999-9999-4999-8999-999999999999',
          event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          event_hash: '0xdeadbeef',
        },
      ],
      error: null,
    }
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer good.jwt' },
        body: goodBody(),
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.offerId).toBe('99999999-9999-4999-8999-999999999999')
    expect(body.data.eventId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(body.data.eventHash).toBe('0xdeadbeef')

    // Confirm the RPC was invoked with session-derived buyerId (D8).
    expect(mockState.rpcCalls).toHaveLength(1)
    const call = mockState.rpcCalls[0]!
    expect(call.name).toBe('rpc_create_offer')
    const params = call.params as { p_buyer_id: string; p_actor_ref: string }
    expect(params.p_buyer_id).toBe(AUTH_USER_ID)
    expect(params.p_actor_ref).toBe(ACTOR_HANDLE)
  })

  it('returns 429 RATE_LIMIT when RPC raises P0002', async () => {
    mockState.rpcResult = {
      data: null,
      error: {
        code: 'P0002',
        message: 'rate_limit: max 3 pending offers per buyer/creator (current=3)',
      },
    }
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer good.jwt' },
        body: goodBody(),
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMIT')
  })

  it('returns 401 ACTOR_MISMATCH when RPC raises P0008', async () => {
    mockState.rpcResult = {
      data: null,
      error: { code: 'P0008', message: 'actor_mismatch' },
    }
    const res = await POST(
      makeRequest({
        headers: { authorization: 'Bearer good.jwt' },
        body: goodBody(),
      }) as unknown as Parameters<typeof POST>[0],
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('ACTOR_MISMATCH')
  })
})
