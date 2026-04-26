/**
 * Frontfiles Upload V3 — Compact-mode asset row (C2.2 §3.4)
 *
 * Spec: UX-SPEC-V3.md §4.1.
 *
 * Renders in Compact / Batch / Archive density modes. ~64px tall row.
 * Click row → OPEN_SIDE_PANEL. Click left edge (~24px wide per IPII-5)
 * → toggle multi-select.
 *
 * Per don't-do #5: side panel rendering is C2.3 — this row only
 * dispatches OPEN_SIDE_PANEL.
 */

'use client'

import { useUploadContext } from './UploadContext'
import { getAssetExceptions } from '@/lib/upload/upload-selectors'
import type { V2Asset, V2Exception } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
}

export default function AssetRowCompact({ asset }: Props) {
  const { state, dispatch } = useUploadContext()
  const isSelected = state.ui.selectedAssetIds.includes(asset.id)
  // V3 UX: drop needs_story from rendered exceptions per UX-BRIEF v3 §4.5
  // (Story groups are opt-in in V3; the SELECTOR still emits needs_story
  // for parity contract continuity, but the UI filters it before render).
  const exceptions = getAssetExceptions(asset).filter(e => e.type !== 'needs_story')
  const blocking = exceptions.filter(e => e.severity === 'blocking')
  const advisory = exceptions.filter(e => e.severity === 'advisory')
  const isReady = !asset.excluded && blocking.length === 0
  const hasCaptionGhost = !asset.editable.description && !!asset.proposal?.description

  // Per C2.4 IPIV-10: render a red "Commit failed" chip when this asset
  // is in state.commit.failed AND the commit phase is partial-failure.
  // No new exception type — render-side read of the transient commit slice.
  const commitFailure =
    state.commit.phase === 'partial-failure'
      ? state.commit.failed.find(f => f.assetId === asset.id) ?? null
      : null

  return (
    <div
      className={`flex items-stretch border border-black bg-white min-w-0 ${asset.excluded ? 'opacity-40' : ''} ${isSelected ? 'border-l-[4px] border-l-blue-600' : ''}`}
      data-asset-id={asset.id}
    >
      {/* Multi-select left-edge clickable area (24px per IPII-5) */}
      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE_ASSET_SELECTION', assetId: asset.id })}
        className="w-6 flex-shrink-0 cursor-pointer hover:bg-slate-100 transition-colors border-r border-black"
        aria-label="Toggle selection"
        title="Toggle selection"
      />

      {/* Thumbnail */}
      <div className="bg-slate-100 w-12 h-12 flex-shrink-0 flex items-center justify-center text-[8px] uppercase text-slate-500 border-r border-black self-center my-1.5">
        {asset.thumbnailRef ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnailRef} alt={asset.filename} className="w-full h-full object-cover" />
        ) : (
          ''
        )}
      </div>

      {/* Click-anywhere body opens side panel */}
      <button
        type="button"
        onClick={() => dispatch({ type: 'OPEN_SIDE_PANEL', assetId: asset.id })}
        className="flex-1 min-w-0 px-3 py-2 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-black truncate">{asset.filename}</span>
            {asset.format && (
              <span className="text-[8px] uppercase tracking-widest text-slate-400 border border-slate-300 px-1">
                {asset.format}
              </span>
            )}
          </div>
          <div className={`text-xs truncate ${hasCaptionGhost ? 'italic text-slate-500' : 'text-slate-700'}`}>
            {asset.editable.description || asset.proposal?.description || ''}
          </div>
        </div>

        {/* Price summary */}
        <div className="text-sm font-mono text-black flex-shrink-0">
          {asset.editable.price !== null
            ? `€${(asset.editable.price / 100).toFixed(2)}`
            : asset.proposal?.priceSuggestion
              ? <span className="italic text-slate-500">€{(asset.proposal.priceSuggestion.amount / 100).toFixed(2)}</span>
              : '—'}
        </div>

        {/* Status chips */}
        <div className="flex gap-1 flex-shrink-0">
          {commitFailure && <Chip label="Commit failed" tone="failed" title={commitFailure.error} />}
          {!commitFailure && isReady && <Chip label="Ready" tone="ready" />}
          {!commitFailure && blocking.slice(0, 3).map((e, i) => (
            <Chip key={i} label={chipLabelFor(e)} tone="blocking" />
          ))}
          {!commitFailure && blocking.length > 3 && <Chip label={`+${blocking.length - 3}`} tone="blocking" />}
          {!commitFailure && blocking.length === 0 && advisory.slice(0, 2).map((e, i) => (
            <Chip key={i} label={chipLabelFor(e)} tone="advisory" />
          ))}
        </div>
      </button>
    </div>
  )
}

function chipLabelFor(e: V2Exception): string {
  switch (e.type) {
    case 'needs_price':
      return 'Needs price'
    case 'needs_privacy':
      return 'Needs privacy'
    case 'needs_licences':
      return 'Needs licences'
    case 'needs_story':
      return 'Needs story'
    case 'manifest_invalid':
      return 'Invalid'
    case 'unresolved_conflict':
      return 'Conflict'
    case 'duplicate_unresolved':
      return 'Duplicate?'
    case 'low_confidence':
      return 'Low conf'
    case 'provenance_pending':
      return 'Provenance'
    default:
      return e.type
  }
}

function Chip({
  label,
  tone,
  title,
}: {
  label: string
  tone: 'ready' | 'blocking' | 'advisory' | 'failed'
  title?: string
}) {
  const cls =
    tone === 'ready'
      ? 'bg-green-200 text-green-900'
      : tone === 'blocking'
        ? 'bg-yellow-300 text-black'
        : tone === 'failed'
          ? 'bg-red-600 text-white'
          : 'bg-slate-200 text-slate-700'
  return (
    <span
      className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${cls}`}
      title={title}
    >
      {label}
    </span>
  )
}
