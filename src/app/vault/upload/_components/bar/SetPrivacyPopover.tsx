/**
 * Frontfiles Upload V4 — Set Privacy popover (D2.5 §6.2)
 *
 * Spec: UX-SPEC-V4 §9.4 + D2.5-DIRECTIVE §6.2.
 *
 * Anchored popover. 3 stacked buttons (Private / Restricted / Public). Click
 * any → BULK_UPDATE_FIELD with that value → close.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useUploadContext } from '../UploadContext'
import type { PrivacyState } from '@/lib/upload/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-black'
const ROW_BTN =
  'w-full text-left border border-black px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-black bg-white hover:bg-black hover:text-white transition-colors'

const OPTIONS: Array<{ value: PrivacyState; label: string }> = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'RESTRICTED', label: 'Restricted' },
  { value: 'PUBLIC', label: 'Public' },
]

export default function SetPrivacyPopover({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useUploadContext()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

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

  function apply(p: PrivacyState) {
    dispatch({
      type: 'BULK_UPDATE_FIELD',
      assetIds: state.ui.selectedAssetIds,
      field: 'privacy',
      value: p,
    })
    onClose()
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Set privacy for selected assets"
      className="absolute bottom-full left-0 mb-2 z-40 border-2 border-black bg-white p-3 flex flex-col gap-2 shadow-lg min-w-[200px]"
    >
      <span className={LABEL}>Set privacy</span>
      <div className="flex flex-col gap-1">
        {OPTIONS.map(opt => (
          <button key={opt.value} type="button" onClick={() => apply(opt.value)} className={ROW_BTN}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
