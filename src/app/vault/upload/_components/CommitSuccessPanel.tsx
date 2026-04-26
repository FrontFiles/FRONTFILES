/**
 * Frontfiles Upload V3 — Commit Success Panel (C2.4 §1.1)
 *
 * Spec: UX-SPEC-V3.md §11.3.
 *
 * Renders as the WHOLE SCREEN BODY when state.commit.phase === 'success'.
 * Per L6: drop zone, asset list, side panel, commit bar are all hidden;
 * UploadShell branches at the top to render only this component.
 *
 * Two terminal actions:
 *   UPLOAD MORE  → RESET_FLOW (reducer wipes everything; back to empty batch)
 *   GO TO VAULT  → router.push('/vault')
 *
 * Per IPIV-7 + IPIV-8.
 *
 * Display uses getCompletionSummary which returns committed asset count,
 * outcome breakdown (stored / transactable-via-link / ready-for-discovery),
 * and per-story summary.
 */

'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUploadContext } from './UploadContext'
import {
  getCompletionSummary,
  type AssetsView,
  type StoryGroupsView,
} from '@/lib/upload/upload-selectors'

const ACTION =
  'border border-black px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors'

export default function CommitSuccessPanel() {
  const { state, dispatch } = useUploadContext()
  const router = useRouter()

  const view: AssetsView & StoryGroupsView = useMemo(
    () => ({
      assetsById: state.assetsById,
      assetOrder: state.assetOrder,
      storyGroupsById: state.storyGroupsById,
      storyGroupOrder: state.storyGroupOrder,
    }),
    [state.assetsById, state.assetOrder, state.storyGroupsById, state.storyGroupOrder],
  )
  const summary = useMemo(() => getCompletionSummary(view), [view])

  return (
    <div className="flex-1 flex items-center justify-center bg-white p-12 min-w-0">
      <div className="border border-black bg-white p-8 max-w-2xl w-full flex flex-col gap-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
            Commit complete
          </div>
          <div className="text-3xl font-bold text-black">
            {summary.totalCommitted} {summary.totalCommitted === 1 ? 'asset' : 'assets'} uploaded
          </div>
          {summary.totalListedValue > 0 && (
            <div className="text-sm text-slate-700 mt-1">
              Total listed value: <span className="font-mono">€{(summary.totalListedValue / 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Outcome breakdown */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <OutcomeCell
            label="Discoverable"
            value={summary.outcomeBreakdown.readyForDiscovery}
            sub="Public + valid declaration"
          />
          <OutcomeCell
            label="Link-only"
            value={summary.outcomeBreakdown.transactableViaLink}
            sub="Restricted, transactable"
          />
          <OutcomeCell
            label="Stored"
            value={summary.outcomeBreakdown.stored}
            sub="Private or not yet listable"
          />
        </div>

        {/* Story groups */}
        {summary.stories.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Stories created / updated
            </div>
            <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto border-t border-black pt-1">
              {summary.stories.map(s => (
                <li key={s.id} className="flex items-baseline justify-between text-sm border-b border-slate-200 py-1">
                  <span className="truncate min-w-0" title={s.name}>
                    {s.name} {s.isNew && <span className="text-[9px] uppercase tracking-widest text-blue-600 ml-1">new</span>}
                  </span>
                  <span className="font-mono text-slate-600 flex-shrink-0 ml-2">
                    {s.assetCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Terminal actions */}
        <div className="flex items-center justify-end gap-2 border-t border-black pt-4">
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_FLOW' })}
            className={`${ACTION} bg-white text-black hover:bg-slate-100`}
          >
            Upload more
          </button>
          <button
            type="button"
            onClick={() => router.push('/vault')}
            className={`${ACTION} bg-blue-600 text-white hover:bg-black`}
          >
            Go to vault
          </button>
        </div>
      </div>
    </div>
  )
}

function OutcomeCell({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="border border-black p-2 bg-white">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-2xl font-mono text-black my-0.5">{value}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </div>
  )
}
