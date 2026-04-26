'use client'

/**
 * Frontfiles — Pack Details form (NR-D6b, F4)
 *
 * Client component. The form body of the Pack editor's Details
 * tab — the first newsroom-side write surface. Used by both F1
 * (create) and F2 (edit); `mode` is derived from `pack === null`.
 *
 * State machine (client-internal):
 *   idle      — form rendered, no in-flight write
 *   unsaved   — at least one field has been edited since last save
 *               (edit mode only; create mode goes idle → saving)
 *   saving    — submit in flight; inputs disabled
 *   saved     — last submit succeeded (edit mode renders this)
 *
 * Slug auto-derivation:
 *   In create mode, slug auto-derives from title via slugify()
 *   until the user manually edits the slug field, at which point
 *   the auto-derive flips off. In edit mode, the existing slug
 *   is treated as user-set — no auto-derive on title edits.
 *
 * Auth: gets the browser Supabase session via
 * `getSupabaseBrowserClient`, attaches Bearer token to
 * fetch (mirrors NR-D5b-i F6 / NR-D5b-ii F6 / NR-D6a verification
 * cards). No server actions per audit (h).
 *
 * Error handling: API responses use `{ ok, reason, errors? }`
 * shape; reason → user-facing copy mapping is local to this
 * component (consistent with NR-D5b-ii email-card precedent).
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P6 (Details-tab field labels, helper text)
 *   - directives/NR-D6b-pack-creation-details-tab.md §F4
 *   - src/lib/newsroom/pack-form-constants.ts (F7a) — slugify, max constants, SLUG_FORMAT
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type {
  NewsroomLicenceClass,
  NewsroomPackRow,
} from '@/lib/db/schema'
import {
  PACK_CREDIT_LINE_MAX,
  PACK_DESCRIPTION_MAX,
  PACK_SLUG_MAX,
  PACK_SUBTITLE_MAX,
  PACK_TITLE_MAX,
  SLUG_FORMAT,
  slugify,
} from '@/lib/newsroom/pack-form-constants'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

interface LicenceOption {
  id: NewsroomLicenceClass
  humanLabel: string
  blurb: string
}

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved'

const ERR_GENERIC = "Couldn't save. Try again in a moment."
const ERR_SESSION = 'Session expired. Refresh and try again.'
const ERR_SLUG_CONFLICT = 'This URL slug is already used. Try another.'
const ERR_TIER = 'Verify your source to create packs.'
const ERR_NOT_EDITABLE =
  'This pack is no longer editable. Status changed.'

function reasonToMessage(reason: string | undefined): string {
  switch (reason) {
    case 'slug-conflict':
      return ERR_SLUG_CONFLICT
    case 'unauthenticated':
    case 'forbidden':
      return ERR_SESSION
    case 'unverified':
      return ERR_TIER
    case 'not-editable':
      return ERR_NOT_EDITABLE
    default:
      return ERR_GENERIC
  }
}

export function DetailsForm({
  orgSlug,
  pack,
  licenceClasses,
}: {
  orgSlug: string
  pack: NewsroomPackRow | null
  licenceClasses: ReadonlyArray<LicenceOption>
}) {
  const router = useRouter()
  const isEdit = pack !== null

  // ── Field state ──
  const [title, setTitle] = useState(pack?.title ?? '')
  const [subtitle, setSubtitle] = useState(pack?.subtitle ?? '')
  const [description, setDescription] = useState(pack?.description ?? '')
  const [creditLine, setCreditLine] = useState(pack?.credit_line ?? '')
  const [licenceClass, setLicenceClass] = useState<NewsroomLicenceClass>(
    pack?.licence_class ?? licenceClasses[0]!.id,
  )
  const [slug, setSlug] = useState(pack?.slug ?? '')

  // ── Slug auto-derive guard ──
  // Edit mode: treat existing slug as user-set (no auto-derive).
  // Create mode: auto-derive from title until user touches slug.
  const [slugAutoDerive, setSlugAutoDerive] = useState(!isEdit)

  // ── Save state + errors ──
  const [saveState, setSaveState] = useState<SaveState>(
    isEdit ? 'saved' : 'idle',
  )
  const [topError, setTopError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function markDirty() {
    setTopError(null)
    setSaveState((prev) => (prev === 'saving' ? prev : 'unsaved'))
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    if (slugAutoDerive) {
      setSlug(slugify(value))
    }
    markDirty()
  }

  function handleSlugChange(value: string) {
    setSlug(value)
    setSlugAutoDerive(false)
    markDirty()
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

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (saveState === 'saving') return

    setSaveState('saving')
    setTopError(null)
    setFieldErrors({})

    const token = await getAuthToken()
    if (!token) {
      setSaveState('unsaved')
      setTopError(ERR_SESSION)
      return
    }

    const body = {
      title,
      subtitle: subtitle.length > 0 ? subtitle : null,
      description,
      credit_line: creditLine,
      licence_class: licenceClass,
      slug,
    }

    const url = isEdit
      ? `/api/newsroom/orgs/${orgSlug}/packs/${pack!.slug}`
      : `/api/newsroom/orgs/${orgSlug}/packs`
    const method = isEdit ? 'PATCH' : 'POST'

    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch {
      setSaveState('unsaved')
      setTopError(ERR_GENERIC)
      return
    }

    const json = (await res.json().catch(() => null)) as
      | { ok: true; pack: NewsroomPackRow }
      | {
          ok: false
          reason?: string
          errors?: Record<string, string>
        }
      | null

    if (res.ok && json && json.ok) {
      if (!isEdit) {
        const newSlug = json.pack.slug
        router.push(`/${orgSlug}/manage/packs/${newSlug}`)
        return
      }
      setSaveState('saved')
      router.refresh()
      return
    }

    setSaveState(isEdit ? 'unsaved' : 'idle')

    if (json && !json.ok) {
      if (json.errors && typeof json.errors === 'object') {
        setFieldErrors(json.errors)
      }
      setTopError(reasonToMessage(json.reason))
    } else {
      setTopError(ERR_GENERIC)
    }
  }

  const submitting = saveState === 'saving'
  const slugIsValidShape = slug.length > 0 && SLUG_FORMAT.test(slug)
  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    creditLine.trim().length > 0 &&
    slugIsValidShape

  const selectedLicence = licenceClasses.find((c) => c.id === licenceClass)

  // Inline live save indicator next to the submit button. The
  // initial top-bar indicator lives in F3; this one tracks live
  // form state.
  const liveIndicator =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'unsaved'
          ? 'Unsaved changes'
          : ''

  return (
    <form onSubmit={handleSubmit} aria-label="Pack details">
      {topError ? <p role="alert">{topError}</p> : null}

      {/* ── Title ── */}
      <label>
        Pack title
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          maxLength={PACK_TITLE_MAX}
          required
          disabled={submitting}
        />
        {fieldErrors.title ? (
          <span role="alert">{fieldErrors.title}</span>
        ) : null}
      </label>

      {/* ── Subtitle (optional) ── */}
      <label>
        Subtitle (optional)
        <input
          type="text"
          value={subtitle}
          onChange={(e) => {
            setSubtitle(e.target.value)
            markDirty()
          }}
          maxLength={PACK_SUBTITLE_MAX}
          disabled={submitting}
        />
        {fieldErrors.subtitle ? (
          <span role="alert">{fieldErrors.subtitle}</span>
        ) : null}
      </label>

      {/* ── Description ── */}
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            markDirty()
          }}
          maxLength={PACK_DESCRIPTION_MAX}
          required
          disabled={submitting}
        />
        {fieldErrors.description ? (
          <span role="alert">{fieldErrors.description}</span>
        ) : null}
      </label>

      {/* ── Credit line ── */}
      <label>
        Credit line
        <input
          type="text"
          value={creditLine}
          onChange={(e) => {
            setCreditLine(e.target.value)
            markDirty()
          }}
          maxLength={PACK_CREDIT_LINE_MAX}
          required
          disabled={submitting}
        />
        <small>
          Appears wherever assets are used. Example: &quot;Photo: Nike&quot;
        </small>
        {fieldErrors.credit_line ? (
          <span role="alert">{fieldErrors.credit_line}</span>
        ) : null}
      </label>

      {/* ── Licence (radio group) ── */}
      <fieldset>
        <legend>Licence</legend>
        {licenceClasses.map((opt) => (
          <label key={opt.id}>
            <input
              type="radio"
              name="licence_class"
              value={opt.id}
              checked={licenceClass === opt.id}
              onChange={() => {
                setLicenceClass(opt.id)
                markDirty()
              }}
              disabled={submitting}
            />
            {opt.humanLabel}
          </label>
        ))}
        {selectedLicence ? <p>{selectedLicence.blurb}</p> : null}
        {fieldErrors.licence_class ? (
          <span role="alert">{fieldErrors.licence_class}</span>
        ) : null}
      </fieldset>

      {/* ── Slug (URL slug) ── */}
      <label>
        URL slug
        <input
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          maxLength={PACK_SLUG_MAX}
          required
          disabled={submitting}
          pattern={SLUG_FORMAT.source}
        />
        <small>
          newsroom.frontfiles.com/{orgSlug}/{slug || '{slug}'}
        </small>
        {fieldErrors.slug ? (
          <span role="alert">{fieldErrors.slug}</span>
        ) : null}
      </label>

      {/* ── Submit + live indicator ── */}
      <div>
        <button type="submit" disabled={!canSubmit}>
          {submitting ? 'Saving…' : 'Save draft'}
        </button>
        <span aria-live="polite">{liveIndicator}</span>
      </div>
    </form>
  )
}
