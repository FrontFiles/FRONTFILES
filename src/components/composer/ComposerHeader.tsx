'use client'

import { useComposer } from '@/lib/composer/context'
import { getWordCount, getTotalAssetCount } from '@/lib/composer/selectors'
import { StateBadge } from '@/components/platform/StateBadge'
import {
  buildPreviewArticleFromState,
  isPreviewReady,
  writePreviewArticle,
} from '@/lib/composer/preview'

export function ComposerHeader() {
  const { state } = useComposer()
  const wordCount = getWordCount(state)
  const totalAssets = getTotalAssetCount(state)
  const canPreview = isPreviewReady(state)

  const openPreview = () => {
    const article = buildPreviewArticleFromState(state)
    writePreviewArticle(article)
    window.open('/article/_preview', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex items-center px-6 py-3 border-b-2 border-black bg-white shrink-0 gap-6">
      <h1 className="text-sm font-black uppercase tracking-widest text-black shrink-0">Composer</h1>
      {/* Right cluster — items spread evenly across the available space,
          same pattern as the main header's Upload/Lightbox/Composer trio.
          `flex-1 justify-between` pins the first item flush to the left
          (right after the title) and the last item flush to the right
          edge, with equal gaps between siblings. */}
      <div className="flex-1 flex items-center justify-between">
        <button
          type="button"
          onClick={openPreview}
          disabled={!canPreview}
          title={
            canPreview
              ? 'Open this draft in a new tab as the finished article view'
              : 'Add a title, source asset, or text block to enable preview'
          }
          className="text-[10px] font-black uppercase tracking-widest border-2 border-black px-3 py-1 bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black shrink-0"
        >
          Preview article
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
          {wordCount} words
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
          {totalAssets} assets
        </span>
        {state.publishState === 'draft' && (
          <span className="text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5 shrink-0">
            Private
          </span>
        )}
        <div className="shrink-0">
          <StateBadge variant={state.publishState === 'pending_review' ? 'published' : 'draft'} />
        </div>
        {state.split.selfSourceException && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#0000ff] shrink-0">
            Self-source
          </span>
        )}
      </div>
    </div>
  )
}
