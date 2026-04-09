import Link from 'next/link'
import type { ArticleData } from '@/data'
import { assetMap } from '@/data'

interface ArticleCardProps {
  article: ArticleData
  size?: 'default' | 'large'
  reason?: string
}

export function ArticleCard({ article, size = 'default', reason }: ArticleCardProps) {
  const heroAsset = assetMap[article.heroAssetId]
  const isLarge = size === 'large'

  return (
    <Link href={`/article/${article.id}`} className="group block border border-slate-200 hover:border-black transition-colors bg-white">
      <div className="flex">
        {/* Side image */}
        {heroAsset && (
          <div className="w-32 shrink-0 overflow-hidden bg-slate-100">
            <img
              src={heroAsset.thumbnailRef}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        )}
        <div className={isLarge ? 'p-4 flex-1 min-w-0' : 'p-3 flex-1 min-w-0'}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
              {article.articleType === 'frontfiles_article' ? 'Frontfiles Article' : 'Creator Article'}
            </span>
            {reason && (
              <>
                <span className="text-slate-300">&middot;</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{reason}</span>
              </>
            )}
          </div>
          <h3 className={`font-bold text-black leading-tight line-clamp-2 ${isLarge ? 'text-sm' : 'text-xs'}`}>
            {article.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500 leading-snug line-clamp-2">
            {article.dek}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
            <span>{article.sourceAssetIds.length} source assets</span>
            <span>&middot;</span>
            <span>{(article.wordCount / 1000).toFixed(1)}k words</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
