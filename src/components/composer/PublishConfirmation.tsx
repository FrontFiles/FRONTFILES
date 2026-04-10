'use client'

import { useComposer } from '@/lib/composer/context'
import { getArticleReadiness, getCrossStoryMap, getSourceAssets, getInlineTextAssets } from '@/lib/composer/selectors'
import { computeArticleSplit, formatEur } from '@/lib/composer/split-engine'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'

export function PublishConfirmation() {
  const { state, dispatch } = useComposer()
  const readiness = getArticleReadiness(state)
  const crossStory = getCrossStoryMap(state)
  const split = computeArticleSplit(state)
  const sourceAssets = getSourceAssets(state)
  const inlineTextAssets = getInlineTextAssets(state)

  if (!state.ui.confirmingPublish) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-black">
          <h2 className="text-sm font-black uppercase tracking-widest text-black">Publish article</h2>
          <p className="text-[10px] text-slate-400 mt-1">
            Article by {state.split.selfSourceException ? 'creator (self-sourced)' : 'editor'}
          </p>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-black">{state.title}</h3>
          {state.dek && <p className="text-xs text-slate-500 mt-1">{state.dek}</p>}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {readiness.wordCount} words
            </span>
            <span className="text-[10px] text-slate-300">&middot;</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {readiness.sourceAssetCount} source assets
            </span>
            <span className="text-[10px] text-slate-300">&middot;</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {readiness.uniqueStoryCount} {readiness.uniqueStoryCount === 1 ? 'story' : 'stories'}
            </span>
          </div>
        </div>

        {/* Source assets */}
        <div className="px-6 py-4 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
            Source assets (FCS Layer 4 Assembly)
          </span>
          <div className="flex flex-col gap-1.5">
            {sourceAssets.map(asset => (
              <div key={asset.id} className="flex items-center gap-2">
                <div className="w-8 h-6 bg-slate-100 shrink-0 overflow-hidden">
                  <img src={asset.thumbnailRef} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-bold text-black truncate flex-1">{asset.title}</span>
                <ValidationBadge state={asset.validationDeclaration} />
                {asset.price && (
                  <span className="text-[10px] font-bold font-mono text-black shrink-0">
                    {formatEur(asset.price)}
                  </span>
                )}
              </div>
            ))}
            {inlineTextAssets.map(ta => (
              <div key={ta.blockId} className="flex items-center gap-2">
                <div className="w-8 h-6 bg-black shrink-0 flex items-center justify-center">
                  <span className="text-[7px] font-bold uppercase text-white">Text</span>
                </div>
                <span className="text-[10px] font-bold text-black truncate flex-1">{ta.title}</span>
                <span className="text-[9px] font-mono text-slate-400 shrink-0">{ta.wordCount}w</span>
                <span className="text-[10px] font-bold font-mono text-black shrink-0">
                  {formatEur(ta.price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-story map */}
        {crossStory.length > 1 && (
          <div className="px-6 py-4 border-b border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
              Cross-story sources
            </span>
            {crossStory.map(entry => (
              <div key={entry.storyId} className="flex items-baseline justify-between py-0.5">
                <span className="text-[10px] text-black">{entry.storyTitle}</span>
                <span className="text-[10px] font-mono text-slate-400">{entry.assetCount} assets</span>
              </div>
            ))}
          </div>
        )}

        {/* Cost breakdown */}
        <div className="px-6 py-4 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
            Split summary
          </span>
          <div className="flex flex-col gap-1">
            <SplitRow label="Creators receive" amount={split.totalCreatorReceives} />
            {split.totalEditorReceives > 0 && (
              <SplitRow label="Editor receives" amount={split.totalEditorReceives} />
            )}
            <SplitRow label="Platform" amount={split.totalPlatformReceives} />
          </div>
          <div className="flex items-baseline justify-between pt-2 mt-2 border-t border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-black">Buyer pays</span>
            <span className="text-sm font-bold font-mono text-black">{formatEur(split.totalBuyerPays)}</span>
          </div>
        </div>

        {/* Advisories */}
        {readiness.advisories.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
              Advisories
            </span>
            {readiness.advisories.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5">
                <div className="w-1.5 h-1.5 border border-slate-400 mt-1 shrink-0" />
                <span className="text-[10px] text-slate-500">{a.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_CONFIRMING_PUBLISH', payload: false })}
            className="h-10 px-4 border-2 border-black text-black text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              dispatch({ type: 'PUBLISH' })
              dispatch({ type: 'SET_CONFIRMING_PUBLISH', payload: false })
            }}
            className="h-10 px-6 bg-[#0000ff] text-white text-xs font-bold uppercase tracking-wide hover:bg-[#0000cc] transition-colors flex-1"
          >
            Confirm &amp; submit for review
          </button>
        </div>
      </div>
    </div>
  )
}

function SplitRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-[10px] font-mono text-slate-500">{formatEur(amount)}</span>
    </div>
  )
}
