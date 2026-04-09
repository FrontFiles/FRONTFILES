'use client'

import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import {
  getIncludedAssets,
  getAssets,
  getAssetExceptions,
  getAssetCommitOutcome,
  getCompletionSummary,
  getPublishReadiness,
  getStoryGroups,
  getTotalListedValue,
  centsToEur,
} from '@/lib/upload/v2-state'
import type { CommitOutcome } from '@/lib/upload/v2-types'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'
import {
  CheckCircle2, Globe, Lock, Link2, AlertTriangle, ArrowRight, RotateCcw,
  ExternalLink,
} from 'lucide-react'

const OUTCOME_LABELS: Record<CommitOutcome, string> = {
  stored_not_transactable: 'Stored in Vault — not transactable',
  transactable_via_link: 'Transactable via authorised link',
  ready_for_discovery_and_transaction: 'Ready for discovery and transaction',
  excluded: 'Excluded',
  blocked: 'Blocked',
}

const OUTCOME_ICONS: Record<CommitOutcome, typeof Globe> = {
  stored_not_transactable: Lock,
  transactable_via_link: Link2,
  ready_for_discovery_and_transaction: Globe,
  excluded: Lock,
  blocked: AlertTriangle,
}

export function CommitScreen() {
  const { state } = useUploadV2()
  const isComplete = state.batch.currentStage === 'complete'

  if (isComplete) {
    return <CompletionView />
  }

  return <PreCommitView />
}

