'use client'

import { useComposer } from '@/lib/composer/context'
import { getWordCount, getTotalAssetCount } from '@/lib/composer/selectors'
import { StateBadge } from '@/components/platform/StateBadge'

export function ComposerHeader() {
  const { state } = useComposer()
  const wordCount = getWordCount(state)
  const totalAssets = getTotalAssetCount(state)

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b-2 border-black bg-white shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-black uppercase tracking-widest text-black">Composer</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {wordCount} words
        </span>
        <span className="text-[10px] text-slate-300">&middot;</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {totalAssets} assets
        </span>
        {state.publishState === 'draft' && (
          <span className="text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
            Private
          </span>
        )}
        <StateBadge variant={state.publishState === 'pending_review' ? 'published' : 'draft'} />
        {state.split.selfSourceException && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#0000ff]">
            Self-source
          </span>
        )}
      </div>
    </div>
  )
}
