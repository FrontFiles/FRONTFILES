'use client'

import { use } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { ContinueSearchCard } from '@/components/discovery/ContinueSearchCard'
import {
  storyMap,
  assetMap,
  articleMap,
  creatorMap,
  stories,
} from '@/data'

export default function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const story = storyMap[id]

  if (!story) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Story not found.</p>
        </div>
      </div>
    )
  }

  const creator = creatorMap[story.creatorId]
  const heroAsset = assetMap[story.heroAssetId]
  const storyAssets = story.assetIds.map(aid => assetMap[aid]).filter(Boolean)
  const connectedArticles = story.articleIds.map(aid => articleMap[aid]).filter(Boolean)
  const relatedStories = story.recommendedStoryIds.map(sid => storyMap[sid]).filter(Boolean)

  // More from this creator
  const creatorStories = stories.filter(s => s.creatorId === story.creatorId && s.id !== story.id)

  // Same geography stories
  const geoStories = stories.filter(s =>
    s.id !== story.id &&
    (s.primaryGeography === story.primaryGeography || story.secondaryGeographies.includes(s.primaryGeography))
    && !relatedStories.find(rs => rs.id === s.id)
    && !creatorStories.find(cs => cs.id === s.id)
  ).slice(0, 2)

  // Format breakdown
  const formatCounts: Record<string, number> = {}
  storyAssets.forEach(a => { formatCounts[a.format] = (formatCounts[a.format] || 0) + 1 })

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {/* Story hero */}
        {heroAsset && (
          <div className="relative aspect-[3/1] max-h-[360px] overflow-hidden bg-slate-100">
            <img src={heroAsset.thumbnailRef} alt={story.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-6 pb-8">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Story &middot; {storyAssets.length} assets</span>
              <h1 className="text-2xl font-black text-white mt-1">{story.title}</h1>
              <p className="text-sm text-white/70 mt-1 max-w-2xl">{story.dek}</p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Main content */}
            <div className="col-span-8">
              {/* Summary */}
              <p className="text-sm text-slate-600 leading-relaxed mb-8">{story.summary}</p>

              {/* Asset grid */}
              <SectionHeader label="Story assets" sublabel={`${storyAssets.length} assets`} />
              <div className="grid grid-cols-3 gap-4 mb-10">
                {storyAssets.map(a => (
                  <AssetCard key={a.id} asset={a} showCreator={false} />
                ))}
              </div>

              {/* Connected Articles */}
              {connectedArticles.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Connected Articles" sublabel="Built from this Story" />
                  <div className="flex flex-col gap-4">
                    {connectedArticles.map(a => (
                      <ArticleCard key={a.id} article={a} reason="Source-connected content" />
                    ))}
                  </div>
                </section>
              )}

              {/* Related Stories */}
              {relatedStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Related Stories" sublabel="Related coverage" />
                  <div className="grid grid-cols-2 gap-4">
                    {relatedStories.slice(0, 4).map(s => (
                      <StoryCard key={s.id} story={s} reason="Related coverage" />
                    ))}
                  </div>
                </section>
              )}

              {/* More from this creator */}
              {creatorStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="More from this creator" sublabel={creator?.name} />
                  <div className="grid grid-cols-2 gap-4">
                    {creatorStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Same creator" />
                    ))}
                  </div>
                </section>
              )}

              {/* Same geography */}
              {geoStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Same geography" />
                  <div className="grid grid-cols-2 gap-4">
                    {geoStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Same geography" />
                    ))}
                  </div>
                </section>
              )}

              {/* Continue */}
              <ContinueSearchCard
                query={story.topicTags[0]}
                label={`Search more: ${story.topicTags[0]}`}
              />
            </div>

            {/* Right rail */}
            <div className="col-span-4">
              {/* Actions */}
              <div className="border-2 border-black p-4 mb-6">
                <button className="w-full bg-blue-600 text-white text-sm font-bold uppercase tracking-wider py-3 hover:bg-blue-700 transition-colors">
                  Add all to Lightbox
                </button>
                <p className="text-center text-[11px] text-slate-500 mt-2">{storyAssets.length} assets in this Story</p>
              </div>

              {/* Story metadata */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Story record</h3>
                <MetaRow label="Coverage" value={`${story.coverageWindow.start} \u2013 ${story.coverageWindow.end}`} />
                <MetaRow label="Assets" value={String(storyAssets.length)} />
                <MetaRow label="Articles" value={String(connectedArticles.length)} />
                <div className="mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Format mix</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(formatCounts).map(([f, c]) => (
                      <span key={f} className="text-[10px] font-bold uppercase tracking-wider border border-slate-200 px-2 py-0 text-slate-500">
                        {f} {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Creator */}
              {creator && (
                <Link href={`/creator/${creator.slug}`} className="block border border-slate-200 p-4 mb-4 hover:border-black transition-colors">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Creator</h3>
                  <p className="text-sm font-bold text-black">{creator.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{creator.locationBase}</p>
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-widest border border-slate-300 text-slate-500 px-2 py-0.5">
                    {creator.trustBadge}
                  </span>
                </Link>
              )}

              {/* Tags */}
              <div className="border border-slate-200 p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Topics</h3>
                <div className="flex flex-wrap gap-1">
                  {story.topicTags.map(t => (
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
