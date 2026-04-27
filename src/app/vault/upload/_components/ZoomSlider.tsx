/**
 * Frontfiles Upload V4 — Zoom Slider (D2.3 §1.1)
 *
 * Spec: UX-SPEC-V4 §3.5 + IPV4-8 default = (a) discrete 5-step.
 *
 * Replaces the C2-era `densityForCount` auto-detection with one user-
 * controlled dimension. Dispatches SET_CONTACT_SHEET_ZOOM (D2.1 reducer).
 *
 * Five discrete steps mapped to card widths:
 *   1 = 80px   (browse 1500-asset archive)
 *   2 = 120px  (browse + scan)
 *   3 = 160px  (organize — DEFAULT)
 *   4 = 240px  (review / curate)
 *   5 = 360px  (detail review)
 *
 * Bottom-left of CenterPane footer per spec §3.1 anatomy.
 */

'use client'

import { useUploadContext } from './UploadContext'

const STEPS: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5]

export default function ZoomSlider() {
  const { state, dispatch } = useUploadContext()
  const zoom = state.ui.contactSheetZoom

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mr-1">
        Zoom
      </span>
      {STEPS.map(z => {
        const active = z === zoom
        return (
          <button
            key={z}
            type="button"
            onClick={() => dispatch({ type: 'SET_CONTACT_SHEET_ZOOM', zoom: z })}
            className={`w-6 h-6 border border-black text-[10px] font-bold transition-colors ${
              active ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'
            }`}
            aria-pressed={active}
            aria-label={`Zoom level ${z}`}
            title={`Zoom level ${z}`}
          >
            {z}
          </button>
        )
      })}
    </div>
  )
}
