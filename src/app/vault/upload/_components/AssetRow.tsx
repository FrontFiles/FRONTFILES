/**
 * DORMANT — replaced by D2 (ContactSheetCard in app/vault/upload/_components_v4/).
 * Scheduled for deletion at the explicit D2.8 cutover PR.
 * DO NOT extend.
 *
 * Linear mode dies at D2.1 — replaced by the contact-sheet zoom slider per
 * UX-SPEC-V4 §3.5. As of D2.1 this file is no longer on any production path.
 */

/**
 * Frontfiles Upload V3 — Linear-mode asset row (C2.2 §3.3, extended in C2.5)
 *
 * Spec: UX-SPEC-V3.md §3.1 (row anatomy) + §3.2 (AI proposal visual)
 * + §9 (AI proposal surfacing).
 *
 * Renders only in Linear density mode (1–5 files). Full per-row inline
 * editing of all primary metadata fields. AI suggestions render as
 * italic ghost text with one-click ✓ accept (dispatches UPDATE_ASSET_FIELD
 * per IP-5 selector-derived acceptance) and a ↻ regenerate icon (per
 * spec §9.4 — UI stub in C2.5; real regen lands at E2).
 *
 * C2.5 additions:
 *   - ✓ accept icons for title, tags, geography (caption + price already
 *     in C2.2). Per IPV-10.
 *   - ↻ regenerate icons next to each ✓ (per spec §9.4 + IPV-3 = UI stub).
 *   - "Accept all suggestions" link in the row header (per spec §10.2 +
 *     IPV-7). Loops UPDATE_ASSET_FIELD for caption + tags + geography.
 *     NEVER price — type-level + L5 enforced.
 *   - PriceBasisPanel mount when state.ui.priceBasisOpenAssetId === asset.id
 *     (per IPV-4 — Linear inline + side panel both).
 *
 * Per don't-do #3: NEVER expose a "bulk-accept price suggestion"
 * affordance. Per-asset price acceptance via the row's ✓ button is fine
 * (it dispatches a single UPDATE_ASSET_FIELD on price, which is a
 * creator-authored set, not a bulk-accept).
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from './UploadContext'
import type { V2Asset, AssetEditableFields } from '@/lib/upload/v3-types'
import type { LicenceType, PrivacyState } from '@/lib/upload/types'
import PriceBasisPanel from './PriceBasisPanel'

const LABEL = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1'
const INPUT =
  'border border-black px-2 py-1 text-sm text-black bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-600'
const GHOST = 'italic text-slate-500'
const ACCEPT_BTN =
  'border border-black px-2 py-0.5 text-[10px] font-bold uppercase text-black hover:bg-black hover:text-white transition-colors'
const REGEN_BTN =
  'border border-black px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-200 transition-colors'
// P5 (C2.6): per-row "Accept all suggestions" reads as a button, not a
// text link, so it sits visually beside the ✕ Exclude button at brutalist
// weight. Bordered + uppercase + tracking matches the cluster-header bulk
// action affordance without competing with the per-field ✓ buttons (which
// are black-bordered).
const ACCEPT_ALL_LINK =
  'border border-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white transition-colors'

const REGEN_FEEDBACK_MS = 600

type RegenField = 'title' | 'caption' | 'tags' | 'geography' | 'price'

interface Props {
  asset: V2Asset
}

export default function AssetRow({ asset }: Props) {
  const { state, dispatch } = useUploadContext()
  const [regenerating, setRegenerating] = useState<RegenField | null>(null)

  function update<K extends keyof AssetEditableFields>(field: K, value: AssetEditableFields[K]) {
    dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field, value })
  }

  // Per C2.4 IPIV-10: render-side read of state.commit.failed for the
  // transient "Commit failed" chip. No new exception type added.
  const commitFailure =
    state.commit.phase === 'partial-failure'
      ? state.commit.failed.find(f => f.assetId === asset.id) ?? null
      : null

  // Ghost flags — per spec §9.1, suggestion visible only when the editable
  // value is empty AND the proposal field has content.
  const hasTitleGhost = !asset.editable.title && !!asset.proposal?.title
  const hasCaptionGhost = !asset.editable.description && !!asset.proposal?.description
  const hasTagsGhost =
    asset.editable.tags.length === 0 && (asset.proposal?.tags?.length ?? 0) > 0
  const hasGeoGhost =
    asset.editable.geography.length === 0 && (asset.proposal?.geography?.length ?? 0) > 0
  const hasPriceGhost = asset.editable.price === null && !!asset.proposal?.priceSuggestion

  // "Accept all" appears when there's at least one non-accepted suggestion
  // in the bulk-eligible set (caption / tags / geography). Price is excluded
  // per L5 + spec §9.2 (must be per-asset explicit acceptance).
  const hasAnyBulkable = hasCaptionGhost || hasTagsGhost || hasGeoGhost

  function acceptTitle() {
    if (!asset.proposal?.title) return
    update('title', asset.proposal.title)
  }
  function acceptCaption() {
    if (!asset.proposal?.description) return
    update('description', asset.proposal.description)
  }
  function acceptTags() {
    if (!asset.proposal?.tags?.length) return
    update('tags', asset.proposal.tags)
  }
  function acceptGeography() {
    if (!asset.proposal?.geography?.length) return
    update('geography', asset.proposal.geography)
  }
  function acceptPrice() {
    if (!asset.proposal?.priceSuggestion) return
    update('price', asset.proposal.priceSuggestion.amount)
  }

  /**
   * Per-row "Accept all suggestions" handler. Loops UPDATE_ASSET_FIELD
   * for caption + tags + geography. NEVER price (L5 — type-level safe;
   * runtime safe because we don't include 'price' in the field list).
   * Dispatches in a single event handler → React 19 batches into 1 re-render.
   */
  function acceptAllSuggestions() {
    if (hasCaptionGhost) acceptCaption()
    if (hasTagsGhost) acceptTags()
    if (hasGeoGhost) acceptGeography()
    if (hasTitleGhost) acceptTitle()
  }

  function regenerate(field: RegenField) {
    // Per IPV-3: UI stub. Dispatch the no-op REGENERATE_PROPOSAL action
    // (telemetry hook) and show a brief "regenerating" state. Real regen
    // lands at E2 (AI pipeline). The reducer-side action is currently a
    // no-op stub per v3-state.ts line 601.
    const proposalField = field === 'caption' ? 'caption' : field === 'price' ? 'price' : field
    dispatch({
      type: 'REGENERATE_PROPOSAL',
      assetId: asset.id,
      // V3Action shape: 'caption' | 'tags' | 'keywords' | 'price'. Map our
      // five-field UX into the four-action shape.
      field:
        field === 'title' || field === 'geography'
          ? 'tags' // closest semantic — the action set predates per-field expansion
          : (proposalField as 'caption' | 'tags' | 'price'),
    })
    setRegenerating(field)
    setTimeout(() => setRegenerating(null), REGEN_FEEDBACK_MS)
  }

  const priceBasisOpen = state.ui.priceBasisOpenAssetId === asset.id

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
        {/* Filename + Accept-all + exclude + (optional) commit-failed chip */}
        <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
              {asset.filename}
            </div>
            {commitFailure && (
              <span
                className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-red-600 text-white flex-shrink-0"
                title={commitFailure.error}
              >
                Commit failed
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {hasAnyBulkable && (
              <button
                type="button"
                onClick={acceptAllSuggestions}
                className={ACCEPT_ALL_LINK}
                title="Accept all AI suggestions for this asset (excludes price — must be per-field)"
              >
                ✓ Accept all suggestions
              </button>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_ASSET_EXCLUDED', assetId: asset.id })}
              className="text-[10px] font-bold uppercase tracking-widest text-black hover:underline"
              aria-pressed={asset.excluded}
            >
              {asset.excluded ? '↺ Include' : '✕ Exclude'}
            </button>
          </div>
        </div>

        {/* Title */}
        <label className="block mb-2">
          <span className={LABEL}>Title*</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={asset.editable.title}
              onChange={e => update('title', e.target.value)}
              placeholder={hasTitleGhost ? asset.proposal!.title : 'Title…'}
              className={`${INPUT} ${hasTitleGhost ? GHOST : ''}`}
            />
            {hasTitleGhost && (
              <>
                <button type="button" onClick={acceptTitle} className={ACCEPT_BTN} title="Accept AI suggestion">
                  ✓
                </button>
                <RegenButton
                  active={regenerating === 'title'}
                  onClick={() => regenerate('title')}
                />
              </>
            )}
          </div>
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
              <>
                <button type="button" onClick={acceptCaption} className={ACCEPT_BTN} title="Accept AI suggestion">
                  ✓
                </button>
                <RegenButton
                  active={regenerating === 'caption'}
                  onClick={() => regenerate('caption')}
                />
              </>
            )}
          </div>
        </label>

        {/* Tags */}
        <label className="block mb-2">
          <span className={LABEL}>Tags</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={asset.editable.tags.join(', ')}
              onChange={e => update('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              placeholder={
                hasTagsGhost ? asset.proposal!.tags.join(', ') : 'comma, separated, tags'
              }
              className={`${INPUT} ${hasTagsGhost ? GHOST : ''}`}
            />
            {hasTagsGhost && (
              <>
                <button type="button" onClick={acceptTags} className={ACCEPT_BTN} title="Accept AI tags">
                  ✓
                </button>
                <RegenButton
                  active={regenerating === 'tags'}
                  onClick={() => regenerate('tags')}
                />
              </>
            )}
          </div>
        </label>

        {/* Price (with engine ghost + Why? + PriceBasisPanel mount) */}
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
                  aria-expanded={priceBasisOpen}
                >
                  {priceBasisOpen ? 'Hide' : 'Why?'}
                </button>
                <button type="button" onClick={acceptPrice} className={ACCEPT_BTN} title="Accept engine recommendation">
                  ✓
                </button>
                <RegenButton
                  active={regenerating === 'price'}
                  onClick={() => regenerate('price')}
                />
              </>
            )}
          </div>
        </label>

        {/* Inline PriceBasisPanel (per IPV-4 + spec §9.3) */}
        {priceBasisOpen && hasPriceGhost && (
          <div className="mb-2">
            <PriceBasisPanel asset={asset} />
          </div>
        )}

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
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={asset.editable.geography.join(', ')}
              onChange={e =>
                update('geography', e.target.value.split(',').map(g => g.trim()).filter(Boolean))
              }
              placeholder={
                hasGeoGhost ? asset.proposal!.geography.join(', ') : 'City, Country'
              }
              className={`${INPUT} ${hasGeoGhost ? GHOST : ''}`}
            />
            {hasGeoGhost && (
              <>
                <button type="button" onClick={acceptGeography} className={ACCEPT_BTN} title="Accept AI geography">
                  ✓
                </button>
                <RegenButton
                  active={regenerating === 'geography'}
                  onClick={() => regenerate('geography')}
                />
              </>
            )}
          </div>
        </label>
      </div>
    </div>
  )
}

function RegenButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`${REGEN_BTN} ${active ? 'opacity-60 cursor-wait' : ''}`}
      title="Regenerate AI suggestion"
    >
      {active ? '⟳ regenerating…' : '↻'}
    </button>
  )
}
