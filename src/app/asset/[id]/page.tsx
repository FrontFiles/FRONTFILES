'use client'

import { use, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'
import {
  assetMap,
  storyMap,
  articleMap,
  creatorMap,
  publicAssets,
  assets as allPlatformAssets,
  type AssetData,
} from '@/data'

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const asset = assetMap[id]

  if (!asset) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Asset not found.</p>
      </div>
    )
  }

  const creator = creatorMap[asset.creatorId]
  const story = storyMap[asset.storyId]

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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">

          {/* ── Format identification (top) ────────── */}
          <div className="mb-6">
            <span className="inline-block text-xs font-black uppercase tracking-[0.18em] bg-[#0000ff] text-white px-3 py-1">
              {asset.format}
            </span>
          </div>

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

          {/* ── Title + Description ──────────────── */}
          <div className="mb-6">
            <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold text-black tracking-tight leading-[1.1] mb-3">
              {asset.title}
            </h1>
            <p className="text-base text-slate-500 leading-relaxed max-w-3xl">{asset.description}</p>
          </div>

          {/* ── Format-specific viewer ────────────── */}
          <div className="mb-6">
            <FormatViewer asset={asset} />
          </div>

          {/* ── Metadata strip ───────────────────── */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-4">
            <span>{asset.mediaTypeDisplay}</span>
            <span>{asset.locationLabel}</span>
            <span>{asset.captureDate}</span>
            <span>{asset.aspectRatio}</span>
            {asset.durationSeconds && (
              <span>{Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}</span>
            )}
            {asset.wordCount && <span>{asset.wordCount} words</span>}
            <ValidationBadge state={asset.validationDeclaration} />
          </div>

          {/* ── Action row: lightbox + price ──────── */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest border-2 border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors">
                Add to Lightbox
              </button>
              <button className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest bg-[#0000ff] text-white hover:bg-[#0000cc] transition-colors border-2 border-[#0000ff]">
                License this asset
              </button>
            </div>
            {asset.price && (
              <span className="text-lg font-bold font-mono text-black">
                &euro;{asset.price}
              </span>
            )}
          </div>

          {/* ── Tags ─────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5 mb-8">
            {asset.tags.map(t => (
              <Link
                key={t}
                href={`/search?q=${encodeURIComponent(t)}`}
                className="text-[10px] font-bold uppercase tracking-wider border-2 border-slate-200 px-2.5 py-1 text-slate-500 hover:border-black hover:text-black transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>

          {/* ── Part of Story ────────────────────── */}
          {story && (
            <Link
              href={`/story/${story.id}`}
              className="block border-2 border-slate-200 p-5 mb-10 hover:border-black transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]">Part of Story</span>
              <p className="text-base font-bold text-black mt-1">{story.title}</p>
              <p className="text-xs text-slate-400 mt-1">
                {story.assetIds.length} assets · {story.coverageWindow.start} – {story.coverageWindow.end}
              </p>
            </Link>
          )}

          {/* ── More from this Story ─────────────── */}
          {storyAssets.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="More from this Story" sublabel={story?.title} />
              <div className="grid grid-cols-3 gap-4">
                {storyAssets.slice(0, 6).map(a => (
                  <AssetCard key={a.id} asset={a} size="compact" showCreator={false} />
                ))}
              </div>
            </section>
          )}

          {/* ── Related assets ───────────────────── */}
          {relatedAssets.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Related assets" />
              <div className="grid grid-cols-3 gap-4">
                {relatedAssets.slice(0, 6).map(a => (
                  <AssetCard key={a.id} asset={a} size="compact" showCreator />
                ))}
              </div>
            </section>
          )}

          {/* ── Connected Articles ────────────────── */}
          {allArticles.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Connected Articles" sublabel="Source-linked coverage" />
              <div className="flex flex-col gap-4">
                {allArticles.map(a => (
                  <ArticleCard key={a.id} article={a} reason="Connected article" />
                ))}
              </div>
            </section>
          )}

          {/* ── Related Stories ───────────────────── */}
          {relatedStories.length > 0 && (
            <section className="mb-10">
              <SectionLabel label="Related Stories" sublabel="Related coverage" />
              <div className="grid grid-cols-2 gap-4">
                {relatedStories.map(s => (
                  <StoryCard key={s.id} story={s} reason="Related coverage" />
                ))}
              </div>
            </section>
          )}

          {/* ── Suggested for you (infinite scroll) ── */}
          <InfiniteRecommendations
            assetId={asset.id}
            tags={asset.tags}
            geography={asset.geography}
            creatorId={asset.creatorId}
            storyId={asset.storyId}
            relatedAssetIds={asset.relatedAssetIds}
          />
        </div>
      </main>
    </div>
  )
}

