'use client'

/**
 * Frontfiles — DNS TXT verification card (NR-D5b-i, F6)
 *
 * Client card that drives the DNS TXT verification flow end-to-end.
 * Copy bound to PRD §5.1 P2 (DNS TXT card table).
 *
 * State machine:
 *   - 'loading-token'   — on mount, POST /verifications/dns-txt/issue
 *                          to fetch the deterministic token; show a
 *                          loading placeholder.
 *   - 'ready'           — instruction + record value + Recheck CTA.
 *   - 'rechecking'      — CTA disabled, "Checking…" label.
 *   - 'error'           — error copy per PRD (below).
 *   - (rendered via prop) if `currentRecord` is non-null, render the
 *                          success-state block and skip the state
 *                          machine entirely.
 *
 * Error copy (PRD §5.1 P2):
 *   - not-found / dns-error : "We could not find the TXT record.
 *                              Wait 10 minutes after adding it and
 *                              retry."
 *   - value-mismatch         : "The record value does not match."
 *
 * After a successful recheck, the card calls `onChange()` (which
 * points to router.refresh() in the shell). The refreshed render
 * will include the new `currentRecord` prop, which flips the card
 * to the success-state branch.
 */

import { useEffect, useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { NewsroomVerificationRecordRow } from '@/lib/db/schema'

type CardState =
  | { kind: 'loading-token' }
  | { kind: 'ready'; recordValue: string }
  | { kind: 'rechecking'; recordValue: string }
  | { kind: 'error'; recordValue: string; message: string }

const ERROR_NOT_FOUND =
  'We could not find the TXT record. Wait 10 minutes after adding it and retry.'
const ERROR_VALUE_MISMATCH = 'The record value does not match.'
const ERROR_GENERIC = 'Something went wrong. Please retry.'

export function DnsTxtCard({
  orgSlug,
  primaryDomain,
  currentRecord,
  onChange,
}: {
  orgSlug: string
  primaryDomain: string
  currentRecord: NewsroomVerificationRecordRow | null
  onChange: () => void
}) {
  const [state, setState] = useState<CardState>({ kind: 'loading-token' })
  const [authToken, setAuthToken] = useState<string | null>(null)

  useEffect(() => {
    // Skip token issuance when we're already in the success branch.
    if (currentRecord) return

    let cancelled = false
    async function load() {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase.auth.getSession()
        if (cancelled) return

        const token = data.session?.access_token
        if (!token) {
          setState({ kind: 'error', recordValue: '', message: ERROR_GENERIC })
          return
        }
        setAuthToken(token)

        const res = await fetch(
          `/api/newsroom/orgs/${orgSlug}/verifications/dns-txt/issue`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        if (cancelled) return

        if (!res.ok) {
          setState({ kind: 'error', recordValue: '', message: ERROR_GENERIC })
          return
        }

        const body = (await res.json()) as {
          token: string
          recordName: string
          recordValue: string
        }
        if (cancelled) return

        setState({ kind: 'ready', recordValue: body.recordValue })
      } catch {
        if (cancelled) return
        setState({ kind: 'error', recordValue: '', message: ERROR_GENERIC })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [orgSlug, currentRecord])

  async function handleRecheck() {
    if (!authToken) return
    if (state.kind !== 'ready' && state.kind !== 'error') return
    const { recordValue } = state
    setState({ kind: 'rechecking', recordValue })

    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/verifications/dns-txt/recheck`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        },
      )
      const body = (await res.json()) as
        | { ok: true; verified_at: string }
        | { ok: false; reason: string; detail?: string }

      if (res.ok && body.ok) {
        onChange()
        return
      }

      const errorBody = body as { ok: false; reason: string }
      const message =
        errorBody.reason === 'value-mismatch'
          ? ERROR_VALUE_MISMATCH
          : ERROR_NOT_FOUND
      setState({ kind: 'error', recordValue, message })
    } catch {
      setState({ kind: 'error', recordValue, message: ERROR_GENERIC })
    }
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Copy is a convenience; silent failure is acceptable.
    }
  }

  if (currentRecord) {
    return (
      <section>
        <h2>Domain ownership — DNS TXT</h2>
        <p>Verified on {currentRecord.verified_at}.</p>
      </section>
    )
  }

  if (state.kind === 'loading-token') {
    return (
      <section>
        <h2>Domain ownership — DNS TXT</h2>
        <p>Loading…</p>
      </section>
    )
  }

  const rechecking = state.kind === 'rechecking'

  return (
    <section>
      <h2>Domain ownership — DNS TXT</h2>
      <p>
        Add this TXT record to your DNS for <strong>{primaryDomain}</strong>:
      </p>
      <pre>
        <code>{state.recordValue}</code>
      </pre>
      <button type="button" onClick={() => handleCopy(state.recordValue)}>
        Copy
      </button>
      <p>Propagation usually completes within 10 minutes.</p>
      <button type="button" onClick={handleRecheck} disabled={rechecking}>
        {rechecking ? 'Checking…' : 'Recheck DNS'}
      </button>
      {state.kind === 'error' ? (
        <p role="alert">{state.message}</p>
      ) : null}
    </section>
  )
}
