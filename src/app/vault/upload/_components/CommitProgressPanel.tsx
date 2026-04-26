/**
 * Frontfiles Upload V3 — Commit Progress Panel (C2.4 §1.1)
 *
 * Spec: UX-SPEC-V3.md §11.2.
 *
 * Renders inside CommitBar when state.commit.phase === 'committing'.
 * Shows aggregate progress (X of N committed) + a thin progress bar.
 *
 * Per-asset progress in state.commit.perAssetProgress[assetId] is
 * dispatched by useCommitSimulation (and, in PR 5, by the real upload
 * stream). Each asset progress is 0–100. Aggregate = sum of progresses
 * over (included count × 100).
 *
 * No user actions in this phase — the simulation drives transitions to
 * 'success' (CommitSuccessPanel takes over the whole screen) or to
 * 'partial-failure' (CommitErrorPanel renders below the asset list).
 */

'use client'

import { useMemo } from 'react'
import { useUploadContext } from './UploadContext'

export default function CommitProgressPanel() {
  const { state } = useUploadContext()

  const includedIds = useMemo(
    () => state.assetOrder.filter(id => state.assetsById[id] && !state.assetsById[id].excluded),
    [state.assetOrder, state.assetsById],
  )
  const totalAssets = includedIds.length

  const completedCount = useMemo(
    () =>
      includedIds.filter(id => (state.commit.perAssetProgress[id] ?? 0) >= 100).length,
    [includedIds, state.commit.perAssetProgress],
  )

  const aggregatePct = useMemo(() => {
    if (totalAssets === 0) return 0
    const sum = includedIds.reduce(
      (acc, id) => acc + (state.commit.perAssetProgress[id] ?? 0),
      0,
    )
    return Math.round(sum / totalAssets)
  }, [includedIds, state.commit.perAssetProgress, totalAssets])

  return (
    <div className="px-6 py-4 flex flex-col gap-2 min-w-0 border-t border-black bg-slate-50">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Committing batch
        </div>
        <div className="text-xs text-black">
          {completedCount} of {totalAssets} committed · {aggregatePct}%
        </div>
      </div>

      {/* Aggregate progress bar */}
      <div
        className="border border-black h-3 bg-white relative overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={aggregatePct}
        aria-label="Aggregate commit progress"
      >
        <div
          className="absolute inset-y-0 left-0 bg-blue-600 transition-[width] duration-100 ease-linear"
          style={{ width: `${aggregatePct}%` }}
        />
      </div>

      <div className="text-[10px] uppercase tracking-widest text-slate-400">
        Do not navigate away. This will complete in a moment.
      </div>
    </div>
  )
}
