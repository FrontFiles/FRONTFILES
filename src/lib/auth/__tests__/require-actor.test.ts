// ═══════════════════════════════════════════════════════════════
// requireActor — dual-mode tests
//
// Mock mode (default): `@/lib/db/client` is replaced with a
// hoisted stub so the four behaviour branches can be exercised
// deterministically without a live Supabase.
//
// Integration mode (opt-in via FF_INTEGRATION_TESTS=1 — matching
// the pattern in src/lib/providers/__tests__/service.test.ts per
// docs/audits/P4_CONCERN_2_DECISION_MEMO.md): placeholder left
// behind a skip gate. Wiring a real end-to-end case would need a
// test user + JWT + actor_handles row in a reachable dev DB —
// open item for concern 4 when the replacement routes exist.
//
// `vi.stubEnv` works against `flags.authWired` because the
// getter in src/lib/env.ts L270-283 reads live `process.env`
// on every access (CCP Pattern-a Option 2b — the same idiom
// that backs `flags.fffSharing` and `flags.realUpload`).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Hoisted mock state — must use vi.hoisted because vi.mock's
// factory is hoisted above variable declarations.
const mockState = vi.hoisted(() => ({
  getUser: async (_jwt?: string): Promise<{
    data: { user: { id: string } } | null
    error: { message: string } | null
  }> => ({ data: null, error: { message: 'default — unconfigured' } }),
  actorRow: null as { handle: string; auth_user_id: string } | null,
  actorError: null as { message: string } | null,
}))

vi.mock('@/lib/db/client', () => {
  const buildChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      maybeSingle: async () => ({
        data: mockState.actorRow,
        error: mockState.actorError,
      }),
    }
    return chain
  }
  return {
    getSupabaseClient: () => ({
      auth: {
        getUser: (jwt?: string) => mockState.getUser(jwt),
      },
      from: (_table: string) => buildChain(),
    }),
  }
})

import { requireActor } from '../require-actor'

// ─── helpers ────────────────────────────────────────────────────

function makeRequest(init?: { authorization?: string }): Request {
  const headers = new Headers()
  if (init?.authorization) {
    headers.set('authorization', init.authorization)
  }
  return new Request('https://frontfiles.test/api/probe', { headers })
}

const AUTH_USER_ID = '00000000-0000-0000-0000-00000000aaaa'
const ACTOR_HANDLE = '00000000-0000-0000-0000-00000000bbbb'

// ─── setup / teardown ───────────────────────────────────────────

beforeEach(() => {
  // Defaults every test overrides as needed.
  mockState.getUser = async () => ({
    data: null,
    error: { message: 'default — no session' },
  })
  mockState.actorRow = null
  mockState.actorError = null
  // Each test explicitly sets the flag — starting from the
  // concern-3 directive default (on) so the off-path cases
  // have to stub explicitly. Matches the vitest.config.ts
  // forwarding: live path by default, off path opt-in.
  vi.stubEnv('FFF_AUTH_WIRED', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Case 1 — flag off ──────────────────────────────────────────

describe('requireActor — flag off (fail-closed)', () => {
  it('returns FEATURE_DISABLED when FFF_AUTH_WIRED=false', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'false')
    const r = await requireActor(makeRequest())
    expect(r).toEqual({ ok: false, reason: 'FEATURE_DISABLED' })
  })

  it('returns FEATURE_DISABLED when FFF_AUTH_WIRED is unset', async () => {
    // vi.stubEnv to '' unsets it — the flag's getter strictly
    // compares `=== 'true'`, so anything-but-'true' is off.
    vi.stubEnv('FFF_AUTH_WIRED', '')
    const r = await requireActor(makeRequest())
    expect(r).toEqual({ ok: false, reason: 'FEATURE_DISABLED' })
  })

  it('returns FEATURE_DISABLED when FFF_AUTH_WIRED=bogus', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'bogus')
    const r = await requireActor(makeRequest())
    expect(r).toEqual({ ok: false, reason: 'FEATURE_DISABLED' })
  })

  it('does NOT touch Supabase when the flag is off', async () => {
    vi.stubEnv('FFF_AUTH_WIRED', 'false')
    let touched = false
    mockState.getUser = async () => {
      touched = true
      return { data: null, error: null }
    }
    await requireActor(makeRequest({ authorization: 'Bearer x' }))
    expect(touched).toBe(false)
  })
})

