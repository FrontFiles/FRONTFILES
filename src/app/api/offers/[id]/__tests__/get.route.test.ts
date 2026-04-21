// ═══════════════════════════════════════════════════════════════
// GET /api/offers/[id] — route integration tests (P4 4A.2 Part B1 F9)
//
// Mock seam: @/lib/db/client. Unified client supports
// auth.getUser, from(actor_handles | offers | offer_assets |
// offer_briefs), and rpc (unused here but present so the mock
// resolves cleanly).
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
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444'
const OFFER_ID = '55555555-5555-4555-8555-555555555555'

// Shape the mock state understands.
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
  offerRow: null as Record<string, unknown> | null,
  offerError: null as { code?: string; message: string } | null,
  assetRows: [] as unknown[],
  briefRows: [] as unknown[],
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
        order: (...a: unknown[]) => Promise<{ data: unknown; error: unknown }>
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      } = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: async () => {
          if (table === 'offer_assets')
            return { data: mockState.assetRows, error: null }
          if (table === 'offer_briefs')
            return { data: mockState.briefRows, error: null }
          return { data: [], error: null }
        },
        maybeSingle: async () => {
          if (table === 'actor_handles')
            return { data: mockState.actorRow, error: null }
          if (table === 'offers')
            return {
              data: mockState.offerRow,
              error: mockState.offerError,
            }
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
  return new Request(`http://localhost/api/offers/${OFFER_ID}`, {
    method: 'GET',
    headers,
  })
}

function makeOffer(overrides: Partial<MockOfferRow> = {}): MockOfferRow {
  return {
    id: OFFER_ID,
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

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  mockState.getUser = async () => ({
    data: null,
    error: { message: 'default' },
  })
  mockState.actorRow = null
  mockState.offerRow = null
  mockState.offerError = null
  mockState.assetRows = []
  mockState.briefRows = []
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Tests ──────────────────────────────────────────────────────

describe('GET /api/offers/[id] — flag + auth gates', () => {
  it('returns 404 FEATURE_DISABLED when flag is unset', async () => {
    const res = await GET(
      makeRequest('Bearer t') as unknown as Parameters<typeof GET>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(404)
    const b = await res.json()
    expect(b.error.code).toBe('FEATURE_DISABLED')
  })

  it('returns 401 UNAUTHENTICATED when no Authorization', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    const res = await GET(
      makeRequest() as unknown as Parameters<typeof GET>[0],
      ctxFor(OFFER_ID),
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
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 ACTOR_NOT_FOUND with no actor_handles row', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('ACTOR_NOT_FOUND')
  })
})

describe('GET /api/offers/[id] — read outcomes', () => {
  beforeEach(() => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    setAuthedActor()
  })

  it('returns 404 OFFER_NOT_FOUND when the offer row is absent', async () => {
    mockState.offerRow = null
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('OFFER_NOT_FOUND')
  })

  it('returns 404 (NOT 403) when caller is not a party — surface parity', async () => {
    mockState.offerRow = makeOffer({ buyer_id: OTHER_USER_ID })
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(404)
    const b = await res.json()
    expect(b.error.code).toBe('OFFER_NOT_FOUND')
  })

  it('returns 200 with offer + assets for a buyer on an asset-pack offer', async () => {
    mockState.offerRow = makeOffer({ target_type: 'asset_pack' })
    mockState.assetRows = [
      { offer_id: OFFER_ID, asset_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', position: 1 },
      { offer_id: OFFER_ID, asset_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', position: 2 },
    ]
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.offer.id).toBe(OFFER_ID)
    expect(body.data.assets).toHaveLength(2)
    expect(body.data.briefs).toBeNull()
  })

  it('returns 200 with offer + briefs for a creator on a brief-pack offer', async () => {
    // Creator calling — flip the session so auth.uid() == CREATOR_ID.
    mockState.getUser = async () => ({
      data: { user: { id: CREATOR_ID } },
      error: null,
    })
    mockState.actorRow = {
      handle: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      auth_user_id: CREATOR_ID,
    }
    mockState.offerRow = makeOffer({ target_type: 'brief_pack' })
    mockState.briefRows = [
      {
        offer_id: OFFER_ID,
        position: 1,
        spec: {
          title: 't',
          deadline_offset_days: 5,
          deliverable_format: 'video',
          revision_cap: 1,
        },
      },
    ]
    const res = await GET(
      makeRequest('Bearer ok') as unknown as Parameters<typeof GET>[0],
      ctxFor(OFFER_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.offer.target_type).toBe('brief_pack')
    expect(body.data.briefs).toHaveLength(1)
    expect(body.data.assets).toBeNull()
  })
})
