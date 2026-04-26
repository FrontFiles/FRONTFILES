'use client'

/**
 * Frontfiles — Newsroom admin gate (NR-D5b-i, F1b)
 *
 * Client-only wrapper that enforces the /{orgSlug}/manage/** auth
 * contract. Rendered by layout.tsx (F1a) around the subtree's
 * children.
 *
 * Flow on mount:
 *   1. Read the browser Supabase session (localStorage). No token →
 *      redirect to `/signin?return=/{orgSlug}/manage`.
 *   2. POST the Bearer token to GET /api/newsroom/orgs/{orgSlug}/me.
 *      Non-200 → redirect to '/'. Body { isAdmin: false } →
 *      redirect to '/'.
 *   3. Admin confirmed → unlock children.
 *
 * While the gate is checking, render a loading placeholder. While
 * redirecting, render nothing.
 *
 * Mirrors the session-read pattern in
 * `src/app/newsroom/start/_components/signup-form.tsx` (NR-D5a) —
 * same `getSupabaseBrowserClient().auth.getSession()` path, same
 * `cancelled` latch to avoid state updates after unmount.
 */

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type GateState =
  | { kind: 'checking' }
  | { kind: 'allow' }
  | { kind: 'deny' }

export function AdminGate({
  orgSlug,
  children,
}: {
  orgSlug: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<GateState>({ kind: 'checking' })

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase.auth.getSession()
        if (cancelled) return

        const token = data.session?.access_token
        if (!token) {
          router.push(`/signin?return=/${orgSlug}/manage`)
          setState({ kind: 'deny' })
          return
        }

        const res = await fetch(`/api/newsroom/orgs/${orgSlug}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return

        if (!res.ok) {
          router.push('/')
          setState({ kind: 'deny' })
          return
        }

        const body = (await res.json()) as {
          ok: true
          isAdmin: boolean
          role: string | null
        }
        if (cancelled) return

        if (!body.isAdmin) {
          router.push('/')
          setState({ kind: 'deny' })
          return
        }

        setState({ kind: 'allow' })
      } catch {
        if (cancelled) return
        router.push('/')
        setState({ kind: 'deny' })
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [orgSlug, router])

  if (state.kind === 'checking') {
    return <p>Loading…</p>
  }
  if (state.kind === 'deny') {
    return null
  }
  return <>{children}</>
}