// ── Section label (matching story/collection pattern) ──

function SectionLabel({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4 border-b border-slate-200 pb-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">{label}</h2>
      {sublabel && <span className="text-xs text-slate-400">{sublabel}</span>}
    </div>
  )
}

// ── Format-specific viewers ───────────────────────────

function FormatViewer({ asset }: { asset: AssetData }) {
  switch (asset.format) {
    case 'Text':
      return <TextViewer asset={asset} />
    case 'Audio':
      return <AudioViewer asset={asset} />
    case 'Video':
      return <VideoViewer asset={asset} />
    case 'Photo':
      return <ImageViewer asset={asset} />
    case 'Illustration':
      return <ImageViewer asset={asset} />
    case 'Vector':
      return <ImageViewer asset={asset} />
    case 'Infographic':
      return <InfographicViewer asset={asset} />
    default:
      return <ImageViewer asset={asset} />
  }
}

// ── Photo / Illustration / Vector viewer ──────────────

function ImageViewer({ asset }: { asset: AssetData }) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <>
      <div
        className="relative bg-slate-50 border-2 border-black overflow-hidden cursor-zoom-in"
        onClick={() => setZoomed(true)}
      >
        {asset.thumbnailRef ? (
          <img
            src={asset.thumbnailRef}
            alt={asset.title}
            className="w-full h-auto object-contain"
            style={{ maxHeight: '70vh' }}
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center">
            <span className="text-sm font-bold font-mono text-black/20">{asset.format}</span>
          </div>
        )}
      </div>

      {/* Lightbox overlay */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={() => setZoomed(false)}
            className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {asset.thumbnailRef && (
            <img
              src={asset.thumbnailRef}
              alt={asset.title}
              className="max-w-[90vw] max-h-[90vh] object-contain"
            />
          )}
        </div>
      )}
    </>
  )
}

// ── Infographic viewer (taller, scrollable) ───────────

function InfographicViewer({ asset }: { asset: AssetData }) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <>
      <div
        className="relative bg-white border-2 border-black overflow-hidden cursor-zoom-in"
        onClick={() => setZoomed(true)}
      >
        {asset.thumbnailRef ? (
          <img
            src={asset.thumbnailRef}
            alt={asset.title}
            className="w-full h-auto"
          />
        ) : (
          <div className="w-full aspect-[3/4] flex items-center justify-center">
            <span className="text-sm font-bold font-mono text-black/20">INFOGRAPHIC</span>
          </div>
        )}
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out overflow-auto"
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={() => setZoomed(false)}
            className="absolute top-6 right-6 z-10 text-white/60 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {asset.thumbnailRef && (
            <img
              src={asset.thumbnailRef}
              alt={asset.title}
              className="max-w-[90vw] max-h-none object-contain"
            />
          )}
        </div>
      )}
    </>
  )
}

// ── Video viewer ──────────────────────────────────────

