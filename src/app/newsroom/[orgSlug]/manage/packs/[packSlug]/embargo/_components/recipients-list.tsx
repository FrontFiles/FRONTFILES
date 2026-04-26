'use client'

/**
 * Frontfiles — Embargo recipients list (NR-D8, F4)
 *
 * Client component. Add-recipient form above + recipients table
 * below. Status displayed is derived from
 * (revoked_at, access_count, first_accessed_at, last_accessed_at)
 * columns — no `status` enum in the schema (IP-3).
 *
 * Outlet column displays a deriveOutletFromEmail label
 * client-side (IP-4: NR-D8 v1 doesn't write to newsroom_outlets).
 *
 * Re-add semantic for revoked recipients (per founder
 * ratification): submitting an email that already has a
 * revoked-state row triggers an UPDATE that clears revoked_at
 * and rotates access_token, sending a fresh invite. The
 * front-end isn't aware of this — F6 handles it server-side
 * and returns 201 / 200 with the refreshed recipient.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P8 (recipients table — verbatim)
 *   - directives/NR-D8-embargo-configuration.md §F4
 *   - src/lib/newsroom/embargo-form-constants.ts (F8a — outlet derivation)
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  EMBARGO_RECIPIENT_EMAIL_MAX,
  deriveOutletFromEmail,
} from '@/lib/newsroom/embargo-form-constants'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

import type { RecipientSnapshot } from '../page'

// ── PRD §5.1 P8 verbatim copy ─────────────────────────────────

const ADD_BUTTON = 'Add recipient'
const REVOKE_CTA = 'Revoke access'
const RESEND_CTA = 'Resend invite'
const REVOKE_CONFIRM_PREFIX = 'Revoke access for '
const REVOKE_CONFIRM_SUFFIX =
  '? Their token will return 410 Gone. They can be re-invited later by adding them again.'
const ERR_GENERIC = "Couldn't update. Try again in a moment."
const ERR_SESSION = 'Session expired. Refresh and try again.'
const ERR_ALREADY_INVITED = 'This recipient is already invited.'
const ERR_INVALID_EMAIL = 'That email address is not valid.'

// ── Helpers ───────────────────────────────────────────────────

const RTF = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (Math.abs(diffMin) < 60) return RTF.format(diffMin, 'minute')
  const diffHr = Math.round(diffMs / 3_600_000)
  if (Math.abs(diffHr) < 24) return RTF.format(diffHr, 'hour')
  const diffDay = Math.round(diffMs / 86_400_000)
  return RTF.format(diffDay, 'day')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function statusLabel(snapshot: RecipientSnapshot): string {
  // PRD §5.1 P8: 'Invited' / 'Accessed {rel}' / 'Last accessed {rel}'
  // NR-D8 also surfaces revoked rows since the UI lets you re-add.
  if (snapshot.revoked_at) {
    return `Revoked ${formatDate(snapshot.revoked_at)}`
  }
  if (snapshot.access_count === 0) {
    return 'Invited'
  }
  // access_count >= 1 — show last_accessed_at
  if (snapshot.last_accessed_at) {
    return `Last accessed ${formatRelative(snapshot.last_accessed_at)}`
  }
  // Defensive: access_count >= 1 but somehow no last_accessed_at
  // (schema CHECK should prevent this, but guard the render path)
  return 'Accessed'
}

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

// ── Component ─────────────────────────────────────────────────

export function RecipientsList({
  orgSlug,
  packSlug,
  embargoId: _embargoId,
  recipients,
}: {
  orgSlug: string
  packSlug: string
  embargoId: string
  recipients: ReadonlyArray<RecipientSnapshot>
}) {
  const router = useRouter()

  const [emailInput, setEmailInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<
    string | null
  >(null)

  async function handleAdd(ev: React.FormEvent) {
    ev.preventDefault()
    if (submitting) return
    const trimmed = emailInput.trim()
    if (trimmed.length === 0) return

    setSubmitting(true)
    setError(null)

    const token = await getAuthToken()
    if (!token) {
      setSubmitting(false)
      setError(ERR_SESSION)
      return
    }

    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/embargo/recipients`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: trimmed }),
        },
      )
      if (res.ok) {
        setEmailInput('')
        setSubmitting(false)
        router.refresh()
        return
      }
      const json = (await res.json().catch(() => null)) as
        | { ok: false; reason?: string }
        | null
      setSubmitting(false)
      if (json?.reason === 'already-invited') {
        setError(ERR_ALREADY_INVITED)
      } else if (json?.reason === 'validation') {
        setError(ERR_INVALID_EMAIL)
      } else if (
        json?.reason === 'unauthenticated' ||
        json?.reason === 'forbidden'
      ) {
        setError(ERR_SESSION)
      } else {
        setError(ERR_GENERIC)
      }
    } catch {
      setSubmitting(false)
      setError(ERR_GENERIC)
    }
  }

  async function handleRevoke(recipientRowId: string) {
    setConfirmingRevokeId(null)
    setSubmitting(true)
    setError(null)
    const token = await getAuthToken()
    if (!token) {
      setSubmitting(false)
      setError(ERR_SESSION)
      return
    }
    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/embargo/recipients/${recipientRowId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      setSubmitting(false)
      if (res.ok || res.status === 204) {
        router.refresh()
        return
      }
      setError(ERR_GENERIC)
    } catch {
      setSubmitting(false)
      setError(ERR_GENERIC)
    }
  }

  return (
    <section aria-label="Embargo recipients">
      <h2>Approved recipients</h2>

      <form onSubmit={handleAdd} aria-label="Add recipient">
        <label>
          Email
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            maxLength={EMBARGO_RECIPIENT_EMAIL_MAX}
            disabled={submitting}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {ADD_BUTTON}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      {recipients.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Outlet</th>
              <th scope="col">Status</th>
              <th scope="col">Access count</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((snapshot) => {
              const email = snapshot.recipient?.email ?? '(unknown)'
              const outlet =
                snapshot.recipient?.email
                  ? deriveOutletFromEmail(snapshot.recipient.email)
                  : 'Unknown'
              const isRevoked = snapshot.revoked_at !== null
              return (
                <tr key={snapshot.id}>
                  <td>{email}</td>
                  <td>{outlet}</td>
                  <td>{statusLabel(snapshot)}</td>
                  <td>{snapshot.access_count}</td>
                  <td>
                    {/* Resend invite — deferred to v1.1; PRD §5.1 P8
                        column lists it but the action ships when
                        the resend flow lands alongside admin
                        diagnostics (NR-D17 territory). */}
                    <button
                      type="button"
                      disabled
                      title="Resend invite ships in v1.1."
                    >
                      {RESEND_CTA}
                    </button>
                    {!isRevoked ? (
                      confirmingRevokeId === snapshot.id ? (
                        <span role="dialog" aria-label="Confirm revoke">
                          <span>
                            {REVOKE_CONFIRM_PREFIX}
                            {email}
                            {REVOKE_CONFIRM_SUFFIX}
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfirmingRevokeId(null)}
                            disabled={submitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(snapshot.id)}
                            disabled={submitting}
                          >
                            Confirm revoke
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmingRevokeId(snapshot.id)
                          }
                          disabled={submitting}
                        >
                          {REVOKE_CTA}
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p>No recipients yet. Add one above.</p>
      )}
    </section>
  )
}
