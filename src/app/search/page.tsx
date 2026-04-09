'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CommandSearchBar } from '@/components/discovery/CommandSearchBar'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { DiscoveryMap } from '@/components/discovery/DiscoveryMap'
import {
  searchableAssets,
  stories,
  articles,
  storyMap,
  assetMap,
  spotlightRanked,
  savedSearches,
} from '@/data'

const FORMATS = ['All', 'Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const

export default function SearchPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [formatFilter, setFormatFilter] = useState<string>('All')

  const query = initialQuery.toLowerCase()

  const matchedAssets = useMemo(() => {
    let results = searchableAssets
    if (query) {
      results = results.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.tags.some(t => t.includes(query)) ||
        a.locationLabel.toLowerCase().includes(query)
      )
    }
    if (formatFilter !== 'All') {
      results = results.filter(a => a.format === formatFilter)
    }
    return results
  }, [query, formatFilter])

  const matchedStories = useMemo(() => {
    if (!query) return stories.slice(0, 4)
    return stories.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.dek.toLowerCase().includes(query) ||
      s.topicTags.some(t => t.includes(query))
    )
  }, [query])

  const matchedArticles = useMemo(() => {
    if (!query) return articles.slice(0, 3)
    return articles.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.dek.toLowerCase().includes(query) ||
      a.topicTags.some(t => t.includes(query))
    )
  }, [query])

  const matchingSavedSearch = query ? savedSearches.find(s =>
    s.label.toLowerCase().includes(query) || s.query.toLowerCase().includes(query)
  ) : null

  const sideSpotlight = spotlightRanked.slice(0, 3)

  const relatedQueries = ['flood evacuation', 'border queue video', 'heatwave hospital', 'wildfire recovery', 'student protest', 'court hearing']
    .filter(r => r !== query)
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {/* Search bar — full width, tight */}
        <div className="border-b-2 border-black">
          <div className="max-w-[1400px] mx-auto px-6 py-5">
            <CommandSearchBar size="large" initialQuery={initialQuery} />

            {/* Filters row */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Format:</span>
              {FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => setFormatFilter(f)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border transition-colors ${
                    formatFilter === f
                      ? 'bg-black text-white border-black'
                      : 'border-slate-200 text-slate-500 hover:border-black hover:text-black'
                  }`}
                >
                  {f}
                </button>
              ))}
              {matchingSavedSearch && (
                <span className="ml-4 text-[10px] font-bold uppercase tracking-widest text-blue-600 border border-blue-600 px-2 py-0.5">
                  Saved search: {matchingSavedSearch.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Discovery Map — dominant, wide */}
        <div className="border-b-2 border-black">
          <div className="max-w-[1400px] mx-auto px-6 py-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block">FrontSearch</span>
                <h2 className="text-[22px] font-serif italic text-black tracking-tight leading-none mt-1">Discovery</h2>
              </div>
              <span className="text-[8px] text-black/20 uppercase tracking-[0.12em] font-bold">Geographic archive browser</span>
            </div>
            <div className="border-b-2 border-black mb-4" />
            <DiscoveryMap />
          </div>
        </div>

        {/* Results grid — below the map */}
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Main results */}
            <div className="col-span-8">
              {/* Stories */}
              {matchedStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Stories" sublabel={`${matchedStories.length} matching`} />
                  <div className="grid grid-cols-2 gap-4">
                    {matchedStories.slice(0, 4).map(s => (
                      <StoryCard key={s.id} story={s} />
                    ))}
                  </div>
                </section>
              )}

              {/* Assets */}
              <section className="mb-10">
                <SectionHeader label="Assets" sublabel={`${matchedAssets.length} results`} />
                <div className="grid grid-cols-3 gap-4">
                  {matchedAssets.slice(0, 12).map(a => (
                    <AssetCard key={a.id} asset={a} />
                  ))}
                </div>
                {matchedAssets.length === 0 && (
                  <div className="border-2 border-black/10 py-12 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-black/25">No matching assets</p>
                    <p className="text-[10px] text-black/15 mt-1">Try a broader search or remove format filters.</p>
                  </div>
                )}
              </section>

              {/* Articles */}
              {matchedArticles.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Articles" sublabel={`${matchedArticles.length} matching`} />
                  <div className="flex flex-col gap-4">
                    {matchedArticles.slice(0, 4).map(a => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right rail */}
            <div className="col-span-4">
              {/* Spotlight */}
              <section className="mb-8">
                <div className="border-b border-slate-200 pb-2 mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-black">FCS Spotlight</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {sideSpotlight.map(s => {
                    if (s.objectType === 'asset' && assetMap[s.objectId]) {
                      const a = assetMap[s.objectId]
                      return (
                        <Link key={s.id} href={`/asset/${a.id}`} className="flex gap-3 group border border-slate-200 p-2 hover:border-black transition-colors">
                          <div className="w-20 h-14 shrink-0 overflow-hidden bg-slate-100">
                            <img src={a.thumbnailRef} alt={a.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600">{s.displayReason}</span>
                            <p className="text-[11px] font-bold text-black line-clamp-2 mt-0.5">{a.title}</p>
                          </div>
                        </Link>
                      )
                    }
                    if (s.objectType === 'story' && storyMap[s.objectId]) {
                      const st = storyMap[s.objectId]
                      return (
                        <Link key={s.id} href={`/story/${st.id}`} className="block border border-slate-200 p-2 hover:border-black transition-colors">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600">{s.displayReason}</span>
                          <p className="text-[11px] font-bold text-black mt-0.5">{st.title}</p>
                          <p className="text-[10px] text-slate-400">{st.assetIds.length} assets</p>
                        </Link>
                      )
                    }
                    return null
                  })}
                </div>
              </section>

              {/* Related searches */}
              <section className="mb-8">
                <div className="border-b border-slate-200 pb-2 mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-black">Related searches</h3>
                </div>
                <div className="flex flex-col gap-1">
                  {relatedQueries.map(r => (
                    <Link key={r} href={`/search?q=${encodeURIComponent(r)}`} className="text-xs text-blue-600 hover:text-black transition-colors py-1">
                      {r} &rarr;
                    </Link>
                  ))}
                </div>
              </section>

              {/* Save search */}
              <section className="border-2 border-black p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-black">Save this search</h3>
                <p className="text-[11px] text-slate-500 mt-1">Get alerts when new content matches this query.</p>
                <button className="mt-3 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 hover:bg-blue-700 transition-colors w-full">
                  Save search alert
                </button>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
