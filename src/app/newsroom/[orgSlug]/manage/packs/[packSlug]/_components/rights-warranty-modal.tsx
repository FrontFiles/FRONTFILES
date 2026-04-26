'use client'

/**
 * Frontfiles — Rights warranty modal (NR-D9b, F4)
 *
 * P9 modal per PRD §5.1 P9 (verbatim copy). Native `<dialog>`
 * element (IP-1 ratified Option A) — `showModal()` on mount gives
 * focus trap, ESC handler, and ::backdrop for free; no new
 * primitive dependency.
 *
 * Validation: all 3 checkboxes required. Confirm button disabled
 * until all checked.
 *
 * Footer: "Confirming as {User.name} · {User.email}" per PRD line
 * 931 — fetched via `getSupabaseBrowserClient().auth.getUser()` on
 * mount. Falls back to "current user" if the lookup fails (defensive
 * — should never trigger since AdminGate already established
 * session).
 *
 * POST flow: Confirm → fetch `/api/.../rights-warranty` with
 * Bearer token. On 201 → `onConfirmed()` (parent closes this modal
 * + opens F5). On non-201 → top-of-modal error string; modal stays
 * open for retry.
 *
 * Spec cross-references:
 *   - directives/NR-D9b-publish-flow.md §F4
 *   - PRD.md §5.1 P9 (line 919) — verbatim copy
 *   - PRD.md §3.2 (lines 368–370) — checkbox copy verbatim source
 */

import { useEffect, useRef, useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

const ERR_SESSION = 'Sign in expired. Please refresh.'
const ERR_REQUEST = 'Could not save warranty. Please try again.'

// ── PRD §5.1 P9 + §3.2 verbatim copy (frozen) ──────────────────

const COPY = Object.freeze({
  TITLE: 'Before publishing',
  INTRO:
    'Confirm the rights basis for this pack. These confirmations are recorded and attached to the pack.',
  // PRD §3.2 lines 368–370 — exact strings.
  CHECKBOX_SUBJECTS:
    'All identifiable people in this pack have given required releases, or this pack contains no identifiable people.',
  CHECKBOX_THIRD_PARTY:
    'All third-party content in this pack is cleared for this use, or this pack contains no third-party content.',
  CHECKBOX_MUSIC:
    'All music in this pack is cleared for this use, or this pack contains no music.',
  NARRATIVE_LABEL: 'Anything we should know? (optional)',
  FOOTER_PREFIX: 'Confirming as ',
  CANCEL: 'Cancel',
  CONFIRM: 'Confirm and continue',
  SAVING: 'Saving…',
})

interface RightsWarrantyModalProps {
  orgSlug: string
  packSlug: string
  onClose: () => void
  onConfirmed: () => void
}

export function RightsWarrantyModal({
  orgSlug,
  packSlug,
  onClose,
  onConfirmed,
}: RightsWarrantyModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Open the dialog imperatively on mount.
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (!d.open) d.showModal()
    return () => {
      if (d.open) d.close()
    }
  }, [])

  // Native <dialog> ESC + backdrop dismissal — listen for `close`
  // event so parent can sync state.
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    function handleClose() {
      onClose()
    }
    d.addEventListener('close', handleClose)
    return () => {
      d.removeEventListener('close', handleClose)
    }
  }, [onClose])

  // ── Form state ────────────────────────────────────────────────

  const [subjects, setSubjects] = useState(false)
  const [thirdParty, setThirdParty] = useState(false)
  const [music, setMusic] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [submitState, setSubmitState] = useState<
    'idle' | 'submitting'
  >('idle')
  const [topError, setTopError] = useState<string | null>(null)

  // ── User identity (footer) ────────────────────────────────────

  const [userLabel, setUserLabel] = useState<string>('current user')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase.auth.getUser()
        const user = data.user
        if (!alive || !user) return
        const name =
          (user.user_metadata?.display_name as string | undefined) ??
          user.email ??
          'current user'
        const email = user.email ?? ''
        setUserLabel(email ? `${name} · ${email}` : name)
      } catch {
        // Silent fall-through — keep the default.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // ── Submit ────────────────────────────────────────────────────

  const allChecked = subjects && thirdParty && music
  const canSubmit = allChecked && submitState !== 'submitting'

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitState('submitting')
    setTopError(null)

    let token: string | null = null
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token ?? null
    } catch {
      token = null
    }
    if (!token) {
      setSubmitState('idle')
      setTopError(ERR_SESSION)
      return
    }

    let res: Response
    try {
      res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/rights-warranty`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subject_releases_confirmed: true,
            third_party_content_cleared: true,
            music_cleared: true,
            narrative_text: narrative.trim().length > 0 ? narrative : null,
          }),
        },
      )
    } catch {
      setSubmitState('idle')
      setTopError(ERR_REQUEST)
      return
    }

    if (res.status !== 201) {
      setSubmitState('idle')
      setTopError(ERR_REQUEST)
      return
    }

    // Success — close native dialog, then notify parent (which
    // opens P10).
    if (dialogRef.current?.open) {
      // Bypass the `close` listener's onClose by removing it first
      // — onConfirmed() will set the parent's phase to 'confirm',
      // which unmounts this component anyway. But to keep the close
      // path clean we just call onConfirmed; the parent transitions
      // phase atomically.
      dialogRef.current.close()
    }
    onConfirmed()
  }

  function handleCancelClick() {
    // Close via native API; the `close` event listener fires
    // onClose().
    if (dialogRef.current?.open) {
      dialogRef.current.close()
    } else {
      onClose()
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="rights-warranty-title">
      <h2 id="rights-warranty-title">{COPY.TITLE}</h2>
      <p>{COPY.INTRO}</p>

      {topError !== null ? (
        <p role="alert">{topError}</p>
      ) : null}

      <fieldset>
        <legend>Required confirmations</legend>

        <label>
          <input
            type="checkbox"
            checked={subjects}
            onChange={(e) => setSubjects(e.target.checked)}
          />
          {COPY.CHECKBOX_SUBJECTS}
        </label>

        <label>
          <input
            type="checkbox"
            checked={thirdParty}
            onChange={(e) => setThirdParty(e.target.checked)}
          />
          {COPY.CHECKBOX_THIRD_PARTY}
        </label>

        <label>
          <input
            type="checkbox"
            checked={music}
            onChange={(e) => setMusic(e.target.checked)}
          />
          {COPY.CHECKBOX_MUSIC}
        </label>
      </fieldset>

      <label>
        {COPY.NARRATIVE_LABEL}
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          maxLength={2000}
        />
      </label>

      <p>
        <small>
          {COPY.FOOTER_PREFIX}
          {userLabel}
        </small>
      </p>

      <div>
        <button type="button" onClick={handleCancelClick}>
          {COPY.CANCEL}
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitState === 'submitting' ? COPY.SAVING : COPY.CONFIRM}
        </button>
      </div>
    </dialog>
  )
}
