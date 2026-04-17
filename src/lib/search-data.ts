/**
 * FrontSearch data adapters.
 * Enriches creator/asset/story data for the discovery map and result rail.
 * Only exposes PUBLIC, non-invalidated assets per product rules.
 */

import { creators, creatorMap } from '@/data/creators'
import { searchableAssets, type AssetData } from '@/data/assets'
import { stories, storyMap, type StoryData } from '@/data/stories'
import { geographies, geographyMap, type Geography } from '@/data/geographies'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'

// ── Enriched types for the search surface ──

export interface SearchCreator {
  id: string
  name: string
  slug: string
  avatarUrl: string | null
  initials: string
  locationBase: string
  lat: number
  lng: number
  trustBadge: 'verified' | 'trusted'
  assetCount: number
  storyCount: number
  specialties: string[]
  sampleAssets: SampleAsset[]
}

export interface SampleAsset {
  id: string
  title: string
  thumbnailUrl: string
  format: string
  locationLabel: string
  validationDeclaration: string
}

export interface SearchStory {
  id: string
  title: string
  slug: string
  dek: string
  creatorId: string
  creatorName: string
  creatorAvatarUrl: string | null
  lat: number
  lng: number
  assetCount: number
  topicTags: string[]
  sampleAssets: SampleAsset[]
}

export interface SearchAssetCluster {
  id: string
  geographyLabel: string
  country: string
  lat: number
  lng: number
  assetCount: number
  formats: string[]
  sampleAssets: SampleAsset[]
  creatorNames: string[]
}

// ── Helper: get initials from name ──
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Helper: get creator coordinates from location string ──
// Exported so the Discovery search page can resolve feedItem creator points
// without duplicating the lookup table.
export const CREATOR_COORDS: Record<string, [number, number]> = {
  'Porto Alegre, Brazil': [-30.03, -51.23],
  'Lisbon, Portugal': [38.72, -9.14],
  'Alexandroupoli, Greece': [40.85, 25.87],
  'Palermo, Italy': [38.12, 13.36],
  'Marseille, France': [43.30, 5.37],
  'Warsaw, Poland': [52.23, 21.01],
  'Bucharest, Romania': [44.43, 26.10],
  'Huelva, Spain': [37.26, -6.95],
  'Seville, Spain': [37.39, -5.98],
  'Thessaloniki, Greece': [40.63, 22.94],
  'Hong Kong': [22.32, 114.17],
  'Hong Kong, CN': [22.32, 114.17],
  'Accra, Ghana': [5.60, -0.19],
  'Mumbai, India': [19.08, 72.88],
  'Amman, Jordan': [31.95, 35.93],
  'Stockholm, Sweden': [59.33, 18.07],
  'Tokyo, Japan': [35.68, 139.69],
  'Mexico City, Mexico': [19.43, -99.13],
  'Nairobi, Kenya': [-1.29, 36.82],
  'Sydney, Australia': [-33.87, 151.21],
  'Lagos, Nigeria': [6.52, 3.38],
  'Bamako, Mali': [12.65, -8.00],
  'Mogadishu, Somalia': [2.05, 45.34],
  "Sana'a, Yemen": [15.35, 44.21],
  'Addis Ababa, Ethiopia': [9.03, 38.74],
  'Port Sudan, Sudan': [19.62, 37.22],
}

// ── Helper: convert AssetData to SampleAsset ──
function toSampleAsset(a: AssetData): SampleAsset {
  return {
    id: a.id,
    title: a.title,
    thumbnailUrl: resolveProtectedUrl(a.id, 'thumbnail'),
    format: a.format,
    locationLabel: a.locationLabel,
    validationDeclaration: a.validationDeclaration,
  }
}

// ── Only public, non-invalidated, non-disputed assets ──
const discoveryAssets = searchableAssets.filter(a =>
  a.privacyLevel === 'PUBLIC' &&
  a.validationDeclaration !== 'disputed'
)

// ── Enriched creators ──
export function getSearchCreators(): SearchCreator[] {
  return creators.map(c => {
    const coords = CREATOR_COORDS[c.locationBase] ?? [0, 0]
    const creatorAssets = discoveryAssets.filter(a => a.creatorId === c.id)
    const creatorStoryIds = new Set(creatorAssets.map(a => a.storyId).filter(Boolean))

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      avatarUrl: c.avatarRef || null,
      initials: getInitials(c.name),
      locationBase: c.locationBase,
      lat: coords[0],
      lng: coords[1],
      trustBadge: c.trustBadge,
      assetCount: creatorAssets.length,
      storyCount: creatorStoryIds.size,
      specialties: c.specialties.slice(0, 3),
      sampleAssets: creatorAssets.slice(0, 15).map(toSampleAsset),
    }
  }).filter(c => c.lat !== 0)
}

