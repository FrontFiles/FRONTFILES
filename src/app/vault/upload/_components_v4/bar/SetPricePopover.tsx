/**
 * Frontfiles Upload V4 — Set Price popover (D2.5 §6.1)
 *
 * Spec: UX-SPEC-V4 §9.4 + D2.5-DIRECTIVE §6.1.
 *
 * Anchored popover for the contextual action bar. Numeric input (EUR
 * decimal) → APPLY → BULK_UPDATE_FIELD with cents conversion. EUR-to-cents
 * math is the same as the dormant C2 BulkOpsBar.
 *
 * Closes on: Apply (success), Esc, click-outside.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useUploadContext } from '../../_components/UploadContext'

const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-black'
const INPUT = 'border border-black px-2 py-1 text-sm text-black bg-white'
const BTN =
  'border border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black'

export default function SetPricePopover({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useUploadContext()
  const [value, setValue] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Click-outside dismisses
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Esc dismisses (popover-scoped — bar has its own Esc handler when no
  // popover open). preventDefault stops the bar-level Esc from also firing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function apply() {
    const cents = Math.round(parseFloat(value) * 100)
    if (!Number.isFinite(cents) || cents < 0) return
    dispatch({
      type: 'BULK_UPDATE_FIELD',
      assetIds: state.ui.selectedAssetIds,
      field: 'price',
      value: cents,
    })
    onClose()
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Set price for selected assets"
      className="absolute bottom-full left-0 mb-2 z-40 border-2 border-black bg-white p-3 flex flex-col gap-2 shadow-lg min-w-[220px]"
    >
      <span className={LABEL}>Set price for {state.ui.selectedAssetIds.length} selected</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') apply()
          }}
          placeholder="EUR"
          autoFocus
          className={`${INPUT} w-28 font-mono`}
        />
        <button
          type="button"
          onClick={apply}
          disabled={value === '' || !Number.isFinite(parseFloat(value)) || parseFloat(value) < 0}
          className={BTN}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
