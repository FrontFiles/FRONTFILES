'use client'

import { use } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'
import { ContinueSearchCard } from '@/components/discovery/ContinueSearchCard'
import { CommandSearchBar } from '@/components/discovery/CommandSearchBar'
import {
  assetMap,
  storyMap,
  articleMap,
  creatorMap,
  publicAssets,
  getRecommendationsFor,
} from '@/data'

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const asset = assetMap[id]

  if (!asset) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Asset not found.</p>
        </div>
      </div>
    )
  }

  const creator = creatorMap[asset.creatorId]
  const story = storyMap[asset.storyId]
  const recs = getRecommendationsFor('asset', asset.id)

  // More from this story
  const storyAssets = story
    ? story.assetIds.filter(aid => aid !== asset.id).map(aid => assetMap[aid]).filter(Boolean)
    : []

  // Related assets
  const relatedAssets = asset.relatedAssetIds.map(aid => assetMap[aid]).filter(Boolean)

  // Connected articles
  const connectedArticles = asset.sourceArticleIds.map(aid => articleMap[aid]).filter(Boolean)
  const relatedArticles = asset.relatedArticleIds
    .filter(aid => !asset.sourceArticleIds.includes(aid))
    .map(aid => articleMap[aid])
    .filter(Boolean)
  const allArticles = [...connectedArticles, ...relatedArticles]

  // Related stories
  const relatedStories = asset.relatedStoryIds.map(sid => storyMap[sid]).filter(Boolean)

  // Same geography
  const sameGeoAssets = publicAssets
    .filter(a => a.id !== asset.id && a.geography === asset.geography && !storyAssets.find(sa => sa.id === a.id))
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Main content */}
            <div className="col-span-8">
              {/* Primary media */}
              <div className="relative aspect-video bg-slate-100 border border-slate-200 overflow-hidden">
                <img src={asset.thumbnailRef} alt={asset.title} className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
                  {asset.format}
                </span>
                {asset.durationSeconds && (
                  <span className="absolute bottom-3 right-3 text-[10px] font-bold bg-black/80 text-white px-2 py-0.5 font-mono">
                    {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
                  </span>
                )}
              </div>

              <h1 className="text-lg font-black text-black mt-4 leading-tight">{asset.title}</h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{asset.description}</p>

              {/* MORE FROM THIS STORY */}
              {storyAssets.length > 0 && (
                <section className="mt-10">
                  <SectionHeader label="More from this Story" sublabel={story?.title} href={`/story/${story?.id}`} linkText="View full Story" />
                  <div className="grid grid-cols-3 gap-4">
                    {storyAssets.slice(0, 3).map(a => (
                      <AssetCard key={a.id} asset={a} size="compact" reason="Same Story" />
                    ))}
                  </div>
                </section>
              )}

              {/* CONNECTED ARTICLES */}
              {allArticles.length > 0 && (
                <section className="mt-10">
                  <SectionHeader label="Connected Articles" sublabel="Source-linked coverage" />
                  <div className="flex flex-col gap-4">
                    {allArticles.map(a => (
                      <ArticleCard key={a.id} article={a} reason="Connected article" />
                    ))}
                  </div>
                </section>
              )}

              {/* RELATED STORIES */}
              {relatedStories.length > 0 && (
                <section className="mt-10">
                  <SectionHeader label="Related Stories" sublabel="Related coverage" />
                  <div className="grid grid-cols-2 gap-4">
                    {relatedStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Related coverage" />
                    ))}
                  </div>
                </section>
              )}

              {/* SAME GEOGRAPHY */}
              {sameGeoAssets.length > 0 && (
                <section className="mt-10">
                  <SectionHeader label="Same geography" sublabel={asset.locationLabel} />
                  <div className="grid grid-cols-3 gap-4">
                    {sameGeoAssets.map(a => (
                      <AssetCard key={a.id} asset={a} size="compact" reason="Same geography" />
                    ))}
                  </div>
                </section>
              )}

              {/* CONTINUE IN FRONTSEARCH */}
              <section className="mt-10">
                <ContinueSearchCard
                  query={asset.tags[0]}
                  label={`Search more: ${asset.tags[0]}`}
                />
              </section>
            </div>

            {/* Right rail: metadata + actions */}
            <div className="col-span-4">
              {/* Lightbox action */}
              <div className="border-2 border-black p-4 mb-6">
                <button className="w-full bg-blue-600 text-white text-sm font-bold uppercase tracking-wider py-3 hover:bg-blue-700 transition-colors">
                  Add to Lightbox
                </button>
                {asset.price && (
                  <p className="text-center text-xs text-slate-500 mt-2">From <span className="font-bold text-black font-mono">&euro;{asset.price}</span></p>
                )}
              </div>

              {/* Metadata */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Asset record</h3>
                <MetaRow label="Format" value={asset.mediaTypeDisplay} />
                <MetaRow label="Location" value={asset.locationLabel} />
                <MetaRow label="Captured" value={asset.captureDate} />
                <MetaRow label="Published" value={new Date(asset.publishedAt).toLocaleDateString()} />
                <MetaRow label="Aspect" value={asset.aspectRatio} />
                {asset.durationSeconds && <MetaRow label="Duration" value={`${asset.durationSeconds}s`} />}
                {asset.wordCount && <MetaRow label="Words" value={String(asset.wordCount)} />}
              </div>

              {/* Declaration panel */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Declaration status</h3>
                <ValidationBadge state={asset.validationDeclaration} />
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Declaration state reflects the creator submission and provenance workflow. This is not a factual verification.
                </p>
              </div>

              {/* Creator */}
              {creator && (
                <div className="border border-slate-200 p-4 mb-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Creator</h3>
                  <Link href={`/creator/${creator.slug}`} className="text-sm font-bold text-black hover:text-blue-600 transition-colors">
                    {creator.name}
                  </Link>
                  <p className="text-[11px] text-slate-500 mt-1">{creator.locationBase}</p>
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-widest border border-slate-300 text-slate-500 px-2 py-0.5">
                    {creator.trustBadge}
                  </span>
                </div>
              )}

              {/* Tags */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {asset.tags.map(t => (
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

              {/* Story link */}
              {story && (
                <Link href={`/story/${story.id}`} className="block border border-slate-200 p-4 hover:border-black transition-colors">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Part of Story</span>
                  <p className="text-sm font-bold text-black mt-1">{story.title}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{story.assetIds.length} assets</p>
                </Link>
              )}
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
