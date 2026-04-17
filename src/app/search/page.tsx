'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { GridToolbar, type OverlayMode } from '@/components/discovery/GridToolbar'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DiscoveryResultsGrid,
  feedItemKey,
  type DiscoveryFeedItem,
} from '@/components/discovery/DiscoveryResultsGrid'
import { type MapPoint } from '@/components/discovery/DiscoveryMap'
import { MapBand } from '@/components/discovery/MapBand'
import { GeoBoltControlGroup, type ContextualPanel } from '@/components/discovery/GeoBoltControlGroup'
import type { MapBounds } from '@/components/discovery/LeafletMap'
import { AssistantInput, FORMATS, ENTITY_FILTERS, FORMAT_FILTERS } from '@/components/discovery/AssistantInput'
import { LightboxTray } from '@/components/discovery/LightboxTray'
import { DiscoveryAgentPanel } from '@/components/discovery/DiscoveryAgentPanel'
import { DiscoveryConversationBand } from '@/components/discovery/DiscoveryConversationBand'
import { useDiscoveryAgent } from '@/hooks/useDiscoveryAgent'
import {
  searchableAssets,
  stories,
  articles,
  storyMap,
  assetMap,
  creatorMap,
  geographyMap,
  savedSearches,
  creators,
  collections,
  spotlightRanked,
} from '@/data'
import type { AssetData } from '@/data'
import { BoltPanel } from '@/components/discovery/BoltPanel'
import { useBoltSession } from '@/hooks/useBoltSession'
import { deriveScopeFromSearchParams } from '@/lib/bolt/scope'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import { CREATOR_COORDS, parseGeoContextFromQuery, type GeoContext } from '@/lib/search-data'

