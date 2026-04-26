// ═══════════════════════════════════════════════════════════════
// DORMANT — replaced by C2 (new shell at app/vault/upload/).
// Scheduled for deletion at the explicit cutover PR (PR 5+).
// DO NOT extend. DO NOT import from production code paths.
// See docs/upload/C2-PLAN.md §3.3 for the coexistence rule.
// ═══════════════════════════════════════════════════════════════
'use client'

import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import { getAssets, getAnalysisProgress } from '@/lib/upload/v2-state'
import { CheckCircle2, Loader2, XCircle, ArrowRight } from 'lucide-react'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'
import { DECLARATION_STATE_LABELS } from '@/lib/upload/types'

export function AnalysisScreen() {
  const { state, dispatch } = useUploadV2()
  const assets = getAssets(state)
  const progress = getAnalysisProgress(state)

  const canEnterReview = progress.complete > 0

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Progress header */}
        <div className="border-2 border-black p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest">Analysing your files</span>
            <span className="text-sm font-mono font-bold">
              {progress.complete} of {progress.total} complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 border border-black">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {progress.failed > 0 && (
            <p className="text-xs text-black mt-2 font-bold">
              {progress.failed} file{progress.failed > 1 ? 's' : ''} failed analysis
            </p>
          )}
        </div>

        {/* Early transition button */}
        {canEnterReview && progress.inProgress > 0 && (
          <button
            onClick={() => dispatch({ type: 'ENTER_REVIEW_EARLY' })}
            className="w-full py-3 bg-[#0000ff] text-white text-sm font-bold uppercase tracking-widest hover:bg-[#0000cc] transition-colors flex items-center justify-center gap-2"
          >
            Go to Review & Assign
            <span className="text-[#0000ff]/15 font-normal lowercase">— analysis continues in background</span>
            <ArrowRight size={14} />
          </button>
        )}

        {/* Auto-transition when all complete */}
        {progress.inProgress === 0 && progress.complete > 0 && (
          <button
            onClick={() => dispatch({ type: 'SET_STAGE', stage: 'review' })}
            className="w-full py-3 bg-black text-white text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            Continue to Review & Assign
            <ArrowRight size={14} />
          </button>
        )}

        {/* Per-asset status list */}
        <div className="border-2 border-black divide-y divide-slate-100">
          <div className="px-4 py-2 bg-slate-50 grid grid-cols-[1fr_80px_100px_120px_100px_80px] gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>File</span>
            <span>Format</span>
            <span>Upload</span>
            <span>Declaration check</span>
            <span>Metadata</span>
            <span>Pricing</span>
          </div>
          {assets.map(asset => {
            const isComplete = asset.analysisStatus === 'complete'
            const isFailed = asset.analysisStatus === 'failed'
            const isAnalysing = asset.analysisStatus === 'analysing'

            return (
              <div key={asset.id} className="px-4 py-2 grid grid-cols-[1fr_80px_100px_120px_100px_80px] gap-2 items-center text-xs">
                <span className="font-mono truncate">{asset.filename}</span>
                <span className="text-slate-400 uppercase text-[10px] font-bold">
                  {asset.format ? ASSET_FORMAT_LABELS[asset.format] : '—'}
                </span>

                {/* Upload status */}
                <div className="flex items-center gap-1.5">
                  {isComplete || isAnalysing ? (
                    <CheckCircle2 size={12} className="text-[#0000ff]" />
                  ) : isFailed ? (
                    <XCircle size={12} className="text-black" />
                  ) : (
                    <>
                      <Loader2 size={12} className="text-slate-400 animate-spin" />
                      <span className="text-slate-400 font-mono">{asset.uploadProgress}%</span>
                    </>
                  )}
                </div>

                {/* Declaration check status */}
                <div className="flex items-center gap-1.5">
                  {isComplete && asset.declarationState ? (
                    <>
                      {asset.declarationState === 'manifest_invalid' ? (
                        <XCircle size={12} className="text-black" />
                      ) : (
                        <CheckCircle2 size={12} className="text-[#0000ff]" />
                      )}
                      <span className={cn(
                        'text-[10px] font-bold uppercase',
                        asset.declarationState === 'manifest_invalid' ? 'text-black' : 'text-slate-500',
                      )}>
                        {DECLARATION_STATE_LABELS[asset.declarationState]}
                      </span>
                    </>
                  ) : isFailed ? (
                    <span className="text-black text-[10px] font-bold">Failed</span>
                  ) : (
                    <Loader2 size={12} className="text-slate-300 animate-spin" />
                  )}
                </div>

                {/* Metadata status */}
                <div>
                  {isComplete && asset.proposal ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-[#0000ff]" />
                      <span className="text-[10px] font-mono text-slate-400">
                        {Math.round(asset.proposal.confidence * 100)}%
                      </span>
                    </div>
                  ) : isFailed ? (
                    <span className="text-black text-[10px] font-bold">Failed</span>
                  ) : (
                    <Loader2 size={12} className="text-slate-300 animate-spin" />
                  )}
                </div>

                {/* Pricing status */}
                <div>
                  {isComplete && asset.proposal?.priceSuggestion ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-[#0000ff]" />
                      <span className="text-[10px] font-mono text-slate-400">
                        {`\u20AC${(asset.proposal.priceSuggestion.amount / 100).toFixed(0)}`}
                      </span>
                    </div>
                  ) : isComplete ? (
                    <span className="text-slate-300 text-[10px]">{'\u2014'}</span>
                  ) : isFailed ? (
                    <span className="text-black text-[10px] font-bold">Failed</span>
                  ) : (
                    <Loader2 size={12} className="text-slate-300 animate-spin" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}