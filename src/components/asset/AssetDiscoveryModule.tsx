'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { AssetCard } from '@/components/discovery/AssetCard'
import { GridToolbar, type OverlayMode } from '@/components/discovery/GridToolbar'
import { gridLayoutClass, type ViewMode } from '@/lib/grid-layout'
import { assets as allPlatformAssets } from '@/data'

interface AssetDiscoveryModuleProps {
  assetId: string
  tags: string[]
  geography: string
  creatorId: string
  storyId: string | null
  relatedAssetIds: string[]
}

export function AssetDiscoveryModule({
  assetId,
  tags,
  geography,
  creatorId,
  storyId,
  relatedAssetIds,
}: AssetDiscoveryModuleProps) {
  return (
    <InfiniteRecommendations
      assetId={assetId}
      tags={tags}
      geography={geography}
      creatorId={creatorId}
      storyId={storyId}
      relatedAssetIds={relatedAssetIds}
    />
  )
}

// ── Infinite scroll recommendations ─────────────────────

const BATCH_SIZE = 6
const FORMATS = ['All', 'Photo', 'Video', 'Audio', 'Text', 'Illustration', 'Infographic', 'Vector']

function InfiniteRecommendations({
  assetId, tags, geography, creatorId, storyId, relatedAssetIds,
}: {
  assetId: string; tags: string[]; geography: string; creatorId: string; storyId: string | null; relatedAssetIds: string[]
}) {
  const pool = useMemo(() => {
    const excluded = new Set([assetId, ...relatedAssetIds])
    const tagSet = new Set(tags.map(t => t.toLowerCase()))

    return allPlatformAssets
      .filter(a => !excluded.has(a.id))
      .map(a => {
        let score = 0
        const matchingTags = a.tags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 3
        if (a.geography === geography) score += 2
        if (a.creatorId === creatorId) score += 1
        if (a.storyId === storyId) score += 3
        if (a.relatedAssetIds?.includes(assetId)) score += 4
        score += Math.random() * 0.5
        const reason = matchingTags.length > 0 ? `Similar: ${matchingTags[0]}` : a.geography === geography ? 'Same region' : a.creatorId === creatorId ? 'Same creator' : ''
        return { asset: a, score, reason }
      })
      .sort((a, b) => b.score - a.score)
  }, [assetId, tags, geography, creatorId, storyId, relatedAssetIds])

  const [formatFilter, setFormatFilter] = useState<string>('All')
  const [viewMode, setViewMode] = useState<ViewMode>('grid4')
  const [overlay, setOverlay] = useState<OverlayMode>('data')
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filtered = formatFilter === 'All' ? pool : pool.filter(p => p.asset.format === formatFilter)

  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [formatFilter])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < filtered.length && !loading) {
          setLoading(true)
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filtered.length))
            setLoading(false)
          }, 400)
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, filtered.length, loading])

  if (pool.length === 0) return null

  return (
    <section>
      <div className="border-t-2 border-[#0000ff] pt-2">
        <GridToolbar
          title="Related"
          filters={FORMATS.map(f => ({ label: f, value: f }))}
          activeFilters={new Set([formatFilter])}
          onToggleFilter={setFormatFilter}
          overlay={overlay}
          onOverlayChange={setOverlay}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          borderTop={false}
        />
      </div>
      <div className={`${gridLayoutClass(viewMode)} mt-6`}>
        {filtered.slice(0, visibleCount).map(({ asset, reason }) => (
          <div key={asset.id} className="relative">
            <AssetCard asset={asset} showCreator overlay={overlay} />
            {reason && <div className="mt-1.5"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">{reason}</span></div>}
          </div>
        ))}
      </div>
      {loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finding more</span>
        </div>
      )}
      {visibleCount < filtered.length && <div ref={sentinelRef} className="h-1" />}
      {visibleCount >= filtered.length && filtered.length > 0 && (
        <div className="text-center py-8 border-t border-slate-200 mt-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{filtered.length} results</span>
        </div>
      )}
    </section>
  )
}