function PreCommitView() {
  const { state, dispatch } = useUploadV2()
  const included = getIncludedAssets(state)
  const groups = getStoryGroups(state)
  const readiness = getPublishReadiness(state)

  // Group assets by story
  const byStory = new Map<string, typeof included>()
  const noStory: typeof included = []
  for (const asset of included) {
    if (asset.storyGroupId) {
      const arr = byStory.get(asset.storyGroupId) ?? []
      arr.push(asset)
      byStory.set(asset.storyGroupId, arr)
    } else {
      noStory.push(asset)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Review before publishing</div>

        {/* Per-story summaries */}
        {groups.map(group => {
          const storyAssets = byStory.get(group.id) ?? []
          if (storyAssets.length === 0) return null

          const storyValue = storyAssets
            .filter(a => a.editable.privacy === 'PUBLIC' || a.editable.privacy === 'RESTRICTED')
            .reduce((sum, a) => sum + (a.editable.price ?? 0), 0)

          const formats = new Map<string, number>()
          storyAssets.forEach(a => {
            const f = a.format ?? 'unknown'
            formats.set(f, (formats.get(f) ?? 0) + 1)
          })

          return (
            <div key={group.id} className="border-2 border-black">
              <div className="px-4 py-3 border-b border-black bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold">{group.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{storyAssets.length} asset{storyAssets.length !== 1 ? 's' : ''}</span>
                    <span>{Array.from(formats.entries()).map(([f, c]) => `${c} ${f}`).join(', ')}</span>
                  </div>
                </div>
                {storyValue > 0 && (
                  <div className="text-xs font-mono font-bold">{centsToEur(storyValue)}</div>
                )}
              </div>
              <div className="divide-y divide-slate-50">
                {storyAssets.map(asset => {
                  const outcome = getAssetCommitOutcome(asset)
                  const OutcomeIcon = OUTCOME_ICONS[outcome]
                  return (
                    <div key={asset.id} className="px-4 py-2 grid grid-cols-[1fr_70px_70px_70px_180px] gap-2 items-center text-xs">
                      <span className="truncate font-mono text-[10px]">{asset.editable.title || asset.filename}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {asset.format ? ASSET_FORMAT_LABELS[asset.format] : '—'}
                      </span>
                      <span className={cn(
                        'text-[10px] font-bold uppercase',
                        asset.editable.privacy === 'PUBLIC' ? 'text-blue-600' : asset.editable.privacy === 'RESTRICTED' ? 'text-amber-600' : 'text-slate-400',
                      )}>
                        {asset.editable.privacy ?? '—'}
                      </span>
                      <span className="text-right font-mono text-[10px]">
                        {asset.editable.price !== null ? centsToEur(asset.editable.price) : '—'}
                      </span>
                      <div className="flex items-center gap-1">
                        <OutcomeIcon size={10} className={cn(
                          outcome === 'ready_for_discovery_and_transaction' ? 'text-blue-600' :
                          outcome === 'transactable_via_link' ? 'text-amber-600' :
                          outcome === 'blocked' ? 'text-red-500' : 'text-slate-400',
                        )} />
                        <span className="text-[10px] text-slate-500 truncate">{OUTCOME_LABELS[outcome]}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Blocked assets (no story + other blockers) */}
        {(() => {
          const allIncluded = getIncludedAssets(state)
          const blockedAssets = allIncluded.filter(a => getAssetExceptions(a).some(e => e.severity === 'blocking'))
          const excludedAssets = getAssets(state).filter(a => a.excluded)
          if (blockedAssets.length === 0 && excludedAssets.length === 0) return null
          return (
            <>
              {blockedAssets.length > 0 && (
                <div className="border-2 border-black bg-white">
                  <div className="px-4 py-2 border-b border-black bg-slate-50 flex items-center justify-between">
                    <div className="text-xs font-bold">
                      {blockedAssets.length} asset{blockedAssets.length > 1 ? 's' : ''} blocked — will not commit
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'SET_STAGE', stage: 'review' })}
                      className="text-[10px] font-bold uppercase tracking-wide text-blue-600 hover:underline"
                    >
                      Fix in Review
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {blockedAssets.slice(0, 10).map(asset => {
                      const exceptions = getAssetExceptions(asset).filter(e => e.severity === 'blocking')
                      return (
                        <div key={asset.id} className="px-4 py-1.5 flex items-center justify-between text-[10px]">
                          <span className="font-mono truncate max-w-[200px]">{asset.editable.title || asset.filename}</span>
                          <span className="text-slate-400">{exceptions.map(e => e.label).join(' · ')}</span>
                        </div>
                      )
                    })}
                    {blockedAssets.length > 10 && (
                      <div className="px-4 py-1.5 text-[10px] text-slate-400">
                        + {blockedAssets.length - 10} more blocked
                      </div>
                    )}
                  </div>
                </div>
              )}
              {excludedAssets.length > 0 && (
                <div className="border border-slate-200 px-4 py-2 text-[10px] text-slate-400">
                  {excludedAssets.length} asset{excludedAssets.length > 1 ? 's' : ''} excluded — will not commit
                </div>
              )}
            </>
          )
        })()}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_STAGE', stage: 'review' })}
            className="px-4 py-3 border-2 border-black text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
          >
            Back to Review
          </button>
          <button
            disabled={!readiness.ready}
            onClick={() => dispatch({ type: 'COMPLETE_COMMIT' })}
            className={cn(
              'flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2',
              readiness.ready
                ? 'bg-black text-white hover:bg-slate-800'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed',
            )}
          >
            Publish {readiness.readyCount} asset{readiness.readyCount !== 1 ? 's' : ''} to Vault
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CompletionView() {
  const { state, dispatch } = useUploadV2()
  const summary = getCompletionSummary(state)

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success header */}
        <div className="text-center py-6">
          <CheckCircle2 size={48} className="mx-auto text-blue-600 mb-3" />
          <h2 className="text-lg font-bold uppercase tracking-wide">
            {summary.totalCommitted} asset{summary.totalCommitted !== 1 ? 's' : ''} published
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            across {summary.stories.length} {summary.stories.length === 1 ? 'Story' : 'Stories'}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border-2 border-black p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ready for discovery</div>
            <div className="text-lg font-bold mt-1">{summary.outcomeBreakdown.readyForDiscovery}</div>
          </div>
          <div className="border-2 border-black p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Transactable via link</div>
            <div className="text-lg font-bold mt-1">{summary.outcomeBreakdown.transactableViaLink}</div>
          </div>
          <div className="border-2 border-black p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stored (not transactable)</div>
            <div className="text-lg font-bold mt-1">{summary.outcomeBreakdown.stored}</div>
          </div>
        </div>

        {/* Total listed value */}
        {summary.totalListedValue > 0 && (
          <div className="border-2 border-black p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total listed value</div>
            <div className="text-2xl font-bold font-mono mt-1">{centsToEur(summary.totalListedValue)}</div>
          </div>
        )}

        {/* Per-story cards */}
        <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stories</div>
          {summary.stories.map(story => (
            <div key={story.id} className="border-2 border-black p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">{story.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {story.assetCount} asset{story.assetCount !== 1 ? 's' : ''}
                  {story.listedValue > 0 && <> · {centsToEur(story.listedValue)} listed</>}
                  {story.isNew && <span className="ml-2 bg-blue-100 text-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase">New Story</span>}
                </div>
              </div>
              <a
                href={story.vaultUrl}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:underline"
              >
                View in Vault <ExternalLink size={10} />
              </a>
            </div>
          ))}
        </div>

        {/* Excluded / blocked notice */}
        {(summary.totalExcluded > 0 || summary.totalBlocked > 0) && (
          <div className="border-2 border-slate-200 p-3 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {summary.totalExcluded > 0 && <span>{summary.totalExcluded} excluded. </span>}
              {summary.totalBlocked > 0 && <span>{summary.totalBlocked} blocked (not published). </span>}
            </div>
            {summary.totalBlocked > 0 && (
              <button
                onClick={() => dispatch({ type: 'SET_STAGE', stage: 'review' })}
                className="text-[10px] font-bold uppercase tracking-wide text-blue-600 hover:underline"
              >
                Return to Review to fix
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => dispatch({ type: 'RESET_FLOW' })}
            className="flex-1 py-3 border-2 border-black text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={12} /> Upload more
          </button>
          <a
            href="/vault"
            className="flex-1 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            Go to Vault <ArrowRight size={12} />
          </a>
        </div>
      </div>
    </div>
  )
}
