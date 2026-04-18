/**
 * Supabase Client — Frontfiles Database Access
 *
 * Creates and returns the Supabase service-role client for
 * server-side use. Requires NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY environment variables.
 *
 * SERVER-ONLY. The service role key bypasses RLS and must
 * never be sent to the browser. For browser-side reads, route
 * through the `/api/*` route handlers, which are themselves
 * server-only.
 *
 * Usage:
 *   import { getSupabaseClient } from '@/lib/db/client'
 *   const client = await getSupabaseClient()
 *   const { data } = await client.from('posts').select('*')
 *
 * Dual-mode contract:
 *   - Env vars present → real Supabase client.
 *   - Env vars absent  → callers are expected to short-circuit
 *     via `isSupabaseConfigured()` and fall back to in-memory
 *     stores. `getSupabaseClient()` throws if called without
 *     env vars so accidental misuse is loud.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env, isSupabaseEnvPresent } from '@/lib/env'

// Module-level singleton — the Supabase client is safe to
// reuse across requests in a Node.js process. Lazy so the
// module graph stays trivial when env vars are unset.
let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client

  // env.ts fail-fast guarantees both vars are present and well-formed
  // before this function can run. Keep the defensive branch for the
  // narrow test-path where env is mocked.
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  _client = createClient(url, key, {
    auth: {
      // Service-role usage — no session persistence.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return _client
}

/**
 * Check whether Supabase is configured (env vars present).
 * Used by store layers to decide mock vs real persistence.
 *
 * Delegates to `isSupabaseEnvPresent` from `@/lib/env`, which is the
 * canonical source of truth. CCP 4 will retire this shim as the
 * mock-fallback stores get converted to real dual-mode.
 */
export function isSupabaseConfigured(): boolean {
  return isSupabaseEnvPresent()
}

/**
 * Test/dev helper: reset the cached client so subsequent
 * `getSupabaseClient()` calls re-read env vars. Useful in
 * tests that toggle the env to exercise the dual-mode branches.
 */
export function _resetSupabaseClient(): void {
  _client = null
}
