'use client'

import { useComposer } from '@/lib/composer/context'
import { getArticleReadiness } from '@/lib/composer/selectors'
import { computeArticleSplit, formatEur } from '@/lib/composer/split-engine'

export function StatusBar() {
  const { state, dispatch } = useComposer()
  const readiness = getArticleReadiness(state)
  const split = computeArticleSplit(state)

  return (
    <div className="flex items-center justify-between px-6 py-2 border-t-2 border-black bg-white shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {readiness.sourceAssetCount} assets
        </span>
        {readiness.uniqueStoryCount > 0 && (
          <>
            <span className="text-[10px] text-slate-300">&middot;</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {readiness.uniqueStoryCount} {readiness.uniqueStoryCount === 1 ? 'story' : 'stories'}
            </span>
          </>
        )}
        {readiness.uniqueCreatorCount > 0 && (
          <>
            <span className="text-[10px] text-slate-300">&middot;</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {readiness.uniqueCreatorCount} {readiness.uniqueCreatorCount === 1 ? 'creator' : 'creators'}
            </span>
          </>
        )}
        {readiness.blockers.length > 0 && (
          <>
            <span className="text-[10px] text-slate-300">&middot;</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-black">
              {readiness.blockers.length} {readiness.blockers.length === 1 ? 'blocker' : 'blockers'}
            </span>
          </>
        )}
        {readiness.advisories.length > 0 && (
          <>
            <span className="text-[10px] text-slate-300">&middot;</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {readiness.advisories.length} advisory
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {split.totalBuyerPays > 0 && (
          <span className="text-[10px] font-bold font-mono text-black">
            Total {formatEur(split.totalBuyerPays)}
          </span>
        )}
        <button
          onClick={() => dispatch({ type: 'SAVE_DRAFT' })}
          className="h-7 px-3 border-2 border-black text-black text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          Save draft
        </button>
        <button
          onClick={() => {
            if (readiness.ready) {
              dispatch({ type: 'SET_CONFIRMING_PUBLISH', payload: true })
            }
          }}
          disabled={!readiness.ready}
          className="h-7 px-4 bg-[#0000ff] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#0000cc] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Publish
        </button>
      </div>
    </div>
  )
}
