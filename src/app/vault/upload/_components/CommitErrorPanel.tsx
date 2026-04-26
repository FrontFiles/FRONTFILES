/**
 * Frontfiles Upload V3 — Commit Error Panel (C2.4 §1.1)
 *
 * Spec: UX-SPEC-V3.md §11.4.
 *
 * Renders inside CommitBar when state.commit.phase === 'partial-failure'.
 * Per L7: this panel REPLACES the bottom bar only — drop zone, session
 * defaults, asset list, and (if open) side panel stay visible above.
 * Failed assets get an inline "Commit failed: {error}" chip in their
 * AssetRow / AssetRowCompact (per IPIV-10).
 *
 * Two actions:
 *   RETRY FAILED   → RETRY_FAILED_COMMITS (reducer transitions back to
 *                    'committing' with a fresh perAssetProgress + cleared
 *                    failed list; useCommitSimulation re-arms)
 *   CONTINUE TO VAULT → router.push('/vault'). Accepts the partial commit;
 *                       failed assets remain uncommitted in the batch but
 *                       the user moves on.
 */

'use client'

import { useRouter } from 'next/navigation'
import { useUploadContext } from './UploadContext'

const ACTION =
  'border border-black px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors'

export default function CommitErrorPanel() {
  const { state, dispatch } = useUploadContext()
  const router = useRouter()

  const failed = state.commit.failed
  const succeededCount =
    state.assetOrder.filter(
      id => state.assetsById[id] && !state.assetsById[id].excluded,
    ).length - failed.length

  return (
    <div className="px-6 py-4 flex flex-col gap-3 min-w-0 border-t-2 border-black bg-yellow-50">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-black">
          ⚠ Commit partially failed
        </div>
        <div className="text-xs text-black">
          {succeededCount} succeeded · {failed.length} failed
        </div>
      </div>

      {failed.length > 0 && (
        <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto border border-black bg-white p-2">
          {failed.map(f => {
            const asset = state.assetsById[f.assetId]
            return (
              <li key={f.assetId} className="text-xs text-black">
                <span className="font-mono">{asset?.filename ?? f.assetId}</span>
                <span className="text-slate-600 ml-2">— {f.error}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/vault')}
          className={`${ACTION} bg-white text-black hover:bg-slate-100`}
        >
          Continue to vault
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'RETRY_FAILED_COMMITS' })}
          className={`${ACTION} bg-blue-600 text-white hover:bg-black`}
        >
          Retry failed
        </button>
      </div>
    </div>
  )
}
