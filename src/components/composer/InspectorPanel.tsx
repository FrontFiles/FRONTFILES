'use client'

import { useComposer } from '@/lib/composer/context'
import { getArticleReadiness, getSourceAssets, getInlineTextAssets, getCrossStoryMap, getWordCount } from '@/lib/composer/selectors'
import { computeArticleSplit, formatEur, detectSelfSource } from '@/lib/composer/split-engine'
import { assetMap, creatorMap, storyMap } from '@/data'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'

export function InspectorPanel() {
  const { state, dispatch } = useComposer()
  const focusedAssetId = state.ui.focusedAssetId
  const focusedAsset = focusedAssetId ? assetMap[focusedAssetId] : null

  if (focusedAsset) {
    return <AssetInspector assetId={focusedAsset.id} />
  }

  return <ArticleInspector />
}

// ── Article overview inspector ──────────────────────────────

function ArticleInspector() {
  const { state, dispatch } = useComposer()
  const readiness = getArticleReadiness(state)
  const crossStory = getCrossStoryMap(state)
  const split = computeArticleSplit(state)
  const wordCount = getWordCount(state)
  const sourceAssets = getSourceAssets(state)
  const inlineTextAssets = getInlineTextAssets(state)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Readiness */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Readiness</h3>
        {readiness.ready ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-[#0000ff]" />
            <span className="text-xs font-bold text-[#0000ff]">Ready to publish</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {readiness.blockers.map((b, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-1.5 h-1.5 bg-black mt-1 shrink-0" />
                <span className="text-[10px] text-black">{b.label}</span>
              </div>
            ))}
          </div>
        )}
        {readiness.advisories.length > 0 && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-100">
            {readiness.advisories.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-1.5 h-1.5 border border-slate-400 mt-1 shrink-0" />
                <span className="text-[10px] text-slate-500">{a.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Article</h3>
        <MetaRow label="Words" value={String(wordCount)} />
        <MetaRow label="Sources" value={String(readiness.sourceAssetCount)} />
        <MetaRow label="Stories" value={String(readiness.uniqueStoryCount)} />
        <MetaRow label="Creators" value={String(readiness.uniqueCreatorCount)} />
      </div>

      {/* Source assets list */}
      {(sourceAssets.length > 0 || inlineTextAssets.length > 0) && (
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Source assets</h3>
          <div className="flex flex-col gap-1.5">
            {sourceAssets.map(asset => (
              <div
                key={asset.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 -mx-1 px-1 py-0.5 transition-colors"
                onClick={() => dispatch({ type: 'FOCUS_ASSET', payload: asset.id })}
              >
                <div className="w-6 h-5 bg-slate-100 shrink-0 overflow-hidden">
                  <img src={asset.thumbnailRef} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-black truncate flex-1">{asset.title}</span>
                <span className="text-[9px] font-bold font-mono text-black shrink-0">
                  {formatEur(asset.price ?? 0)}
                </span>
              </div>
            ))}
            {inlineTextAssets.map(ta => (
              <div key={ta.blockId} className="flex items-center gap-2 -mx-1 px-1 py-0.5">
                <div className="w-6 h-5 bg-black shrink-0 flex items-center justify-center">
                  <span className="text-[6px] font-bold uppercase text-white">T</span>
                </div>
                <span className="text-[10px] text-black truncate flex-1">{ta.title}</span>
                <span className="text-[9px] font-bold font-mono text-black shrink-0">
                  {formatEur(ta.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-story map */}
      {crossStory.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Source stories</h3>
          <div className="flex flex-col gap-1.5">
            {crossStory.map(entry => (
              <div key={entry.storyId} className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold text-black truncate">{entry.storyTitle}</span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">{entry.assetCount} assets</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost breakdown */}
      {split.lineItems.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Cost breakdown</h3>
          <div className="flex flex-col gap-1">
            {split.lineItems.map(item => (
              <div key={item.assetId} className="flex items-baseline justify-between py-0.5">
                <span className="text-[10px] text-slate-500 truncate">{item.assetTitle}</span>
                <span className="text-[10px] font-bold font-mono text-black shrink-0 ml-2">
                  {formatEur(item.buyerPays)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between pt-2 mt-2 border-t border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-black">Total</span>
            <span className="text-xs font-bold font-mono text-black">{formatEur(split.totalBuyerPays)}</span>
          </div>
          <div className="flex flex-col gap-0.5 mt-2">
            <SplitRow label="Creators receive" amount={split.totalCreatorReceives} />
            {split.totalEditorReceives > 0 && (
              <SplitRow label="Editor receives" amount={split.totalEditorReceives} />
            )}
            <SplitRow label="Platform" amount={split.totalPlatformReceives} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Focused asset inspector ─────────────────────────────────

function AssetInspector({ assetId }: { assetId: string }) {
  const { dispatch } = useComposer()
  const asset = assetMap[assetId]
  if (!asset) return null

  const creator = creatorMap[asset.creatorId]
  const story = storyMap[asset.storyId]

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={() => dispatch({ type: 'FOCUS_ASSET', payload: null })}
        className="w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[#0000ff] hover:bg-slate-50 border-b border-slate-200 transition-colors"
      >
        &larr; Back to article
      </button>

      {/* Preview */}
      <div className="aspect-video bg-slate-100 overflow-hidden">
        <img src={asset.thumbnailRef} alt={asset.title} className="w-full h-full object-cover" />
      </div>

      {/* Asset details */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-xs font-bold text-black">{asset.title}</h3>
        <p className="text-[10px] text-slate-500 mt-1 line-clamp-3">{asset.description}</p>
      </div>

      <div className="px-4 py-3 border-b border-slate-200">
        <MetaRow label="Format" value={asset.format} />
        <MetaRow label="Location" value={asset.locationLabel} />
        <MetaRow label="Captured" value={asset.captureDate} />
        {creator && <MetaRow label="Creator" value={creator.name} />}
        {story && <MetaRow label="Story" value={story.title} />}
        <MetaRow label="Privacy" value={asset.privacyLevel} />
        {asset.price && <MetaRow label="Price" value={`\u20AC${asset.price}`} />}
      </div>

      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Declaration</h3>
        <ValidationBadge state={asset.validationDeclaration} />
      </div>

      {/* Tags */}
      {asset.tags.length > 0 && (
        <div className="px-4 py-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tags</h3>
          <div className="flex flex-wrap gap-1">
            {asset.tags.map(tag => (
              <span key={tag} className="text-[9px] font-bold uppercase tracking-widest border border-slate-200 px-1.5 py-0.5 text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared micro-components ─────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 border-b border-slate-100 last:border-0">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-[10px] font-bold text-black">{value}</span>
    </div>
  )
}

function SplitRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-[10px] font-mono text-slate-500">{formatEur(amount)}</span>
    </div>
  )
}
