/**
 * Frontfiles Upload V3 — Bulk Operations Bar (C2.2 §3.6)
 *
 * Spec: UX-SPEC-V3.md §4.2.
 *
 * Renders when:
 *   - state.ui.bulkOpsBarOpen === true (Compact mode toggle), OR
 *   - density is 'batch' or 'archive' (auto-shown)
 * Parent (AssetList) decides whether to mount.
 *
 * Per IPII-6: price input is type="number" with step="0.01".
 * Per IPII-7: Caption/Tags/Geo "apply to selected" use inline popovers
 * (popover anchored to button; dismiss on click-outside).
 *
 * Per don't-do #3: NEVER expose a "bulk-accept price suggestion" affordance.
 * The reducer's bulk_accept_price_forbidden throw is the safety net; this
 * UI is the first line — only "Set price" (creator-authored) here.
 */

'use client'

import { useRef, useState, useEffect } from 'react'
import { useUploadContext } from './UploadContext'
import type { PrivacyState } from '@/lib/upload/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-black'
const INPUT = 'border border-black px-2 py-1 text-sm text-black bg-white'
const BTN =
  'border border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors'

export default function BulkOpsBar() {
  const { state, dispatch } = useUploadContext()
  const selectedCount = state.ui.selectedAssetIds.length
  const [priceInput, setPriceInput] = useState('')
  const [openPopover, setOpenPopover] = useState<'caption' | 'tags' | 'geo' | null>(null)

  function applySetPrice() {
    const cents = Math.round(parseFloat(priceInput) * 100)
    if (!Number.isFinite(cents) || cents < 0) return
    dispatch({
      type: 'BULK_UPDATE_FIELD',
      assetIds: state.ui.selectedAssetIds,
      field: 'price',
      value: cents,
    })
    setPriceInput('')
  }

  function applySetPrivacy(p: PrivacyState) {
    dispatch({
      type: 'BULK_UPDATE_FIELD',
      assetIds: state.ui.selectedAssetIds,
      field: 'privacy',
      value: p,
    })
  }

  return (
    <div className="border-b border-black bg-white px-4 py-2 flex items-center gap-3 flex-wrap min-w-0 sticky top-0 z-10">
      <span className={LABEL}>{selectedCount} selected</span>

      <span className="text-black">•</span>

      <label className="flex items-center gap-2">
        <span className={LABEL}>Set price:</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={priceInput}
          onChange={e => setPriceInput(e.target.value)}
          placeholder="EUR"
          className={`${INPUT} w-24 font-mono`}
        />
        <button
          type="button"
          onClick={applySetPrice}
          disabled={selectedCount === 0 || priceInput === ''}
          className={`${BTN} disabled:opacity-40`}
        >
          Apply
        </button>
      </label>

      <span className="text-black">•</span>

      <label className="flex items-center gap-2">
        <span className={LABEL}>Set privacy:</span>
        <select
          onChange={e => {
            if (e.target.value) applySetPrivacy(e.target.value as PrivacyState)
            e.target.value = ''
          }}
          disabled={selectedCount === 0}
          className={`${INPUT} disabled:opacity-40`}
          defaultValue=""
        >
          <option value="" disabled>
            Choose…
          </option>
          <option value="PRIVATE">Private</option>
          <option value="RESTRICTED">Restricted</option>
          <option value="PUBLIC">Public</option>
        </select>
      </label>

      <span className="text-black">•</span>

      <span className={LABEL}>Apply to selected:</span>
      <ApplyButton field="caption" open={openPopover === 'caption'} onToggle={() => setOpenPopover(openPopover === 'caption' ? null : 'caption')} onClose={() => setOpenPopover(null)} />
      <ApplyButton field="tags" open={openPopover === 'tags'} onToggle={() => setOpenPopover(openPopover === 'tags' ? null : 'tags')} onClose={() => setOpenPopover(null)} />
      <ApplyButton field="geo" open={openPopover === 'geo'} onToggle={() => setOpenPopover(openPopover === 'geo' ? null : 'geo')} onClose={() => setOpenPopover(null)} />

      <button
        type="button"
        onClick={() => dispatch({ type: 'DESELECT_ALL_ASSETS' })}
        disabled={selectedCount === 0}
        className={`${BTN} disabled:opacity-40 ml-auto`}
      >
        Clear
      </button>
    </div>
  )
}

/**
 * "Apply to selected" button with inline popover for caption/tags/geo.
 * Dispatches BULK_UPDATE_FIELD on apply.
 */
function ApplyButton({
  field,
  open,
  onToggle,
  onClose,
}: {
  field: 'caption' | 'tags' | 'geo'
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const { state, dispatch } = useUploadContext()
  const [value, setValue] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selectedCount = state.ui.selectedAssetIds.length

  // Click-outside dismisses popover
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  function apply() {
    if (!value.trim()) return
    const fieldKey = field === 'caption' ? 'description' : field === 'geo' ? 'geography' : 'tags'
    const fieldValue =
      field === 'tags'
        ? value.split(',').map(t => t.trim()).filter(Boolean)
        : field === 'geo'
          ? [value.trim()]
          : value
    dispatch({
      type: 'BULK_UPDATE_FIELD',
      assetIds: state.ui.selectedAssetIds,
      field: fieldKey as never,
      value: fieldValue as never,
    })
    setValue('')
    onClose()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={selectedCount === 0}
        className={`${BTN} disabled:opacity-40`}
      >
        {field.charAt(0).toUpperCase() + field.slice(1)}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 border border-black bg-white p-2 flex items-center gap-2 shadow-lg">
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={field === 'tags' ? 'comma,separated,tags' : field === 'geo' ? 'Location label' : 'Caption text'}
            className={`${INPUT} w-64`}
            autoFocus
          />
          <button type="button" onClick={apply} className={BTN}>
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