function VideoViewer({ asset }: { asset: AssetData }) {
  return (
    <div className="border-2 border-black overflow-hidden bg-black">
      {asset.videoUrl ? (
        <video
          src={asset.videoUrl}
          controls
          className="w-full aspect-video object-contain"
          poster={asset.thumbnailRef || undefined}
        />
      ) : asset.thumbnailRef ? (
        <div className="relative aspect-video">
          <img src={asset.thumbnailRef} alt={asset.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-white/80 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
          {asset.durationSeconds && (
            <span className="absolute bottom-3 right-3 text-[10px] font-bold bg-black/80 text-white px-2 py-0.5 font-mono">
              {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video flex items-center justify-center bg-black">
          <span className="text-sm font-bold font-mono text-white/20">VIDEO</span>
        </div>
      )}
    </div>
  )
}

// ── Audio viewer ──────────────────────────────────────

function AudioViewer({ asset }: { asset: AssetData }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause() } else { audioRef.current.play().catch(() => {}) }
    setPlaying(!playing)
  }

  const bars = [0.3,0.5,0.8,0.4,1,0.6,0.9,0.35,0.7,0.5,0.85,0.4,0.6,0.9,0.3,0.7,0.5,0.8,0.45,0.65,0.3,0.5,0.8,0.4,1,0.6,0.9,0.35,0.7,0.5,0.85,0.4,0.6,0.9,0.3,0.7,0.5,0.8,0.45,0.65]

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="border-2 border-black">
      <div className="bg-black px-6 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Audio</span>
        {asset.durationSeconds && (
          <span className="text-[10px] font-mono text-white/50">
            {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="bg-black px-6 py-10 flex flex-col items-center gap-6">
        <audio
          ref={audioRef}
          src={asset.audioUrl}
          preload="metadata"
          onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration) }}
          onTimeUpdate={() => { if (audioRef.current && duration) setProgress(audioRef.current.currentTime / duration) }}
          onEnded={() => setPlaying(false)}
        />

        {/* Waveform */}
        <div className="flex items-end gap-[3px] h-20 w-full max-w-2xl justify-center">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`w-[5px] transition-colors ${i / bars.length <= progress ? 'bg-[#0000ff]/70' : 'bg-white/20'}`}
              style={{ height: `${h * 100}%`, animation: playing ? `audioBar 0.8s ease-in-out ${i * 0.05}s infinite alternate` : 'none' }}
            />
          ))}
        </div>
        <style>{`@keyframes audioBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>

        {/* Time */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-white/40">
          <span>{duration > 0 ? formatTime(progress * duration) : '0:00'}</span>
          <span>/</span>
          <span>{duration > 0 ? formatTime(duration) : (asset.durationSeconds ? formatTime(asset.durationSeconds) : '0:00')}</span>
        </div>

        {/* Play button */}
        <button onClick={toggle} className="w-14 h-14 border-2 border-white/60 flex items-center justify-center hover:border-white transition-colors">
          {playing ? (
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Text viewer ───────────────────────────────────────

function TextViewer({ asset }: { asset: AssetData }) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    if (asset.textUrl) {
      fetch(asset.textUrl).then(r => r.text()).then(setText).catch(() => {})
    }
  }, [asset.textUrl])

  const handleDownload = () => {
    const content = text || asset.textExcerpt || ''
    if (!content) return
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${asset.slug || asset.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border-2 border-black">
      <div className="bg-black px-6 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Text</span>
        <div className="flex items-center gap-4">
          {asset.wordCount && <span className="text-[10px] font-mono text-white/50">{asset.wordCount} words</span>}
          <button onClick={handleDownload} className="text-[10px] font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 px-3 py-1 transition-colors flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      </div>
      <div className="bg-white p-8 max-h-[70vh] overflow-y-auto relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="text-[80px] font-black uppercase tracking-[0.2em] text-black/[0.03] rotate-[-30deg] whitespace-nowrap select-none">LICENSABLE</span>
        </div>
        <div className="max-w-[680px] mx-auto relative z-10" style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={e => e.preventDefault()}>
          {text ? (
            <p className="text-[15px] leading-[1.9] text-black/80 font-serif whitespace-pre-line">{text}</p>
          ) : asset.textExcerpt ? (
            <p className="text-[15px] leading-[1.9] text-black/80 font-serif whitespace-pre-line">{asset.textExcerpt}</p>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No text content available for preview.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Infinite scroll recommendations ───────────────────

const BATCH_SIZE = 6

function InfiniteRecommendations({
  assetId,
  tags,
  geography,
  creatorId,
  storyId,
  relatedAssetIds,
}: {
  assetId: string
  tags: string[]
  geography: string
  creatorId: string
  storyId: string
  relatedAssetIds: string[]
}) {
  const pool = useMemo(() => {
    const excluded = new Set([assetId, ...relatedAssetIds])
    const tagSet = new Set(tags.map(t => t.toLowerCase()))
    const relatedSet = new Set(relatedAssetIds)

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
        return { asset: a, score, reason: buildReason(matchingTags, a.geography === geography, a.creatorId === creatorId) }
      })
      .sort((a, b) => b.score - a.score)
  }, [assetId, tags, geography, creatorId, storyId, relatedAssetIds])

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
        <p className="text-xs text-slate-400 mt-1">Based on this asset's subject, geography, and your browsing</p>
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
