/**
 * Frontfiles Upload V3 — Commit Summary Panel (C2.4 §1.1)
 *
 * Spec: UX-SPEC-V3.md §11.1.
 *
 * Renders inside CommitBar when state.commit.phase === 'summary'. Shows
 * a pre-commit confirmation: privacy distribution, total listed value,
 * story-group breakdown, plus BACK + CONFIRM COMMIT buttons.
 *
 * Per IPIV-11: computes display data inline from state + existing
 * selectors (no new aggregator extracted yet — premature for V1).
 *
 * BACK dispatches CANCEL_COMMIT (reducer guards: must be in 'summary',
 * else throws). CONFIRM dispatches CONFIRM_COMMIT (same guard).
 */

'use client'

import { useMemo } from 'react'
import { useUploadContext } from './UploadContext'
import {
  getIncludedAssets,
  getTotalListedValue,
  getStoryCoverageSummary,
  type PublishReadinessResult,
  type AssetsView,
  type StoryGroupsView,
} from '@/lib/upload/upload-selectors'
import type { PrivacyState } from '@/lib/upload/types'

const BTN =
  'border border-black px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors'

interface Props {
  readiness: PublishReadinessResult
}

export default function CommitSummaryPanel({ readiness }: Props) {
  const { state, dispatch } = useUploadContext()

  const assetsView: AssetsView = useMemo(
    () => ({ assetsById: state.assetsById, assetOrder: state.assetOrder }),
    [state.assetsById, state.assetOrder],
  )
  const storyView: AssetsView & StoryGroupsView = useMemo(
    () => ({
      assetsById: state.assetsById,
      assetOrder: state.assetOrder,
      storyGroupsById: state.storyGroupsById,
      storyGroupOrder: state.storyGroupOrder,
    }),
    [state.assetsById, state.assetOrder, state.storyGroupsById, state.storyGroupOrder],
  )

  // Privacy distribution across included assets
  const privacyCounts = useMemo(() => {
    const counts: Record<PrivacyState | 'unset', number> = {
      PUBLIC: 0,
      RESTRICTED: 0,
      PRIVATE: 0,
      unset: 0,
    }
    for (const a of getIncludedAssets(assetsView)) {
      const p = a.editable.privacy
      if (p === 'PUBLIC' || p === 'RESTRICTED' || p === 'PRIVATE') counts[p]++
      else counts.unset++
    }
    return counts
  }, [assetsView])

  const totalListedCents = useMemo(() => getTotalListedValue(assetsView), [assetsView])
  const storyCoverage = useMemo(() => getStoryCoverageSummary(storyView), [storyView])

  return (
    <div className="px-6 py-4 flex flex-col gap-3 min-w-0 border-t border-black bg-slate-50">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Pre-commit summary
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {readiness.readyCount} of {readiness.includedCount} ready
        </div>
      </div>

      {/* Privacy distribution */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <SummaryCell label="Public" value={privacyCounts.PUBLIC} />
        <SummaryCell label="Restricted" value={privacyCounts.RESTRICTED} />
        <SummaryCell label="Private" value={privacyCounts.PRIVATE} />
        <SummaryCell label="Unset" value={privacyCounts.unset} muted />
      </div>

      {/* Total listed value */}
      <div className="flex items-baseline justify-between border-t border-black pt-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Total listed value (transactable)
        </span>
        <span className="text-base font-mono text-black">
          €{(totalListedCents / 100).toFixed(2)}
        </span>
      </div>

      {/* Story groups */}
      {storyCoverage.groups.length > 0 && (
        <div className="border-t border-black pt-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
            Story groups
          </div>
          <ul className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
            {storyCoverage.groups.map(g => (
              <li key={g.id} className="flex items-baseline justify-between text-xs text-black">
                <span className="truncate min-w-0" title={g.name}>
                  {g.name}
                </span>
                <span className="font-mono text-slate-600 flex-shrink-0 ml-2">
                  {g.assignedCount} {g.assignedCount === 1 ? 'asset' : 'assets'}
                </span>
              </li>
            ))}
            {storyCoverage.unassigned > 0 && (
              <li className="flex items-baseline justify-between text-xs text-slate-500 italic">
                <span>Ungrouped</span>
                <span className="font-mono">
                  {storyCoverage.unassigned} {storyCoverage.unassigned === 1 ? 'asset' : 'assets'}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-black pt-3">
        <button
          type="button"
          onClick={() => dispatch({ type: 'CANCEL_COMMIT' })}
          className={`${BTN} bg-white text-black hover:bg-slate-100`}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'CONFIRM_COMMIT' })}
          className={`${BTN} bg-blue-600 text-white hover:bg-black`}
        >
          Confirm commit
        </button>
      </div>
    </div>
  )
}

function SummaryCell({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`border border-black p-2 ${muted ? 'bg-slate-100' : 'bg-white'}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-lg font-mono ${muted ? 'text-slate-500' : 'text-black'}`}>{value}</div>
    </div>
  )
}