// ─── Case 2 — flag on, no session ───────────────────────────────

describe('requireActor — flag on, no session', () => {
  it('returns UNAUTHENTICATED when no Authorization header', async () => {
    const r = await requireActor(makeRequest())
    expect(r).toEqual({ ok: false, reason: 'UNAUTHENTICATED' })
  })

  it('returns UNAUTHENTICATED on a non-Bearer Authorization value', async () => {
    const r = await requireActor(makeRequest({ authorization: 'Basic xyz' }))
    expect(r).toEqual({ ok: false, reason: 'UNAUTHENTICATED' })
  })

  it('returns UNAUTHENTICATED on empty Bearer', async () => {
    const r = await requireActor(makeRequest({ authorization: 'Bearer ' }))
    expect(r).toEqual({ ok: false, reason: 'UNAUTHENTICATED' })
  })

  it('returns UNAUTHENTICATED when Supabase rejects the token', async () => {
    mockState.getUser = async () => ({
      data: null,
      error: { message: 'invalid JWT' },
    })
    const r = await requireActor(
      makeRequest({ authorization: 'Bearer expired.jwt.here' }),
    )
    expect(r).toEqual({ ok: false, reason: 'UNAUTHENTICATED' })
  })
})

// ─── Case 3 — flag on, session, no actor_handles row ────────────

describe('requireActor — flag on, session, no actor_handles row', () => {
  it('returns ACTOR_NOT_FOUND when the lookup returns no row', async () => {
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
    mockState.actorRow = null
    mockState.actorError = null
    const r = await requireActor(
      makeRequest({ authorization: 'Bearer valid.jwt.here' }),
    )
    expect(r).toEqual({ ok: false, reason: 'ACTOR_NOT_FOUND' })
  })

  it('returns ACTOR_NOT_FOUND when the lookup errors', async () => {
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
    mockState.actorRow = null
    mockState.actorError = { message: 'RLS blocked read' }
    const r = await requireActor(
      makeRequest({ authorization: 'Bearer valid.jwt.here' }),
    )
    expect(r).toEqual({ ok: false, reason: 'ACTOR_NOT_FOUND' })
  })
})

// ─── Case 4 — flag on, session, actor_handles row present ───────

describe('requireActor — flag on, session, actor_handles row present', () => {
  it('returns ok with { handle, authUserId } matching the row', async () => {
    mockState.getUser = async () => ({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    })
    mockState.actorRow = {
      handle: ACTOR_HANDLE,
      auth_user_id: AUTH_USER_ID,
    }
    const r = await requireActor(
      makeRequest({ authorization: 'Bearer valid.jwt.here' }),
    )
    expect(r).toEqual({
      ok: true,
      actor: { handle: ACTOR_HANDLE, authUserId: AUTH_USER_ID },
    })
  })
})

// ─── Integration-mode placeholder ───────────────────────────────
//
// Opt-in path. FF_INTEGRATION_TESTS=1 would swap the mocked
// `@/lib/db/client` for a real connection and exercise the full
// Supabase `auth.getUser` → `actor_handles` round-trip. Until the
// wiring exists (open item — see concern 3 exit report), the
// case is skipped so the file runs green in the default suite.

describe.skipIf(process.env.FF_INTEGRATION_TESTS !== '1')(
  'requireActor — integration mode',
  () => {
    it.skip('resolves a real auth user against actor_handles (wiring deferred)', () => {
      // Placeholder — filled when concern 4 lands a route handler
      // under AUTH_WIRED=true and a fixture user + handle pair.
    })
  },
)
