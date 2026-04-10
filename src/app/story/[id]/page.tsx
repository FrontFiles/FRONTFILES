'use client'

import { use, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/discovery/SectionHeader'
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
      <div className="min-h-screen bg-white flex items-center justify-center">
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
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">

          {/* ── Creator banner ────────────────────── */}
          {creator && (
            <Link
              href={`/creator/${creator.slug}`}
              className="flex items-center gap-3 mb-8 group"
            >
              <div className="w-10 h-10 bg-slate-200 border-2 border-black overflow-hidden shrink-0">
                {creator.avatarRef ? (
                  <img src={creator.avatarRef} alt={creator.name} className="w-full h-full object-cover" />
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
          )}

          {/* ── Story title & description ─────────── */}
          <div className="mb-8">
            <h1 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold text-black tracking-tight leading-[1.1] mb-3">
              {story.title}
            </h1>
            <p className="text-base text-slate-500 leading-relaxed max-w-3xl">{story.dek}</p>
            {story.summary !== story.dek && (
              <p className="text-sm text-slate-400 leading-relaxed mt-3 max-w-3xl">{story.summary}</p>
            )}
          </div>

          {/* ── Story metadata strip ──────────────── */}
          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">
            <span>{storyAssets.length} assets</span>
            <span>{story.coverageWindow.start} – {story.coverageWindow.end}</span>
            <span>{story.primaryGeography}</span>
            {connectedArticles.length > 0 && (
              <span>{connectedArticles.length} article{connectedArticles.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* ── Format selector + Add all to lightbox ── */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFormatFilter('all')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 transition-colors ${
                  formatFilter === 'all'
                    ? 'border-black bg-black text-white'
                    : 'border-slate-200 text-slate-400 hover:border-black hover:text-black'
                }`}
              >
                All {storyAssets.length}
              </button>
              {formats.map(([format, count]) => (
                <button
                  key={format}
                  onClick={() => setFormatFilter(format)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 transition-colors ${
                    formatFilter === format
                      ? 'border-black bg-black text-white'
                      : 'border-slate-200 text-slate-400 hover:border-black hover:text-black'
                  }`}
                >
                  {format} {count}
                </button>
              ))}
            </div>
            <button className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors">
              Add all to Lightbox
            </button>
          </div>

          {/* ── Asset grid ────────────────────────── */}
          {saveFlash && <SaveIndicator onDone={() => setSaveFlash(false)} />}
          <DraggableAssetGrid assets={filteredAssets} onReorder={handleReorder} allAssets={storyAssets} />

          {/* ── Connected Articles ────────────────── */}
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

          {/* ── Related Stories ───────────────────── */}
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

          {/* ── More from this creator ────────────── */}
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

          {/* ── Same geography ────────────────────── */}
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

          {/* ── Suggested for you ─────────────────── */}
          <InfiniteRecommendations
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
}: {
  assets: AssetData[]
  onReorder: (a: AssetData[]) => void
  allAssets: AssetData[]
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
    <div className="grid grid-cols-3 gap-4 mb-10">
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
            <AssetCard asset={asset} showCreator={false} disablePreview />
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

// ── Infinite scroll recommendations ────────────────

const BATCH_SIZE = 6

function InfiniteRecommendations({
  storyId,
  storyTags,
  storyGeography,
  storyAssetIds,
  creatorId,
}: {
  storyId: string
  storyTags: string[]
  storyGeography: string
  storyAssetIds: string[]
  creatorId: string
}) {
  // Build a scored pool of all assets not in this story
  const pool = useMemo(() => {
    const excluded = new Set(storyAssetIds)
    const tagSet = new Set(storyTags.map(t => t.toLowerCase()))

    return allPlatformAssets
      .filter(a => !excluded.has(a.id))
      .map(a => {
        let score = 0
        // Tag overlap
        const matchingTags = a.tags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 3
        // Same geography
        if (a.geography === storyGeography) score += 2
        // Same creator (familiar work)
        if (a.creatorId === creatorId) score += 1
        // Related to this story directly
        if (a.relatedStoryIds?.includes(storyId)) score += 4
        // Variety bonus for different formats
        score += Math.random() * 0.5 // slight shuffle within same score
        return { asset: a, score, reason: buildReason(matchingTags, a.geography === storyGeography, a.creatorId === creatorId) }
      })
      .sort((a, b) => b.score - a.score)
  }, [storyId, storyTags, storyGeography, storyAssetIds, creatorId])

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < pool.length && !loading) {
          setLoading(true)
          // Simulate network delay
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
        <p className="text-xs text-slate-400 mt-1">Based on this story's subject, geography, and your browsing</p>
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

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finding more</span>
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      {visibleCount < pool.length && (
        <div ref={sentinelRef} className="h-1" />
      )}

      {/* End state */}
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
