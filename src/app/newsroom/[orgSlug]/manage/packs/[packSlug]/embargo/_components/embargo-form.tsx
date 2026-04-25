'use client'

/**
 * Frontfiles — Embargo form (NR-D8, F3)
 *
 * Client component. The toggle + fields above the recipients
 * list. Three modes:
 *
 *   - No embargo (embargo prop null): toggle off, fields hidden,
 *     button "Set up embargo"
 *   - Editing draft embargo (embargo exists): toggle on, fields
 *     populated, button "Save changes"
 *   - Removing embargo (toggle flipped off when embargo exists):
 *     confirmation modal → DELETE
 *
 * Auth: Bearer fetch via getSupabaseBrowserClient (mirrors
 * NR-D6b / NR-D7a precedent). No server actions.
 *
 * Lift-at conversion: HTML5 <input type="datetime-local"> emits
 * "YYYY-MM-DDTHH:MM" (browser's wall clock). Combined with the
 * user's IANA timezone selection, we compute the actual UTC ISO
 * via Intl.DateTimeFormat's longOffset format. This is the
 * smallest-correct-thing for v1; v1.1 may swap to Temporal API
 * once stable.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P8 (toggle + field labels + helper text — verbatim)
 *   - directives/NR-D8-embargo-configuration.md §F3
 *   - src/lib/newsroom/embargo-form-constants.ts (F8a — caps + TZ list)
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { NewsroomEmbargoRow } from '@/lib/db/schema'
import {
  COMMON_TIMEZONES,
  EMBARGO_POLICY_MAX,
} from '@/lib/newsroom/embargo-form-constants'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

// ── PRD §5.1 P8 verbatim copy ─────────────────────────────────

const TOGGLE_LABEL = 'Release under embargo'
const TOGGLE_HELPER =
  '(off = publish immediately or at publish_at)'
const LIFT_AT_LABEL = 'Lift at'
const POLICY_LABEL = 'Embargo policy'
const POLICY_HELPER =
  'Tell recipients what they can and cannot do before lift. Shown on the preview page and in invite emails.'
const NOTIFY_LABEL = 'Notify subscribers when embargo lifts.'
const REMOVE_CONFIRM =
  'Removing this embargo will release the pack on publish without a hold. Recipients lose pre-lift access. Continue?'
const ERR_GENERIC = "Couldn't save. Try again in a moment."
const ERR_SESSION = 'Session expired. Refresh and try again.'

type SaveState = 'idle' | 'saving' | 'saved'

// ── Helpers ───────────────────────────────────────────────────

/**
 * Convert "YYYY-MM-DDTHH:MM" (wall-clock from datetime-local input)
 * + IANA zone → UTC ISO string with offset.
 *
 * Strategy: format an arbitrary point in the chosen zone with
 * Intl.DateTimeFormat's `longOffset` to read the offset literally
 * ("GMT-05:00"), then subtract that offset from the local-as-UTC
 * timestamp.
 *
 * Edge cases (DST transitions, exotic zones) get best-effort
 * results — v1 acceptable, v1.1 polish via Temporal API when
 * stable.
 */
function localToUtcIso(localWallClock: string, ianaZone: string): string {
  // Treat the local wall clock as if it were UTC for offset lookup.
  const probeMs = new Date(`${localWallClock}:00Z`).getTime()
  if (Number.isNaN(probeMs)) {
    throw new Error(`Invalid lift_at: ${localWallClock}`)
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaZone,
    timeZoneName: 'longOffset',
  })
  const parts = fmt.formatToParts(new Date(probeMs))
  const offsetPart =
    parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'

  // "GMT-05:00" / "GMT+1" / "UTC"
  const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(offsetPart)
  let offsetMin = 0
  if (match) {
    const sign = match[1] === '+' ? 1 : -1
    const hours = Number(match[2])
    const minutes = Number(match[3] ?? '0')
    offsetMin = sign * (hours * 60 + minutes)
  }
  // Local-as-UTC minus the zone's offset gives real UTC.
  const realMs = probeMs - offsetMin * 60_000
  return new Date(realMs).toISOString()
}

