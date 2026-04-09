'use client'

import { useUploadV2 } from './UploadV2Context'
import { getIncludedAssets, getStoryGroups, centsToEur } from '@/lib/upload/v2-state'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'
import { Zap, ArrowRight } from 'lucide-react'

export function ExpressCard() {
  const { state, dispatch } = useUploadV2()
  const assets = getIncludedAssets(state)
  const groups = getStoryGroups(state)
  const group = groups[0]

  // Calculate total suggested price
  const totalSuggested = assets.reduce((sum, a) => sum + (a.proposal?.priceSuggestion?.amount ?? 0), 0)

  const handleApplyAll = () => {
    // Apply all proposals (story assignments, prices, privacy, licences)
    // then route to the Commit gate for final creator confirmation.
    dispatch({ type: 'APPLY_EXPRESS_FLOW' })
    dispatch({ type: 'COMMIT_BATCH' })
  }

  const handleReviewIndividually = () => {
    // Dismiss the express card and show the full three-zone layout.
    // Do NOT apply any proposals — the creator wants to review manually.
    dispatch({ type: 'DISMISS_EXPRESS' })
  }

  if (!group) return null

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-xl w-full border-2 border-black">
        {/* Header */}
        <div className="bg-black text-white px-5 py-3 flex items-center gap-2">
          <Zap size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">Express path available</span>
        </div>

        <div className="p-5 space-y-5">
          {/* Story info */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Story</div>
            <div className="text-sm font-bold">{group.name}</div>
            {group.kind === 'matched-existing' && group.existingStoryTitle && (
              <div className="text-xs text-amber-600 mt-0.5">
                Matches existing: {group.existingStoryTitle} ({group.existingStoryAssetCount} assets already published)
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-1">{group.rationale}</div>
          </div>

          {/* Asset grid */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{assets.length} files</div>
            <div className="grid grid-cols-5 gap-1.5">
              {assets.slice(0, 10).map(a => (
                <div key={a.id} className="border border-slate-200 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    {a.format ? ASSET_FORMAT_LABELS[a.format] : '?'}
                  </div>
                  <div className="text-[9px] font-mono text-slate-300 truncate mt-0.5">{a.filename}</div>
                </div>
              ))}
              {assets.length > 10 && (
                <div className="border border-slate-200 p-2 text-center flex items-center justify-center">
                  <span className="text-[10px] text-slate-400">+{assets.length - 10}</span>
                </div>
              )}
            </div>
          </div>

          {/* Summary row */}
          <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Privacy</div>
              <div className="text-xs font-bold">PUBLIC</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Licences</div>
              <div className="text-xs font-bold">Editorial</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Suggested total</div>
              <div className="text-xs font-bold">{centsToEur(totalSuggested)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Confidence</div>
              <div className="text-xs font-bold">
                {Math.round((assets.reduce((s, a) => s + (a.proposal?.confidence ?? 0), 0) / assets.length) * 100)}%
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleApplyAll}
              className="flex-1 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              Apply all suggestions & publish
              <ArrowRight size={14} />
            </button>
            <button
              onClick={handleReviewIndividually}
              className="px-4 py-3 border-2 border-black text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              Review individually
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
