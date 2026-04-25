/**
 * Frontfiles — Pack editor shell (NR-D6b, F3)
 *
 * Server component. Composes the top bar (breadcrumb + status
 * badge + initial save indicator + disabled Publish CTA) and
 * the tab nav (Details active; Assets + Embargo disabled
 * placeholders), then renders the active-tab content as
 * `children`.
 *
 * Save indicator is intentionally a static slot here. F4 (the
 * `'use client'` Details form) manages its own dynamic indicator
 * inline next to its submit button — passing reactive state
 * through a server boundary into a client child via prop would
 * either require server actions (locked NO per audit (h)) or a
 * router-refresh dance after every keystroke. Two indicators
 * (one initial, one live) is the v1 compromise; can unify in a
 * v1.1 polish pass.
 *
 * Disabled-tab semantics (audit (i)): Assets + Embargo render as
 * `<span>` (not `<button>` or `<Link>`) with tooltips so admins
 * understand the state is intentional rather than broken.
 *
 * Disabled Publish CTA (audit (j)): the button is rendered but
 * disabled with a tooltip pointing to NR-D9. Matches the disabled-
 * CTA semantics on the dashboard's "New pack" button (NR-D6a F3).
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P6 (top-bar layout — verbatim authority)
 *   - directives/NR-D6b-pack-creation-details-tab.md §F3
 */

import Link from 'next/link'

import type { NewsroomPackRow } from '@/lib/db/schema'

const PUBLISH_CTA_TOOLTIP = 'Publishing ships in NR-D9. Save draft for now.'

const SAVE_STATE_LABEL: Record<
  'idle' | 'saving' | 'saved',
  string
> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
}

export function PackEditorShell({
  orgSlug,
  orgName,
  pack,
  saveState,
  children,
}: {
  orgSlug: string
  orgName: string
  pack: NewsroomPackRow | null
  saveState: 'idle' | 'saving' | 'saved'
  children: React.ReactNode
}) {
  const breadcrumbTitle = pack?.title ?? 'New pack'
  const detailsHref = pack
    ? `/${orgSlug}/manage/packs/${pack.slug}`
    : `/${orgSlug}/manage/packs/new`

  return (
    <main>
      {/* ── Top bar ── */}
      <header>
        <nav aria-label="Breadcrumb">
          <Link href={`/${orgSlug}/manage`}>{orgName}</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/${orgSlug}/manage`}>Packs</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{breadcrumbTitle}</span>
        </nav>

        <div>
          {/* Status badge — always "Draft" in NR-D6b's editable surface
              (F2 status-guard rejects non-draft packs upstream). */}
          <span aria-label="Status: Draft">Draft</span>

          {/* Initial save indicator (server-rendered). F4 has its own
              live indicator next to the submit button. */}
          <span aria-live="polite">{SAVE_STATE_LABEL[saveState]}</span>

          {/* Disabled Publish CTA — NR-D9 turns this on. */}
          <button type="button" disabled title={PUBLISH_CTA_TOOLTIP}>
            Publish
          </button>
        </div>
      </header>

      {/* ── Tab nav ──
       *  NR-D7a activated the Assets tab; NR-D8 activates Embargo.
       *  Both follow the same shape: rendered as <Link> when a
       *  saved pack exists (path takes pack.slug), or as a
       *  disabled <span> in create mode (no slug yet — admin
       *  saves the draft first via the Details tab, then the
       *  other tabs become reachable).
       *
       *  Active-state styling for "currently on Details vs Assets
       *  vs Embargo" is intentionally not encoded here — Next 16
       *  doesn't expose the current pathname to server components
       *  without an extra wrapper, and the visual-polish pass owns
       *  selected-tab indicators. All three tabs render
       *  aria-current="page" so the editor surface itself is
       *  signalled; routing differentiates the actual content.
       */}
      <nav aria-label="Pack editor tabs">
        <Link href={detailsHref} aria-current="page">
          Details
        </Link>
        {pack ? (
          <Link
            href={`/${orgSlug}/manage/packs/${pack.slug}/assets`}
            aria-current="page"
          >
            Assets
          </Link>
        ) : (
          <span
            aria-disabled="true"
            title="Save the pack first to upload assets."
          >
            Assets
          </span>
        )}
        {pack ? (
          <Link
            href={`/${orgSlug}/manage/packs/${pack.slug}/embargo`}
            aria-current="page"
          >
            Embargo
          </Link>
        ) : (
          <span
            aria-disabled="true"
            title="Save the pack first to set up an embargo."
          >
            Embargo
          </span>
        )}
      </nav>

      {/* ── Active tab content (DetailsForm) ── */}
      <section>{children}</section>
    </main>
  )
}
