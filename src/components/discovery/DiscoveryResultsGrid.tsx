'use client'

// ═══════════════════════════════════════════════════════════════
// Frontfiles — Discovery Results Grid
//
// The unified feed renderer for the Discovery (search) surface.
// Extracted verbatim from `src/app/search/page.tsx` (the inline
// 200-line render block) so the grid can be re-used inside the
// new conversation-band layout without duplicating render logic.
//
// ZERO BEHAVIOUR CHANGE from the inline original:
//
//   - Same per-type render branches (asset / story / article /
//     creator / collection)
//   - Same per-viewMode branches (grid4 / grid2 / grid1 / list)
//   - Same hover/select sync class (`ring-2 ring-[#0000ff]
//     ring-inset`) and `data-result-id` data attribute
//   - Same `feedItemKey` id format — exported here as the source
//     of truth so the page-level map point conversion stays in
//     lockstep
//   - Same empty / loading / end-of-feed states
//
// This component is PURE PRESENTATION:
//   - No data fetching, no router calls
//   - All state (visibleCount, viewMode, hover/select ids, area
//     filter) is owned by the parent and passed in
//   - The infinite-scroll sentinel ref is passed in by the parent
//     so the parent's IntersectionObserver keeps owning the
//     pagination policy
//
// SCOPE: Discovery feed only. The map-side rendering
// (`feedItemToMapPoint` in page.tsx) consumes the SAME id format
// via the exported `feedItemKey` helper.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import type { RefObject } from 'react'
import { gridLayoutClass } from '@/lib/grid-layout'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import { getAvatarCrop } from '@/lib/avatar-crop'
import { assetMap, creatorMap } from '@/data'
import type {
  AssetData,
  StoryData,
  ArticleData,
  Creator,
  CollectionData,
} from '@/data'
import { AssetCard } from './AssetCard'
import { StoryCard } from './StoryCard'
import { ArticleCard } from './ArticleCard'
import { ValidationBadge } from './ValidationBadge'

// ─── FeedItem ────────────────────────────────────────────────
//
// The single unified shape the Discovery feed iterates over.
// The parent (SearchPage) builds the items by tagging each row
// with its type and a relevance score; this component is the
// only place that branches on `item.type` for rendering.
//
// Defined here (not in @/data) because it is a Discovery-specific
// projection over the canonical data types — it doesn't belong
// to the data layer, it belongs to the grid that consumes it.

export type DiscoveryFeedItem =
  | { type: 'asset'; data: AssetData; relevance: number }
  | { type: 'story'; data: StoryData; relevance: number }
  | { type: 'article'; data: ArticleData; relevance: number }
  | { type: 'creator'; data: Creator; relevance: number }
  | { type: 'collection'; data: CollectionData; relevance: number }

// ─── feedItemKey ─────────────────────────────────────────────
//
// Stable identity for a feed item. The format is the id contract
// shared by:
//   - this grid (used as React key, data attribute, hover/select
//     sync id)
//   - the page's `feedItemToMapPoint` and map↔grid sync state
//   - any future agent panel that wants to highlight a row
//
// Exported here so any consumer that needs a feed-item id calls
// the same function and the format stays in lockstep.

export function feedItemKey(item: DiscoveryFeedItem): string {
  switch (item.type) {
    case 'asset':      return `asset-${item.data.id}`
    case 'story':      return `s-${item.data.id}`
    case 'article':    return `a-${item.data.id}`
    case 'creator':    return `c-${item.data.id}`
    case 'collection': return `col-${item.data.id}`
  }
}

// ─── ViewMode + Overlay (re-exported from grid-layout / AssetCard) ─

export type DiscoveryViewMode = 'grid4' | 'grid2' | 'grid1' | 'list'
export type DiscoveryOverlayMode = 'off' | 'data' | 'magnify'

// ─── Component props ─────────────────────────────────────────

export interface DiscoveryResultsGridProps {
  /**
   * The (potentially area-filtered) feed items the grid should
   * render. Already sorted by relevance upstream — this component
   * only slices by `visibleCount` and renders.
   */
  items: ReadonlyArray<DiscoveryFeedItem>

  /**
   * Total feed length BEFORE the area filter, used by the
   * "X of Y results" end-of-feed footer. When `items.length`
   * equals this number, the grid omits the "of Y" suffix.
   */
  totalFeedCount: number

  /** How many items to render. The parent owns infinite-scroll. */
  visibleCount: number

  /** Loading spinner is rendered when the parent says so. */
  feedLoading: boolean

  /**
   * Sentinel for the parent's IntersectionObserver. The grid
   * mounts the div but never observes it — the parent observer
   * lives in SearchPage and drives `visibleCount` from there.
   */
  feedSentinelRef: RefObject<HTMLDivElement | null>

