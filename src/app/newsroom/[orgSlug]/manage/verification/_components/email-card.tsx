'use client'

/**
 * Frontfiles — Domain-email verification card (NR-D5b-ii, F6)
 *
 * Client card that drives the second verification method end-to-
 * end. Replaces the NR-D5b-i stub (email-card-stub.tsx, deleted
 * by F7). Copy bound to PRD §5.1 P2 (Domain email card table).
 *
 * Mirrors dns-txt-card.tsx's posture:
 *   - Currently-verified branch (currentRecord != null) renders
 *     the success block and short-circuits the state machine.
 *   - Otherwise the state machine drives the issue/verify flow.
 *
 * State machine:
 *   - 'idle'           — email input, "Send code" disabled until
 *                         the address is well-formed and at the
 *                         primary domain.
 *   - 'sending'        — Send CTA disabled with "Sending…".
 *   - 'code-sent'      — email read-only, code input + Verify
 *                         CTA + Resend link. The 'Resend code'
 *                         link is the ratified PRD-vs-directive
 *                         reconciliation (IP-3): PRD's expired-
 *                         error copy "Request a new one." needs
 *                         an action target; the directive adds
 *                         the link as that target.
 *   - 'verifying'      — Verify CTA disabled with "Verifying…".
 *   - error-sent / error-verify states are encoded as `error`
 *     fields on the active state so we don't lose the user's
 *     entered email/code on a transient failure.
 *
 * After a successful verify, the card calls onChange() (which
 * points to router.refresh() in the shell). The refreshed render
 * will include the new currentRecord prop, which flips this
 * card to the success branch — and, if DNS TXT is also active,
 * tier promotion (recomputeTier inside F10) flips the company
 * to verified_source.
 *
 * Spec cross-references:
 *   - docs/public-newsroom/PRD.md §5.1 P2 (verbatim copy below)
 *   - directives/NR-D5b-ii-domain-email-otp.md §F6
 *   - dns-txt-card.tsx (sibling precedent)
 */

import { useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { NewsroomVerificationRecordRow } from '@/lib/db/schema'

// ── PRD §5.1 P2 copy (verbatim) ──
//
// Errors are surfaced as the strings the PRD specifies; the
// route-response `reason` codes are mapped to these strings here
// rather than at the route boundary so the route stays stable
// while the UI owns the user-facing wording.
const ERROR_WRONG_DOMAIN = 'That address is not at'
const ERROR_INCORRECT_CODE = 'Incorrect code.'
const ERROR_EXPIRED =
  'This code has expired. Request a new one.'
const ERROR_GENERIC = 'Something went wrong. Please retry.'

// Mirrors the server CHECK constraint
// (newsroom_email_otps_email_format) and F9's pre-INSERT regex.
const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type IdleState = {
  kind: 'idle'
  email: string
  error: string | null
}

type SendingState = {
  kind: 'sending'
  email: string
}

type CodeSentState = {
  kind: 'code-sent'
  email: string
  code: string
  error: string | null
  resending: boolean
}

type VerifyingState = {
  kind: 'verifying'
  email: string
  code: string
}

type CardState =
  | IdleState
  | SendingState
  | CodeSentState
  | VerifyingState

function isAtDomain(email: string, domain: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  return email.slice(at + 1).toLowerCase() === domain.toLowerCase()
}

function emailLooksValid(email: string, domain: string): boolean {
  return EMAIL_FORMAT.test(email) && isAtDomain(email, domain)
}

function reasonToMessage(
  reason: string | undefined,
  primaryDomain: string,
): string {
  switch (reason) {
    case 'wrong-domain':
      return `${ERROR_WRONG_DOMAIN} ${primaryDomain}.`
    case 'wrong-code':
      return ERROR_INCORRECT_CODE
    case 'expired':
    case 'no-active-otp':
    case 'too-many-attempts':
      return ERROR_EXPIRED
    default:
      return ERROR_GENERIC
  }
}

export function EmailCard({
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
  const [state, setState] = useState<CardState>({
    kind: 'idle',
    email: '',
    error: null,
  })

  async function getAuthToken(): Promise<string | null> {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    } catch {
      return null
    }
  }

  async function handleSend(emailValue: string) {
    const token = await getAuthToken()
    if (!token) {
      setState({
        kind: 'idle',
        email: emailValue,
        error: ERROR_GENERIC,
      })
      return
    }

    setState({ kind: 'sending', email: emailValue })

    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/verifications/email/send-otp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: emailValue }),
        },
      )
      const body = (await res.json().catch(() => null)) as
        | { ok: true; expiresAt: string }
        | { ok: false; reason?: string }
        | null

      if (res.ok && body && body.ok) {
        setState({
          kind: 'code-sent',
          email: emailValue,
          code: '',
          error: null,
          resending: false,
        })
        return
      }

      const reason = body && !body.ok ? body.reason : undefined
      setState({
        kind: 'idle',
        email: emailValue,
        error: reasonToMessage(reason, primaryDomain),
      })
    } catch {
      setState({
        kind: 'idle',
        email: emailValue,
        error: ERROR_GENERIC,
      })
    }
  }

  async function handleResend() {
    if (state.kind !== 'code-sent') return
    const { email } = state
    setState({ ...state, resending: true, error: null })

    const token = await getAuthToken()
    if (!token) {
      setState({ ...state, resending: false, error: ERROR_GENERIC })
      return
    }

    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/verifications/email/send-otp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        },
      )
      const body = (await res.json().catch(() => null)) as
        | { ok: true; expiresAt: string }
        | { ok: false; reason?: string }
        | null

      if (res.ok && body && body.ok) {
        setState({
          kind: 'code-sent',
          email,
          code: '',
          error: null,
          resending: false,
        })
        return
      }

      const reason = body && !body.ok ? body.reason : undefined
      setState({
        kind: 'code-sent',
        email,
        code: state.code,
        error: reasonToMessage(reason, primaryDomain),
        resending: false,
      })
    } catch {
      setState({
        kind: 'code-sent',
        email,
        code: state.code,
        error: ERROR_GENERIC,
        resending: false,
      })
    }
  }

  async function handleVerify() {
    if (state.kind !== 'code-sent') return
    const { email, code } = state
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setState({ ...state, error: ERROR_INCORRECT_CODE })
      return
    }

    const token = await getAuthToken()
    if (!token) {
      setState({ ...state, error: ERROR_GENERIC })
      return
    }

    setState({ kind: 'verifying', email, code })

    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/verifications/email/verify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, code }),
        },
      )
      const body = (await res.json().catch(() => null)) as
        | { ok: true; verified_at: string }
        | { ok: false; reason?: string }
        | null

      if (res.ok && body && body.ok) {
        onChange()
        return
      }

      const reason = body && !body.ok ? body.reason : undefined
      setState({
        kind: 'code-sent',
        email,
        code,
        error: reasonToMessage(reason, primaryDomain),
        resending: false,
      })
    } catch {
      setState({
        kind: 'code-sent',
        email,
        code,
        error: ERROR_GENERIC,
        resending: false,
      })
    }
  }

  // ── Currently-verified branch ──
  if (currentRecord) {
    return (
      <section>
        <h2>Domain email</h2>
        <p>
          Verified on {currentRecord.verified_at} (
          {currentRecord.value_checked}).
        </p>
      </section>
    )
  }

  // ── Idle ──
  if (state.kind === 'idle' || state.kind === 'sending') {
    const sending = state.kind === 'sending'
    const email = state.email
    const error = state.kind === 'idle' ? state.error : null
    const canSend = !sending && emailLooksValid(email, primaryDomain)

    function handleEmailChange(
      ev: React.ChangeEvent<HTMLInputElement>,
    ) {
      setState({
        kind: 'idle',
        email: ev.target.value,
        error: null,
      })
    }

    function handleSubmit(ev: React.FormEvent) {
      ev.preventDefault()
      if (!canSend) return
      void handleSend(email)
    }

    return (
      <section>
        <h2>Domain email</h2>
        <p>
          Enter an email address at <strong>{primaryDomain}</strong>.
          We will send a one-time code.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            Your email at {primaryDomain}
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={handleEmailChange}
              disabled={sending}
              required
            />
          </label>
          <button type="submit" disabled={!canSend}>
            {sending ? 'Sending…' : 'Send code'}
          </button>
        </form>
        {error ? <p role="alert">{error}</p> : null}
      </section>
    )
  }

  // ── Code-sent / verifying ──
  const verifying = state.kind === 'verifying'
  const { email, code } = state
  const error = state.kind === 'code-sent' ? state.error : null
  const resending = state.kind === 'code-sent' ? state.resending : false

  function handleCodeChange(
    ev: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (state.kind !== 'code-sent') return
    // Strip non-digits and clamp to 6 — keeps the input
    // numeric-only without requiring inputmode coercion.
    const raw = ev.target.value.replace(/\D/g, '').slice(0, 6)
    setState({ ...state, code: raw, error: null })
  }

  function handleVerifySubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (verifying || resending) return
    void handleVerify()
  }

  function handleResendClick() {
    if (verifying || resending) return
    void handleResend()
  }

  return (
    <section>
      <h2>Domain email</h2>
      <p>
        Code sent to <strong>{email}</strong>. Enter it below to
        verify.
      </p>
      <form onSubmit={handleVerifySubmit}>
        <label>
          Six-digit code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={handleCodeChange}
            disabled={verifying}
            maxLength={6}
            required
          />
        </label>
        <button
          type="submit"
          disabled={verifying || resending || code.length !== 6}
        >
          {verifying ? 'Verifying…' : 'Verify email'}
        </button>
        <button
          type="button"
          onClick={handleResendClick}
          disabled={verifying || resending}
        >
          {resending ? 'Sending…' : 'Resend code'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