/** Convert ISO timestamp → "YYYY-MM-DDTHH:MM" in the given IANA zone. */
function utcIsoToLocal(iso: string, ianaZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(iso))
  const map = Object.fromEntries(
    parts
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  const hour = map.hour === '24' ? '00' : map.hour
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`
}

function defaultZone(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    return COMMON_TIMEZONES.some((t) => t.value === z) ? z : 'UTC'
  } catch {
    return 'UTC'
  }
}

// ── Component ─────────────────────────────────────────────────

export function EmbargoForm({
  orgSlug,
  packSlug,
  embargo,
}: {
  orgSlug: string
  packSlug: string
  embargo: NewsroomEmbargoRow | null
}) {
  const router = useRouter()
  const isEdit = embargo !== null

  // Initialize zone from embargo or browser default.
  const initialZone = defaultZone()

  const [enabled, setEnabled] = useState(isEdit)
  const [liftLocal, setLiftLocal] = useState(
    embargo ? utcIsoToLocal(embargo.lift_at, initialZone) : '',
  )
  const [zone, setZone] = useState(initialZone)
  const [policyText, setPolicyText] = useState(
    embargo?.policy_text ?? '',
  )
  const [notifyOnLift, setNotifyOnLift] = useState(
    embargo?.notify_on_lift ?? true,
  )

  const [saveState, setSaveState] = useState<SaveState>(
    isEdit ? 'saved' : 'idle',
  )
  const [topError, setTopError] = useState<string | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

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

    const token = await getAuthToken()
    if (!token) {
      setSaveState('idle')
      setTopError(ERR_SESSION)
      return
    }

    let liftAtIso: string
    try {
      liftAtIso = localToUtcIso(liftLocal, zone)
    } catch {
      setSaveState('idle')
      setTopError('Lift time is required.')
      return
    }

    const url = `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/embargo`
    const method = isEdit ? 'PATCH' : 'POST'
    const body = {
      lift_at: liftAtIso,
      policy_text: policyText,
      notify_on_lift: notifyOnLift,
    }

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
      setSaveState('idle')
      setTopError(ERR_GENERIC)
      return
    }

    if (res.ok) {
      setSaveState('saved')
      router.refresh()
      return
    }

    const json = (await res.json().catch(() => null)) as
      | { ok: false; reason?: string }
      | null
    setSaveState('idle')
    if (json && !json.ok && json.reason === 'unauthenticated') {
      setTopError(ERR_SESSION)
    } else if (json && !json.ok && json.reason === 'forbidden') {
      setTopError(ERR_SESSION)
    } else {
      setTopError(ERR_GENERIC)
    }
  }

  async function handleRemove() {
    setShowRemoveConfirm(false)
    setSaveState('saving')
    setTopError(null)
    const token = await getAuthToken()
    if (!token) {
      setSaveState('idle')
      setTopError(ERR_SESSION)
      return
    }
    const url = `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/embargo`
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok || res.status === 204) {
        router.refresh()
        return
      }
      setSaveState('idle')
      setTopError(ERR_GENERIC)
    } catch {
      setSaveState('idle')
      setTopError(ERR_GENERIC)
    }
  }

  function handleToggleChange(next: boolean) {
    if (!next && isEdit) {
      // Toggling off an existing embargo opens the confirm modal.
      setShowRemoveConfirm(true)
      return
    }
    setEnabled(next)
  }

  const submitting = saveState === 'saving'

  return (
    <section aria-label="Embargo configuration">
      {topError ? <p role="alert">{topError}</p> : null}

      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggleChange(e.target.checked)}
          disabled={submitting}
        />
        {TOGGLE_LABEL}
        <small> {TOGGLE_HELPER}</small>
      </label>

      {enabled ? (
        <form onSubmit={handleSubmit}>
          <label>
            {LIFT_AT_LABEL}
            <input
              type="datetime-local"
              value={liftLocal}
              onChange={(e) => setLiftLocal(e.target.value)}
              required
              disabled={submitting}
            />
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              disabled={submitting}
              aria-label="Timezone"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {POLICY_LABEL}
            <textarea
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              maxLength={EMBARGO_POLICY_MAX}
              required
              disabled={submitting}
            />
            <small>{POLICY_HELPER}</small>
          </label>

          <label>
            <input
              type="checkbox"
              checked={notifyOnLift}
              onChange={(e) => setNotifyOnLift(e.target.checked)}
              disabled={submitting}
            />
            {NOTIFY_LABEL}
          </label>

          <button type="submit" disabled={submitting}>
            {submitting
              ? 'Saving…'
              : isEdit
                ? 'Save changes'
                : 'Set up embargo'}
          </button>
        </form>
      ) : null}

      {showRemoveConfirm ? (
        <div role="dialog" aria-label="Remove embargo">
          <p>{REMOVE_CONFIRM}</p>
          <button
            type="button"
            onClick={() => setShowRemoveConfirm(false)}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={submitting}
          >
            Remove embargo
          </button>
        </div>
      ) : null}
    </section>
  )
}
