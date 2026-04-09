'use client'

import { use } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { ContinueSearchCard } from '@/components/discovery/ContinueSearchCard'
import {
  articleMap,
  assetMap,
  storyMap,
  creatorMap,
  articles,
} from '@/data'

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const article = articleMap[id]

  if (!article) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Article not found.</p>
        </div>
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

  // More from source creators
  const creatorArticles = articles.filter(a =>
    a.id !== article.id &&
    a.sourceCreatorIds.some(cid => article.sourceCreatorIds.includes(cid))
  ).slice(0, 2)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Main content */}
            <div className="col-span-8">
              {/* Article header */}
              <div className="mb-8">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  {article.articleType === 'frontfiles_article' ? 'Frontfiles Article' : 'Creator Article'}
                </span>
                <h1 className="text-2xl font-black text-black mt-2 leading-tight">{article.title}</h1>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{article.dek}</p>
                <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
                  {article.editorName && <span>{article.editorName}</span>}
                  {article.creatorName && <span>{article.creatorName}</span>}
                  <span>{(article.wordCount / 1000).toFixed(1)}k words</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Hero image */}
              {heroAsset && (
                <Link href={`/asset/${heroAsset.id}`} className="block relative aspect-video bg-slate-100 border border-slate-200 overflow-hidden mb-8 group">
                  <img src={heroAsset.thumbnailRef} alt={article.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <span className="text-[10px] font-bold text-white/70">Source asset &middot; {heroAsset.format}</span>
                  </div>
                </Link>
              )}

              {/* Summary */}
              <p className="text-sm text-slate-600 leading-relaxed mb-8">{article.summary}</p>

              {/* Source asset rail */}
              <section className="mb-10">
                <SectionHeader label="Source assets" sublabel={`${sourceAssets.length} certified sources`} />
                <div className="grid grid-cols-3 gap-4">
                  {sourceAssets.map(a => (
                    <AssetCard key={a.id} asset={a} size="compact" reason="Source asset" />
                  ))}
                </div>
              </section>

              {/* Source-connected Stories */}
              {sourceStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Source-connected Stories" sublabel="Stories supplying source assets" />
                  <div className="grid grid-cols-2 gap-4">
                    {sourceStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Source-connected content" />
                    ))}
                  </div>
                </section>
              )}

              {/* Related Articles */}
              {relatedArticles.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Related Articles" sublabel="Related coverage" />
                  <div className="flex flex-col gap-4">
                    {relatedArticles.map(a => (
                      <ArticleCard key={a.id} article={a} reason="Related coverage" />
                    ))}
                  </div>
                </section>
              )}

              {/* Related Stories */}
              {relatedStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Related Stories" />
                  <div className="grid grid-cols-2 gap-4">
                    {relatedStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Same geography" />
                    ))}
                  </div>
                </section>
              )}

              {/* More from source creators */}
              {creatorArticles.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="More from source creators" />
                  <div className="flex flex-col gap-4">
                    {creatorArticles.map(a => (
                      <ArticleCard key={a.id} article={a} reason="Same creator" />
                    ))}
                  </div>
                </section>
              )}

              {/* Related assets */}
              {relatedAssets.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Related assets" />
                  <div className="grid grid-cols-3 gap-4">
                    {relatedAssets.map(a => (
                      <AssetCard key={a.id} asset={a} size="compact" />
                    ))}
                  </div>
                </section>
              )}

              {/* Continue */}
              <ContinueSearchCard
                query={article.topicTags[0]}
                label={`Search more: ${article.topicTags[0]}`}
              />
            </div>

            {/* Right rail */}
            <div className="col-span-4">
              {/* Article metadata */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Article record</h3>
                <MetaRow label="Type" value={article.articleType === 'frontfiles_article' ? 'Frontfiles Article' : 'Creator Article'} />
                <MetaRow label="Words" value={String(article.wordCount)} />
                <MetaRow label="Source assets" value={String(article.sourceAssetIds.length)} />
                <MetaRow label="Source Stories" value={String(article.sourceStoryIds.length)} />
                <MetaRow label="Published" value={new Date(article.publishedAt).toLocaleDateString()} />
              </div>

              {/* Source creators */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Source creators</h3>
                {sourceCreators.map(c => (
                  <Link key={c.id} href={`/creator/${c.slug}`} className="block py-2 border-b border-slate-100 last:border-0 hover:text-blue-600 transition-colors">
                    <p className="text-sm font-bold text-black">{c.name}</p>
                    <p className="text-[11px] text-slate-500">{c.locationBase}</p>
                  </Link>
                ))}
              </div>

              {/* Tags */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Topics</h3>
                <div className="flex flex-wrap gap-1">
                  {article.topicTags.map(t => (
                    <Link
                      key={t}
                      href={`/search?q=${encodeURIComponent(t)}`}
                      className="text-[10px] font-bold uppercase tracking-wider border border-slate-200 px-2 py-0.5 text-slate-500 hover:border-black hover:text-black transition-colors"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recommendation reasons */}
              <div className="border border-slate-200 p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Discovery signals</h3>
                <div className="flex flex-col gap-1">
                  {article.recommendationReasons.map(r => (
                    <span key={r} className="text-[10px] font-bold uppercase tracking-widest text-blue-600 border border-blue-600 px-2 py-0.5 inline-block w-fit">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-[11px] font-bold text-black">{value}</span>
    </div>
  )
}
