import type { RecommendationGroup } from '@/data'
import { assetMap, storyMap, articleMap } from '@/data'
import { AssetCard } from './AssetCard'
import { StoryCard } from './StoryCard'
import { ArticleCard } from './ArticleCard'

interface RecommendationRailProps {
  group: RecommendationGroup
  columns?: 2 | 3 | 4
}

export function RecommendationRail({ group, columns = 3 }: RecommendationRailProps) {
  const targetAssets = group.targetAssetIds.map(id => assetMap[id]).filter(Boolean)
  const targetStories = group.targetStoryIds.map(id => storyMap[id]).filter(Boolean)
  const targetArticles = group.targetArticleIds.map(id => articleMap[id]).filter(Boolean)

  const hasContent = targetAssets.length > 0 || targetStories.length > 0 || targetArticles.length > 0
  if (!hasContent) return null

  const gridCols = columns === 4 ? 'grid-cols-4' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 border-b border-slate-200 pb-2 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-black">{group.title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 border border-blue-600 px-2 py-0">{group.reasonLabel}</span>
      </div>
      <div className={`grid ${gridCols} gap-4`}>
        {targetStories.map(s => (
          <StoryCard key={s.id} story={s} size="default" />
        ))}
        {targetArticles.map(a => (
          <div key={a.id} className="col-span-full">
            <ArticleCard article={a} />
          </div>
        ))}
        {targetAssets.slice(0, columns).map(a => (
          <AssetCard key={a.id} asset={a} size="compact" />
        ))}
      </div>
    </section>
  )
}
