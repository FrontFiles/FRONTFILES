'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CommandSearchBar } from '@/components/discovery/CommandSearchBar'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { DiscoveryMap, type MapSize } from '@/components/discovery/DiscoveryMap'
import {
  searchableAssets,
  stories,
  articles,
  storyMap,
  assetMap,
  assets as allAssets,
  spotlightRanked,
  savedSearches,
  recommendations,
  type AssetData,
} from '@/data'

const FORMATS = ['All', 'Article', 'Story', 'Collection', 'Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const

export default function SearchPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [formatFilters, setFormatFilters] = useState<Set<string>>(new Set(['All']))
  const [mapSize, setMapSize] = useState<MapSize>('small')
  const [viewMode, setViewMode] = useState<'grid4' | 'grid2' | 'grid1' | 'list'>('grid4')
  const [hoverEnabled, setHoverEnabled] = useState(false)

  const toggleFormat = useCallback((f: string) => {
    setFormatFilters(prev => {
      if (f === 'All') return new Set(['All'])
      const next = new Set(prev)
      next.delete('All')
      if (next.has(f)) next.delete(f); else next.add(f)
      return next.size === 0 ? new Set(['All']) : next
    })
  }, [])

  const query = initialQuery.toLowerCase()

  // Match all content types
  const allMatchedAssets = useMemo(() => {
    let results = searchableAssets
    if (query) {
      results = results.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.tags.some(t => t.includes(query)) ||
        a.locationLabel.toLowerCase().includes(query)
      )
    }
    return results
  }, [query])

  const allMatchedStories = useMemo(() => {
    if (!query) return stories.slice(0, 4)
    return stories.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.dek.toLowerCase().includes(query) ||
      s.topicTags.some(t => t.includes(query))
    )
  }, [query])

  const allMatchedArticles = useMemo(() => {
    if (!query) return articles.slice(0, 3)
    return articles.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.dek.toLowerCase().includes(query) ||
      a.topicTags.some(t => t.includes(query))
    )
  }, [query])

  // Build unified feed: tag each item with a type, then filter
  type FeedItem =
    | { type: 'asset'; data: typeof searchableAssets[number]; relevance: number }
    | { type: 'story'; data: typeof stories[number]; relevance: number }
    | { type: 'article'; data: typeof articles[number]; relevance: number }

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []
    const isAll = formatFilters.has('All')

    if (isAll || formatFilters.has('Story')) {
      allMatchedStories.forEach((s, i) => items.push({ type: 'story', data: s, relevance: 100 - i }))
    }
    if (isAll || formatFilters.has('Article')) {
      allMatchedArticles.forEach((a, i) => items.push({ type: 'article', data: a, relevance: 90 - i }))
    }
    if (isAll || formatFilters.has('Collection')) {
      // Collections don't exist in search data yet — placeholder
    }

    // Asset-specific formats
    const assetFormatNames = ['Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector']
    const selectedAssetFormats = assetFormatNames.filter(f => formatFilters.has(f))

    if (isAll) {
      allMatchedAssets.forEach((a, i) => items.push({ type: 'asset', data: a, relevance: 80 - i }))
    } else if (selectedAssetFormats.length > 0) {
      const lowerFormats = selectedAssetFormats.map(f => f.toLowerCase())
      allMatchedAssets
        .filter(a => lowerFormats.includes(a.format.toLowerCase()))
        .forEach((a, i) => items.push({ type: 'asset', data: a, relevance: 80 - i }))
    }

    items.sort((a, b) => b.relevance - a.relevance)
    return items
  }, [allMatchedAssets, allMatchedStories, allMatchedArticles, formatFilters])

  // Keep old names for map/spotlight compatibility
  const matchedAssets = allMatchedAssets
  const matchedStories = allMatchedStories
  const matchedArticles = allMatchedArticles

  const matchingSavedSearch = query ? savedSearches.find(s =>
    s.label.toLowerCase().includes(query) || s.query.toLowerCase().includes(query)
  ) : null

  const sideSpotlight = spotlightRanked.slice(0, 8)

  // Sync spotlight height to map height
  const mapWrapRef = useRef<HTMLDivElement>(null)
  const [mapHeight, setMapHeight] = useState<number | undefined>(undefined)
  useEffect(() => {
    const el = mapWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setMapHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const relatedQueries = ['flood evacuation', 'border queue video', 'heatwave hospital', 'wildfire recovery', 'student protest', 'court hearing']
    .filter(r => r !== query)
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {/* Search + Discovery Map + Spotlight */}
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          {/* Row 1: Map + Spotlight side-by-side (compact) or Map full-width (expanded) */}
          <div className={mapSize === 'small' ? 'flex gap-6' : ''}>
            <div ref={mapWrapRef} className={mapSize === 'small' ? 'w-1/2' : ''}>
              <DiscoveryMap mapSize={mapSize} onMapSizeChange={setMapSize} />
            </div>

            {/* Spotlight — right column, aligned to map box bottom so tops match */}
            {mapSize === 'small' && sideSpotlight.length > 0 && (
              <div className="flex-1 min-w-0 flex flex-col self-end" style={{ height: 390 }}>
                <SpotlightPanel items={sideSpotlight} direction="vertical" />
              </div>
            )}
          </div>

          {/* Spotlight — horizontal scroll strip when expanded */}
          {mapSize !== 'small' && sideSpotlight.length > 0 && (
            <div className="mt-5">
              <SpotlightPanel items={sideSpotlight} direction="horizontal" />
            </div>
          )}

          {/* Row 2: Search bar + filters — always full width */}
          <div className="mt-8">
            <div className="flex gap-3 items-stretch">
              <div className="flex-1 min-w-0">
                <CommandSearchBar size="large" initialQuery={initialQuery} />
              </div>
              <div className="shrink-0 border-2 border-black px-3 flex items-center gap-2">
                <span className="text-[8px] font-bold uppercase tracking-widest text-black whitespace-nowrap">Save search</span>
                <button className="bg-[#0000ff] text-white text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 hover:bg-[#0000cc] transition-colors whitespace-nowrap">
                  Alert
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Format:</span>
              {FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => toggleFormat(f)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border transition-colors ${
                    formatFilters.has(f)
                      ? 'bg-[#0000ff] text-white border-[#0000ff]'
                      : 'border-slate-200 text-slate-500 hover:border-black hover:text-black'
                  }`}
                >
                  {f}
                </button>
              ))}
              {matchingSavedSearch && (
                <span className="ml-4 text-[10px] font-bold uppercase tracking-widest text-[#0000ff] border border-[#0000ff] px-2 py-0.5">
                  Saved search: {matchingSavedSearch.label}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Related:</span>
              {relatedQueries.map(r => (
                <Link key={r} href={`/search?q=${encodeURIComponent(r)}`} className="text-[10px] text-[#0000ff] hover:text-black transition-colors">
                  {r} &rarr;
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Results — centered */}
        <div className="max-w-[1400px] mx-auto px-6 py-8">
              {/* View mode toggle + hover toggle */}
              <div className="flex items-center justify-end gap-2 mb-6">
                <button
                  onClick={() => setHoverEnabled(h => !h)}
                  className={`w-8 h-8 flex items-center justify-center border-2 transition-colors ${hoverEnabled ? 'bg-[#0000ff] text-white border-[#0000ff]' : 'bg-white text-[#0000ff]/40 border-[#0000ff]/40 hover:text-[#0000ff] hover:border-[#0000ff]'}`}
                  title={hoverEnabled ? 'Hover preview on' : 'Hover preview off'}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 2v17l4.5-4.5 3.5 7 2.5-1.3-3.5-7H17.5L5 2z" />
                    {!hoverEnabled && <rect x="1" y="1" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" rx="0" />}
                  </svg>
                </button>
                <div className="flex items-center gap-0 border-2 border-black">
                  {([
                    ['grid4', <><span className="grid grid-cols-2 gap-[2px] w-3 h-3"><span className="bg-current" /><span className="bg-current" /><span className="bg-current" /><span className="bg-current" /></span></>],
                    ['grid2', <><span className="grid grid-cols-2 gap-[2px] w-3 h-3"><span className="bg-current col-span-1 row-span-2 h-3" /><span className="bg-current col-span-1 row-span-2 h-3" /></span></>],
                    ['grid1', <><span className="flex flex-col gap-[2px] w-3 h-3"><span className="bg-current flex-1" /></span></>],
                    ['list', <><span className="flex flex-col gap-[2px] w-3 h-3"><span className="bg-current h-[2px]" /><span className="bg-current h-[2px]" /><span className="bg-current h-[2px]" /></span></>],
                  ] as [string, React.ReactNode][]).map(([mode, icon], i) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as typeof viewMode)}
                      className={`w-8 h-8 flex items-center justify-center transition-colors ${
                        i > 0 ? 'border-l border-black/10' : ''
                      } ${
                        viewMode === mode
                          ? 'bg-[#0000ff] text-white'
                          : 'bg-white text-black/30 hover:text-black'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unified results feed */}
              <div className="flex items-baseline justify-between mb-6">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-black">
                  {feedItems.length} results found
                </h3>
              </div>

              {feedItems.length > 0 ? (
                <div className={
                  viewMode === 'grid4' ? 'grid grid-cols-4 gap-4' :
                  viewMode === 'grid2' ? 'grid grid-cols-2 gap-4' :
                  viewMode === 'grid1' ? 'grid grid-cols-1 gap-4' :
                  'flex flex-col gap-2'
                }>
                  {feedItems.slice(0, viewMode === 'list' ? 30 : 20).map(item => {
                    if (item.type === 'story') return <StoryCard key={`s-${item.data.id}`} story={item.data} disablePreview={!hoverEnabled} />
                    if (item.type === 'article') return <ArticleCard key={`a-${item.data.id}`} article={item.data} disablePreview={!hoverEnabled} />
                    return <AssetCard key={`asset-${item.data.id}`} asset={item.data} disablePreview={!hoverEnabled} />
                  })}
                </div>
              ) : (
                <div className="border-2 border-black/10 py-12 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-black/25">No results found</p>
                  <p className="text-[10px] text-black/15 mt-1">Try a broader search or remove format filters.</p>
                </div>
              )}

              {/* Suggested for you — infinite scroll */}
              <SuggestedForYou
                query={query}
                shownIds={new Set(feedItems.map(i => i.data.id))}
                hoverEnabled={hoverEnabled}
              />

        </div>
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// SPOTLIGHT PANEL — infinite scroll, image-only hover
// ══════════════════════════════════════════════════════

type SpotlightEntry = typeof spotlightRanked[number]

function SpotlightPanel({ items, direction }: { items: SpotlightEntry[]; direction: 'vertical' | 'horizontal' }) {
  const [collapsed, setCollapsed] = useState(false)
  // Repeat items 4x for infinite-scroll illusion
  const repeated = useMemo(() => [...items, ...items, ...items, ...items], [items])

  return (
    <div className={`border-2 border-[#0000ff] ${direction === 'vertical' ? 'flex flex-col flex-1 min-h-0' : ''}`}>
      <div className="bg-[#0000ff] px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">Spotlight</span>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-[8px] font-bold uppercase tracking-widest text-white bg-white/15 hover:bg-white/25 px-2 py-0.5 transition-colors"
          >
            {collapsed ? 'Expand' : 'Hide'}
          </button>
        </div>
        <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">{items.length} trending</span>
      </div>
      {!collapsed && (
        <div className={
          direction === 'vertical'
            ? 'flex flex-col overflow-y-auto flex-1 min-h-0'
            : 'flex overflow-x-auto'
        }>
          {repeated.map((s, idx) => {
            const key = `${s.id}-${idx}`
            if (s.objectType === 'asset' && assetMap[s.objectId]) {
              return <SpotlightAssetItem key={key} asset={assetMap[s.objectId]} reason={s.displayReason} direction={direction} />
            }
            if (s.objectType === 'story' && storyMap[s.objectId]) {
              return <SpotlightStoryItem key={key} story={storyMap[s.objectId]} reason={s.displayReason} direction={direction} />
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}

function useImageHover() {
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEnter = useCallback(() => { timerRef.current = setTimeout(() => setShowPreview(true), 400) }, [])
  const onLeave = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); setShowPreview(false) }, [])
  return { showPreview, onEnter, onLeave }
}

function SpotlightAssetThumb({ asset }: { asset: typeof assetMap[string] }) {
  const isText = asset.format === 'Text'
  const isAudio = asset.format === 'Audio'
  if (isText) {
    return (
      <div className="w-full h-full bg-white flex flex-col justify-center px-2 py-1 overflow-hidden">
        <span className="text-[6px] font-bold text-black line-clamp-2 leading-tight">{asset.title}</span>
        <span className="text-[5px] text-black/40 font-serif mt-0.5 line-clamp-1">{asset.textExcerpt}</span>
      </div>
    )
  }
  if (isAudio) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </div>
    )
  }
  return asset.thumbnailRef ? (
    <img src={asset.thumbnailRef} alt={asset.title} className="w-full h-full object-cover object-center" />
  ) : (
    <div className="w-full h-full flex items-center justify-center"><span className="text-[7px] font-bold text-black/20">{asset.format}</span></div>
  )
}

function SpotlightAssetItem({ asset, reason, direction }: { asset: typeof assetMap[string]; reason: string; direction: 'vertical' | 'horizontal' }) {
  const { showPreview, onEnter, onLeave } = useImageHover()
  const hasImage = !!asset.thumbnailRef

  if (direction === 'vertical') {
    return (
      <>
        <Link href={`/asset/${asset.id}`} className="flex gap-3 group p-2.5 hover:bg-slate-50 transition-colors border-b border-[#0000ff]/10 last:border-b-0">
          <div className="w-20 shrink-0 overflow-hidden bg-slate-100 aspect-video" onMouseEnter={onEnter} onMouseLeave={onLeave}>
            <SpotlightAssetThumb asset={asset} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#0000ff]">{reason}</span>
            <p className="text-[11px] font-bold text-black line-clamp-2 mt-0.5 leading-tight">{asset.title}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{asset.locationLabel}</p>
          </div>
        </Link>
        {showPreview && hasImage && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
            <img src={asset.thumbnailRef} alt={asset.title} className="max-w-[85vw] max-h-[85vh] object-contain" />
          </div>, document.body
        )}
      </>
    )
  }

  return (
    <>
      <Link href={`/asset/${asset.id}`} className="group block w-[260px] shrink-0 border-r border-[#0000ff]/10 last:border-r-0 hover:bg-slate-50 transition-colors">
        <div className="aspect-video overflow-hidden bg-slate-100" onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <SpotlightAssetThumb asset={asset} />
        </div>
        <div className="p-2">
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#0000ff]">{reason}</span>
          <p className="text-[10px] font-bold text-black line-clamp-2 mt-0.5 leading-tight">{asset.title}</p>
        </div>
      </Link>
      {showPreview && hasImage && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
          <img src={asset.thumbnailRef} alt={asset.title} className="max-w-[85vw] max-h-[85vh] object-contain" />
        </div>, document.body
      )}
    </>
  )
}

function SpotlightStoryItem({ story, reason, direction }: { story: typeof storyMap[string]; reason: string; direction: 'vertical' | 'horizontal' }) {
  const heroAsset = assetMap[story.heroAssetId]
  const storyAssets = story.assetIds.map(id => assetMap[id]).filter(Boolean)
  const { showPreview, onEnter, onLeave } = useImageHover()

  if (direction === 'vertical') {
    return (
      <>
        <Link href={`/story/${story.id}`} className="flex gap-3 group p-2.5 hover:bg-slate-50 transition-colors border-b border-[#0000ff]/10 last:border-b-0">
          {heroAsset && (
            <div className="w-20 shrink-0 overflow-hidden bg-slate-100 aspect-video" onMouseEnter={onEnter} onMouseLeave={onLeave}>
              <img src={heroAsset.thumbnailRef} alt={story.title} className="w-full h-full object-cover object-center" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#0000ff]">{reason}</span>
            <p className="text-[11px] font-bold text-black line-clamp-2 mt-0.5 leading-tight">{story.title}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{storyAssets.length} assets</p>
          </div>
        </Link>
        {showPreview && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
            <div className="max-w-[85vw] max-h-[85vh] flex flex-col items-center gap-4">
              {heroAsset && <img src={heroAsset.thumbnailRef} alt={story.title} className="max-w-full max-h-[50vh] object-contain" />}
              <div className="text-center max-w-[600px]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]/60">Story &middot; {storyAssets.length} assets</span>
                <h2 className="text-xl font-black text-white mt-1">{story.title}</h2>
                <p className="text-sm text-white/60 mt-1 line-clamp-2">{story.dek}</p>
              </div>
            </div>
          </div>, document.body
        )}
      </>
    )
  }

  return (
    <>
      <Link href={`/story/${story.id}`} className="group block w-[260px] shrink-0 border-r border-[#0000ff]/10 last:border-r-0 hover:bg-slate-50 transition-colors">
        {heroAsset && (
          <div className="aspect-video overflow-hidden bg-slate-100" onMouseEnter={onEnter} onMouseLeave={onLeave}>
            <img src={heroAsset.thumbnailRef} alt={story.title} className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-300" />
          </div>
        )}
        <div className="p-2">
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#0000ff]">{reason}</span>
          <p className="text-[10px] font-bold text-black line-clamp-2 mt-0.5 leading-tight">{story.title}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">{storyAssets.length} assets</p>
        </div>
      </Link>
      {showPreview && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
          <div className="max-w-[85vw] max-h-[85vh] flex flex-col items-center gap-4">
            {heroAsset && <img src={heroAsset.thumbnailRef} alt={story.title} className="max-w-full max-h-[50vh] object-contain" />}
            <div className="text-center max-w-[600px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]/60">Story &middot; {storyAssets.length} assets</span>
              <h2 className="text-xl font-black text-white mt-1">{story.title}</h2>
              <p className="text-sm text-white/60 mt-1 line-clamp-2">{story.dek}</p>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════
// SUGGESTED FOR YOU — infinite scroll recommendations
// ══════════════════════════════════════════════════════

const SUGGEST_BATCH = 6

function SuggestedForYou({ query, shownIds, hoverEnabled }: { query: string; shownIds: Set<string>; hoverEnabled: boolean }) {
  const pool = useMemo(() => {
    const tagSet = new Set(query.split(/\s+/).filter(Boolean))

    // Collect recommendation target IDs with reasons
    const recAssetReasons = new Map<string, string>()
    const recStoryReasons = new Map<string, string>()
    const recArticleReasons = new Map<string, string>()
    for (const rec of recommendations) {
      for (const aid of rec.targetAssetIds) {
        if (!recAssetReasons.has(aid)) recAssetReasons.set(aid, rec.reasonLabel)
      }
      for (const sid of rec.targetStoryIds) {
        if (!recStoryReasons.has(sid)) recStoryReasons.set(sid, rec.reasonLabel)
      }
      for (const aid of rec.targetArticleIds) {
        if (!recArticleReasons.has(aid)) recArticleReasons.set(aid, rec.reasonLabel)
      }
    }

    type SuggestItem =
      | { kind: 'asset'; data: AssetData; score: number; reason: string }
      | { kind: 'story'; data: typeof stories[number]; score: number; reason: string }
      | { kind: 'article'; data: typeof articles[number]; score: number; reason: string }

    const items: SuggestItem[] = []

    // Score assets
    for (const asset of allAssets) {
      if (shownIds.has(asset.id)) continue
      let score = 0
      let reason = ''
      if (recAssetReasons.has(asset.id)) { score += 4; reason = recAssetReasons.get(asset.id)! }
      if (query) {
        const matchingTags = asset.tags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 3
        if (matchingTags.length > 0 && !reason) reason = `Similar: ${matchingTags[0]}`
        if (asset.title.toLowerCase().includes(query)) { score += 2; if (!reason) reason = 'Title match' }
        if (asset.locationLabel.toLowerCase().includes(query)) { score += 2; if (!reason) reason = 'Same region' }
      }
      score += Math.random() * 0.5
      if (!reason) reason = 'Suggested'
      items.push({ kind: 'asset', data: asset, score, reason })
    }

    // Score stories
    for (const story of stories) {
      if (shownIds.has(story.id)) continue
      let score = 0
      let reason = ''
      if (recStoryReasons.has(story.id)) { score += 5; reason = recStoryReasons.get(story.id)! }
      if (query) {
        if (story.title.toLowerCase().includes(query)) { score += 3; if (!reason) reason = 'Title match' }
        const matchingTags = story.topicTags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 2
        if (matchingTags.length > 0 && !reason) reason = `Similar: ${matchingTags[0]}`
      }
      score += Math.random() * 0.3
      if (!reason) reason = 'Suggested'
      items.push({ kind: 'story', data: story, score, reason })
    }

    // Score articles
    for (const article of articles) {
      if (shownIds.has(article.id)) continue
      let score = 0
      let reason = ''
      if (recArticleReasons.has(article.id)) { score += 5; reason = recArticleReasons.get(article.id)! }
      if (query) {
        if (article.title.toLowerCase().includes(query)) { score += 3; if (!reason) reason = 'Title match' }
        const matchingTags = article.topicTags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 2
        if (matchingTags.length > 0 && !reason) reason = `Similar: ${matchingTags[0]}`
      }
      score += Math.random() * 0.3
      if (!reason) reason = 'Suggested'
      items.push({ kind: 'article', data: article, score, reason })
    }

    items.sort((a, b) => b.score - a.score)
    return items
  }, [query, shownIds])

  const [visibleCount, setVisibleCount] = useState(SUGGEST_BATCH)
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
            setVisibleCount(prev => Math.min(prev + SUGGEST_BATCH, pool.length))
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
    <section className="mt-12 mb-10">
      <div className="border-t-2 border-black pt-6 mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">Suggested for you</h2>
        <p className="text-xs text-slate-400 mt-1">Based on your search, trending coverage, and saved interests</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {visible.map(item => (
          <div key={`${item.kind}-${item.data.id}`} className="relative">
            {item.kind === 'story' ? (
              <StoryCard story={item.data} disablePreview={!hoverEnabled} />
            ) : item.kind === 'article' ? (
              <ArticleCard article={item.data} disablePreview={!hoverEnabled} />
            ) : (
              <AssetCard asset={item.data} showCreator disablePreview={!hoverEnabled} />
            )}
            {item.reason && (
              <div className="mt-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">{item.reason}</span>
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
