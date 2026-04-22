'use client'

/**
 * Frontfiles — browser Supabase client (P4 concern 4A.2.AUTH, F1)
 *
 * Singleton factory that instantiates a `@supabase/supabase-js` client
 * wired for browser-side use. Counterpart to the two server factories
 * in `src/lib/db/client.ts`:
 *
 *   - `getSupabaseClient()`           — service-role, server-only
 *   - `getSupabaseClientForUser(tok)` — user-JWT per-request, server-only
 *   - `getSupabaseBrowserClient()`    — anon key + localStorage, browser-only (this file)
 *
 * Why a browser-specific factory at all:
 *   The server factories run under Node, reach for server-only env vars
 *   (`SUPABASE_SERVICE_ROLE_KEY`), and must not be reachable from a
 *   client bundle. The browser needs its own client so the user can
 *   sign in with `signInWithPassword`, maintain a persisted session
 *   under `persistSession: true` (default localStorage), and surface
 *   a refreshed access token to consumers via `onAuthStateChange`.
 *
 * Why a singleton:
 *   The Supabase browser client is event-emitter-backed. Every call to
 *   `createClient` allocates a new internal `GoTrueClient` with its own
 *   subscriber registry. Recreating it would orphan existing listeners
 *   (from `useSession`) and double-fire callbacks on the next auth
 *   event. One process-level instance keeps the subscription graph
 *   coherent.
 *
 * Why `'use client'` at the top:
 *   This module is browser-only by construction (it reads `process.env`
 *   vars that ship to the client bundle and instantiates a client that
 *   expects `window.localStorage`). Marking it with the directive makes
 *   a Server Component import a build-time error, not a silent runtime
 *   surprise.
 *
 * References:
 *   - `docs/audits/P4_CONCERN_4A_2_AUTH_DIRECTIVE.md` §F1
 *   - `src/lib/db/client.ts` — server-side counterparts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Module-scoped singleton. Lazy: the client is not created until the
// first call, so module evaluation in tests / server-side tree shakes
// without touching env vars.
let _client: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client

  // These are the public `NEXT_PUBLIC_*` vars — Next.js inlines them
  // into the client bundle at build time. They are intentionally NOT
  // routed through `@/lib/env`: that module's Zod schema marks the
  // server-only `SUPABASE_SERVICE_ROLE_KEY` as required (`min(1)`),
  // so importing `env` from a client bundle would fail Zod
  // validation at module load (env.ts itself documents this at
  // L153-157). Reading `process.env.NEXT_PUBLIC_*` directly is the
  // canonical path for client-bundle env access in this codebase.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Browser Supabase client requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  _client = createClient(url, anonKey, {
    auth: {
      // Persist in localStorage so a page refresh survives the session.
      persistSession: true,
      // Refresh tokens automatically in the background; prevents
      // 401 storms when a user leaves a tab open past the JWT TTL.
      autoRefreshToken: true,
      // No OAuth callbacks in this concern — disable URL parsing so
      // we don't accidentally swallow query params on unrelated pages.
      detectSessionInUrl: false,
    },
  })
  return _client
}

/**
 * Test-only reset. Mirrors `_resetSupabaseClient` in the server module
 * so Vitest can exercise the env-missing branch and the singleton
 * behaviour deterministically across tests.
 */
export function _resetSupabaseBrowserClient(): void {
  _client = null
}
