import type { ArticleData } from '@/data'
import { ArticleCard } from '@/components/discovery/ArticleCard'

interface AssetContextModuleProps {
  articles: ArticleData[]
}

export function AssetContextModule({ articles }: AssetContextModuleProps) {
  if (articles.length === 0) return null

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4 border-b border-slate-200 pb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">Connected Articles</h2>
        <span className="text-xs text-slate-400">Source-linked coverage</span>
      </div>
      <div className="flex flex-col gap-4">
        {articles.map(a => (
          <ArticleCard key={a.id} article={a} reason="Connected article" />
        ))}
      </div>
    </div>
  )
}
