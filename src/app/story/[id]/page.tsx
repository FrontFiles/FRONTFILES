'use client'

import { use, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { GridToolbar, type OverlayMode } from '@/components/discovery/GridToolbar'
import { gridLayoutClass, type ViewMode } from '@/lib/grid-layout'
import { getAvatarCrop } from '@/lib/avatar-crop'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import {
  storyMap,
  assetMap,
  articleMap,
  creatorMap,
  stories,
  assets as allPlatformAssets,
  type AssetData,
} from '@/data'

type FormatFilter = 'all' | string

export default function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const story = storyMap[id]

  if (!story) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Story not found.</p>
      </div>
    )
  }

  const creator = creatorMap[story.creatorId]
  const initialAssets = story.assetIds.map(aid => assetMap[aid]).filter(Boolean)
  const [orderedAssets, setOrderedAssets] = useState<AssetData[]>(() => {
    if (typeof window === 'undefined') return initialAssets
    try {
      const saved = localStorage.getItem(`story-order-${id}`)
      if (saved) {
        const savedIds: string[] = JSON.parse(saved)
        const reordered = savedIds.map(aid => assetMap[aid]).filter(Boolean)
        if (reordered.length === initialAssets.length) return reordered
      }
    } catch {}
    return initialAssets
  })
  const [saveFlash, setSaveFlash] = useState(false)
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid4')
  const [overlay, setOverlay] = useState<OverlayMode>('data')

  const handleReorder = useCallback((next: AssetData[]) => {
    setOrderedAssets(next)
    try {
      localStorage.setItem(`story-order-${id}`, JSON.stringify(next.map(a => a.id)))
    } catch {}
    setSaveFlash(true)
  }, [id])

  const storyAssets = orderedAssets
  const connectedArticles = story.articleIds.map(aid => articleMap[aid]).filter(Boolean)
  const relatedStories = story.recommendedStoryIds.map(sid => storyMap[sid]).filter(Boolean)
  const creatorStories = stories.filter(s => s.creatorId === story.creatorId && s.id !== story.id)
  const geoStories = stories.filter(s =>
    s.id !== story.id &&
    (s.primaryGeography === story.primaryGeography || story.secondaryGeographies.includes(s.primaryGeography))
    && !relatedStories.find(rs => rs.id === s.id)
    && !creatorStories.find(cs => cs.id === s.id)
  ).slice(0, 2)

  // Format breakdown
  const formatCounts: Record<string, number> = {}
  storyAssets.forEach(a => { formatCounts[a.format] = (formatCounts[a.format] || 0) + 1 })
  const formats = Object.entries(formatCounts)

  // Filtered assets
  const filteredAssets = formatFilter === 'all'
    ? storyAssets
    : storyAssets.filter(a => a.format === formatFilter)

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <main>
        <div className="w-[min(calc(100%-2rem),1080px)] mx-auto py-10">

          {/* ── Story header with cover + right rail ── */}
          <div className="flex gap-8 mb-8">
            {/* Left: cover image + title & description */}
            <div className="flex-1 min-w-0">
              {/* Cover image */}
              {(() => {
                const coverId = orderedAssets[0]?.id || story.heroAssetId
                return coverId ? (
                  <div
                    className="aspect-video overflow-hidden bg-slate-100 mb-6 relative border-2 border-transparent hover:border-[#0000ff] transition-colors"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[#0000ff]') }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-[#0000ff]') }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-[#0000ff]')
                      const droppedId = e.dataTransfer.getData('text/lightbox-item')
                      if (droppedId) {
                        const idx = orderedAssets.findIndex(a => a.id === droppedId)
                        if (idx > 0) {
                          const next = [...orderedAssets]
                          const [moved] = next.splice(idx, 1)
                          next.unshift(moved)
                          handleReorder(next)
                        }
                      }
                    }}
                  >
                    <img src={resolveProtectedUrl(coverId, 'thumbnail')} alt={story.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 left-2 text-[8px] font-bold uppercase tracking-widest text-white/60">
                      Drag an asset here to set cover
                    </span>
                  </div>
                ) : null
              })()}

              <h1 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold text-black tracking-tight leading-[1.1] mb-3">
                {story.title}
              </h1>
              <p className="text-base text-slate-500 leading-relaxed">{story.dek}</p>
              {story.summary !== story.dek && (
                <p className="text-sm text-slate-400 leading-relaxed mt-3">{story.summary}</p>
              )}
            </div>

            {/* Right rail: creator + metadata */}
            <div className="hidden lg:block w-[280px] shrink-0 border-l-2 border-[#0b1220] pl-6">
              <div className="flex flex-col gap-4">
                {/* Creator */}
                {creator && (
                  <div className="pb-4 border-b border-slate-200">
                    <Link
                      href={`/creator/${creator.slug}/frontfolio`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-slate-200 border-2 border-black overflow-hidden shrink-0">
                        {creator.avatarRef ? (
                          <img src={creator.avatarRef} alt={creator.name} className="w-full h-full object-cover" style={{ objectPosition: getAvatarCrop(creator.slug) }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-slate-400">
                            {creator.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-black group-hover:text-[#0000ff] transition-colors">
                          {creator.name}
                        </span>
                        <span className="block text-[11px] text-slate-400">{creator.locationBase}</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3 mt-3 ml-[52px]">
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="Website">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      </a>
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="Instagram">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><path d="M17.5 6.5h.01" /></svg>
                      </a>
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="X / Twitter">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                      </a>
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="LinkedIn">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
                      </a>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#0000ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  <span className="text-lg font-bold text-black">{storyAssets.length}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Coverage</span>
                  <span className="text-xs font-mono text-black">{story.coverageWindow.start}</span>
                  <span className="text-xs text-slate-400 mx-1">–</span>
                  <span className="text-xs font-mono text-black">{story.coverageWindow.end}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Geography</span>
                  <span className="text-xs font-bold text-black">{story.primaryGeography.replace('geo-', '').replace(/-/g, ' ')}</span>
                </div>
                {connectedArticles.length > 0 && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Articles</span>
                    <span className="text-lg font-bold text-black">{connectedArticles.length}</span>
                  </div>
                )}
                {story.topicTags.length > 0 && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Topics</span>
                    <div className="flex flex-wrap gap-1">
                      {story.topicTags.map(tag => (
                        <span key={tag} className="inline-flex items-center h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider border-2 border-black bg-white text-black">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {creator && (
                  <div className="pt-3 border-t border-slate-200">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Appears in</span>
                    <Link
                      href={`/creator/${creator.slug}/frontfolio`}
                      className="block border-2 border-slate-200 p-3 hover:border-black transition-colors"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#0000ff]">Frontfolio</span>
                      <p className="text-sm font-bold text-black mt-1 leading-tight">{creator.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{creator.locationBase}</p>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Story assets — canonical search grid ── */}
          <div className="mt-8 border-t-2 border-black" />
          <GridToolbar
            filters={[
              { label: 'All', value: 'all', count: storyAssets.length },
              ...formats.map(([format, count]) => ({ label: format, value: format, count })),
            ]}
            activeFilters={new Set([formatFilter])}
            onToggleFilter={(f) => setFormatFilter(f as FormatFilter)}
            overlay={overlay}
            onOverlayChange={setOverlay}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            borderTop={false}
          />

          <div className={`${gridLayoutClass(viewMode)} mt-4`}>
            {filteredAssets.map(asset => (
              <AssetCard key={asset.id} asset={asset} overlay={overlay} />
            ))}
          </div>

          {/* ── Related content ── */}
          <RelatedContent
            connectedArticles={connectedArticles}
            relatedStories={relatedStories}
            creatorStories={creatorStories}
            geoStories={geoStories}
            storyId={story.id}
            storyTags={story.topicTags}
            storyGeography={story.primaryGeography}
            storyAssetIds={story.assetIds}
            creatorId={story.creatorId}
          />

        </div>
      </main>
    </div>
  )
}

// ── Save indicator ─────────────────────────────────

function SaveIndicator({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="flex items-center gap-1.5 mb-2 animate-in fade-in duration-150">
      <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-[#0000ff]">
        <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#0000ff]">Order saved</span>
    </div>
  )
}

// ── Draggable asset grid ───────────────────────────

function DraggableAssetGrid({
  assets,
  onReorder,
  allAssets,
  viewMode,
  overlay,
}: {
  assets: AssetData[]
  onReorder: (a: AssetData[]) => void
  allAssets: AssetData[]
  viewMode: ViewMode
  overlay: OverlayMode
}) {
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setOverIdx(idx)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault()
    const from = dragIdx.current
    if (from === null || from === dropIdx) { setOverIdx(null); return }
    // Reorder in full list
    const fromAsset = assets[from]
    const toAsset = assets[dropIdx]
    const fullFrom = allAssets.indexOf(fromAsset)
    const fullTo = allAssets.indexOf(toAsset)
    if (fullFrom === -1 || fullTo === -1) { setOverIdx(null); return }
    const next = [...allAssets]
    const [moved] = next.splice(fullFrom, 1)
    next.splice(fullTo, 0, moved)
    onReorder(next)
    dragIdx.current = null
    setOverIdx(null)
  }, [assets, allAssets, onReorder])

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null
    setOverIdx(null)
  }, [])

  return (
    <div className={`${gridLayoutClass(viewMode)} mb-10`}>
      {assets.map((asset, i) => {
        const isCover = allAssets.indexOf(asset) === 0
        const isDragOver = overIdx === i
        return (
          <div
            key={asset.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            className={`relative cursor-grab active:cursor-grabbing transition-all ${
              isDragOver ? 'scale-[1.03] ring-2 ring-[#0000ff]/60' : ''
            } ${isCover ? 'ring-2 ring-[#0000ff]' : ''}`}
          >
            <AssetCard asset={asset} showCreator={false} overlay={overlay} />
            {isCover && (
              <span className="absolute top-2 right-2 z-10 text-[8px] font-bold uppercase tracking-[0.12em] bg-[#0000ff] text-white px-2 py-0.5 leading-tight">
                Cover
              </span>
            )}
            <div className="absolute top-2 left-2 z-10 opacity-0 hover:opacity-100 transition-opacity">
              <div className="w-5 h-5 bg-black/60 flex items-center justify-center rounded-sm">
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-white">
                  <circle cx="4" cy="3" r="1" fill="currentColor" />
                  <circle cx="8" cy="3" r="1" fill="currentColor" />
                  <circle cx="4" cy="6" r="1" fill="currentColor" />
                  <circle cx="8" cy="6" r="1" fill="currentColor" />
                  <circle cx="4" cy="9" r="1" fill="currentColor" />
                  <circle cx="8" cy="9" r="1" fill="currentColor" />
                </svg>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Related content — unified canonical grid ─────────

function buildReason(matchingTags: string[], sameGeo: boolean, sameCreator: boolean): string {
  if (matchingTags.length > 0) return `Similar: ${matchingTags[0]}`
  if (sameGeo) return 'Same region'
  if (sameCreator) return 'Same creator'
  return ''
}

type RelatedType = 'All' | 'Articles' | 'Stories' | 'Suggested'

function RelatedContent({
  connectedArticles,
  relatedStories,
  creatorStories,
  geoStories,
  storyId,
  storyTags,
  storyGeography,
  storyAssetIds,
  creatorId,
}: {
  connectedArticles: (typeof articleMap)[string][]
  relatedStories: (typeof storyMap)[string][]
  creatorStories: (typeof storyMap)[string][]
  geoStories: (typeof storyMap)[string][]
  storyId: string
  storyTags: string[]
  storyGeography: string
  storyAssetIds: string[]
  creatorId: string
}) {
  const [activeFilter, setActiveFilter] = useState<RelatedType>('All')
  const [overlay, setOverlay] = useState<OverlayMode>('data')
  const [viewMode, setViewMode] = useState<ViewMode>('grid4')

  // All unique stories (related + creator + geo, deduplicated)
  const allStories = useMemo(() => {
    const seen = new Set<string>()
    const result: typeof relatedStories = []
    for (const s of [...relatedStories, ...creatorStories, ...geoStories]) {
      if (s && !seen.has(s.id)) { seen.add(s.id); result.push(s) }
    }
    return result
  }, [relatedStories, creatorStories, geoStories])

  // Suggested assets pool
  const pool = useMemo(() => {
    const excluded = new Set(storyAssetIds)
    const tagSet = new Set(storyTags.map(t => t.toLowerCase()))
    return allPlatformAssets
      .filter(a => !excluded.has(a.id))
      .map(a => {
        let score = 0
        const matchingTags = a.tags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 3
        if (a.geography === storyGeography) score += 2
        if (a.creatorId === creatorId) score += 1
        if (a.relatedStoryIds?.includes(storyId)) score += 4
        score += Math.random() * 0.5
        return { asset: a, score, reason: buildReason(matchingTags, a.geography === storyGeography, a.creatorId === creatorId) }
      })
      .sort((a, b) => b.score - a.score)
  }, [storyId, storyTags, storyGeography, storyAssetIds, creatorId])

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(12)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < pool.length && !loading) {
          setLoading(true)
          setTimeout(() => { setVisibleCount(prev => Math.min(prev + 12, pool.length)); setLoading(false) }, 400)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, pool.length, loading])

  const visibleSuggested = pool.slice(0, visibleCount)

  // Filter chips with counts
  const filters = [
    { label: 'All', value: 'All', count: connectedArticles.length + allStories.length + pool.length },
    ...(connectedArticles.length > 0 ? [{ label: 'Articles', value: 'Articles', count: connectedArticles.length }] : []),
    ...(allStories.length > 0 ? [{ label: 'Stories', value: 'Stories', count: allStories.length }] : []),
    ...(pool.length > 0 ? [{ label: 'Suggested', value: 'Suggested', count: pool.length }] : []),
  ]

  const showArticles = activeFilter === 'All' || activeFilter === 'Articles'
  const showStories = activeFilter === 'All' || activeFilter === 'Stories'
  const showSuggested = activeFilter === 'All' || activeFilter === 'Suggested'

  const hasContent = connectedArticles.length > 0 || allStories.length > 0 || pool.length > 0
  if (!hasContent) return null

  return (
    <section className="mb-10">
      <SectionHeader label="Related" sublabel="Connected content and suggestions" />
      <GridToolbar
        filters={filters}
        activeFilters={new Set([activeFilter])}
        onToggleFilter={(f) => setActiveFilter(f as RelatedType)}
        overlay={overlay}
        onOverlayChange={setOverlay}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        borderTop={false}
      />

      <div className={`${gridLayoutClass(viewMode)} mt-4`}>
        {showArticles && connectedArticles.map(a => (
          <ArticleCard key={`a-${a.id}`} article={a} reason="Connected article" />
        ))}
        {showStories && allStories.map(s => (
          <StoryCard key={`s-${s.id}`} story={s} />
        ))}
        {showSuggested && visibleSuggested.map(({ asset, reason }) => (
          <AssetCard key={`r-${asset.id}`} asset={asset} showCreator overlay={overlay} reason={reason} />
        ))}
      </div>

      {showSuggested && loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finding more</span>
        </div>
      )}
      {showSuggested && visibleCount < pool.length && <div ref={sentinelRef} className="h-1" />}
      {showSuggested && visibleCount >= pool.length && pool.length > 0 && (
        <div className="text-center py-8 border-t border-slate-200 mt-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            {pool.length} suggestions · End of results
          </span>
        </div>
      )}
    </section>
  )
}
