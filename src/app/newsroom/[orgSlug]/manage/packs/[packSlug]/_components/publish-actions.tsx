'use client'

/**
 * Frontfiles — Publish actions wrapper (NR-D9b, F2)
 *
 * Client component. Owns the modal-open state for the P9 → P10
 * sequence:
 *
 *   click CTA → if warranty null → P9 (warranty) → on confirm → P10
 *               else            → P10 (publish/schedule confirm)
 *
 * Also owns the post-publish toast (IP-2 ratified: native `<output
 * role="status" aria-live="polite">` with 6s setTimeout auto-
 * dismiss + manual close button). Single use site for v1.
 *
 * Disabled-CTA tooltip: when `ctaDisabled` is true, the button
 * renders disabled with the `missing[]` list joined into the
 * `title` attribute (PRD §5.1 P10 line 953: "tooltip lists missing
 * items").
 *
 * Spec cross-references:
 *   - directives/NR-D9b-publish-flow.md §F2
 *   - PRD.md §5.1 P10 (CTA states + post-publish toast)
 *   - src/lib/newsroom/publish-checklist.ts — `CtaLabel` type
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { NewsroomLicenceClass } from '@/lib/db/schema'
import type { CtaLabel } from '@/lib/newsroom/publish-checklist'

import { PublishConfirmationModal } from './publish-confirmation-modal'
import { RightsWarrantyModal } from './rights-warranty-modal'

const TOAST_AUTO_DISMISS_MS = 6000

interface PublishActionsProps {
  orgSlug: string
  packSlug: string
  packId: string
  packTitle: string
  packLicenceClass: NewsroomLicenceClass
  packCreditLine: string
  /** ISO timestamp; used by P10 schedule (no embargo) variant. */
  packPublishAt: string | null
  warrantyConfirmed: boolean
  embargo: { lift_at: string; recipientCount: number } | null
  ctaLabel: CtaLabel
  ctaDisabled: boolean
  /** PRD §5.1 P10: tooltip lists missing items. */
  missing: ReadonlyArray<string>
  canonicalUrl: string
}

/**
 * Modal phase. `null` = closed; `warranty` = P9 open; `confirm` =
 * P10 open (warranty already confirmed). Strict sequencing: only
 * one modal open at a time.
 */
type ModalPhase = null | 'warranty' | 'confirm'

export function PublishActions({
  orgSlug,
  packSlug,
  packId,
  packTitle,
  packLicenceClass,
  packCreditLine,
  packPublishAt,
  warrantyConfirmed,
  embargo,
  ctaLabel,
  ctaDisabled,
  missing,
  canonicalUrl,
}: PublishActionsProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<ModalPhase>(null)
  const [toastUrl, setToastUrl] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup toast timer on unmount.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  function handleCtaClick() {
    if (ctaDisabled) return
    if (!warrantyConfirmed) {
      setPhase('warranty')
    } else {
      setPhase('confirm')
    }
  }

  function handleWarrantyConfirmed() {
    // Warranty saved — proceed to P10 confirmation.
    setPhase('confirm')
  }

  function handlePublishSuccess() {
    setPhase(null)
    setToastUrl(canonicalUrl)
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = setTimeout(() => {
      setToastUrl(null)
      toastTimerRef.current = null
    }, TOAST_AUTO_DISMISS_MS)
    // Refresh so the surface picks up new pack.status / visibility.
    router.refresh()
  }

  function handleClose() {
    setPhase(null)
  }

  function handleToastClose() {
    setToastUrl(null)
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
  }

  // Tooltip: only when disabled and `missing[]` is non-empty.
  const tooltipText =
    ctaDisabled && missing.length > 0
      ? `Missing: ${missing.join(', ')}`
      : undefined

  return (
    <>
      <button
        type="button"
        disabled={ctaDisabled}
        onClick={handleCtaClick}
        title={tooltipText}
      >
        {ctaLabel}
      </button>

      {phase === 'warranty' ? (
        <RightsWarrantyModal
          orgSlug={orgSlug}
          packSlug={packSlug}
          onClose={handleClose}
          onConfirmed={handleWarrantyConfirmed}
        />
      ) : null}

      {phase === 'confirm' ? (
        <PublishConfirmationModal
          orgSlug={orgSlug}
          packSlug={packSlug}
          packId={packId}
          packTitle={packTitle}
          packLicenceClass={packLicenceClass}
          packCreditLine={packCreditLine}
          packPublishAt={packPublishAt}
          embargo={embargo}
          canonicalUrl={canonicalUrl}
          onClose={handleClose}
          onPublished={handlePublishSuccess}
        />
      ) : null}

      {/* Post-publish toast — IP-2 native `<output>` w/ auto-dismiss. */}
      {toastUrl !== null ? (
        <output
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>Published. </span>
          <strong>{toastUrl}</strong>
          <span> · </span>
          <button type="button" onClick={handleToastClose}>
            Close
          </button>
        </output>
      ) : null}
    </>
  )
}
