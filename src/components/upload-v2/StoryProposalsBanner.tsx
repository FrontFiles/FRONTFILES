'use client'

import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import { getStoryGroups, getUnassignedAssets, getAssetsForStoryGroup } from '@/lib/upload/v2-state'
import { ChevronUp, ChevronDown, Check, X } from 'lucide-react'

export function StoryProposalsBanner() {
  const { state, dispatch } = useUploadV2()
  const groups = getStoryGroups(state)
  const unassigned = getUnassignedAssets(state)

  // Only show proposed groups that have unaccepted assets
  const proposedGroups = groups.filter(g =>
    g.kind === 'proposed' && g.proposedAssetIds.some(id => {
      const asset = state.assetsById[id]
      return asset && asset.storyGroupId === null && !asset.excluded
    })
  )

  if (proposedGroups.length === 0) return null

  return (
    <div className="border-b-2 border-black bg-blue-50/30 flex-shrink-0">
      <div className="px-3 py-2">
        {/* Banner header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
              Story proposals
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {proposedGroups.length} group{proposedGroups.length !== 1 ? 's' : ''} &middot; {unassigned.length} unassigned
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch({ type: 'ACCEPT_ALL_PROPOSED_ASSIGNMENTS' })}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
            >
              <Check size={10} /> Accept all
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_STORY_PROPOSALS_BANNER' })}
              className="p-0.5 text-slate-400 hover:text-black transition-colors"
              title="Dismiss proposals"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Proposal cards */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {proposedGroups.map(group => {
            const assignableCount = group.proposedAssetIds.filter(id => {
              const a = state.assetsById[id]
              return a && a.storyGroupId === null && !a.excluded
            }).length
            const alreadyAssigned = getAssetsForStoryGroup(state, group.id).length

            return (
              <div
                key={group.id}
                className="flex-shrink-0 w-64 border-2 border-dashed border-blue-300 bg-white p-2"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600">
                      {group.kind === 'matched-existing' ? 'Matches existing' : 'Proposed new'}
                    </span>
                    <h4 className="text-xs font-bold text-black leading-tight mt-0.5">
                      {group.name}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {Math.round(group.confidence * 100)}%
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 leading-snug line-clamp-2 mb-1.5">
                  {group.rationale}
                </p>

                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1.5">
                  <span className="font-mono">{assignableCount}</span> to assign
                  {alreadyAssigned > 0 && (
                    <>
                      <span>&middot;</span>
                      <span className="font-mono">{alreadyAssigned}</span> already assigned
                    </>
                  )}
                </div>

                {/* Asset thumbnails preview */}
                <div className="flex gap-px mb-1.5">
                  {group.proposedAssetIds.slice(0, 6).map(id => {
                    const asset = state.assetsById[id]
                    if (!asset) return null
                    return (
                      <div
                        key={id}
                        className={cn(
                          'w-8 h-6 bg-slate-100 overflow-hidden border',
                          asset.storyGroupId === group.id ? 'border-blue-400' : 'border-slate-200',
                        )}
                      >
                        {asset.thumbnailRef ? (
                          <img src={asset.thumbnailRef} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-slate-300">
                            {asset.format?.charAt(0) ?? '?'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {group.proposedAssetIds.length > 6 && (
                    <div className="w-8 h-6 bg-slate-50 border border-slate-200 flex items-center justify-center text-[8px] text-slate-400 font-mono">
                      +{group.proposedAssetIds.length - 6}
                    </div>
                  )}
                </div>

                {assignableCount > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const ids = group.proposedAssetIds.filter(id => {
                          const a = state.assetsById[id]
                          return a && a.storyGroupId === null && !a.excluded
                        })
                        dispatch({ type: 'BULK_ASSIGN_ASSETS', assetIds: ids, storyGroupId: group.id })
                      }}
                      className="flex-1 py-0.5 text-[9px] font-bold uppercase tracking-wide border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      Accept ({assignableCount})
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_STORY_GROUP', storyGroupId: group.id })}
                      className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide border-2 border-slate-200 text-slate-400 hover:border-black hover:text-black transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
