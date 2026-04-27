/**
 * Frontfiles Upload V4 — Session Defaults Popover (D2.7 §1.1)
 *
 * Spec: UX-SPEC-V4 §13.
 *
 * Anchored beneath the cog button in LeftRailHeader (per IPD7-8). Form
 * fields per IPD7-9 = (a):
 *
 *   Privacy   — <select> over PUBLIC / RESTRICTED / PRIVATE
 *   Licences  — checkbox grid (per LicenceType enum)
 *   Tags      — comma-separated input
 *   Watermark — <select> over WatermarkMode enum
 *
 * Each change dispatches SET_DEFAULTS (existing C2 action) with a partial
 * update. No save button — inline-save pattern matches the rest of V4.
 *
 * Dismiss per IPD7-10:
 *   - Click outside (window-level mousedown)
 *   - Esc key
 *   - Clicking the cog button again (handled by parent toggling open prop)
 *
 * Brutalist visual: black border, square corners, no shadow except a 2px
 * black drop-shadow for "depth" without rounding.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useUploadContext } from './UploadContext'
import type { PrivacyState, LicenceType } from '@/lib/upload/types'
import { LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import type { WatermarkMode } from '@/lib/watermark/types'

const PRIVACY_OPTIONS: PrivacyState[] = ['PUBLIC', 'RESTRICTED', 'PRIVATE']
const LICENCE_OPTIONS: LicenceType[] = [
  'editorial',
  'commercial',
  'broadcast',
  'print',
  'digital',
  'web',
  'merchandise',
]
const WATERMARK_OPTIONS: WatermarkMode[] = ['none', 'subtle', 'standard', 'strong']

const FIELD_INPUT =
  'border border-black px-2 py-1 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-0'

interface Props {
  /** Parent (LeftRailHeader) controls open state; popover requests close via onClose. */
  onClose: () => void
}

export default function SessionDefaultsPopover({ onClose }: Props) {
  const { state, dispatch } = useUploadContext()
  const ref = useRef<HTMLDivElement>(null)

  // Click-outside + Esc dismiss per IPD7-10.
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  function setPrivacy(p: PrivacyState | null) {
    dispatch({ type: 'SET_DEFAULTS', defaults: { privacy: p } })
  }
  function toggleLicence(l: LicenceType) {
    const current = state.defaults.licences
    const next = current.includes(l) ? current.filter(x => x !== l) : [...current, l]
    dispatch({ type: 'SET_DEFAULTS', defaults: { licences: next } })
  }
  function setTags(raw: string) {
    const tags = raw.split(',').map(t => t.trim()).filter(Boolean)
    dispatch({ type: 'SET_DEFAULTS', defaults: { tags } })
  }
  function setWatermark(mode: WatermarkMode | null) {
    dispatch({ type: 'SET_DEFAULTS', defaults: { watermarkMode: mode } })
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Session defaults"
      // Anchored absolutely beneath the cog. Width fits comfortably inside
      // the 240px-wide rail when expanded; pushes slightly past the rail
      // edge to give the form room. z-30 sits above the contact sheet.
      className="absolute top-full right-0 mt-1 w-[280px] border-2 border-black bg-white p-3 z-30 flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Session defaults
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-black hover:underline"
          aria-label="Close defaults"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Privacy */}
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Privacy
        </span>
        <select
          value={state.defaults.privacy ?? ''}
          onChange={e => setPrivacy((e.target.value || null) as PrivacyState | null)}
          className={FIELD_INPUT}
        >
          <option value="">— Unset —</option>
          {PRIVACY_OPTIONS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      {/* Licences (checkbox grid) */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Licences
        </span>
        <div className="grid grid-cols-2 gap-1">
          {LICENCE_OPTIONS.map(l => {
            const checked = state.defaults.licences.includes(l)
            return (
              <label key={l} className="flex items-center gap-1.5 text-xs text-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLicence(l)}
                />
                {LICENCE_TYPE_LABELS[l]}
              </label>
            )
          })}
        </div>
      </div>

      {/* Tags (comma-separated) */}
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Tags
        </span>
        <input
          type="text"
          defaultValue={state.defaults.tags.join(', ')}
          onBlur={e => setTags(e.target.value)}
          placeholder="comma-separated"
          className={FIELD_INPUT}
        />
      </label>

      {/* Watermark */}
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Watermark
        </span>
        <select
          value={state.defaults.watermarkMode ?? ''}
          onChange={e => setWatermark((e.target.value || null) as WatermarkMode | null)}
          className={FIELD_INPUT}
        >
          <option value="">— Unset —</option>
          {WATERMARK_OPTIONS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <div className="text-[10px] uppercase tracking-widest text-slate-400 italic">
        Defaults apply to new files added after this point.
      </div>
    </div>
  )
}