// ── Enriched stories ──
export function getSearchStories(): SearchStory[] {
  return stories.flatMap(s => {
    const geo = geographyMap[s.primaryGeography]
    if (!geo) return []
    const creator = creatorMap[s.creatorId]
    const storyAssets = discoveryAssets.filter(a => a.storyId === s.id)

    return [{
      id: s.id,
      title: s.title,
      slug: s.slug,
      dek: s.dek,
      creatorId: s.creatorId,
      creatorName: creator?.name ?? 'Unknown',
      creatorAvatarUrl: creator?.avatarRef ?? null,
      lat: geo.lat,
      lng: geo.lng,
      assetCount: s.assetIds.length,
      topicTags: s.topicTags,
      sampleAssets: storyAssets.slice(0, 6).map(toSampleAsset),
    }]
  })
}

// ── Geo context parsing from free-text query ──
// Fallback resolver: walks the canonical geographies + creator coords and
// returns the first textual match, if any. Discovery should PREFER a
// structured geo source (URL param, filter state, etc.) when one exists and
// only fall back to this parser when nothing structured is available.

export interface GeoContext {
  label: string
  lat: number
  lng: number
  geoId: string | null
  /** 'structured' if sourced from filter state, 'parsed' if inferred from q. */
  source: 'structured' | 'parsed'
}

export function parseGeoContextFromQuery(q: string | null | undefined): GeoContext | null {
  if (!q) return null
  const lower = q.toLowerCase()

  // 1) Full location labels (most specific first — labels are longer than countries).
  for (const g of geographies) {
    if (!g.locationLabel) continue
    if (lower.includes(g.locationLabel.toLowerCase())) {
      return { label: g.locationLabel, lat: g.lat, lng: g.lng, geoId: g.id, source: 'parsed' }
    }
  }

  // 2) City names (when labels embed them — catches 'lisbon' matching 'Lisbon, Portugal').
  for (const g of geographies) {
    if (!g.city) continue
    if (lower.includes(g.city.toLowerCase())) {
      return { label: g.locationLabel || g.city, lat: g.lat, lng: g.lng, geoId: g.id, source: 'parsed' }
    }
  }

  // 3) Country names.
  for (const g of geographies) {
    if (!g.country) continue
    if (lower.includes(g.country.toLowerCase())) {
      return { label: g.country, lat: g.lat, lng: g.lng, geoId: g.id, source: 'parsed' }
    }
  }

  // 4) Region names (when distinct from country).
  for (const g of geographies) {
    if (!g.region || g.region === g.country) continue
    if (lower.includes(g.region.toLowerCase())) {
      return { label: g.region, lat: g.lat, lng: g.lng, geoId: g.id, source: 'parsed' }
    }
  }

  // 5) Creator base-city fallback (covers cities present in CREATOR_COORDS
  //    but not in the geography reference).
  for (const [key, [lat, lng]] of Object.entries(CREATOR_COORDS)) {
    const city = key.split(',')[0].trim().toLowerCase()
    if (city && lower.includes(city)) {
      return { label: key, lat, lng, geoId: null, source: 'parsed' }
    }
  }

  return null
}

// ── Asset clusters by geography ──
export function getSearchAssetClusters(formatFilter?: string): SearchAssetCluster[] {
  const filtered = formatFilter && formatFilter !== 'All'
    ? discoveryAssets.filter(a => a.format.toLowerCase() === formatFilter.toLowerCase())
    : discoveryAssets

  const byGeo = new Map<string, AssetData[]>()
  for (const a of filtered) {
    const list = byGeo.get(a.geography) ?? []
    list.push(a)
    byGeo.set(a.geography, list)
  }

  return Array.from(byGeo.entries()).flatMap(([geoId, assets]) => {
    const geo = geographyMap[geoId]
    if (!geo || assets.length === 0) return []
    const formats = [...new Set(assets.map(a => a.format))]
    const creatorNames = [...new Set(assets.map(a => creatorMap[a.creatorId]?.name).filter(Boolean))] as string[]

    return [{
      id: geoId,
      geographyLabel: geo.locationLabel,
      country: geo.country,
      lat: geo.lat,
      lng: geo.lng,
      assetCount: assets.length,
      formats,
      sampleAssets: assets.slice(0, 6).map(toSampleAsset),
      creatorNames,
    }]
  })
}
