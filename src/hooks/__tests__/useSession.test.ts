/**
 * Tests for `subscribeToSession` (P4 concern 4A.2.AUTH, F7 + R3).
 *
 * Pure-Node — targets the exported state-machine helper, not the React
 * hook. The React `useSession` wrapper is a 10-line composition over
 * `subscribeToSession + useState/useEffect`; its observable behavior
 * is fully covered by these helper tests plus AC3 manual smoke.
 *
 * See P4_CONCERN_4A_2_AUTH_DIRECTIVE.md §R3 for the rationale.
 */

import { describe, expect, it, vi } from 'vitest'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

import { subscribeToSession, type SessionState } from '@/hooks/useSession'

// Build a fake `SupabaseClient` exposing only the surface
// `subscribeToSession` actually touches: `auth.getSession()` and
// `auth.onAuthStateChange()`.
function makeFakeClient(opts: {
  initialSession: Session | null
}): {
  client: SupabaseClient
  unsubscribeSpy: ReturnType<typeof vi.fn>
  // Allow tests to drive a post-mount auth event.
  fire: (session: Session | null) => void
} {
  const unsubscribeSpy = vi.fn()
  let listener: ((event: string, session: Session | null) => void) | null =
    null

  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: opts.initialSession },
      })),
      onAuthStateChange: vi.fn(
        (cb: (event: string, session: Session | null) => void) => {
          listener = cb
          return {
            data: { subscription: { unsubscribe: unsubscribeSpy } },
          }
        },
      ),
    },
  } as unknown as SupabaseClient

  return {
    client,
    unsubscribeSpy,
    fire: (session) => {
      if (!listener) throw new Error('onAuthStateChange not yet called')
      listener('SIGNED_IN', session)
    },
  }
}

function makeFakeSession(token: string): Session {
  // Cast — only the fields `subscribeToSession` cares about (the
  // session existence + access_token) need to be present for the
  // helper's contract; the rest of the Session shape is irrelevant
  // here.
  return { access_token: token } as unknown as Session
}

describe('subscribeToSession', () => {
  it('emits authenticated once initial getSession resolves with a session', async () => {
    const session = makeFakeSession('jwt-1')
    const fake = makeFakeClient({ initialSession: session })

    const states: SessionState[] = []
    const unsub = subscribeToSession(fake.client, (s) => states.push(s))

    // Drain the microtask queue so the async getSession() promise resolves.
    await Promise.resolve()
    await Promise.resolve()

    expect(states).toEqual([{ session, status: 'authenticated' }])

    unsub()
  })

  it('emits unauthenticated once initial getSession resolves with null', async () => {
    const fake = makeFakeClient({ initialSession: null })

    const states: SessionState[] = []
    const unsub = subscribeToSession(fake.client, (s) => states.push(s))

    await Promise.resolve()
    await Promise.resolve()

    expect(states).toEqual([{ session: null, status: 'unauthenticated' }])

    unsub()
  })

  it('re-emits when onAuthStateChange fires after mount', async () => {
    const fake = makeFakeClient({ initialSession: null })

    const states: SessionState[] = []
    const unsub = subscribeToSession(fake.client, (s) => states.push(s))

    await Promise.resolve()
    await Promise.resolve()

    // First emission was the initial unauthenticated state.
    expect(states).toHaveLength(1)
    expect(states[0]).toEqual({ session: null, status: 'unauthenticated' })

    // Now drive a sign-in event.
    const session = makeFakeSession('jwt-after-signin')
    fake.fire(session)

    expect(states).toHaveLength(2)
    expect(states[1]).toEqual({ session, status: 'authenticated' })

    unsub()
  })

  it('does not emit after unsubscribe (race-safe for late getSession)', async () => {
    const session = makeFakeSession('jwt-late')
    const fake = makeFakeClient({ initialSession: session })

    const states: SessionState[] = []
    const unsub = subscribeToSession(fake.client, (s) => states.push(s))

    // Unsubscribe BEFORE the getSession() promise resolves.
    unsub()
    await Promise.resolve()
    await Promise.resolve()

    expect(states).toEqual([])
    expect(fake.unsubscribeSpy).toHaveBeenCalledTimes(1)

    // A post-unsubscribe auth event must also be ignored (the helper
    // guards both async paths with the same `cancelled` flag).
    fake.fire(session)
    expect(states).toEqual([])
  })
})
