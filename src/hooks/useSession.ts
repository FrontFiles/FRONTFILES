'use client'

/**
 * Frontfiles — `useSession` hook (P4 concern 4A.2.AUTH, F2)
 *
 * Consumer-facing session accessor for client components. Abstracts
 * the Supabase `Session` shape into a stable, minimal contract:
 *
 *   {
 *     session:     Session | null,
 *     accessToken: string  | null,
 *     status:      'loading' | 'authenticated' | 'unauthenticated',
 *   }
 *
 * Usage:
 *
 *   const { accessToken, status } = useSession()
 *   if (status === 'loading') return <LoadingSpinner />
 *   if (status === 'unauthenticated') return <SignInPrompt />
 *   fetch('/api/offers', {
 *     headers: { Authorization: `Bearer ${accessToken}` },
 *   })
 *
 * Implementation is split deliberately:
 *
 *   - `subscribeToSession(client, onState)` — pure, framework-free
 *     state-machine helper. Owns the `getSession()` bootstrap plus the
 *     `onAuthStateChange` subscription. Returns an `unsubscribe`. This
 *     is what unit tests exercise (pure Node, no DOM).
 *
 *   - `useSession()` — thin React wrapper. Calls `getSupabaseBrowserClient()`,
 *     wires `subscribeToSession` into a `useEffect`, and maps the
 *     emitted `SessionState` into the hook's return shape.
 *
 * Rationale (P4_CONCERN_4A_2_AUTH_DIRECTIVE.md §R3): the repo has no
 * `.test.tsx` / jsdom / RTL footprint, and adding that infra mid-concern
 * would violate §D9 ("no new dependencies"). Extracting the subscription
 * state machine keeps the observable behavior Node-testable while the
 * React glue stays a mechanical ~10-line composition whose correctness
 * is AC3-smoke-covered.
 *
 * References:
 *   - `docs/audits/P4_CONCERN_4A_2_AUTH_DIRECTIVE.md` §F2, §R3, §AC2
 *   - `src/lib/supabase/browser.ts` — the client factory this hook consumes
 */

import { useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type UseSessionResult = {
  session: Session | null
  accessToken: string | null
  status: SessionStatus
}

/**
 * Pure state-machine payload emitted by `subscribeToSession`. Testable
 * in Node — no React, no DOM. The React wrapper below converts this
 * into the `UseSessionResult` shape consumers see.
 */
export type SessionState = {
  session: Session | null
  status: SessionStatus
}

/**
 * Subscribe to a Supabase client's session lifecycle.
 *
 * Contract:
 *
 *   1. Immediately calls `client.auth.getSession()`. Once it resolves,
 *      emits `{ session, status }` where status is `'authenticated'`
 *      if the session exists and `'unauthenticated'` otherwise. Never
 *      emits `'loading'` — the caller owns that as the initial state
 *      before this helper's first emission lands.
 *
 *   2. Registers `client.auth.onAuthStateChange` so any subsequent
 *      sign-in, sign-out, or token-refresh event re-emits the new
 *      `{ session, status }`.
 *
 *   3. Returns an `unsubscribe()`. Calling it:
 *        - marks the subscription cancelled, so a late-resolving step-1
 *          promise does NOT emit into a unmounted consumer,
 *        - invokes `subscription.unsubscribe()` on the change listener.
 *
 * The `cancelled` flag mirrors the canonical React-effect pattern for
 * async bootstraps; without it, a slow `getSession()` could emit into
 * a component that has already unmounted (ignored by React but spams
 * dev-only warnings).
 */
export function subscribeToSession(
  client: SupabaseClient,
  onState: (state: SessionState) => void,
): () => void {
  let cancelled = false

  client.auth.getSession().then(({ data }) => {
    if (cancelled) return
    onState({
      session: data.session ?? null,
      status: data.session ? 'authenticated' : 'unauthenticated',
    })
  })

  const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
    if (cancelled) return
    onState({
      session: session ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    })
  })

  return () => {
    cancelled = true
    sub.subscription.unsubscribe()
  }
}

export function useSession(): UseSessionResult {
  // Initial state is 'loading' — the `subscribeToSession` helper never
  // emits this; it's the gap between mount and the first getSession()
  // resolution that React owns.
  const [state, setState] = useState<SessionState>({
    session: null,
    status: 'loading',
  })

  useEffect(() => {
    const client = getSupabaseBrowserClient()
    return subscribeToSession(client, setState)
  }, [])

  return {
    session: state.session,
    accessToken: state.session?.access_token ?? null,
    status: state.status,
  }
}
