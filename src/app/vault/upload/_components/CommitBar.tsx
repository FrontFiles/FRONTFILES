/**
 * Frontfiles Upload V3 — Commit Bar orchestrator (C2.4 §1.1)
 *
 * Spec: UX-SPEC-V3.md §2.2 (sticky bottom region) + §10.2 (plain-language
 * summary) + §11 (commit flow).
 *
 * Renders the bottom region across four visible commit phases. The fifth
 * phase ('success') is handled by UploadShell's top-level branch — when
 * phase === 'success', the success panel replaces the entire screen body
 * and CommitBar is not mounted.
 *
 * Phase-to-render map:
 *   idle             → CTA + plain-language summary
 *   summary          → CommitSummaryPanel (pre-commit confirm)
 *   committing       → CommitProgressPanel (per-asset + aggregate progress)
 *   partial-failure  → CommitErrorPanel (asset list stays visible above)
 *
 * Per IPIV-1 + IPIV-4 + IPIV-5: useCommitSimulation hook is mounted here
 * and drives the fake committing → success/partial-failure transition.
 * Real network is PR 5.
 *
 * Per L3: CTA disabled when readyCount === 0 OR any blocking exception
 * remains. Per L2: CTA reads "COMMIT N" where N = readyCount from
 * getV3PublishReadiness (V3 — needs_story not blocking per UX-BRIEF v3
 * §4.5).
 */

'use client'

import { useMemo } from 'react'
import { useUploadContext } from './UploadContext'
import {
  getV3PublishReadiness,
  getCommitBarSummaryText,
  type AssetsView,
} from '@/lib/upload/upload-selectors'
import { useCommitSimulation } from './useCommitSimulation'
import CommitSummaryPanel from './CommitSummaryPanel'
import CommitProgressPanel from './CommitProgressPanel'
import CommitErrorPanel from './CommitErrorPanel'

interface Props {
  /** Dev-only failure injection from ?simulateFailure=N. Null in production. */
  simulateFailure: number | null
}

export default function CommitBar({ simulateFailure }: Props) {
  const { state, dispatch } = useUploadContext()
  const phase = state.commit.phase

  // Fake-progress driver. Mounted unconditionally — hook self-gates on phase.
  useCommitSimulation({ simulateFailure })

  const view: AssetsView = useMemo(
    () => ({ assetsById: state.assetsById, assetOrder: state.assetOrder }),
    [state.assetsById, state.assetOrder],
  )
  const readiness = useMemo(() => getV3PublishReadiness(view), [view])
  const summaryText = useMemo(() => getCommitBarSummaryText(readiness), [readiness])

  const ctaDisabled = readiness.readyCount === 0 || readiness.blockedCount > 0

  return (
    <div
      data-region="commit-bar"
      className="border-t border-black bg-white sticky bottom-0 z-20 min-w-0"
    >
      {phase === 'idle' && (
        <div className="flex items-center gap-4 px-6 py-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {readiness.readyCount} of {readiness.includedCount} ready
              {readiness.excludedCount > 0 && (
                <span className="ml-2 text-slate-400">· {readiness.excludedCount} excluded</span>
              )}
            </div>
            {summaryText && (
              <div className="text-sm text-black mt-0.5">{summaryText}</div>
            )}
          </div>
          <button
            type="button"
            disabled={ctaDisabled}
            onClick={() => dispatch({ type: 'BEGIN_COMMIT' })}
            className={`border border-black px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${
              ctaDisabled
                ? 'opacity-40 cursor-not-allowed bg-white text-black'
                : 'bg-blue-600 text-white hover:bg-black'
            }`}
          >
            Commit {readiness.readyCount}
          </button>
        </div>
      )}

      {phase === 'summary' && <CommitSummaryPanel readiness={readiness} />}
      {phase === 'committing' && <CommitProgressPanel />}
      {phase === 'partial-failure' && <CommitErrorPanel />}
    </div>
  )
}
