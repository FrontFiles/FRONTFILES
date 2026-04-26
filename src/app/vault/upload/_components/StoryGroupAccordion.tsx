/**
 * DORMANT — replaced by D2 (LeftRailStoryHeader + sortable contact sheet).
 * Scheduled for deletion at the explicit D2.8 cutover PR.
 * DO NOT extend.
 *
 * Archive accordion shape dies at D2.1 — stories now live in the left rail
 * (UX-SPEC-V4 §4); their assets render in the center contact sheet when the
 * story bucket is selected. As of D2.1 this file is no longer on any
 * production path.
 */

/**
 * Frontfiles Upload V3 — Archive-mode Story group accordion (C2.2 §3.5)
 *
 * Spec: UX-SPEC-V3.md §6.1.
 *
 * Renders in Archive density mode (100+ files) per cluster. Click cluster
 * header to expand/collapse. Inline rename via <input> swap on click
 * (per IPII-10). Cluster-level bulk action buttons. Body is a non-
 * virtualized scroll list of AssetRowCompact for assets in this cluster.
 *
 * Per IPII-3: first cluster expanded by default, others collapsed.
 * Per IPII-11: drag-drop cluster reassignment is DEFERRED to C3 — render-only here.
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from './UploadContext'
import { getAssetExceptions } from '@/lib/upload/upload-selectors'
import type { V2Asset, V2StoryGroup } from '@/lib/upload/v3-types'
import AssetRowCompact from './AssetRowCompact'

interface Props {
  cluster: V2StoryGroup
  assets: V2Asset[]
}

const HEADER_BTN =
  'text-[10px] font-bold uppercase tracking-widest text-black hover:underline px-2 py-1'

export default function StoryGroupAccordion({ cluster, assets }: Props) {
  const { state, dispatch } = useUploadContext()
  const expanded = state.ui.expandedClusterIds.includes(cluster.id)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(cluster.name)

  // V3 UX: drop needs_story from "ready" computation per UX-BRIEF v3 §4.5
  // (Story groups are opt-in in V3; SELECTOR returns needs_story for parity,
  // but V3 ready-count must not treat it as blocking).
  //
  // P3 (C2.6) — note for future debuggers: a "0 READY" header on a populated
  // cluster is TRUTHFUL, not a bug. After hydration, dev fixtures leave
  // assets at NEEDS PRIVACY / NEEDS PRICE / NEEDS LICENCES (blocking
  // exceptions OTHER than needs_story). The user must accept proposals
  // and set privacy before assets become "ready". The cluster bulk-accept
  // applies caption + tags + geography only — privacy + price stay manual
  // per spec §9.2 (price never bulk-acceptable).
  const readyCount = assets.filter(
    a =>
      !a.excluded &&
      getAssetExceptions(a)
        .filter(e => e.type !== 'needs_story')
        .filter(e => e.severity === 'blocking').length === 0,
  ).length

  function commitRename() {
    setEditingName(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== cluster.name) {
      dispatch({ type: 'RENAME_STORY_GROUP', storyGroupId: cluster.id, name: trimmed })
    } else {
      setNameInput(cluster.name)
    }
  }

  return (
    <div className="border border-black bg-white mb-3 min-w-0">
      {/* Cluster header */}
      <div className="flex items-center gap-2 border-b border-black px-3 py-2 min-w-0">
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_CLUSTER_EXPANDED', clusterId: cluster.id })}
          className="text-sm font-bold text-black w-4 flex-shrink-0"
          aria-label={expanded ? 'Collapse cluster' : 'Expand cluster'}
        >
          {expanded ? '▼' : '▶'}
        </button>

        {/* Cluster name (editable) */}
        {editingName ? (
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setNameInput(cluster.name)
                setEditingName(false)
              }
            }}
            autoFocus
            className="border border-black px-2 py-0.5 text-sm text-black bg-white flex-1 min-w-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="text-sm font-bold text-black truncate flex-1 min-w-0 text-left hover:underline"
            title="Click to rename"
          >
            {cluster.name}
          </button>
        )}

        {/* Counts */}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex-shrink-0">
          {assets.length} assets — {readyCount} ready
        </span>

        {/* Cluster bulk actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              // Per C2.5 IPV-2: dispatch the no-op BULK_ACCEPT_PROPOSALS_FOR_GROUP
              // (telemetry hook per IPI-1) THEN loop UPDATE_ASSET_FIELD per
              // asset for caption + tags + geography. NEVER price (L5 +
              // spec §9.2 — type-level + runtime forbidden in reducer).
              //
              // React 19 batches synchronous dispatches in an event handler
              // → 1 re-render even on a 60-asset cluster.
              //
              // Note: 'keywords' in the action's fields array is dead text —
              // V2Asset has no 'keywords' editable field (only 'tags'). The
              // 'keywords' fallback is preserved for telemetry-shape continuity.
              dispatch({
                type: 'BULK_ACCEPT_PROPOSALS_FOR_GROUP',
                clusterId: cluster.id,
                fields: ['caption', 'tags', 'keywords'],
              })
              for (const asset of assets) {
                if (asset.excluded) continue
                if (!asset.editable.description && asset.proposal?.description) {
                  dispatch({
                    type: 'UPDATE_ASSET_FIELD',
                    assetId: asset.id,
                    field: 'description',
                    value: asset.proposal.description,
                  })
                }
                if (asset.editable.tags.length === 0 && (asset.proposal?.tags?.length ?? 0) > 0) {
                  dispatch({
                    type: 'UPDATE_ASSET_FIELD',
                    assetId: asset.id,
                    field: 'tags',
                    value: asset.proposal!.tags,
                  })
                }
                if (
                  asset.editable.geography.length === 0 &&
                  (asset.proposal?.geography?.length ?? 0) > 0
                ) {
                  dispatch({
                    type: 'UPDATE_ASSET_FIELD',
                    assetId: asset.id,
                    field: 'geography',
                    value: asset.proposal!.geography,
                  })
                }
              }
            }}
            className={HEADER_BTN}
            title="Accept all AI suggestions for caption, tags, and geography (NOT price — per spec §9.2)"
          >
            Accept all suggestions
          </button>
          <BulkCaptionTemplateButton clusterId={cluster.id} />
          <BulkSetPriceButton clusterId={cluster.id} />
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="flex flex-col gap-1 p-2 max-h-[60vh] overflow-y-auto">
          {assets.map(asset => (
            <AssetRowCompact key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  )
}

function BulkCaptionTemplateButton({ clusterId }: { clusterId: string }) {
  const { dispatch } = useUploadContext()
  const [open, setOpen] = useState(false)
  const [tpl, setTpl] = useState('')

  function apply() {
    if (!tpl.trim()) return
    dispatch({ type: 'BULK_EDIT_CAPTION_TEMPLATE', clusterId, template: tpl })
    setTpl('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className={HEADER_BTN}>
        Bulk-edit caption
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-20 border border-black bg-white p-2 flex items-center gap-2 shadow-lg">
          <input
            type="text"
            value={tpl}
            onChange={e => setTpl(e.target.value)}
            placeholder="Template caption"
            className="border border-black px-2 py-1 text-sm text-black w-64"
            autoFocus
          />
          <button type="button" onClick={apply} className={HEADER_BTN}>
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

function BulkSetPriceButton({ clusterId }: { clusterId: string }) {
  const { dispatch } = useUploadContext()
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState('')

  function apply() {
    const cents = Math.round(parseFloat(price) * 100)
    if (!Number.isFinite(cents) || cents < 0) return
    dispatch({ type: 'BULK_SET_PRICE_FOR_CLUSTER', clusterId, priceCents: cents })
    setPrice('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className={HEADER_BTN}>
        Set price
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-20 border border-black bg-white p-2 flex items-center gap-2 shadow-lg">
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="EUR"
            className="border border-black px-2 py-1 text-sm text-black w-24 font-mono"
            autoFocus
          />
          <button type="button" onClick={apply} className={HEADER_BTN}>
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
