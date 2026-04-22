/**
 * Tests for `src/lib/supabase/browser.ts` (P4 concern 4A.2.AUTH, F7).
 *
 * Pure-Node — no jsdom, no React. The browser client factory is just
 * a singleton wrapper around `createClient`; we mock the Supabase
 * package at the module boundary and assert the wiring contract.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock `@supabase/supabase-js` so we can both observe the call and
// avoid pulling in the real client (which expects browser globals).
// `vi.fn().mockReturnValue(...)` produces a variadic-typed spy, so
// the proxy below can forward args without tripping tsc's strict
// spread check (which is what `vi.fn(() => ...)` would do).
const createClientSpy = vi.fn().mockReturnValue({ tag: 'fake-supabase-client' })
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientSpy(...args),
}))

// The factory reads `process.env.NEXT_PUBLIC_SUPABASE_*` directly,
// not via `@/lib/env`. We toggle env vars via `vi.stubEnv` so the
// test worker's own env is not mutated permanently.
import {
  getSupabaseBrowserClient,
  _resetSupabaseBrowserClient,
} from '@/lib/supabase/browser'

describe('getSupabaseBrowserClient', () => {
  beforeEach(() => {
    _resetSupabaseBrowserClient()
    createClientSpy.mockClear()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fake-anon-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    _resetSupabaseBrowserClient()
  })

  it('returns the same instance on repeated calls (singleton)', () => {
    const a = getSupabaseBrowserClient()
    const b = getSupabaseBrowserClient()
    expect(a).toBe(b)
    // createClient must be invoked exactly once across both calls.
    expect(createClientSpy).toHaveBeenCalledTimes(1)
  })

  it('passes the documented auth options to createClient', () => {
    getSupabaseBrowserClient()
    expect(createClientSpy).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'fake-anon-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      },
    )
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(() => getSupabaseBrowserClient()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    )
    expect(createClientSpy).not.toHaveBeenCalled()
  })

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(() => getSupabaseBrowserClient()).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    )
    expect(createClientSpy).not.toHaveBeenCalled()
  })
})
