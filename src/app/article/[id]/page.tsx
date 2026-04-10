'use client'

import { use, useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import {
  articleMap,
  assetMap,
  storyMap,
  creatorMap,
  articles,
  assets as allPlatformAssets,
  type AssetData,
} from '@/data'

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const article = articleMap[id]

  if (!article) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Article not found.</p>
      </div>
    )
  }

  const heroAsset = assetMap[article.heroAssetId]
  const sourceAssets = article.sourceAssetIds.map(aid => assetMap[aid]).filter(Boolean)
  const sourceStories = article.sourceStoryIds.map(sid => storyMap[sid]).filter(Boolean)
  const sourceCreators = article.sourceCreatorIds.map(cid => creatorMap[cid]).filter(Boolean)
  const relatedArticles = article.relatedArticleIds.map(aid => articleMap[aid]).filter(Boolean)
  const relatedStories = article.relatedStoryIds
    .filter(sid => !article.sourceStoryIds.includes(sid))
    .map(sid => storyMap[sid])
    .filter(Boolean)
  const relatedAssets = article.relatedAssetIds.map(aid => assetMap[aid]).filter(Boolean)

  // Primary creator (first source creator)
  const primaryCreator = sourceCreators[0]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">

          {/* ── Format identification (top) ────────── */}
          <div className="mb-6">
            <span className="inline-block text-xs font-black uppercase tracking-[0.18em] bg-[#0000ff] text-white px-3 py-1">
              Article
            </span>
          </div>

          {/* ── Creator / Author banner ──────────── */}
          <div className="flex items-start justify-between mb-8">
            {primaryCreator ? (
              <Link
                href={`/creator/${primaryCreator.slug}`}
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 bg-slate-200 border-2 border-black overflow-hidden shrink-0">
                  {primaryCreator.avatarRef ? (
                    <img src={primaryCreator.avatarRef} alt={primaryCreator.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-slate-400">
                      {primaryCreator.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-black group-hover:text-[#0000ff] transition-colors">
                    {primaryCreator.name}
                  </span>
                  <span className="block text-[11px] text-slate-400">{primaryCreator.locationBase}</span>
                </div>
              </Link>
            ) : article.editorName ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black border-2 border-black overflow-hidden shrink-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-white">FF</span>
                </div>
                <div>
                  <span className="text-sm font-bold text-black">{article.editorName}</span>
                  <span className="block text-[11px] text-slate-400">Frontfiles Editorial</span>
                </div>
              </div>
            ) : null}

            {/* Additional source creators */}
            {sourceCreators.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mr-1">
                  {sourceCreators.length} sources
                </span>
                <div className="flex -space-x-2">
                  {sourceCreators.map(c => (
                    <Link key={c.id} href={`/creator/${c.slug}`} title={c.name}>
                      <div className="w-7 h-7 bg-slate-200 border-2 border-white overflow-hidden shrink-0">
                        {c.avatarRef ? (
                          <img src={c.avatarRef} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-400">
                            {c.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Title + Dek ────────────────────────── */}
          <div className="mb-6">
            <h1 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold text-black tracking-tight leading-[1.1] mb-3">
              {article.title}
            </h1>
            <p className="text-base text-slate-500 leading-relaxed max-w-3xl">{article.dek}</p>
          </div>

          {/* ── Hero image ───────────────────────── */}
          {heroAsset && (
            <Link href={`/asset/${heroAsset.id}`} className="block relative bg-slate-50 border-2 border-black overflow-hidden mb-6 group">
              <img
                src={heroAsset.thumbnailRef}
                alt={article.title}
                className="w-full h-auto max-h-[60vh] object-cover group-hover:scale-[1.01] transition-transform duration-300"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  Hero asset · {heroAsset.format}
                </span>
              </div>
            </Link>
          )}

          {/* ── Summary ──────────────────────────── */}
          <p className="text-sm text-slate-600 leading-relaxed mb-6 max-w-3xl">{article.summary}</p>

          {/* ── Metadata strip ───────────────────── */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">
            <span>{(article.wordCount / 1000).toFixed(1)}k words</span>
            <span>{article.sourceAssetIds.length} source assets</span>
            <span>{article.sourceStoryIds.length} source stories</span>
            <span>{article.primaryGeography}</span>
            <span>{new Date(article.publishedAt).toISOString().split('T')[0]}</span>
          </div>

          {/* ── Tags ─────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5 mb-8">
            {article.topicTags.map(t => (
              <Link
                key={t}
                href={`/search?q=${encodeURIComponent(t)}`}
                className="text-[10px] font-bold uppercase tracking-wider border-2 border-slate-200 px-2.5 py-1 text-slate-500 hover:border-black hover:text-black transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>

          {/* ── Source assets ─────────────────────── */}
          {sourceAssets.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Source assets" sublabel={`${sourceAssets.length} certified sources`} />
              <div className="grid grid-cols-3 gap-4">
                {sourceAssets.map(a => (
                  <AssetCard key={a.id} asset={a} size="compact" showCreator />
                ))}
              </div>
            </section>
          )}

          {/* ── Source-connected Stories ──────────── */}
          {sourceStories.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Source Stories" sublabel="Stories supplying source assets" />
              <div className="grid grid-cols-2 gap-4">
                {sourceStories.map(s => (
                  <StoryCard key={s.id} story={s} reason="Source-connected content" />
                ))}
              </div>
            </section>
          )}

          {/* ── Source creators detail ────────────── */}
          {sourceCreators.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Source creators" />
              <div className="grid grid-cols-3 gap-4">
                {sourceCreators.map(c => (
                  <Link
                    key={c.id}
                    href={`/creator/${c.slug}`}
                    className="border-2 border-slate-200 p-4 hover:border-black transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-200 border border-black overflow-hidden shrink-0">
                        {c.avatarRef ? (
                          <img src={c.avatarRef} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                            {c.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.locationBase}</p>
                      </div>
                    </div>
                    <span className="inline-block mt-3 text-[9px] font-bold uppercase tracking-widest border border-slate-300 text-slate-400 px-2 py-0.5">
                      {c.trustBadge}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Related Articles ──────────────────── */}
          {relatedArticles.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Related Articles" sublabel="Related coverage" />
              <div className="flex flex-col gap-4">
                {relatedArticles.map(a => (
                  <ArticleCard key={a.id} article={a} reason="Related coverage" />
                ))}
              </div>
            </section>
          )}

          {/* ── Related Stories ───────────────────── */}
          {relatedStories.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Related Stories" />
              <div className="grid grid-cols-2 gap-4">
                {relatedStories.map(s => (
                  <StoryCard key={s.id} story={s} reason="Same geography" />
                ))}
              </div>
            </section>
          )}

          {/* ── Related assets ───────────────────── */}
          {relatedAssets.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Related assets" />
              <div className="grid grid-cols-3 gap-4">
                {relatedAssets.map(a => (
                  <AssetCard key={a.id} asset={a} size="compact" showCreator />
                ))}
              </div>
            </section>
          )}

          {/* ── Suggested for you (infinite scroll) ── */}
          <InfiniteRecommendations
            articleId={article.id}
            tags={article.topicTags}
            geography={article.primaryGeography}
            sourceCreatorIds={article.sourceCreatorIds}
            sourceAssetIds={article.sourceAssetIds}
          />
        </div>
      </main>
    </div>
  )
}

// ── Section label ─────────────────────────────────────

function SectionLabel({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4 border-b border-slate-200 pb-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">{label}</h2>
      {sublabel && <span className="text-xs text-slate-400">{sublabel}</span>}
    </div>
  )
}

// ── Infinite scroll recommendations ───────────────────

const BATCH_SIZE = 6

function InfiniteRecommendations({
  articleId,
  tags,
  geography,
  sourceCreatorIds,
  sourceAssetIds,
}: {
  articleId: string
  tags: string[]
  geography: string
  sourceCreatorIds: string[]
  sourceAssetIds: string[]
}) {
  const pool = useMemo(() => {
    const excluded = new Set(sourceAssetIds)
    const tagSet = new Set(tags.map(t => t.toLowerCase()))
    const creatorSet = new Set(sourceCreatorIds)

    return allPlatformAssets
      .filter(a => !excluded.has(a.id))
      .map(a => {
        let score = 0
        const matchingTags = a.tags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 3
        if (a.geography === geography) score += 2
        if (creatorSet.has(a.creatorId)) score += 2
        if (a.relatedArticleIds?.includes(articleId) || a.sourceArticleIds?.includes(articleId)) score += 4
        score += Math.random() * 0.5
        return { asset: a, score, reason: buildReason(matchingTags, a.geography === geography, creatorSet.has(a.creatorId)) }
      })
      .sort((a, b) => b.score - a.score)
  }, [articleId, tags, geography, sourceCreatorIds, sourceAssetIds])

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < pool.length && !loading) {
          setLoading(true)
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + BATCH_SIZE, pool.length))
            setLoading(false)
          }, 400)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, pool.length, loading])

  const visible = pool.slice(0, visibleCount)

  if (pool.length === 0) return null

  return (
    <section className="mb-10">
      <div className="border-t-2 border-black pt-6 mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">Suggested for you</h2>
        <p className="text-xs text-slate-400 mt-1">Based on this article's subject, sources, and your browsing</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {visible.map(({ asset, reason }) => (
          <div key={asset.id} className="relative">
            <AssetCard asset={asset} showCreator />
            {reason && (
              <div className="mt-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">{reason}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finding more</span>
        </div>
      )}

      {visibleCount < pool.length && (
        <div ref={sentinelRef} className="h-1" />
      )}

      {visibleCount >= pool.length && pool.length > 0 && (
        <div className="text-center py-8 border-t border-slate-200 mt-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            {pool.length} suggestions · End of results
          </span>
        </div>
      )}
    </section>
  )
}

function buildReason(matchingTags: string[], sameGeo: boolean, sameCreator: boolean): string {
  if (matchingTags.length > 0) return `Similar: ${matchingTags[0]}`
  if (sameGeo) return 'Same region'
  if (sameCreator) return 'Same creator'
  return ''
}
