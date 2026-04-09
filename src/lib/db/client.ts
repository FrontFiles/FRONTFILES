/**
 * Supabase Client — Assignment Engine Database Access
 *
 * Creates and exports the Supabase client for server-side use.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * environment variables.
 *
 * Usage:
 *   import { supabase } from '@/lib/db/client'
 *   const { data } = await supabase.from('assignments').select('*')
 *
 * This module is server-only. For client components, create a
 * separate browser client with the anon key.
 *
 * NOTE: Until @supabase/supabase-js is installed, this module
 * exports a placeholder. Install with:
 *   npm install @supabase/supabase-js
 */

// ══════════════════════════════════════════════
// MOCK PHASE — Supabase client placeholder
//
// The in-memory store (lib/assignment/store.ts) remains
// authoritative during the mock phase. This module will
// become the real database client once Supabase is provisioned.
// ══════════════════════════════════════════════

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  // Deferred import: only fails if actually called without the package installed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js')
  return createClient(url, key)
}

/**
 * Check whether Supabase is configured (env vars present).
 * Used by the store layer to decide mock vs real persistence.
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
