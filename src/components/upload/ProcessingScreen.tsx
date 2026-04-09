'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset } from '@/lib/upload/batch-types'
import { BATCH_STATE_LABELS } from '@/lib/upload/batch-types'
import { formatFileSize } from '@/lib/upload/validation'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'
import type { BatchAction } from '@/lib/upload/batch-state'
import { getCounters } from '@/lib/upload/batch-state'

interface ProcessingScreenProps {
  assets: BatchAsset[]
  dispatch: (action: BatchAction) => void
}

export function ProcessingScreen({ assets, dispatch }: ProcessingScreenProps) {
  const counters = getCounters(assets)
  const allDone = counters.uploading === 0 && counters.processing === 0
  const doneCount = counters.ready + counters.warning + counters.blocked + counters.committed + counters.failed

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Progress summary */}
      <div className="border-2 border-black p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest">
            BATCH PROCESSING
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {doneCount} / {counters.total} complete
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="w-full h-2 bg-slate-200">
          <div
            className={cn('h-full transition-all duration-300', allDone ? 'bg-blue-600' : 'bg-black')}
            style={{ width: `${counters.total > 0 ? (doneCount / counters.total) * 100 : 0}%` }}
          />
        </div>

        {/* Status lanes */}
        <div className="grid grid-cols-4 gap-3">
          <StatusLane label="UPLOAD" count={counters.uploading} done={counters.uploading === 0} />
          <StatusLane label="ANALYSIS" count={counters.processing} done={counters.processing === 0 && counters.uploading === 0} />
          <StatusLane label="VALIDATION" count={counters.ready + counters.warning} done={allDone} />
          <StatusLane label="PRICING" count={assets.filter(a => a.priceRecommendation !== null).length} done={allDone} />
        </div>
      </div>

      {/* Individual asset progress */}
      <div className="space-y-0.5">
        {assets.map(asset => (
          <div key={asset.id} className="border border-slate-200 px-3 py-2 flex items-center gap-3">
            {/* Format */}
            <span className="w-12 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {asset.format ? ASSET_FORMAT_LABELS[asset.format]?.slice(0, 5) : '???'}
            </span>

            {/* Filename */}
            <span className="flex-1 text-xs font-mono truncate">{asset.fileName}</span>

            {/* Size */}
            <span className="text-[10px] font-mono text-slate-400 w-16 text-right">{formatFileSize(asset.fileSize)}</span>

            {/* Progress / State */}
            <div className="w-40 flex items-center gap-2">
              {asset.state === 'uploading' ? (
                <>
                  <div className="flex-1 h-1 bg-slate-200">
                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${asset.uploadProgress}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 w-8 text-right">{asset.uploadProgress}%</span>
                </>
              ) : asset.state === 'processing' ? (
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 animate-pulse">
                  Analysing...
                </span>
              ) : asset.state === 'failed' ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black">FAILED</span>
                  <button
                    onClick={() => dispatch({ type: 'RETRY_ASSETS', assetIds: [asset.id] })}
                    className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-widest',
                  asset.state === 'ready' ? 'text-blue-600' : 'text-black'
                )}>
                  {BATCH_STATE_LABELS[asset.state]}
                </span>
              )}
            </div>

            {/* Validation state (after processing) */}
            <div className="w-28">
              {asset.declarationState && (
                <span className={cn(
                  'text-[9px] font-bold uppercase tracking-widest px-1 py-0.5 border',
                  asset.declarationState === 'fully_validated' ? 'border-blue-600 text-blue-600' : 'border-slate-400 text-slate-500'
                )}>
                  {asset.declarationState.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Continue to Review */}
      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'review' })}
          className={cn(
            'flex-1 py-3 text-sm font-bold uppercase tracking-widest border-2 transition-colors',
            allDone
              ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
              : 'border-black text-black hover:bg-black hover:text-white'
          )}
        >
          {allDone ? 'Continue to Batch Review' : 'Continue to Review (processing continues)'}
        </button>
      </div>
    </div>
  )
}

function StatusLane({ label, count, done }: { label: string; count: number; done: boolean }) {
  return (
    <div className="text-center space-y-1">
      <div className={cn(
        'text-[10px] font-bold uppercase tracking-widest',
        done ? 'text-blue-600' : 'text-slate-500'
      )}>
        {label}
      </div>
      <div className={cn(
        'text-lg font-bold font-mono',
        done ? 'text-blue-600' : count > 0 ? 'text-black' : 'text-slate-300'
      )}>
        {done ? '✓' : count}
      </div>
    </div>
  )
}
