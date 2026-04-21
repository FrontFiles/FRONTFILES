import { describe, expect, it } from 'vitest'

import { SYSTEM_ACTOR_HANDLE } from '@/lib/ledger/system-actor'

// Spec §8.4: the sentinel UUID for the system actor is locked for
// the life of the platform. The seed migration
// `supabase/migrations/20260421000005_seed_system_actor.sql` inserts
// exactly this value into `public.actor_handles`. These tests lock
// the TS-side constant to that byte sequence.

describe('SYSTEM_ACTOR_HANDLE', () => {
  it('matches the migration-seeded sentinel UUID byte-for-byte', () => {
    expect(SYSTEM_ACTOR_HANDLE).toBe(
      '00000000-0000-0000-0000-000000000001',
    )
  })

  it('is shaped as a UUID', () => {
    // Any valid UUID variant — the sentinel intentionally sets only
    // the low bit, which does not fit the standard v1-v5 version
    // nibble in position 13, so a version-agnostic check is
    // appropriate here.
    const UUID_ANY_VARIANT_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(UUID_ANY_VARIANT_REGEX.test(SYSTEM_ACTOR_HANDLE)).toBe(true)
  })

  it('is typed as the exact literal (readonly at the type level)', () => {
    // If `SYSTEM_ACTOR_HANDLE` were widened to `string`, the
    // following assignment to a same-literal-typed binding would
    // fail to compile. The assertion is primarily a TS compile-time
    // guard; the runtime `expect` keeps the case visible in the
    // test report.
    const handle: '00000000-0000-0000-0000-000000000001' =
      SYSTEM_ACTOR_HANDLE
    expect(handle).toBe(SYSTEM_ACTOR_HANDLE)
  })
})
