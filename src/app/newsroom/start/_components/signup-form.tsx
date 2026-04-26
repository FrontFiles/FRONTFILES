'use client'

/**
 * Frontfiles — Newsroom P1 signup form (NR-D5a, F2)
 *
 * Client component. Five fields (orgName, legalName, primaryDomain,
 * countryCode, termsAccepted) with labels + helper copy verbatim
 * from PRD §5.1 P1. Submit POSTs JSON to /api/newsroom/start with
 * the caller's Supabase JWT in an Authorization: Bearer header;
 * on 200 the form navigates the router to `/{orgSlug}/manage`.
 *
 * ─── Auth gate (NR-D5a IP-1) ────────────────────────────────────
 *
 * The codebase's session lives in localStorage (see
 * src/lib/supabase/browser.ts) and is not visible to server
 * components. On mount, the form reads the session via the browser
 * Supabase client; if it is missing, the user is redirected to
 * /signin?return=/start. The `return` query param is forward-
 * compatible — the current /signin page ignores it — so users
 * will still land on /vault/offers after sign-in today. Future
 * work (post-NR-D5a) can wire the return URL through without
 * touching this file.
 *
 * ─── Submit pathway ─────────────────────────────────────────────
 *
 *   1. Gather fields into the shape SignupSchema validates.
 *   2. POST JSON + Bearer token to /api/newsroom/start.
 *   3. On 200: router.push(`/${orgSlug}/manage`).
 *   4. On 4xx: render either per-field errors (from
 *      fieldErrors) or a top-level error message.
 *
 * Client-side validation mirrors the shared SignupSchema to
 * surface inline hints; the server re-validates, so this is UX
 * only, never a trust boundary.
 *
 * Styling is deliberately minimal — PRD visual treatment ships
 * with NR-D6 / NR-D11.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

import { SignupSchema } from '../schema'

type AuthState =
  | { kind: 'loading' }
  | { kind: 'authed'; accessToken: string }
  | { kind: 'unauthed' }

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | {
      kind: 'error'
      error: string
      fieldErrors?: Record<string, string>
    }

export function SignupForm() {
  const router = useRouter()

  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' })

  const [orgName, setOrgName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [primaryDomain, setPrimaryDomain] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        const token = data.session?.access_token
        if (!token) {
          setAuth({ kind: 'unauthed' })
          router.push('/signin?return=/start')
          return
        }
        setAuth({ kind: 'authed', accessToken: token })
      } catch {
        if (cancelled) return
        setAuth({ kind: 'unauthed' })
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router])

  const wireShape = {
    orgName,
    legalName,
    primaryDomain,
    countryCode,
    termsAccepted: termsAccepted ? 'on' : undefined,
  }

  const parsed = SignupSchema.safeParse(wireShape)

  // Directive-specified disable logic: submitting OR any required
  // field empty OR terms unchecked. Field-format errors do NOT
  // disable the button — they surface inline on blur/change.
  const hasAllFields =
    orgName.trim() !== '' &&
    legalName.trim() !== '' &&
    primaryDomain.trim() !== '' &&
    countryCode.trim() !== '' &&
    termsAccepted
  const disableSubmit =
    auth.kind !== 'authed' ||
    submit.kind === 'submitting' ||
    !hasAllFields

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (auth.kind !== 'authed') return
    setSubmit({ kind: 'submitting' })

    try {
      const response = await fetch('/api/newsroom/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify(wireShape),
      })

      const body = (await response.json()) as
        | { ok: true; orgSlug: string }
        | { ok: false; error?: string; fieldErrors?: Record<string, string> }

      if (response.ok && body.ok && body.orgSlug) {
        router.push(`/${body.orgSlug}/manage`)
        return
      }

      const errorBody = body as {
        ok: false
        error?: string
        fieldErrors?: Record<string, string>
      }
      setSubmit({
        kind: 'error',
        error: errorBody.error ?? 'Something went wrong.',
        fieldErrors: errorBody.fieldErrors,
      })
    } catch {
      setSubmit({ kind: 'error', error: 'Something went wrong.' })
    }
  }

  if (auth.kind === 'loading') {
    return <p>Loading…</p>
  }
  if (auth.kind === 'unauthed') {
    return (
      <p>
        You need to be signed in to create a newsroom.{' '}
        <Link href="/signin?return=/start">Sign in</Link>.
      </p>
    )
  }

  const fieldError = (name: string): string | undefined => {
    if (submit.kind === 'error' && submit.fieldErrors?.[name]) {
      return submit.fieldErrors[name]
    }
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === name)
      if (issue) return issue.message
    }
    return undefined
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="nr-orgName">Organisation name</label>
        <input
          id="nr-orgName"
          name="orgName"
          type="text"
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />
        <p>As it should appear on your newsroom page</p>
        {fieldError('orgName') ? (
          <p role="alert">{fieldError('orgName')}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="nr-legalName">Registered legal name</label>
        <input
          id="nr-legalName"
          name="legalName"
          type="text"
          required
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
        />
        <p>Used on licence terms and legal notices</p>
        {fieldError('legalName') ? (
          <p role="alert">{fieldError('legalName')}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="nr-primaryDomain">Primary domain</label>
        <input
          id="nr-primaryDomain"
          name="primaryDomain"
          type="text"
          required
          value={primaryDomain}
          onChange={(e) => setPrimaryDomain(e.target.value)}
        />
        <p>The domain you will verify ownership of. Example: acme.com</p>
        {fieldError('primaryDomain') ? (
          <p role="alert">{fieldError('primaryDomain')}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="nr-countryCode">Country of incorporation</label>
        <input
          id="nr-countryCode"
          name="countryCode"
          type="text"
          required
          maxLength={2}
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
        />
        <p>Two-letter country code (e.g. US, GB, FR)</p>
        {fieldError('countryCode') ? (
          <p role="alert">{fieldError('countryCode')}</p>
        ) : null}
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            name="termsAccepted"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />{' '}
          I accept the Frontfiles Distributor Terms and the Content Standards.
        </label>
        {fieldError('termsAccepted') ? (
          <p role="alert">{fieldError('termsAccepted')}</p>
        ) : null}
      </div>

      {submit.kind === 'error' && !submit.fieldErrors ? (
        <p role="alert">{submit.error}</p>
      ) : null}

      <button type="submit" disabled={disableSubmit}>
        {submit.kind === 'submitting' ? 'Creating…' : 'Create newsroom'}
      </button>
    </form>
  )
}
