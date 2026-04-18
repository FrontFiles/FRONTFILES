/**
 * Per-suite env-var scoping helper for vitest.
 *
 * Call at the top of a test file (outside any describe block) with
 * the list of process.env keys the suite wants to see "unset" during
 * its tests. The helper:
 *
 *   1. Captures the original value AND defined-ness of each key at
 *      call time (once, when scopeEnvVars() is invoked — not at this
 *      helper file's own module load).
 *   2. Registers a vitest `beforeEach` that deletes each key before
 *      each test, so live-read consumers (Pattern-a's
 *      isSupabaseEnvPresent(), flags.* getters) see them absent.
 *   3. Registers a vitest `afterEach` that restores each key to its
 *      original value if it WAS defined at capture time, or deletes
 *      it if it was NOT — never assigns `undefined` directly, which
 *      would coerce to the string "undefined" (truthy) and defeat
 *      the live-read guard.
 *
 * Multiple invocations across different files are independent: each
 * call captures its own closure over originals/defined, so test
 * files cannot contaminate each other.
 *
 * Origin: extracted at N=3 call sites per the rule-of-three
 * (entitlement services, entitlement authorization-invariants,
 * onboarding × 4). See KD-9-audit.md §Phase 4.B §KD-9.3 entry
 * criterion for the canonical path (`src/lib/test/env-scope.ts`).
 *
 * Typical use (entitlement, onboarding):
 *
 *   import { scopeEnvVars } from '@/lib/test/env-scope'
 *
 *   scopeEnvVars([
 *     'NEXT_PUBLIC_SUPABASE_URL',
 *     'NEXT_PUBLIC_SUPABASE_ANON_KEY',
 *     'SUPABASE_SERVICE_ROLE_KEY',
 *   ])
 */

import { beforeEach, afterEach } from 'vitest'

export function scopeEnvVars(keys: string[]): void {
  const originals: Record<string, string | undefined> = {}
  const defined: Record<string, boolean> = {}

  for (const key of keys) {
    defined[key] = Object.prototype.hasOwnProperty.call(process.env, key)
    originals[key] = process.env[key]
  }

  beforeEach(() => {
    for (const key of keys) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of keys) {
      if (defined[key]) {
        process.env[key] = originals[key] as string
      } else {
        delete process.env[key]
      }
    }
  })
}
