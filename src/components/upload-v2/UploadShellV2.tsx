// ═══════════════════════════════════════════════════════════════
// DORMANT — replaced by C2 (new shell at app/vault/upload/).
// Scheduled for deletion at the explicit cutover PR (PR 5+).
// DO NOT extend. DO NOT import from production code paths.
// See docs/upload/C2-PLAN.md §3.3 for the coexistence rule.
// ═══════════════════════════════════════════════════════════════
'use client'

import { cn } from '@/lib/utils'
import { UploadV2Provider, useUploadV2 } from './UploadV2Context'
import { AddFilesScreen } from './AddFilesScreen'
import { AnalysisScreen } from './AnalysisScreen'
import { ReviewAssignScreen } from './ReviewAssignScreen'
import { CommitScreen } from './CommitScreen'
import { V2_STAGE_LABELS, V2_STAGE_ORDER, type V2Stage } from '@/lib/upload/v2-types'
import { getAssets } from '@/lib/upload/v2-state'

function ShellInner() {
  const { state, dispatch } = useUploadV2()
  const currentStage = state.batch.currentStage
  const currentIndex = V2_STAGE_ORDER.indexOf(currentStage as V2Stage)
  const assetCount = getAssets(state).length

  return (
    <div className="flex flex-col h-full">
      {/* Stage nav */}
      <div className="flex items-center border-b-2 border-black flex-shrink-0">
        {V2_STAGE_ORDER.map((stage, i) => {
          const isActive = currentStage === stage || (currentStage === 'complete' && stage === 'commit')
          const isPast = i < currentIndex || currentStage === 'complete'
          const canNavigate = isPast && currentStage !== 'complete'

          return (
            <button
              key={stage}
              onClick={() => {
                if (canNavigate) dispatch({ type: 'SET_STAGE', stage })
              }}
              disabled={!canNavigate && !isActive}
              className={cn(
                'px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border-r border-black transition-colors',
                isActive && 'bg-black text-white',
                isPast && !isActive && 'text-[#0000ff] hover:bg-[#0000ff]/5 cursor-pointer',
                !isActive && !isPast && 'text-slate-300 cursor-default',
              )}
            >
              {V2_STAGE_LABELS[stage]}
            </button>
          )
        })}
        <div className="flex-1" />
        {state.ui.newsroomMode && (
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[#0000ff] text-white">
            Newsroom
          </div>
        )}
        <div className="px-4 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-wide">
          {assetCount} file{assetCount !== 1 ? 's' : ''} in this upload
        </div>
      </div>

      {/* Screen content */}
      <div className="flex-1 overflow-hidden">
        {currentStage === 'add-files' && <AddFilesScreen />}
        {currentStage === 'analysis' && <AnalysisScreen />}
        {currentStage === 'review' && <ReviewAssignScreen />}
        {(currentStage === 'commit' || currentStage === 'complete') && <CommitScreen />}
      </div>
    </div>
  )
}

export function UploadShellV2() {
  return (
    <UploadV2Provider>
      <ShellInner />
    </UploadV2Provider>
  )
}