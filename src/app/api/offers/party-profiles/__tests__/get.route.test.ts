// ═══════════════════════════════════════════════════════════════
// GET /api/offers/party-profiles — integration tests (§F5)
//
// 3 test cases per §F5:
//   - ids length > 100 → 414 TOO_MANY_IDS.
//   - Cross-party probe → 200 empty users (silent filter, NOT 403).
//   - FFF_AUTH_WIRED = false short-circuit → 200 {users:[], flag:'AUTH_WIRED_OFF'}.
//
// Mock shape mirrors src/app/api/offers/__tests__/get.route.test.ts:
// unified client exposes auth.getUser + from(actor_handles | offers
// | users). The offers branch returns the caller's own offers (as
// RLS would); the users branch filters by `.in('id', [...])`.
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
const COUNTERPARTY_ID = '33333333-3333-4333-8333-333333333333'
const STRANGER_ID = '44444444-4444-4444-8444-444444444444'

// ─── Mock state ─────────────────────────────────────────────────

type OfferPartyRow = { buyer_id: string; creator_id: string }
type UserRow = {
  id: string
  username: string
  display_name: string
  account_state: string
}

const mockState = vi.hoisted(() => ({
  getUser: async (
    _jwt?: string,
  ): Promise<{
    data: { user: { id: string } } | null
    error: { message: string } | null
  }> => ({ data: null, error: { message: 'unconfigured' } }),
  actorRow: null as { handle: string; auth_user_id: string } | null,
  offerRows: [] as OfferPartyRow[],
  offersError: null as { code?: string; message: string } | null,
  userRows: [] as UserRow[],
  usersError: null as { code?: string; message: string } | null,
  lastUsersInFilter: null as string[] | null,
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
        or: (...a: unknown[]) => Promise<{ data: unknown; error: unknown }>
        in: (
          col: string,
          values: string[],
        ) => Promise<{ data: unknown; error: unknown }>
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      } = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        or: async () => {
          if (table === 'offers')
            return { data: mockState.offerRows, error: mockState.offersError }
          return { data: [], error: null }
        },
        in: async (_col: string, values: string[]) => {
          if (table === 'users') {
            mockState.lastUsersInFilter = [...values]
            return { data: mockState.userRows, error: mockState.usersError }
          }
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

// ─── Helpers ────────────────────────────────────────────────────

function makeRequest(
  idsParam: string | null,
  authorization?: string,
): Request {
  const qs = idsParam === null ? '' : `?ids=${encodeURIComponent(idsParam)}`
  const headers = new Headers()
  if (authorization) headers.set('authorization', authorization)
  return new Request(`http://localhost/api/offers/party-profiles${qs}`, {
    method: 'GET',
    headers,
  })
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
  mockState.userRows = []
  mockState.usersError = null
  mockState.lastUsersInFilter = null
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Tests ──────────────────────────────────────────────────────

describe('GET /api/offers/party-profiles — query-param validation (§F1)', () => {
  it('returns 414 TOO_MANY_IDS when the csv exceeds 100 ids', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    setAuthedActor()

    // 101 deterministic uuid-ish strings — format doesn't matter
    // for this test because length validation runs before any DB
    // call.
    const ids = Array.from(
      { length: 101 },
      (_v, i) =>
        `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`,
    ).join(',')

    const res = await GET(
      makeRequest(ids, 'Bearer t') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(414)
    const body = await res.json()
    expect(body.error.code).toBe('TOO_MANY_IDS')
  })
})

describe('GET /api/offers/party-profiles — cross-party probe (§F1 L68 silent filter)', () => {
  it('returns 200 with empty users[] when the caller requests a uuid they share no offer with', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'true')
    setAuthedActor()
    // Caller has one offer (co-party is COUNTERPARTY_ID) — but NOT
    // with STRANGER_ID. The stranger request must be silently filtered.
    mockState.offerRows = [
      { buyer_id: AUTH_USER_ID, creator_id: COUNTERPARTY_ID },
    ]
    // If the route's silent-filter logic is correct, the users
    // query either is not made, or is made with an empty list.
    // We assert the 200-empty shape either way.

    const res = await GET(
      makeRequest(STRANGER_ID, 'Bearer t') as unknown as Parameters<
        typeof GET
      >[0],
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toEqual([])
    // `flag` should be absent on this happy path — the flag field is
    // only present on the FFF_AUTH_WIRED=false short-circuit.
    expect(body.flag).toBeUndefined()
  })
})

describe('GET /api/offers/party-profiles — FFF_AUTH_WIRED=false short-circuit (§F3)', () => {
  it('returns 200 {users:[], flag:"AUTH_WIRED_OFF"} without touching the DB', async () => {
    // Flag unset (== false). Do NOT stub FFF_AUTH_WIRED.
    // requireActor returns FEATURE_DISABLED → short-circuit.
    // No auth needed for this path.

    const res = await GET(
      makeRequest(
        COUNTERPARTY_ID,
        'Bearer whatever',
      ) as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toEqual([])
    expect(body.flag).toBe('AUTH_WIRED_OFF')
    // DB must not have been queried — no `.in()` call happened on
    // the users table.
    expect(mockState.lastUsersInFilter).toBeNull()
  })
})
