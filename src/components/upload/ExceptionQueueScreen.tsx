'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset, AttentionReason } from '@/lib/upload/batch-types'
import { ATTENTION_SEVERITY } from '@/lib/upload/batch-types'
import type { BatchAction } from '@/lib/upload/batch-state'
import { getExceptionAssets } from '@/lib/upload/batch-state'
import { ExceptionGroup } from './ExceptionGroup'
import { MOCK_STORIES } from '@/lib/upload/batch-mock-data'

interface ExceptionQueueScreenProps {
  assets: BatchAsset[]
  dispatch: (action: BatchAction) => void
}

export function ExceptionQueueScreen({ assets, dispatch }: ExceptionQueueScreenProps) {
  const exceptions = getExceptionAssets(assets)

  // Group by attention reason
  const grouped = new Map<AttentionReason | 'failed', BatchAsset[]>()
  exceptions.forEach(a => {
    const key = a.state === 'failed' ? 'failed' : (a.attentionReason ?? 'failed')
    const list = grouped.get(key as AttentionReason) ?? []
    list.push(a)
    grouped.set(key as AttentionReason, list)
  })

  // Sort: blocking first, then warning, then info, then failed
  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
    const sevA = a === 'failed' ? 3 : ({ blocking: 0, warning: 1, info: 2 }[ATTENTION_SEVERITY[a as AttentionReason]] ?? 3)
    const sevB = b === 'failed' ? 3 : ({ blocking: 0, warning: 1, info: 2 }[ATTENTION_SEVERITY[b as AttentionReason]] ?? 3)
    return sevA - sevB
  })

  const handleQuickFix = (assetIds: string[], action: string) => {
    switch (action) {
      case 'assign_story':
        dispatch({ type: 'BULK_UPDATE', assetIds, updates: { storyAssignment: MOCK_STORIES[0] }, mode: 'fill_blanks' })
        break
      case 'set_privacy':
        dispatch({ type: 'BULK_UPDATE', assetIds, updates: { privacy: 'PUBLIC' }, mode: 'fill_blanks' })
        break
      case 'apply_recommended_price':
        dispatch({ type: 'APPLY_RECOMMENDED_PRICES', assetIds })
        break
      case 'apply_licences':
        dispatch({ type: 'BULK_UPDATE', assetIds, updates: { enabledLicences: ['editorial'] }, mode: 'fill_blanks' })
        break
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">Exception Queue</div>
          <div className="text-[10px] font-mono text-slate-400">
            {exceptions.length} asset{exceptions.length !== 1 ? 's' : ''} need attention
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'review' })}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
        >
          Back to Review
        </button>
      </div>

      {/* Exception groups */}
      {sortedGroups.map(([reason, groupAssets]) => {
        if (reason === 'failed') {
          return (
            <div key="failed" className="border-2 border-black p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-black text-white px-1 py-0.5">FAILED</span>
                  <span className="text-xs font-bold">Processing Failed</span>
                  <span className="text-[10px] font-mono text-slate-400">&times;{groupAssets.length}</span>
                </div>
                <button
                  onClick={() => dispatch({ type: 'RETRY_ASSETS', assetIds: groupAssets.map(a => a.id) })}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors"
                >
                  Retry All
                </button>
              </div>
              <div className="space-y-0.5">
                {groupAssets.map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
                    <span className="flex-1 text-xs font-mono truncate">{a.fileName}</span>
                    <span className="text-[10px] font-mono text-slate-400">{a.failureReason}</span>
                    <button
                      onClick={() => dispatch({ type: 'RETRY_ASSETS', assetIds: [a.id] })}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return (
          <ExceptionGroup
            key={reason}
            reason={reason as AttentionReason}
            assets={groupAssets}
            onQuickFix={handleQuickFix}
            onBulkFix={handleQuickFix}
          />
        )
      })}

      {exceptions.length === 0 && (
        <div className="border-2 border-[#0000ff] p-8 text-center space-y-2">
          <div className="text-sm font-bold uppercase tracking-widest text-[#0000ff]">No exceptions</div>
          <div className="text-[10px] font-mono text-slate-400">All assets are ready or in progress</div>
          <button
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'review' })}
            className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors mt-2"
          >
            Return to Review
          </button>
        </div>
      )}
    </div>
  )
}
