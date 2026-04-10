'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { ArticleData } from '@/data'
import { assetMap } from '@/data'

interface ArticleCardProps {
  article: ArticleData
  size?: 'default' | 'large'
  reason?: string
  disablePreview?: boolean
}

export function ArticleCard({ article, size = 'default', reason, disablePreview = false }: ArticleCardProps) {
  const heroAsset = assetMap[article.heroAssetId]
  const sourceAssets = article.sourceAssetIds.map(id => assetMap[id]).filter(Boolean)
  const isLarge = size === 'large'
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hoverScale = disablePreview ? '' : 'group-hover:scale-[1.02]'

  const handleMouseEnter = useCallback(() => {
    if (disablePreview) return
    timerRef.current = setTimeout(() => setShowPreview(true), 400)
  }, [disablePreview])
  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowPreview(false)
  }, [])

  return (
    <>
      <Link
        href={`/article/${article.id}`}
        className="group block border border-slate-200 hover:border-black transition-colors bg-white"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex">
          {heroAsset && (
            <div className="w-32 shrink-0 overflow-hidden bg-slate-100">
              <img
                src={heroAsset.thumbnailRef}
                alt={article.title}
                className={`w-full h-full object-cover object-top ${hoverScale} transition-transform duration-300`}
              />
            </div>
          )}
          <div className={isLarge ? 'p-4 flex-1 min-w-0' : 'p-3 flex-1 min-w-0'}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]">
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

      {showPreview && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
          <div className="max-w-[85vw] max-h-[85vh] flex flex-col items-center gap-4">
            {heroAsset && (
              <img src={heroAsset.thumbnailRef} alt={article.title} className="max-w-full max-h-[50vh] object-contain" />
            )}
            <div className="text-center max-w-[600px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]/60">
                {article.articleType === 'frontfiles_article' ? 'Frontfiles Article' : 'Creator Article'} &middot; {article.sourceAssetIds.length} source assets
              </span>
              <h2 className="text-xl font-black text-white mt-1">{article.title}</h2>
              <p className="text-sm text-white/60 mt-1 line-clamp-3">{article.dek}</p>
              <p className="text-[10px] text-white/30 mt-2 font-mono">{(article.wordCount / 1000).toFixed(1)}k words</p>
            </div>
            {sourceAssets.length > 0 && (
              <div className="flex items-center gap-1 overflow-hidden max-w-[85vw]">
                {sourceAssets.slice(0, 6).map(a => (
                  <div key={a.id} className="w-20 h-14 shrink-0 overflow-hidden">
                    <img src={a.thumbnailRef} alt={a.title} className="w-full h-full object-cover object-top" />
                  </div>
                ))}
                {sourceAssets.length > 6 && (
                  <div className="w-20 h-14 shrink-0 bg-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white/50">+{sourceAssets.length - 6}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
