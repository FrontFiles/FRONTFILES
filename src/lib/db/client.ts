/**
 * Supabase Client — Frontfiles Database Access
 *
 * Two server-side clients live in this module:
 *
 *   1. `getSupabaseClient()` — service-role client for system-
 *      authored work (crons, backfills, the system actor).
 *      Bypasses RLS and leaves `auth.uid()` = NULL. Module-level
 *      singleton: one instance per process.
 *
 *   2. `getSupabaseClientForUser(accessToken)` — user-scoped
 *      client for user-facing request handlers. Uses the anon
 *      key + `Authorization: Bearer <jwt>` header so
 *      `auth.uid()` resolves to the caller inside SECURITY
 *      DEFINER RPC bodies, and every underlying query is subject
 *      to per-party RLS. Fresh client per request (not cached)
 *      because access tokens are per-request.
 *
 * Both server-only. The service-role key and any user JWT must
 * never be sent to the browser. Browser code routes through
 * `/api/*` handlers.
 *
 * Which to use:
 *
 *   - User-facing request handlers (POST/GET /api/offers/*,
 *     POST /api/assignments/*, etc.) → getSupabaseClientForUser.
 *     The user-JWT client is what makes Part A migration
 *     20260421000011's actor-auth guard at P0008 pass cleanly:
 *     the RPC bodies compare `actor_handles.auth_user_id` to
 *     `auth.uid()`, which is only populated when the client
 *     forwards the user's JWT.
 *
 *   - System callers (Part D cron for rpc_expire_offer, the
 *     ledger writer's `rpc_append_ledger_event`, anything that
 *     writes as the `00000000-0000-0000-0000-000000000001`
 *     system actor) → getSupabaseClient (service-role).
 *
 * See P4_CONCERN_4A_2_B1_DIRECTIVE.md §DECISIONS D1 for the
 * rationale for anon-key + Bearer (canonical Supabase pattern)
 * over JWT-verify + service-role with `SET LOCAL`.
 *
 * Usage:
 *   import {
 *     getSupabaseClient,
 *     getSupabaseClientForUser,
 *   } from '@/lib/db/client'
 *
 *   const system = getSupabaseClient()
 *   const user = getSupabaseClientForUser(accessToken)
 *
 * Dual-mode contract:
 *   - Env vars present → real Supabase client.
 *   - Env vars absent  → callers are expected to short-circuit
 *     via `isSupabaseConfigured()` and fall back to in-memory
 *     stores. Either helper throws if called without env vars
 *     so accidental misuse is loud.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env, isSupabaseEnvPresent } from '@/lib/env'

// Module-level singleton — the service-role Supabase client is
// safe to reuse across requests in a Node.js process. Lazy so
// the module graph stays trivial when env vars are unset.
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
 * Build a user-scoped Supabase client for a single request.
 *
 * Wires the caller's access token into two layers so the
 * downstream Postgres session sees the correct identity:
 *
 *   1. `global.headers.Authorization = 'Bearer <jwt>'` — every
 *      PostgREST/RPC request forwards the token, which is what
 *      populates `auth.uid()` inside SECURITY DEFINER function
 *      bodies (Part A migration 20260421000011's P0008 actor-
 *      auth guard depends on this).
 *   2. API key = `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key
 *      authorises the request surface; RLS policies on the
 *      underlying tables (e.g. `offers_party_select`,
 *      `ledger_events_party_select` in migration
 *      20260421000004) then gate visibility to the authenticated
 *      user's parties only.
 *
 * NOT cached — tokens are per-request, so returning a shared
 * client would leak identity across callers. Allocating a fresh
 * client per request is the correct isolation boundary; the
 * cost is ~constant and dominated by the surrounding I/O.
 *
 * See P4_CONCERN_4A_2_B1_DIRECTIVE.md §DECISIONS D1.
 */
export function getSupabaseClientForUser(
  accessToken: string,
): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  if (!accessToken) {
    throw new Error(
      'getSupabaseClientForUser requires a non-empty access token.',
    )
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
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
 * `getSupabaseClientForUser` has no cache to reset.
 */
export function _resetSupabaseClient(): void {
  _client = null
}
