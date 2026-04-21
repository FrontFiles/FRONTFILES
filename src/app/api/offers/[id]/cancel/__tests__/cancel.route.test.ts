// ═══════════════════════════════════════════════════════════════
// POST /api/offers/[id]/cancel — route integration tests
// (P4 4A.2 Part B1 F12)
//
// Covers the full cancel preflight scope (INVALID_STATE + NOT_PARTY
// buyer-only) and the RPC-authoritative NOT_LAST_TURN path (D2 / D12
// carve-out: route cannot short-circuit that case under RLS).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { scopeEnvVars } from '@/lib/test/env-scope'

scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FFF_AUTH_WIRED',
])

const BUYER_USER_ID = '11111111-1111-4111-8111-111111111111'
const BUYER_HANDLE = '22222222-2222-4222-8222-222222222222'
const CREATOR_USER_ID = '33333333-3333-4333-8333-333333333333'
const CREATOR_HANDLE = '44444444-4444-4444-8444-444444444444'
const OFFER_ID = '55555555-5555-4555-8555-555555555555'

type MockOffer = {
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
  offerRow: null as Record<string, unknown> | null,
  rpcResult: null as
    | { data: unknown; error: null }
    | { data: null; error: { code: string; message: string } }
    | null,
  rpcCalls: [] as { name: string; params: unknown }[],
}))

vi.mock('@/lib/db/client', () => {
  const client = {
    auth: { getUser: (jwt?: string) => mockState.getUser(jwt) },
    from: (table: string) => {
      const chain: {
        select: (...a: unknown[]) => typeof chain
        eq: (...a: unknown[]) => typeof chain
        is: (...a: unknown[]) => typeof chain
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      } = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => {
          if (table === 'actor_handles')
            return { data: mockState.actorRow, error: null }
          if (table === 'offers')
            return { data: mockState.offerRow, error: null }
          return { data: null, error: null }
        },
      }
      return chain
    },
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
    getSupabaseClientForUser: (_t: string) => client,
    _resetSupabaseClient: () => {},
    isSupabaseConfigured: () => true,
  }
})

import { POST } from '../route'

function makeOffer(overrides: Partial<MockOffer> = {}): MockOffer {
  return {
    id: OFFER_ID,
    buyer_id: BUYER_USER_ID,
    creator_id: CREATOR_USER_ID,
    target_type: 'asset_pack',
    gross_fee: 1000,
    platform_fee_bps: 1000,
    currency: 'EUR',
    rights: { template: 'editorial_one_time', params: {}, is_transfer: false },
    current_note: 'hi',
    expires_at: '2026-05-01T00:00:00.000Z',
    state: 'sent',
    cancelled_by: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(body: unknown, authorization?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (authorization) headers.set('authorization', authorization)
  return new Request(`http://localhost/api/offers/${OFFER_ID}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

function setAuthedActor(userId: string, handle: string): void {
  mockState.getUser = async () => ({
    data: { user: { id: userId } },
    error: null,
  })
  mockState.actorRow = { handle, auth_user_id: userId }
}

beforeEach(() => {
  mockState.getUser = async () => ({ data: null, error: { message: '' } })
  mockState.actorRow = null
  mockState.offerRow = null
  mockState.rpcResult = null
  mockState.rpcCalls = []
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/offers/[id]/cancel — flag + auth', () => {
  it('returns 404 FEATURE_DISABLED when flag unset', async () => {
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }, 'Bearer t') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 with no Bearer', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }) as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT rejected', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({ data: null, error: { message: 'x' } })
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }, 'Bearer bad') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 ACTOR_NOT_FOUND with no actor row', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({
      data: { user: { id: BUYER_USER_ID } },
      error: null,
    })
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/offers/[id]/cancel — preflight + RPC', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
  })

  it('returns 409 NOT_PARTY when non-buyer (creator) tries to cancel (preflight)', async () => {
    setAuthedActor(CREATOR_USER_ID, CREATOR_HANDLE)
    mockState.offerRow = makeOffer()
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('NOT_PARTY')
    expect(mockState.rpcCalls).toHaveLength(0)
  })

  it('returns 409 NOT_LAST_TURN when RPC raises P0005 (no preflight bypass)', async () => {
    setAuthedActor(BUYER_USER_ID, BUYER_HANDLE)
    mockState.offerRow = makeOffer({ state: 'countered' })
    mockState.rpcResult = {
      data: null,
      error: { code: 'P0005', message: 'not_last_turn' },
    }
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('NOT_LAST_TURN')
    // Critical: preflight MUST NOT short-circuit this case — the
    // RPC is the authoritative source for NOT_LAST_TURN.
    expect(mockState.rpcCalls).toHaveLength(1)
    expect(mockState.rpcCalls[0]!.name).toBe('rpc_cancel_offer')
  })

  it('returns 409 INVALID_STATE without RPC call when offer is accepted', async () => {
    setAuthedActor(BUYER_USER_ID, BUYER_HANDLE)
    mockState.offerRow = makeOffer({ state: 'accepted' })
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('INVALID_STATE')
    expect(mockState.rpcCalls).toHaveLength(0)
  })

  it('returns 409 INVALID_STATE via classifier on RPC race (P0003)', async () => {
    setAuthedActor(BUYER_USER_ID, BUYER_HANDLE)
    mockState.offerRow = makeOffer()
    mockState.rpcResult = {
      data: null,
      error: { code: 'P0003', message: 'invalid_state: offer is accepted' },
    }
    const res = await POST(
      makeRequest({ reasonCode: 'buyer_withdrew' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('INVALID_STATE')
    expect(mockState.rpcCalls).toHaveLength(1)
  })

  it('returns 200 with {eventId, eventHash} on RPC success', async () => {
    setAuthedActor(BUYER_USER_ID, BUYER_HANDLE)
    mockState.offerRow = makeOffer()
    mockState.rpcResult = {
      data: [
        {
          event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          event_hash: '0xfeed',
        },
      ],
      error: null,
    }
    const res = await POST(
      makeRequest(
        { reasonCode: 'buyer_withdrew', note: 'changed mind' },
        'Bearer ok',
      ) as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.eventId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(body.data.eventHash).toBe('0xfeed')
    // Cancel payload per §8.1 is strict {v, by_actor_id}; no
    // reasonCode / note leaks into the ledger.
    const call = mockState.rpcCalls[0]!
    const params = call.params as { p_payload: Record<string, unknown> }
    expect(params.p_payload.by_actor_id).toBe(BUYER_HANDLE)
    expect(params.p_payload).not.toHaveProperty('reason_code')
    expect(params.p_payload).not.toHaveProperty('note')
  })
})