  viewMode: DiscoveryViewMode
  overlay: DiscoveryOverlayMode

  /** Hover/select sync ids. Match `feedItemKey(item)` exactly. */
  hoveredResultId: string | null
  selectedResultId: string | null
  onHoverChange: (id: string | null) => void

  /**
   * Whether an area filter is currently applied. Used only by the
   * empty-state copy and the "Clear area filter" button. The grid
   * itself never reads bounds.
   */
  hasAreaFilter: boolean
  onClearAreaFilter: () => void
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function DiscoveryResultsGrid({
  items,
  totalFeedCount,
  visibleCount,
  feedLoading,
  feedSentinelRef,
  viewMode,
  overlay,
  hoveredResultId,
  selectedResultId,
  onHoverChange,
  hasAreaFilter,
  onClearAreaFilter,
}: DiscoveryResultsGridProps) {
  if (items.length === 0) {
    return (
      <div className="border border-black/10 py-12 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-black/25">
          {hasAreaFilter ? 'No results in this area' : 'No results found'}
        </p>
        <p className="text-[10px] text-black/15 mt-1">
          {hasAreaFilter
            ? `Clear the area filter to see all ${totalFeedCount} results.`
            : 'Try a broader search or remove format filters.'}
        </p>
        {hasAreaFilter && (
          <button
            type="button"
            onClick={onClearAreaFilter}
            className="mt-3 text-[10px] font-bold uppercase tracking-widest px-3 py-1 border border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors"
          >
            Clear area filter
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* List view column headers */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-4 px-3 py-1.5 border-b border-black/15 mb-0">
          <span className="w-16 shrink-0 text-[8px] font-bold uppercase tracking-widest text-black/40">Preview</span>
          <span className="w-[80px] shrink-0 text-[8px] font-bold uppercase tracking-widest text-black/40">Type</span>
          <span className="w-[60px] shrink-0 text-[8px] font-bold uppercase tracking-widest text-black/40">ID</span>
          <span className="flex-1 min-w-0 text-[8px] font-bold uppercase tracking-widest text-black/40">Title</span>
          <span className="w-[120px] shrink-0 text-[8px] font-bold uppercase tracking-widest text-black/40">Creator</span>
          <span className="w-[120px] shrink-0 text-[8px] font-bold uppercase tracking-widest text-black/40">Location</span>
          <span className="w-[80px] shrink-0 text-[8px] font-bold uppercase tracking-widest text-black/40">Date</span>
          <span className="w-[60px] shrink-0 text-[8px] font-bold uppercase tracking-widest text-black/40 text-right">Price</span>
          <span className="w-[20px] shrink-0" />
        </div>
      )}

      <div className={gridLayoutClass(viewMode)}>
        {items.slice(0, visibleCount).map(item => {
          const syncId = feedItemKey(item)
          const isHoverSynced =
            hoveredResultId === syncId || selectedResultId === syncId
          const syncClass = isHoverSynced
            ? 'ring-2 ring-[#0000ff] ring-inset'
            : ''

          const wrap = (node: React.ReactNode) => (
            <div
              key={syncId}
              data-result-id={syncId}
              onMouseEnter={() => onHoverChange(syncId)}
              onMouseLeave={() => {
                // Only clear hover if WE were the current hover —
                // mirrors the page.tsx prev=>prev?null pattern so a
                // race between two hovers doesn't accidentally clear
                // the wrong one.
                if (hoveredResultId === syncId) onHoverChange(null)
              }}
              className={syncClass}
            >
              {node}
            </div>
          )

          const render = (() => {
            if (viewMode === 'list') {
              // List view — horizontal row for all types
              if (item.type === 'asset') {
                const a = item.data
                const c = creatorMap[a.creatorId]
                return (
                  <Link
                    key={`asset-${a.id}`}
                    href={`/asset/${a.id}`}
                    className="group flex items-center gap-4 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-16 h-12 shrink-0 bg-slate-100 overflow-hidden">
                      {a.id && <img src={resolveProtectedUrl(a.id, 'thumbnail')} alt={a.title} className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[#0000ff] w-[80px] shrink-0">{a.format}</span>
                    <span className="text-[9px] font-mono text-black/30 w-[60px] shrink-0">{a.id.replace('asset-', '')}</span>
                    <span className="text-[12px] font-bold text-black truncate flex-1 min-w-0 group-hover:text-[#0000ff] transition-colors">{a.title}</span>
                    <span className="text-[10px] text-black/50 w-[120px] shrink-0 truncate">{c?.name || '—'}</span>
                    <span className="text-[10px] text-black/40 w-[120px] shrink-0 truncate">{a.locationLabel}</span>
                    <span className="text-[9px] font-mono text-black/30 w-[80px] shrink-0">{a.captureDate}</span>
                    <span className="text-[11px] font-bold font-mono text-black w-[60px] shrink-0 text-right">
                      {a.price ? `€${a.price.toFixed(2)}` : '—'}
                    </span>
                    <div className="w-[20px] shrink-0 flex justify-center">
                      <ValidationBadge state={a.validationDeclaration} />
                    </div>
                  </Link>
                )
              }
              if (item.type === 'story') {
                const s = item.data
                const c = creatorMap[s.creatorId]
                return (
                  <Link
                    key={`s-${s.id}`}
                    href={`/story/${s.id}`}
                    className="group flex items-center gap-4 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-16 h-12 shrink-0 bg-slate-100 overflow-hidden">
                      {assetMap[s.heroAssetId] && <img src={resolveProtectedUrl(s.heroAssetId, 'thumbnail')} alt={s.title} className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[#0000ff] w-[80px] shrink-0">Story</span>
                    <span className="text-[9px] font-mono text-black/30 w-[60px] shrink-0">{s.assetIds.length} assets</span>
                    <span className="text-[12px] font-bold text-black truncate flex-1 min-w-0 group-hover:text-[#0000ff] transition-colors">{s.title}</span>
                    <span className="text-[10px] text-black/50 w-[120px] shrink-0 truncate">{c?.name || '—'}</span>
                    <span className="text-[10px] text-black/40 w-[120px] shrink-0 truncate">{s.coverageWindow.start}</span>
                    <span className="text-[9px] font-mono text-black/30 w-[80px] shrink-0"></span>
                    <span className="text-[11px] font-bold font-mono text-black w-[60px] shrink-0 text-right">—</span>
                    <div className="w-[20px] shrink-0" />
                  </Link>
                )
              }
              if (item.type === 'article') {
                const ar = item.data
                return (
                  <Link
                    key={`a-${ar.id}`}
                    href={`/article/${ar.id}`}
                    className="group flex items-center gap-4 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-16 h-12 shrink-0 bg-slate-100 overflow-hidden">
                      {assetMap[ar.heroAssetId] && <img src={resolveProtectedUrl(ar.heroAssetId, 'thumbnail')} alt={ar.title} className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[#0000ff] w-[80px] shrink-0">Article</span>
                    <span className="text-[9px] font-mono text-black/30 w-[60px] shrink-0"></span>
                    <span className="text-[12px] font-bold text-black truncate flex-1 min-w-0 group-hover:text-[#0000ff] transition-colors">{ar.title}</span>
                    <span className="text-[10px] text-black/50 w-[120px] shrink-0 truncate">{ar.editorName || ar.creatorName || '—'}</span>
                    <span className="text-[10px] text-black/40 w-[120px] shrink-0 truncate"></span>
                    <span className="text-[9px] font-mono text-black/30 w-[80px] shrink-0">{ar.publishedAt?.slice(0, 10)}</span>
                    <span className="text-[11px] font-bold font-mono text-black w-[60px] shrink-0 text-right">—</span>
                    <div className="w-[20px] shrink-0" />
                  </Link>
                )
              }
              if (item.type === 'collection') {
                const col = item.data
                return (
                  <Link
                    key={`col-${col.id}`}
                    href={`/collection/${col.id}`}
                    className="group flex items-center gap-4 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-16 h-12 shrink-0 bg-slate-100 overflow-hidden">
                      {assetMap[col.heroAssetId] && <img src={resolveProtectedUrl(col.heroAssetId, 'thumbnail')} alt={col.title} className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[#0000ff] w-[80px] shrink-0">Collection</span>
                    <span className="text-[9px] font-mono text-black/30 w-[60px] shrink-0">{col.assetIds.length} assets</span>
                    <span className="text-[12px] font-bold text-black truncate flex-1 min-w-0 group-hover:text-[#0000ff] transition-colors">{col.title}</span>
                    <span className="text-[10px] text-black/50 w-[120px] shrink-0 truncate">{col.creatorIds.length} creators</span>
                    <span className="text-[10px] text-black/40 w-[120px] shrink-0 truncate">{col.primaryGeography}</span>
                    <span className="text-[9px] font-mono text-black/30 w-[80px] shrink-0">{col.coverageWindow.start.slice(0, 10)}</span>
                    <span className="text-[11px] font-bold font-mono text-black w-[60px] shrink-0 text-right">—</span>
                    <div className="w-[20px] shrink-0" />
                  </Link>
                )
              }
              return null
            }

            // Grid views
            if (item.type === 'story') {
              return <StoryCard key={`s-${item.data.id}`} story={item.data} />
            }
            if (item.type === 'article') {
              return <ArticleCard key={`a-${item.data.id}`} article={item.data} />
            }
            if (item.type === 'collection') {
              const col = item.data
              const heroAsset = assetMap[col.heroAssetId]
              return (
                // 16:9 collection card. The previous `bg-[#0b1220]`
                // footer below the image has been folded into a
                // gradient overlay inside the aspect-video container
                // so every card type in the grid is the SAME shape.
                // The "Collection · N assets" badge stays top-left
                // and is always visible. Title / dek / meta sit at
                // the bottom over a from-black/85 gradient and are
                // also always visible (matching the creator card's
                // identity-always-visible treatment). Hover scales
                // the image slightly the same way the original did.
                <Link key={`col-${col.id}`} href={`/collection/${col.id}`} className="group block bg-black">
                  <div className="relative aspect-video overflow-hidden bg-slate-100">
                    {heroAsset?.id && (
                      <img
                        src={resolveProtectedUrl(heroAsset.id, 'thumbnail')}
                        alt={col.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    )}
                    {/* Top-left badge — always visible */}
                    <span className="absolute top-2 left-2 z-10 text-[8px] font-bold uppercase tracking-widest text-white bg-[#0000ff] px-2 py-0.5">
                      Collection · {col.assetIds.length} assets
                    </span>
                    {/* Bottom info — always visible, gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pt-6 pb-2">
                      <h3 className="font-bold text-white text-[13px] leading-tight line-clamp-2 group-hover:text-[#6666ff] transition-colors">{col.title}</h3>
                      <p className="text-[10px] text-white/60 mt-0.5 line-clamp-1">{col.dek}</p>
                      <p className="text-[9px] text-white/40 mt-0.5">{col.creatorIds.length} creators · {col.primaryGeography}</p>
                    </div>
                  </div>
                </Link>
              )
            }
            if (item.type === 'creator') {
              return <DiscoveryCreatorCard key={`c-${item.data.id}`} creator={item.data} />
            }
            // `watermarkMode="none"` disables the watermark overlay
            // for the Discovery grid context. The 236×133 thumbnails
            // are too small for the watermark to be useful (it just
            // creates visual noise on top of the image), and the IP
            // protection use case is covered by the 'detail-preview'
            // and 'share-preview' contexts on the larger surfaces.
            return <AssetCard key={`asset-${item.data.id}`} asset={item.data} overlay={overlay} watermarkMode="none" />
          })()
          return wrap(render)
        })}
      </div>

      {feedLoading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading more</span>
        </div>
      )}

      {visibleCount < items.length && (
        <div ref={feedSentinelRef} className="h-1" />
      )}

      {visibleCount >= items.length && items.length > 0 && (
        <div className="text-center py-8 border-t border-slate-200 mt-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            {items.length}{hasAreaFilter ? ` of ${totalFeedCount}` : ''} results · End
          </span>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// DiscoveryCreatorCard — search-result card for frontfiler
// profiles. Lifted from src/app/search/page.tsx (where it was
// a private helper) so the grid renderer is fully self-contained.
//
// Note: there is a SEPARATE `CreatorCard` inside DiscoveryMap.tsx
// for the map's creator pin; the two are unrelated and have
// different signatures. Renamed here to make the distinction
// unambiguous when grepping.
// ═══════════════════════════════════════════════════════════════

function DiscoveryCreatorCard({ creator }: { creator: Creator }) {
  return (
    // 16:9 creator card — uniform with every other card type in
    // the grid. Two changes from the previous shape:
    //   1. aspect-[4/3] → aspect-video (16:9) so creator rows
    //      align with asset/story/article/collection rows.
    //   2. The bottom `px-2.5 py-2` footer with the specialty
    //      tags is gone — specialties were a nice-to-have, not a
    //      decision-driver, and the footer was the reason the
    //      creator card overflowed the grid's row height. The
    //      first specialty is folded inline next to the location
    //      so the information isn't lost.
    // The trust badge stays top-left, name + location stays at
    // the bottom over the existing gradient overlay (always
    // visible, identity-first like the original).
    <Link
      href={`/creator/${creator.slug}/frontfolio`}
      className="group block bg-white border border-black/10 hover:border-black transition-colors overflow-hidden"
    >
      <div className="relative aspect-video bg-black/5 overflow-hidden">
        <img
          src={creator.avatarRef}
          alt={creator.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          style={{ objectPosition: getAvatarCrop(creator.slug) }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute top-2 left-2">
          <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 leading-none ${
            creator.trustBadge === 'verified' ? 'bg-[#0000ff] text-white' : 'bg-black text-white'
          }`}>
            {creator.trustBadge}
          </span>
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-white font-black text-[13px] leading-tight">{creator.name}</p>
          <p className="text-white/60 text-[9px] mt-0.5">
            {creator.locationBase}
            {creator.specialties[0] ? ` · ${creator.specialties[0]}` : ''}
          </p>
        </div>
      </div>
    </Link>
  )
}
