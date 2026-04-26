/**
 * Frontfiles Upload V3 — Linear-mode asset row (C2.2 §3.3)
 *
 * Spec: UX-SPEC-V3.md §3.1 (row anatomy) + §3.2 (AI proposal visual)
 * + §3.3 (field validation).
 *
 * Renders only in Linear density mode (1–5 files). Full per-row inline
 * editing of all primary metadata fields. AI suggestions render as
 * italic ghost text with one-click ✓ accept (dispatches UPDATE_ASSET_FIELD
 * per IP-5 selector-derived acceptance).
 *
 * Per don't-do #3: NEVER expose a "bulk-accept price suggestion"
 * affordance. Per-asset price acceptance via the row's ✓ button is fine
 * (it dispatches a single UPDATE_ASSET_FIELD on price, which is a
 * creator-authored set, not a bulk-accept).
 */

'use client'

import { useUploadContext } from './UploadContext'
import type { V2Asset, AssetEditableFields } from '@/lib/upload/v3-types'
import type { LicenceType, PrivacyState } from '@/lib/upload/types'

const LABEL = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1'
const INPUT =
  'border border-black px-2 py-1 text-sm text-black bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-600'
const GHOST = 'italic text-slate-500'
const ACCEPT_BTN =
  'border border-black px-2 py-0.5 text-[10px] font-bold uppercase text-black hover:bg-black hover:text-white transition-colors'

interface Props {
  asset: V2Asset
}

export default function AssetRow({ asset }: Props) {
  const { dispatch } = useUploadContext()

  function update<K extends keyof AssetEditableFields>(field: K, value: AssetEditableFields[K]) {
    dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field, value })
  }

  function acceptCaption() {
    if (!asset.proposal?.description) return
    update('description', asset.proposal.description)
  }

  function acceptPrice() {
    if (!asset.proposal?.priceSuggestion) return
    update('price', asset.proposal.priceSuggestion.amount)
  }

  const hasCaptionGhost = !asset.editable.description && !!asset.proposal?.description
  const hasPriceGhost = asset.editable.price === null && !!asset.proposal?.priceSuggestion

  return (
    <div
      className={`border border-black bg-white p-3 flex gap-3 min-w-0 ${asset.excluded ? 'opacity-40' : ''}`}
      data-asset-id={asset.id}
    >
      {/* Thumbnail */}
      <div className="border border-black bg-slate-100 w-24 h-24 flex-shrink-0 flex items-center justify-center text-[8px] uppercase text-slate-500">
        {asset.thumbnailRef ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnailRef} alt={asset.filename} className="w-full h-full object-cover" />
        ) : (
          'no preview'
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Filename + exclude */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
            {asset.filename}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_ASSET_EXCLUDED', assetId: asset.id })}
            className="text-[10px] font-bold uppercase tracking-widest text-black hover:underline"
            aria-pressed={asset.excluded}
          >
            {asset.excluded ? '↺ Include' : '✕ Exclude'}
          </button>
        </div>

        {/* Title */}
        <label className="block mb-2">
          <span className={LABEL}>Title*</span>
          <input
            type="text"
            value={asset.editable.title}
            onChange={e => update('title', e.target.value)}
            className={INPUT}
          />
        </label>

        {/* Caption (with AI ghost) */}
        <label className="block mb-2">
          <span className={LABEL}>Caption</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={asset.editable.description}
              onChange={e => update('description', e.target.value)}
              placeholder={hasCaptionGhost ? asset.proposal!.description : 'Caption…'}
              className={`${INPUT} ${hasCaptionGhost ? GHOST : ''}`}
            />
            {hasCaptionGhost && (
              <button type="button" onClick={acceptCaption} className={ACCEPT_BTN} title="Accept AI suggestion">
                ✓
              </button>
            )}
          </div>
        </label>

        {/* Tags */}
        <label className="block mb-2">
          <span className={LABEL}>Tags</span>
          <input
            type="text"
            value={asset.editable.tags.join(', ')}
            onChange={e => update('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            placeholder="comma, separated, tags"
            className={INPUT}
          />
        </label>

        {/* Price (with engine ghost + Why?) */}
        <label className="block mb-2">
          <span className={LABEL}>Price (EUR)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={asset.editable.price === null ? '' : asset.editable.price / 100}
              onChange={e => {
                const v = e.target.value
                update('price', v === '' ? null : Math.round(parseFloat(v) * 100))
              }}
              placeholder={hasPriceGhost ? `€${(asset.proposal!.priceSuggestion!.amount / 100).toFixed(2)}` : '0.00'}
              className={`${INPUT} font-mono w-32 ${hasPriceGhost ? GHOST : ''}`}
            />
            {hasPriceGhost && (
              <>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_PRICE_BASIS_PANEL', assetId: asset.id })}
                  className="text-[10px] font-bold uppercase text-black hover:underline"
                  title='"Why this price?"'
                >
                  Why?
                </button>
                <button type="button" onClick={acceptPrice} className={ACCEPT_BTN} title="Accept engine recommendation">
                  ✓
                </button>
              </>
            )}
          </div>
        </label>

        {/* Privacy + Licences row */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="block">
            <span className={LABEL}>Privacy</span>
            <select
              value={asset.editable.privacy ?? ''}
              onChange={e => update('privacy', e.target.value === '' ? null : (e.target.value as PrivacyState))}
              className={INPUT}
            >
              <option value="">— Choose —</option>
              <option value="PRIVATE">Private</option>
              <option value="RESTRICTED">Restricted</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>
          <label className="block">
            <span className={LABEL}>Licences</span>
            <select
              multiple
              value={asset.editable.licences}
              onChange={e =>
                update(
                  'licences',
                  Array.from(e.target.selectedOptions).map(o => o.value as LicenceType),
                )
              }
              className={`${INPUT} h-16`}
            >
              <option value="EDITORIAL">Editorial</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="EXCLUSIVE">Exclusive</option>
            </select>
          </label>
        </div>

        {/* Geo */}
        <label className="block">
          <span className={LABEL}>Geo</span>
          <input
            type="text"
            value={asset.editable.geography.join(', ')}
            onChange={e =>
              update('geography', e.target.value.split(',').map(g => g.trim()).filter(Boolean))
            }
            placeholder="City, Country"
            className={INPUT}
          />
        </label>
      </div>
    </div>
  )
}