// Discovery refactor — Phase 1: results grid extracted into
// `@/components/discovery/DiscoveryResultsGrid`. Phase 2 will mount
// the new conversation band on top.

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') || ''
  const [formatFilters, setFormatFilters] = useState<Set<string>>(() => {
    const fmt = searchParams.get('fmt')
    return fmt ? new Set(fmt.split(',')) : new Set(['All'])
  })
  const [viewMode, setViewMode] = useState<'grid4' | 'grid2' | 'grid1' | 'list'>('grid4')
  // Shuffle after hydration to avoid server/client mismatch
  const [shuffleSeed, setShuffleSeed] = useState(0)
  useEffect(() => setShuffleSeed(Math.random()), [])
  const [overlay, setOverlay] = useState<OverlayMode>('data')
  // Geo map band — simple open/close toggle
  const [geoOpen, setGeoOpen] = useState(false)
  // Right-rail Lightbox is independent of the right column scroll —
  // it's a top-level sibling of the grid column with its own internal
  // scroll. `lightboxOpen` toggles between the full 320px rail and a
  // collapsed 48px trigger rail (mirror of the left Geo/BOLT rail).
  // Default to open so first-time users see the dock.
  const [lightboxOpen, setLightboxOpen] = useState(true)
  // The right column still owns its own scroll context (overflow-y-auto)
  // but no JS reads its scrollTop anymore — the slide-out sticky header
  // is gone in favour of the bottom DiscoveryConversationBand. Keeping
  // the ref so existing query-area-bounds settle logic that relies on
  // DOM mounting still has a stable hook for future use; nothing reads
  // it today so it costs nothing.
  const scrollColRef = useRef<HTMLDivElement>(null)
  const FEED_BATCH = 20
  const [visibleFeedCount, setVisibleFeedCount] = useState(FEED_BATCH)
  const [feedLoading, setFeedLoading] = useState(false)
  const feedSentinelRef = useRef<HTMLDivElement>(null)

  // ── Map ↔ grid sync state (additive; no global store) ──
  // Shared identity for the currently hovered / persistently selected result.
  // ID format matches the per-type key used in the grid render:
  //   asset-*, s-*, a-*, col-*, c-*  (see the map/wrap loop below)
  const [hoveredResultId, setHoveredResultId] = useState<string | null>(null)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  // Area filter: set live by debounced map bounds changes.
  const [queryAreaBounds, setQueryAreaBounds] = useState<MapBounds | null>(null)
  // Debounce timer for live map filtering
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Timestamp to ignore init-time bounds emissions from Leaflet mount.
  const boundsSettleAtRef = useRef<number>(Date.now() + 1500)

  // BOLT — opened from the blue bolt button next to AssistantInput.
  // Scope is derived from the URL, so BOLT inherits whatever Discovery has.
  const boltButtonRef = useRef<HTMLButtonElement>(null)
  const boltScope = useMemo(
    () => deriveScopeFromSearchParams(searchParams),
    [searchParams]
  )
  const bolt = useBoltSession(boltScope)

  // Geo ↔ BOLT mutual exclusivity lives entirely in derived state + a single
  // handler. The GeoBoltControlGroup rail is a dumb controlled component —
  // it renders whatever `activePanel` we compute here, and every toggle
  // funnels through `handleSelectPanel`.
  const boltOpen = bolt.state.status !== 'closed'
  const activePanel: ContextualPanel = geoOpen ? 'geo' : boltOpen ? 'bolt' : null
  const handleSelectPanel = useCallback((next: ContextualPanel) => {
    if (next === 'geo') {
      bolt.close()
      setGeoOpen(true)
      boundsSettleAtRef.current = Date.now() + 1500
    } else if (next === 'bolt') {
      setGeoOpen(false)
      void bolt.run()
    } else {
      bolt.close()
      setGeoOpen(false)
    }
  }, [bolt])
  const handleBoltRequestScope = useCallback(() => {
    bolt.close()
    // Return focus to the Discovery search bar (AssistantInput's textarea).
    const ta = document.querySelector<HTMLTextAreaElement>(
      'form textarea[placeholder^="Describe"]'
    )
    ta?.focus()
  }, [bolt])

  // (Slide-out sticky header effect removed — the search input now
  // lives in the DiscoveryConversationBand at the bottom of the
  // viewport. The right column still owns its own vertical scroll
  // for the grid + lightbox rail, but no JS observes scrollTop.)

  // Infinite scroll observer for main results grid
  useEffect(() => {
    const sentinel = feedSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !feedLoading) {
          setFeedLoading(true)
          setTimeout(() => {
            setVisibleFeedCount(prev => prev + FEED_BATCH)
            setFeedLoading(false)
          }, 300)
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [feedLoading, visibleFeedCount])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleFeedCount(FEED_BATCH)
  }, [formatFilters])

  // Reset map↔grid sync state when the query changes. Leaves formatFilter
  // changes alone: area filter is orthogonal to format filter.
  useEffect(() => {
    setHoveredResultId(null)
    setSelectedResultId(null)
    setQueryAreaBounds(null)
  }, [initialQuery])

  // Map bounds listener — debounced live filtering. Ignores init-time
  // emissions (within settle window). After 500ms of no movement,
  // commits the viewport as the area filter.
  const handleMapBoundsChange = useCallback((b: MapBounds) => {
    if (Date.now() < boundsSettleAtRef.current) return
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current)
    boundsTimerRef.current = setTimeout(() => {
      setQueryAreaBounds(b)
      setVisibleFeedCount(FEED_BATCH)
    }, 500)
  }, [])

  const handleClearAreaFilter = useCallback(() => {
    setQueryAreaBounds(null)
    setGeoOpen(false)
    setVisibleFeedCount(FEED_BATCH)
  }, [])


  const toggleFormat = useCallback((f: string) => {
    setFormatFilters(prev => {
      if (f === 'All') {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('fmt')
        router.replace(`/search?${params.toString()}`, { scroll: false })
        return new Set(['All'])
      }
      const next = new Set(prev)
      next.delete('All')
      if (next.has(f)) next.delete(f); else next.add(f)
      const result = next.size === 0 ? new Set(['All']) : next
      const params = new URLSearchParams(searchParams.toString())
      if (result.has('All')) params.delete('fmt')
      else params.set('fmt', [...result].join(','))
      router.replace(`/search?${params.toString()}`, { scroll: false })
      return result
    })
  }, [router, searchParams])

  const query = initialQuery.toLowerCase()

  // Match all content types — shuffle order changes on every page visit via shuffleSeed
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
    // Only shuffle after hydration (shuffleSeed starts at 0, set to random in useEffect)
    if (!shuffleSeed) return results
    return [...results].sort(() => Math.random() - 0.5)
  }, [query, shuffleSeed])

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

  const allMatchedCreators = useMemo(() => {
    if (!query) return creators.slice(0, 6)
    return creators.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.locationBase.toLowerCase().includes(query) ||
      c.specialties.some(s => s.toLowerCase().includes(query)) ||
      c.regionsCovered.some(r => r.toLowerCase().includes(query)) ||
      c.bio.toLowerCase().includes(query)
    )
  }, [query])

  const allMatchedCollections = useMemo(() => {
    if (!query) return collections.slice(0, 3)
    return collections.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.dek.toLowerCase().includes(query) ||
      c.topicTags.some(t => t.includes(query))
    )
  }, [query])

  // Build unified feed: tag each item with a type, then filter.
  // FeedItem shape lives in DiscoveryResultsGrid as the canonical
  // projection over @/data — imported here as DiscoveryFeedItem so
  // the grid renderer is the source of truth for what it consumes.
  type FeedItem = DiscoveryFeedItem

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []
    const isAll = formatFilters.has('All')

    // Frontfilers — creator profile cards
    if (isAll || formatFilters.has('Frontfilers')) {
      allMatchedCreators.forEach((c, i) => items.push({ type: 'creator', data: c, relevance: 80 - i }))
    }

    // Stories
    if (isAll || formatFilters.has('Story')) {
      allMatchedStories.forEach((s, i) => items.push({ type: 'story', data: s, relevance: 75 - i }))
    }

    // Articles
    if (isAll || formatFilters.has('Article')) {
      allMatchedArticles.forEach((a, i) => items.push({ type: 'article', data: a, relevance: 70 - i }))
    }

    // Collections
    if (isAll || formatFilters.has('Collection')) {
      allMatchedCollections.forEach((c, i) => items.push({ type: 'collection', data: c, relevance: 72 - i }))
    }

    // Asset-specific formats
    const assetFormatNames = ['Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector']
    const selectedAssetFormats = assetFormatNames.filter(f => formatFilters.has(f))
    const VISUAL_FORMATS = new Set(['photo', 'video', 'illustration', 'vector'])

    if (isAll) {
      allMatchedAssets.forEach((a, i) => {
        const fmt = a.format.toLowerCase()
        const base = VISUAL_FORMATS.has(fmt) ? 95 : 50
        const thumb = a.thumbnailRef ? 3 : 0
        items.push({ type: 'asset', data: a, relevance: base + thumb - i * 0.1 })
      })
    } else if (selectedAssetFormats.length > 0) {
      const lowerFormats = selectedAssetFormats.map(f => f.toLowerCase())
      allMatchedAssets
        .filter(a => lowerFormats.includes(a.format.toLowerCase()))
        .forEach((a, i) => {
          const fmt = a.format.toLowerCase()
          const base = VISUAL_FORMATS.has(fmt) ? 95 : 50
          const thumb = a.thumbnailRef ? 3 : 0
          items.push({ type: 'asset', data: a, relevance: base + thumb - i * 0.1 })
        })
    }

    items.sort((a, b) => b.relevance - a.relevance)
    return items
  }, [allMatchedAssets, allMatchedStories, allMatchedArticles, allMatchedCreators, allMatchedCollections, formatFilters])

  // ── Feed-item helpers for map↔grid sync ──────────────────────────────
  // The stable id format (asset-* / s-* / a-* / c-* / col-*) is owned
  // by `feedItemKey` in DiscoveryResultsGrid.tsx — imported at the top
  // of this file so both the grid and the map↔grid sync use the
  // exact same id contract.

  const toSample = (a: AssetData) => ({
    id: a.id,
    title: a.title,
    thumbnailUrl: resolveProtectedUrl(a.id, 'thumbnail'),
    format: a.format,
    locationLabel: a.locationLabel,
    validationDeclaration: a.validationDeclaration,
  })

  // Resolve a feed item to a MapPoint or null (no mappable geography).
  // Items without geo are silently skipped from the map but still rendered
  // in the grid — the spec calls for graceful fallback.
  const feedItemToMapPoint = useCallback((item: FeedItem): MapPoint | null => {
    const id = feedItemKey(item)
    if (item.type === 'asset') {
      const a = item.data
      const geo = geographyMap[a.geography]
      if (!geo) return null
      return {
        id,
        label: a.title,
        lat: geo.lat,
        lng: geo.lng,
        sublabel: a.locationLabel,
        formats: [a.format],
        sampleAssets: [toSample(a)],
        count: 1,
        pointType: 'asset',
      }
    }
    if (item.type === 'creator') {
      const c = item.data
      const coords = CREATOR_COORDS[c.locationBase]
      if (!coords) return null
      const initials = c.name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
      return {
        id,
        slug: c.slug,
        label: c.name,
        lat: coords[0],
        lng: coords[1],
        sublabel: c.locationBase,
        avatarUrl: c.avatarRef || null,
        initials,
        trustBadge: c.trustBadge,
        specialties: c.specialties.slice(0, 3),
        sampleAssets: [],
        pointType: 'creator',
      }
    }
    if (item.type === 'story') {
      const s = item.data
      const geo = geographyMap[s.primaryGeography]
      if (!geo) return null
      const hero = assetMap[s.heroAssetId]
      const creator = creatorMap[s.creatorId]
      return {
        id,
        label: s.title,
        lat: geo.lat,
        lng: geo.lng,
        sublabel: creator?.name ?? '',
        dek: s.dek,
        creatorName: creator?.name,
        creatorAvatarUrl: creator?.avatarRef ?? null,
        sampleAssets: hero ? [toSample(hero)] : [],
        count: s.assetIds.length,
        pointType: 'story',
      }
    }
    if (item.type === 'article') {
      const ar = item.data
      // Prefer primaryGeography (a geo id for articles), fall back to the hero asset's geography.
      const primaryGeo = ar.primaryGeography ? geographyMap[ar.primaryGeography] : undefined
      const hero = ar.heroAssetId ? assetMap[ar.heroAssetId] : undefined
      const fallbackGeo = hero ? geographyMap[hero.geography] : undefined
      const geo = primaryGeo ?? fallbackGeo
      if (!geo) return null
      return {
        id,
        label: ar.title,
        lat: geo.lat,
        lng: geo.lng,
        sublabel: ar.editorName ?? ar.creatorName ?? '',
        sampleAssets: hero ? [toSample(hero)] : [],
        count: 1,
        pointType: 'story',
      }
    }
    if (item.type === 'collection') {
      const col = item.data
      // Collection.primaryGeography is a human label, not a geo id — resolve via the hero asset.
      const hero = col.heroAssetId ? assetMap[col.heroAssetId] : undefined
      const geo = hero ? geographyMap[hero.geography] : undefined
      if (!geo) return null
      return {
        id,
        label: col.title,
        lat: geo.lat,
        lng: geo.lng,
        sublabel: col.primaryGeography,
        sampleAssets: hero ? [toSample(hero)] : [],
        count: col.assetIds.length,
        pointType: 'story',
      }
    }
    return null
  // toSample is stable (pure function over its input); feedItemKey is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItemKey])

  // Area filter: only applied after the user commits "Search this area".
  // Items without resolvable geo pass through, per the graceful-fallback rule.
  const areaFilteredItems = useMemo<FeedItem[]>(() => {
    if (!queryAreaBounds) return feedItems
    return feedItems.filter(item => {
      const pt = feedItemToMapPoint(item)
      if (!pt) return true
      return pt.lat >= queryAreaBounds.south && pt.lat <= queryAreaBounds.north &&
             pt.lng >= queryAreaBounds.west && pt.lng <= queryAreaBounds.east
    })
  }, [feedItems, queryAreaBounds, feedItemToMapPoint])

  // Map points derived from the (area-filtered) feed. Silent skip on no-geo.
  const mapResultPoints = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = []
    for (const item of areaFilteredItems) {
      const pt = feedItemToMapPoint(item)
      if (pt) pts.push(pt)
    }
    return pts
  }, [areaFilteredItems, feedItemToMapPoint])

  // Geo context — prefer a structured filter source if one exists; fall
  // back to parsing the free-text query. Discovery currently has no
  // structured geo state, so this is a parsed fallback today.
  const geoContext: GeoContext | null = useMemo(
    () => parseGeoContextFromQuery(initialQuery),
    [initialQuery]
  )

  // Keep old names for map/spotlight compatibility
  const matchedAssets = allMatchedAssets
  const matchedStories = allMatchedStories
  const matchedArticles = allMatchedArticles

  const matchingSavedSearch = query ? savedSearches.find(s =>
    s.label.toLowerCase().includes(query) || s.query.toLowerCase().includes(query)
  ) : null

  const PROMPT_STARTERS = [
    'Verified flood photography, displacement angle, aerial',
    'Conflict footage, East Africa, last 6 months',
    'Frontfilers covering Yemen or Sudan',
    'Press freedom stories, Sahel region',
    'Border crossing documentation, EU frontier',
    'Hospital infrastructure, humanitarian crisis',
    'Wildfire recovery, visual essay format',
    'Student protest, Europe, 2025–2026',
  ]

  const assistantContext = query ? (() => {
    const geos = [...new Set(allMatchedAssets.map(a => a.locationLabel))].slice(0, 3)
    const creators = [...new Set(allMatchedAssets.map(a => a.creatorId))].length
    const formats = [...new Set(allMatchedAssets.map(a => a.format))].slice(0, 3)
    return { geos, creators, formats, total: feedItems.length }
  })() : null

  // ── Discovery Agent — vault-only narration ───────────────────
  // Companion to BOLT: BOLT covers external sources, the agent
  // here covers what's already in the Frontfiles vault. The hook
  // is sync today (stub) and re-derives when query, ranked feed,
  // or format filters change. The grid stays the source of truth
  // for ranking; this hook only narrates the head of the list.
  const agentState = useDiscoveryAgent({
    query: initialQuery,
    feedItems: areaFilteredItems,
    formatFilters,
  })

  // Pick row clicked → navigate to the underlying entity. The
  // panel forwards the href; the page owns the router.
  const handleAgentPickClick = useCallback(
    (href: string) => {
      router.push(href)
    },
    [router],
  )

  // Follow-up chip clicked → run a refined query. Mirrors the
  // commit path in AssistantInput so the URL stays the single
  // source of truth for `?q=`.
  const handleAgentChipRun = useCallback(
    (nextQuery: string) => {
      const trimmed = nextQuery.trim()
      if (trimmed) {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`)
      } else {
        router.push('/search')
      }
    },
    [router],
  )

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col">
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-[1800px] mx-auto px-6 pt-6 flex flex-col">
          <div className="flex gap-0 flex-1 min-h-0">

            {/* ── LEFT: paired Geo/BOLT control rail (always mounted) ── */}
            <GeoBoltControlGroup
              ref={boltButtonRef}
              activePanel={activePanel}
              onSelectPanel={handleSelectPanel}
            />

            {/* GeoDiscoveryPanel removed — replaced by MapBand in center column */}

            {/* ── BOLT PANEL: lives in the same left-side slot as Geo.
                 Mutual exclusivity guarantees only one of geo/bolt is mounted
                 here at any moment, so they share the same column position. */}
            <BoltPanel
              state={bolt.state}
              preview={bolt.preview}
              onClose={bolt.close}
              onRetry={() => { void bolt.run() }}
              onRequestScope={handleBoltRequestScope}
              openButtonRef={boltButtonRef}
            />

            {/* ── CENTER COLUMN: scrolling grid (top) + conversation band (bottom) ──
                 The grid and the band are now stacked vertically inside
                 a single center column. This is what lets the left and
                 right rails extend ALL THE WAY DOWN to the bottom of
                 main — they're flex children of the same row as this
                 center column, and the band is INSIDE the column rather
                 than a sibling of <main>. As a result both rails grow
                 to the full main height, and the band fits between
                 them horizontally.

                 The grid scroll div uses `flex-1 overflow-y-auto` so it
                 takes the remaining vertical space above the band and
                 scrolls internally. The band is `shrink-0` so it never
                 yields its height to the grid. */}
            {/* Map rail — left of grid, full height when Geo is open */}
            {geoOpen && (
              <div className={`shrink-0 w-[380px] h-full mr-4 border-r border-black/10 ${queryAreaBounds ? 'border-r-[#0000ff]' : ''}`}>
                <MapBand
                  points={mapResultPoints}
                  hoveredId={hoveredResultId}
                  selectedId={selectedResultId}
                  onHoverChange={setHoveredResultId}
                  onSelectChange={setSelectedResultId}
                  onBoundsChange={handleMapBoundsChange}
                  active={queryAreaBounds !== null}
                />
              </div>
            )}

            <div className={`flex-1 min-w-0 h-full flex flex-col ${boltOpen ? 'border-l border-black/15 pl-6' : ''}`}>
              <div ref={scrollColRef} className="flex-1 min-h-0 overflow-y-auto">
                <DiscoveryResultsGrid
                  items={areaFilteredItems}
                  totalFeedCount={feedItems.length}
                  visibleCount={visibleFeedCount}
                  feedLoading={feedLoading}
                  feedSentinelRef={feedSentinelRef}
                  viewMode={viewMode}
                  overlay={overlay}
                  hoveredResultId={hoveredResultId}
                  selectedResultId={selectedResultId}
                  onHoverChange={setHoveredResultId}
                  hasAreaFilter={queryAreaBounds !== null}
                  onClearAreaFilter={handleClearAreaFilter}
                />
              </div>

              {/* ══════════════════════════════════════════════════════
                   Discovery Conversation Band — now mounted INSIDE the
                   center column so the left and right rails can extend
                   PAST the band to the bottom of <main>. Same vertical
                   stack as before:
                     1. Agent answer (DiscoveryAgentPanel)
                     2. GridToolbar (filters / overlay / view mode / geo chip)
                     3. Search input (AssistantInput)
                   ══════════════════════════════════════════════════════ */}
              <DiscoveryConversationBand
                agentSlot={
                  <DiscoveryAgentPanel
                    state={agentState}
                    hoveredResultId={hoveredResultId}
                    onPickHover={setHoveredResultId}
                    onPickClick={handleAgentPickClick}
                    onChipRun={handleAgentChipRun}
                  />
                }
                toolbarSlot={
                  <GridToolbar
                    filters={FORMATS.map(f => ({ label: f, value: f }))}
                    filterGroups={{
                      primary: ENTITY_FILTERS.map(f => ({ label: f, value: f })),
                      secondary: FORMAT_FILTERS.map(f => ({ label: f, value: f })),
                    }}
                    activeFilters={formatFilters}
                    onToggleFilter={toggleFormat}
                    overlay={overlay}
                    onOverlayChange={setOverlay}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    borderTop={false}
                    density="compact"
                    rightSlot={
                      (geoOpen || geoContext || queryAreaBounds) ? (
                        <div className="inline-flex items-center gap-1 px-1.5 h-5 border border-[#0000ff]/40 bg-white">
                          <svg className="w-2.5 h-2.5 text-[#0000ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="text-[8px] font-semibold uppercase tracking-wider text-[#0000ff] whitespace-nowrap max-w-[100px] truncate">
                            {queryAreaBounds ? 'Map area' : geoContext ? geoContext.label : 'Geo'}
                          </span>
                          <button
                            type="button"
                            onClick={handleClearAreaFilter}
                            aria-label="Close map"
                            className="ml-0.5 text-[#0000ff]/40 hover:text-[#0000ff] w-3 h-3 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : null
                    }
                  />
                }
                inputSlot={<AssistantInput initialQuery={initialQuery} />}
              />
            </div>

            {/* ── RIGHT RAIL: Lightbox ──
                 Independent right rail, mirror of the left Geo/BOLT
                 rail. Two states:
                   - lightboxOpen=true  → full 320px LightboxTray
                                          with its own h-full + internal
                                          scroll. The Hide button in the
                                          tray header closes the rail.
                   - lightboxOpen=false → collapsed 48px trigger rail
                                          with rotated "LIGHTBOX" label
                                          and a bookmark icon button.
                                          Click the icon to expand.
                 Either way the rail is `h-full` (fills the main flex
                 row's height) and sits at the far right of the page,
                 separated from the grid column by `border-l-2 border-
                 [#0000ff] ml-4`, mirroring the left rail's
                 `border-r-2 border-[#0000ff] mr-4`. */}
            {lightboxOpen ? (
              <div className="hidden lg:flex shrink-0 w-[320px] h-full ml-4 border-l border-[#0000ff]/30 pl-4">
                <LightboxTray onHide={() => setLightboxOpen(false)} />
              </div>
            ) : (
              <div
                role="group"
                aria-label="Lightbox (collapsed)"
                className="hidden lg:flex shrink-0 w-9 h-full ml-4 border-l border-black/10 bg-black/[0.02] flex-col"
              >
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  aria-label="Show lightbox"
                  aria-pressed={false}
                  title="Show lightbox"
                  className="flex flex-col items-center justify-center py-3 gap-1.5 text-[#0000ff]/60 hover:text-[#0000ff] hover:bg-[#0000ff]/5 transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                  </svg>
                  <span className="text-[7px] font-bold uppercase tracking-widest leading-none">
                    LB
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// CREATOR CARD — moved to DiscoveryResultsGrid.tsx as
// `DiscoveryCreatorCard` (private to that module). The grid
// is now the only consumer, so co-locating the card with the
// grid that renders it is the simpler arrangement.
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// SPOTLIGHT PANEL — infinite scroll, image-only hover
// ══════════════════════════════════════════════════════

type SpotlightEntry = typeof spotlightRanked[number]

function SpotlightPanel({ items, direction }: { items: SpotlightEntry[]; direction: 'vertical' | 'horizontal' }) {
  const repeated = useMemo(() => [...items, ...items, ...items, ...items], [items])

  return (
    <div className={`border border-[#0000ff]/30 ${direction === 'vertical' ? 'flex flex-col flex-1 min-h-0' : ''}`}>
      <div className="px-3 py-2 flex items-center justify-between shrink-0 border-b border-[#0000ff]">
        <div className="flex items-center gap-1.5">
          <svg className="w-5 h-5 text-[#0000ff] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-[14px] font-black uppercase tracking-widest text-[#0000ff] italic">Spotlight</span>
        </div>
      </div>
      <div className={
        direction === 'vertical'
          ? 'flex flex-col divide-y divide-slate-100 overflow-y-auto flex-1 min-h-0'
          : 'flex overflow-x-auto'
      }>
        {repeated.map((s, idx) => {
          const key = `${s.id}-${idx}`
          if (s.objectType === 'asset' && assetMap[s.objectId]) {
            return <SpotlightAssetItem key={key} asset={assetMap[s.objectId]} direction={direction} />
          }
          if (s.objectType === 'story' && storyMap[s.objectId]) {
            return <SpotlightStoryItem key={key} story={storyMap[s.objectId]} direction={direction} />
          }
          return null
        })}
      </div>
    </div>
  )
}

function SpotlightThumb({ src, alt, format }: { src: string; alt: string; format?: string }) {
  if (!src) return <div className="w-full h-full bg-slate-100" />
  if (format === 'Audio') {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <svg className="w-3 h-3 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </div>
    )
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" />
}

function SpotlightAssetItem({ asset, direction }: { asset: typeof assetMap[string]; direction: 'vertical' | 'horizontal' }) {
  const creator = creatorMap[asset.creatorId]
  if (direction === 'vertical') {
    return (
      <Link href={`/asset/${asset.id}`} className="group flex gap-2.5 pr-3 hover:bg-black/[0.02] transition-colors items-center">
        <div className="w-24 aspect-video shrink-0 overflow-hidden bg-slate-100 rounded">
          <SpotlightThumb src={resolveProtectedUrl(asset.id, 'thumbnail')} alt={asset.title} format={asset.format} />
        </div>
        <div className="min-w-0 flex-1 py-2.5 flex flex-col justify-center">
          <p className="text-[24px] font-normal font-serif italic text-black truncate whitespace-nowrap group-hover:text-[#0000ff] transition-colors">{asset.title}</p>
          <p className="text-[9px] font-black uppercase tracking-widest mt-1 truncate"><span className="text-[#0000ff]">{creator?.name}</span><span className="text-black"> · {(asset.locationLabel || '').replace(/^geo-/, '')}</span></p>
        </div>
      </Link>
    )
  }
  return (
    <Link href={`/asset/${asset.id}`} className="block w-[220px] shrink-0 border-r border-[#0000ff]/10 last:border-r-0">
      <div className="aspect-video overflow-hidden bg-slate-100">
        <SpotlightThumb src={resolveProtectedUrl(asset.id, 'thumbnail')} alt={asset.title} format={asset.format} />
      </div>
      <div className="p-2">
        <p className="text-[10px] font-black text-black line-clamp-2 leading-tight tracking-tight">{asset.title}</p>
        <p className="text-[8px] text-black/30 mt-0.5 truncate">{asset.locationLabel}</p>
      </div>
    </Link>
  )
}

function SpotlightStoryItem({ story, direction }: { story: typeof storyMap[string]; direction: 'vertical' | 'horizontal' }) {
  const creator = creatorMap[story.creatorId]
  if (direction === 'vertical') {
    return (
      <Link href={`/story/${story.id}`} className="group flex gap-2.5 pr-3 hover:bg-black/[0.02] transition-colors items-center">
        <div className="w-24 aspect-video shrink-0 overflow-hidden bg-slate-100 rounded">
          <SpotlightThumb src={resolveProtectedUrl(story.heroAssetId, 'thumbnail')} alt={story.title} />
        </div>
        <div className="min-w-0 flex-1 py-2.5 flex flex-col justify-center">
          <p className="text-[24px] font-normal font-serif italic text-black truncate whitespace-nowrap group-hover:text-[#0000ff] transition-colors">{story.title}</p>
          <p className="text-[9px] font-black uppercase tracking-widest mt-1 truncate"><span className="text-[#0000ff]">{creator?.name}</span><span className="text-black"> · {(story.primaryGeography || '').replace(/^geo-/, '')}</span></p>
        </div>
      </Link>
    )
  }
  return (
    <Link href={`/story/${story.id}`} className="block w-[220px] shrink-0 border-r border-[#0000ff]/10 last:border-r-0">
      <div className="aspect-video overflow-hidden bg-slate-100">
        <SpotlightThumb src={resolveProtectedUrl(story.heroAssetId, 'thumbnail')} alt={story.title} />
      </div>
      <div className="p-2">
        <p className="text-[10px] font-black text-black line-clamp-2 leading-tight tracking-tight">{story.title}</p>
        <p className="text-[8px] text-black/30 mt-0.5 truncate">{story.primaryGeography}</p>
      </div>
    </Link>
  )
}

