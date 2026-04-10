// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Collection Dataset
// Collections can aggregate assets from MULTIPLE creators
// Stories are single-creator; Collections are multi-creator
// ═══════════════════════════════════════════════════════════════

export interface CollectionData {
  id: string
  slug: string
  title: string
  dek: string
  summary: string
  curatorId: string // the user who assembled the collection
  creatorIds: string[] // all creators whose assets appear
  primaryGeography: string
  secondaryGeographies: string[]
  topicTags: string[]
  coverageWindow: { start: string; end: string }
  heroAssetId: string
  assetIds: string[]
  articleIds: string[]
  recommendedCollectionIds: string[]
  recommendedStoryIds: string[]
}

export const collections: CollectionData[] = [
  // ═══════════════════════════════════════════════
  // 1. CLIMATE DISPLACEMENT — multi-creator, cross-geography
  // ═══════════════════════════════════════════════
  {
    id: 'collection-001',
    slug: 'climate-displacement-southern-europe-2026',
    title: 'Climate Displacement in Southern Europe',
    dek: 'Visual evidence of climate-driven displacement across southern Europe and Latin America — floods, heatwaves, drought, and wildfire aftermath from multiple frontline reporters.',
    summary: 'A curated cross-geography collection assembling the strongest visual documentation of climate displacement events from Q1 2026. Combines flood coverage from Brazil, heatwave hospital overload from France, wildfire aftermath from Spain, and coastal erosion from Portugal. Assets sourced from 4 creators working independently on related events.',
    curatorId: 'creator-002', // Ana Sousa curates
    creatorIds: ['creator-001', 'creator-002', 'creator-005', 'creator-008'],
    primaryGeography: 'Southern Europe',
    secondaryGeographies: ['GEO-BR-POA', 'GEO-PT-STB', 'GEO-FR-MRS', 'GEO-ES-HUE'],
    topicTags: ['climate', 'displacement', 'flood', 'heatwave', 'wildfire', 'erosion'],
    coverageWindow: { start: '2026-01-15', end: '2026-03-19' },
    heroAssetId: 'asset-001',
    assetIds: [
      'asset-001', 'asset-002', 'asset-004', // Guaíba flood — Marco Oliveira
      'asset-010', 'asset-011',               // Setúbal erosion — Ana Sousa
      'asset-021', 'asset-022',               // Marseille heatwave — Yara Boukhari
      'asset-017', 'asset-018',               // Huelva wildfire — Carmen Ruiz
    ],
    articleIds: [],
    recommendedCollectionIds: ['collection-002'],
    recommendedStoryIds: ['story-001', 'story-003', 'story-005', 'story-006'],
  },

  // ═══════════════════════════════════════════════
  // 2. PROTEST & CIVIC UNREST — multi-creator
  // ═══════════════════════════════════════════════
  {
    id: 'collection-002',
    slug: 'european-civic-unrest-q1-2026',
    title: 'European Civic Unrest, Q1 2026',
    dek: 'Demonstrations, strikes, and political flashpoints across Europe in early 2026 — from Warsaw transit strikes to Bucharest student protests and Lisbon confidence votes.',
    summary: 'Aggregates the sharpest visual and audio documentation of civic unrest events across Europe in the first quarter of 2026. Multiple independent creators covering parallel flashpoints — transport strikes in Poland, student demonstrations in Romania, confidence vote crisis in Portugal, and election security in Warsaw.',
    curatorId: 'creator-006', // Tomasz Nowak curates
    creatorIds: ['creator-002', 'creator-006', 'creator-007'],
    primaryGeography: 'Europe',
    secondaryGeographies: ['GEO-PL-WAW', 'GEO-RO-BUC', 'GEO-PT-LIS'],
    topicTags: ['protest', 'strike', 'democracy', 'politics', 'unrest', 'elections'],
    coverageWindow: { start: '2026-01-20', end: '2026-03-15' },
    heroAssetId: 'asset-006',
    assetIds: [
      'asset-006', 'asset-007', 'asset-008', 'asset-009', // Lisbon vote — Ana Sousa
      'asset-025', 'asset-026', 'asset-027',               // Warsaw strike — Tomasz Nowak
      'asset-029', 'asset-030', 'asset-031',               // Bucharest students — Elena Vasile
    ],
    articleIds: [],
    recommendedCollectionIds: ['collection-001'],
    recommendedStoryIds: ['story-002', 'story-007', 'story-008', 'story-013'],
  },

  // ═══════════════════════════════════════════════
  // 3. BORDER & MIGRATION — multi-creator
  // ═══════════════════════════════════════════════
  {
    id: 'collection-003',
    slug: 'borders-migration-mediterranean-2026',
    title: 'Borders & Migration: Mediterranean 2026',
    dek: 'Documentation of border pressure, migration routes, and port congestion across the Mediterranean basin from frontline reporters in Greece, France, and Italy.',
    summary: 'Bringing together visual evidence from three Mediterranean corridors: the Evros border bottleneck in Greece, Fos-sur-Mer port congestion in France, and settlement documentation in Italy. Assets from 3 creators covering different facets of the same systemic migration pressure.',
    curatorId: 'creator-003', // Dimitris Katsaros curates
    creatorIds: ['creator-003', 'creator-004', 'creator-005'],
    primaryGeography: 'Mediterranean',
    secondaryGeographies: ['GEO-GR-EVR', 'GEO-FR-FOS', 'GEO-IT-PAL'],
    topicTags: ['migration', 'border', 'port', 'Mediterranean', 'displacement'],
    coverageWindow: { start: '2026-02-01', end: '2026-03-10' },
    heroAssetId: 'asset-013',
    assetIds: [
      'asset-013', 'asset-014', 'asset-015', 'asset-016', // Evros border — Dimitris Katsaros
      'asset-037', 'asset-038',                             // Fos port — Yara Boukhari
      'asset-033', 'asset-034',                             // Palermo — Lucia Ferrante
    ],
    articleIds: [],
    recommendedCollectionIds: ['collection-001'],
    recommendedStoryIds: ['story-004', 'story-012', 'story-010'],
  },
]

// ═══════════════════════════════════════════════════════════════
// Lookup maps
// ═══════════════════════════════════════════════════════════════

export const collectionMap: Record<string, CollectionData> = {}
export const collectionBySlug: Record<string, CollectionData> = {}

for (const c of collections) {
  collectionMap[c.id] = c
  collectionBySlug[c.slug] = c
}
