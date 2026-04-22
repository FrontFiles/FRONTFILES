// ═══════════════════════════════════════════════════════════════
// POST /api/offers/[id]/reject — route integration tests
// (P4 4A.2 Part B1 F11)
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { scopeEnvVars } from '@/lib/test/env-scope'

scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FFF_AUTH_WIRED',
])

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111'
const ACTOR_HANDLE = '22222222-2222-4222-8222-222222222222'
const BUYER_ID = AUTH_USER_ID
const CREATOR_ID = '33333333-3333-4333-8333-333333333333'
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
    buyer_id: BUYER_ID,
    creator_id: CREATOR_ID,
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
  return new Request(`http://localhost/api/offers/${OFFER_ID}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

function setAuthedActor(userId = AUTH_USER_ID, handle = ACTOR_HANDLE): void {
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

describe('POST /api/offers/[id]/reject — flag + auth', () => {
  it('returns 404 FEATURE_DISABLED when flag unset', async () => {
    const res = await POST(
      makeRequest({ reasonCode: 'terms_rejected' }, 'Bearer t') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 UNAUTHENTICATED with no Bearer', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    const res = await POST(
      makeRequest({ reasonCode: 'terms_rejected' }) as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT rejected', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({ data: null, error: { message: 'x' } })
    const res = await POST(
      makeRequest({ reasonCode: 'terms_rejected' }, 'Bearer bad') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 ACTOR_NOT_FOUND when no actor row', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
    const res = await POST(
      makeRequest({ reasonCode: 'terms_rejected' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/offers/[id]/reject — body validation + preflight + RPC', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    setAuthedActor()
    mockState.offerRow = makeOffer()
  })

  it('returns 400 VALIDATION_ERROR when reasonCode is outside the enum', async () => {
    const res = await POST(
      makeRequest({ reasonCode: 'bogus_reason' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 409 INVALID_STATE via preflight without RPC call', async () => {
    mockState.offerRow = makeOffer({ state: 'accepted' })
    const res = await POST(
      makeRequest({ reasonCode: 'terms_rejected' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('INVALID_STATE')
    expect(mockState.rpcCalls).toHaveLength(0)
  })

  it('returns 409 INVALID_STATE when RPC races (P0003)', async () => {
    mockState.rpcResult = {
      data: null,
      error: { code: 'P0003', message: 'invalid_state: offer is accepted' },
    }
    const res = await POST(
      makeRequest({ reasonCode: 'terms_rejected' }, 'Bearer ok') as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('INVALID_STATE')
    expect(mockState.rpcCalls).toHaveLength(1)
    expect(mockState.rpcCalls[0]!.name).toBe('rpc_reject_offer')
  })

  it('returns 200 with {eventId, eventHash} on success', async () => {
    mockState.rpcResult = {
      data: [
        {
          event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          event_hash: '0xcafe',
        },
      ],
      error: null,
    }
    const res = await POST(
      makeRequest(
        { reasonCode: 'price_too_low', note: 'too low' },
        'Bearer ok',
      ) as unknown as Parameters<typeof POST>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.eventId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(body.data.eventHash).toBe('0xcafe')
    const call = mockState.rpcCalls[0]!
    const params = call.params as { p_payload: Record<string, unknown> }
    // Payload carries reasonCode as `reason` per §8.1 + Zod schema.
    expect(params.p_payload.reason).toBe('price_too_low')
    // Note is not in the payload (spec schema is strict).
    expect(params.p_payload).not.toHaveProperty('note')
  })
})
