/**
 * Frontfiles Upload V4 — Inspector AI Proposal Detail (D2.4 §1.1)
 *
 * Spec: UX-SPEC-V4 §5.2 (AI Proposal Detail is collapsible per L7) +
 * IPD4-3 default = (a) closed by default.
 *
 * Adapted from C2.5's SideDetailPanel AIProposalDetailSection (now dormant).
 * Three independently-collapsible rows per UX-SPEC-V4 §7.1 anatomy:
 *   - Caption rationale (renders asset.proposal.rationale)
 *   - Price basis (mounts <PriceBasisPanel compact />, gated by !priceSuggestion)
 *   - Tag confidence (overall confidence % + tag chips)
 *
 * The "Price basis" row uses the reducer's TOGGLE_PRICE_BASIS_PANEL because
 * the same state is shared with Linear AssetRow (now dormant). In V4, the
 * shared state remains useful: D2.6 might add a side-by-side compare view
 * that wants the same "open" invariant.
 *
 * PriceBasisPanel is reused as-is from the C2 spine (non-dormant).
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from '../UploadContext'
import type { V2Asset } from '@/lib/upload/v3-types'
import PriceBasisPanel from '../PriceBasisPanel'

interface Props {
  asset: V2Asset
}

export default function InspectorAIProposalDetail({ asset }: Props) {
  const { state, dispatch } = useUploadContext()
  const [sectionOpen, setSectionOpen] = useState(false)
  const [captionOpen, setCaptionOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const priceOpen = state.ui.priceBasisOpenAssetId === asset.id

  if (!asset.proposal) {
    return (
      <div className="border-b border-black flex-shrink-0">
        <button
          type="button"
          onClick={() => setSectionOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-colors"
          aria-expanded={sectionOpen}
        >
          <span className="flex items-center gap-2">
            <span>{sectionOpen ? '▼' : '▶'}</span>
            <span>AI Proposal Detail</span>
          </span>
        </button>
        {sectionOpen && (
          <div className="px-3 pb-3 text-xs text-slate-500 italic">
            No AI proposal for this asset.
          </div>
        )}
      </div>
    )
  }

  const overallConfPct = Math.round(asset.proposal.confidence * 100)

  return (
    <div className="border-b border-black flex-shrink-0">
      <button
        type="button"
        onClick={() => setSectionOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-colors"
        aria-expanded={sectionOpen}
      >
        <span className="flex items-center gap-2">
          <span>{sectionOpen ? '▼' : '▶'}</span>
          <span>AI Proposal Detail</span>
        </span>
        <span className="text-slate-500 font-mono">{overallConfPct}%</span>
      </button>

      {sectionOpen && (
        <div className="px-3 pb-3 flex flex-col gap-1 min-w-0">
          <DetailRow
            open={captionOpen}
            onToggle={() => setCaptionOpen(o => !o)}
            label="Caption rationale"
          >
            <div className="text-xs text-slate-700">
              {asset.proposal.rationale || (
                <span className="italic text-slate-500">No rationale recorded.</span>
              )}
            </div>
          </DetailRow>

          <DetailRow
            open={priceOpen}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_PRICE_BASIS_PANEL', assetId: asset.id })
            }
            label="Price basis"
            disabled={!asset.proposal.priceSuggestion}
          >
            {asset.proposal.priceSuggestion ? (
              <PriceBasisPanel asset={asset} compact />
            ) : (
              <div className="text-xs text-slate-500 italic">No price suggestion.</div>
            )}
          </DetailRow>

          <DetailRow
            open={tagsOpen}
            onToggle={() => setTagsOpen(o => !o)}
            label="Tag confidence"
          >
            <div className="flex flex-col gap-1 text-xs">
              <div className="text-slate-700">
                Overall metadata confidence:{' '}
                <span className="font-mono text-black">{overallConfPct}%</span>
              </div>
              {asset.proposal.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {asset.proposal.tags.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="text-[10px] font-bold uppercase tracking-widest border border-slate-400 text-slate-700 px-1.5 py-0.5 bg-white"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="italic text-slate-500">No tags suggested.</span>
              )}
            </div>
          </DetailRow>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  open,
  onToggle,
  label,
  disabled = false,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="border border-black bg-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`w-full text-left px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
          disabled ? 'text-slate-400 cursor-not-allowed' : 'text-black hover:bg-slate-50'
        }`}
        aria-expanded={open}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
      </button>
      {open && !disabled && <div className="px-2 pb-2">{children}</div>}
    </div>
  )
}
