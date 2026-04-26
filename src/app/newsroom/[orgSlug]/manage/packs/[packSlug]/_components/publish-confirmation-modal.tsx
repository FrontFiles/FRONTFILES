'use client'

/**
 * Frontfiles — Publish confirmation modal (NR-D9b, F5)
 *
 * P10 confirmation per PRD §5.1 P10 (verbatim body-copy variants).
 * Native `<dialog>` element (IP-1 ratified Option A).
 *
 * Three body-copy variants per PRD lines 957–969:
 *
 *   1. No embargo, no publish_at  → "Publish this pack?"
 *      "You are publishing **{title}** to `{url}`. It will be
 *       public immediately. Licence class ({licence}) and credit
 *       line ({credit}) will be locked after publish."
 *      CTA: "Publish now"
 *
 *   2. With embargo               → "Schedule this pack?" (IP-3)
 *      "This pack will lift at {lift_at} ({TZ}) and publish to
 *       `{url}`. {n} recipient(s) will be invited now with pre-
 *       lift access."
 *      CTA: "Schedule"
 *
 *   3. publish_at, no embargo     → "Schedule this pack?" (IP-3)
 *      "This pack will publish at {publish_at} ({TZ}) to `{url}`.
 *       Before then, it remains private to your newsroom."
 *      CTA: "Schedule"
 *
 * IP-3 ratified: schedule variants get an interpolated title
 * ("Schedule this pack?") for accessibility (aria-labelledby
 * target). PRD silent on title for these two variants; symmetry
 * with the publish variant maintained.
 *
 * Target status derivation:
 *   no embargo + no publish_at → 'published'
 *   embargo OR publish_at      → 'scheduled'
 *
 * POST flow: CTA click → fetch `/api/.../transition` with Bearer
 * token + targetStatus body. The RPC's `TransitionResult`
 * discriminated union returns ok=true/false; on success →
 * `onPublished()` (parent shows toast + refreshes); on RPC false
 * → top-of-modal error.
 *
 * Spec cross-references:
 *   - directives/NR-D9b-publish-flow.md §F5
 *   - PRD.md §5.1 P10 (lines 957–969)
 *   - src/lib/newsroom/pack-transition.ts — `TransitionResult`
 */

import { useEffect, useRef, useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { NewsroomLicenceClass } from '@/lib/db/schema'

const ERR_SESSION = 'Sign in expired. Please refresh.'
const ERR_REQUEST = 'Could not publish. Please try again.'

interface PublishConfirmationModalProps {
  orgSlug: string
  packSlug: string
  packId: string
  packTitle: string
  packLicenceClass: NewsroomLicenceClass
  packCreditLine: string
  packPublishAt: string | null
  embargo: { lift_at: string; recipientCount: number } | null
  canonicalUrl: string
  onClose: () => void
  onPublished: () => void
}

interface BodyCopy {
  title: string
  ctaLabel: string
  body: React.ReactNode
}

/**
 * Browser-local timezone short label (e.g. "PST", "UTC"). Falls
 * back to "UTC" if Intl resolution fails.
 */
function getLocalTzLabel(): string {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    const parts = fmt.formatToParts(new Date())
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value
    return tz ?? 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Browser-local formatted timestamp (e.g. "Apr 30, 2026, 9:00 AM").
 */
function formatLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function buildCopy(props: PublishConfirmationModalProps): BodyCopy {
  const { packTitle, packLicenceClass, packCreditLine, packPublishAt, embargo, canonicalUrl } = props
  const tz = getLocalTzLabel()

  // Variant 2: embargo set
  if (embargo !== null) {
    const liftAt = formatLocal(embargo.lift_at)
    return {
      title: 'Schedule this pack?',
      ctaLabel: 'Schedule',
      body: (
        <>
          This pack will lift at {liftAt} ({tz}) and publish to{' '}
          <code>{canonicalUrl}</code>. {embargo.recipientCount} recipient(s) will be
          invited now with pre-lift access.
        </>
      ),
    }
  }

  // Variant 3: publish_at set, no embargo
  if (packPublishAt !== null) {
    const publishAt = formatLocal(packPublishAt)
    return {
      title: 'Schedule this pack?',
      ctaLabel: 'Schedule',
      body: (
        <>
          This pack will publish at {publishAt} ({tz}) to{' '}
          <code>{canonicalUrl}</code>. Before then, it remains private to your
          newsroom.
        </>
      ),
    }
  }

  // Variant 1: no embargo, no publish_at — immediate publish
  return {
    title: 'Publish this pack?',
    ctaLabel: 'Publish now',
    body: (
      <>
        You are publishing <strong>{packTitle}</strong> to{' '}
        <code>{canonicalUrl}</code>. It will be public immediately. Licence class
        ({packLicenceClass}) and credit line ({packCreditLine}) will be locked
        after publish.
      </>
    ),
  }
}

/**
 * Map the user-driven state intent to the RPC's `targetStatus`.
 * The RPC validates the actual transition against current state.
 */
function deriveTargetStatus(props: PublishConfirmationModalProps): 'published' | 'scheduled' {
  if (props.embargo !== null || props.packPublishAt !== null) {
    return 'scheduled'
  }
  return 'published'
}

export function PublishConfirmationModal(
  props: PublishConfirmationModalProps,
) {
  const { orgSlug, packSlug, onClose, onPublished } = props
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (!d.open) d.showModal()
    return () => {
      if (d.open) d.close()
    }
  }, [])

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

  const [submitState, setSubmitState] = useState<
    'idle' | 'submitting'
  >('idle')
  const [topError, setTopError] = useState<string | null>(null)

  const copy = buildCopy(props)
  const targetStatus = deriveTargetStatus(props)

  async function handleSubmit() {
    if (submitState === 'submitting') return
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
        `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/transition`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetStatus }),
        },
      )
    } catch {
      setSubmitState('idle')
      setTopError(ERR_REQUEST)
      return
    }

    if (!res.ok) {
      setSubmitState('idle')
      setTopError(ERR_REQUEST)
      return
    }

    let payload: { ok: boolean; errorCode?: string } | null = null
    try {
      payload = (await res.json()) as { ok: boolean; errorCode?: string }
    } catch {
      payload = null
    }

    if (payload === null || !payload.ok) {
      setSubmitState('idle')
      setTopError(
        payload?.errorCode
          ? `Could not publish (${payload.errorCode}). Refresh and try again.`
          : ERR_REQUEST,
      )
      return
    }

    if (dialogRef.current?.open) {
      dialogRef.current.close()
    }
    onPublished()
  }

  function handleCancelClick() {
    if (dialogRef.current?.open) {
      dialogRef.current.close()
    } else {
      onClose()
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="publish-confirmation-title">
      <h2 id="publish-confirmation-title">{copy.title}</h2>

      {topError !== null ? <p role="alert">{topError}</p> : null}

      <p>{copy.body}</p>

      <div>
        <button type="button" onClick={handleCancelClick}>
          Cancel
        </button>
        <button
          type="button"
          disabled={submitState === 'submitting'}
          onClick={handleSubmit}
        >
          {submitState === 'submitting' ? 'Working…' : copy.ctaLabel}
        </button>
      </div>
    </dialog>
  )
}
