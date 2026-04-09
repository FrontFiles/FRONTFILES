// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Saved Search Dataset
// 10 saved searches driving recommendation logic
// ═══════════════════════════════════════════════════════════════

export interface SavedSearchData {
  id: string
  label: string
  query: string
  userType: 'buyer' | 'reader'
  filters: {
    geography?: string[]
    format?: string[]
    tags?: string[]
    dateRange?: { start: string; end: string }
    creatorIds?: string[]
  }
  reason: string
  matchingStoryIds: string[]
  matchingAssetIds: string[]
  matchingArticleIds: string[]
  alertEnabled: boolean
  lastTriggered: string | null
}

export const savedSearches: SavedSearchData[] = [
  {
    id: 'search-001',
    label: 'Flood displacement southern Brazil',
    query: 'flood displacement Porto Alegre Rio Grande do Sul',
    userType: 'buyer',
    filters: {
      geography: ['geo-br-poa', 'geo-br-canoas', 'geo-br-eldorado'],
      tags: ['flood', 'displacement', 'evacuation'],
    },
    reason: 'Tracking ongoing flood displacement coverage in southern Brazil for editorial licensing.',
    matchingStoryIds: ['story-001', 'story-011'],
    matchingAssetIds: ['asset-001', 'asset-002', 'asset-003', 'asset-004', 'asset-005', 'asset-038', 'asset-039', 'asset-040'],
    matchingArticleIds: ['article-001'],
    alertEnabled: true,
    lastTriggered: '2026-03-28T16:00:00Z',
  },
  {
    id: 'search-002',
    label: 'Parliament Lisbon confidence vote',
    query: 'parliament confidence vote Lisbon Assembleia',
    userType: 'buyer',
    filters: {
      geography: ['geo-pt-lisbon'],
      tags: ['parliament', 'municipal-politics'],
    },
    reason: 'Sourcing institutional photography from the March 2026 confidence motion.',
    matchingStoryIds: ['story-002'],
    matchingAssetIds: ['asset-006', 'asset-007', 'asset-008', 'asset-009'],
    matchingArticleIds: ['article-002'],
    alertEnabled: true,
    lastTriggered: '2026-03-24T08:00:00Z',
  },
  {
    id: 'search-003',
    label: 'Border crossing queue video',
    query: 'border crossing queue video Evros Kastanies',
    userType: 'buyer',
    filters: {
      geography: ['geo-gr-evros'],
      format: ['Video'],
      tags: ['border-crossing', 'asylum'],
    },
    reason: 'Licensing video content from EU external border crossings for broadcast use.',
    matchingStoryIds: ['story-004'],
    matchingAssetIds: ['asset-015'],
    matchingArticleIds: ['article-003'],
    alertEnabled: true,
    lastTriggered: '2026-02-19T14:00:00Z',
  },
  {
    id: 'search-004',
    label: 'Wildfire recovery aerial photo',
    query: 'wildfire aftermath recovery aerial Andalusia',
    userType: 'buyer',
    filters: {
      geography: ['geo-es-huelva'],
      format: ['Photo', 'Infographic'],
      tags: ['wildfire', 'recovery'],
    },
    reason: 'Sourcing before/after wildfire recovery imagery for environmental reporting.',
    matchingStoryIds: ['story-005'],
    matchingAssetIds: ['asset-017', 'asset-018', 'asset-019'],
    matchingArticleIds: ['article-008'],
    alertEnabled: false,
    lastTriggered: '2026-03-03T14:00:00Z',
  },
  {
    id: 'search-005',
    label: 'Court hearing police misconduct',
    query: 'court hearing police misconduct Sicily Palermo',
    userType: 'buyer',
    filters: {
      geography: ['geo-it-palermo', 'geo-it-catania'],
      tags: ['court', 'police-accountability'],
    },
    reason: 'Tracking Italian police accountability proceedings for editorial package.',
    matchingStoryIds: ['story-010'],
    matchingAssetIds: ['asset-034', 'asset-035', 'asset-036', 'asset-037'],
    matchingArticleIds: ['article-006b'],
    alertEnabled: true,
    lastTriggered: '2026-03-10T10:00:00Z',
  },
  {
    id: 'search-006',
    label: 'Heatwave hospital corridor',
    query: 'heatwave hospital overflow corridor Marseille',
    userType: 'buyer',
    filters: {
      geography: ['geo-fr-marseille'],
      tags: ['heatwave', 'hospital-pressure', 'public-health'],
    },
    reason: 'Sourcing hospital pressure documentation for public health feature.',
    matchingStoryIds: ['story-006'],
    matchingAssetIds: ['asset-020', 'asset-021', 'asset-022', 'asset-023'],
    matchingArticleIds: ['article-004'],
    alertEnabled: true,
    lastTriggered: '2026-03-02T10:00:00Z',
  },
  {
    id: 'search-007',
    label: 'Transit strike commuter terminals',
    query: 'transit strike metro bus commuter Warsaw Poland',
    userType: 'buyer',
    filters: {
      geography: ['geo-pl-warsaw'],
      tags: ['strike', 'transit-disruption'],
    },
    reason: 'Licensing transit disruption imagery for European labor coverage.',
    matchingStoryIds: ['story-007'],
    matchingAssetIds: ['asset-025', 'asset-026', 'asset-027', 'asset-028'],
    matchingArticleIds: ['article-005'],
    alertEnabled: false,
    lastTriggered: '2026-03-15T10:00:00Z',
  },
  {
    id: 'search-008',
    label: 'Port congestion truck queue',
    query: 'port congestion truck queue Fos-sur-Mer Marseille',
    userType: 'buyer',
    filters: {
      geography: ['geo-fr-fos', 'geo-fr-marseille'],
      tags: ['port-congestion', 'logistics'],
    },
    reason: 'Tracking port logistics disruption in southern France for trade impact reporting.',
    matchingStoryIds: ['story-012'],
    matchingAssetIds: ['asset-041', 'asset-042'],
    matchingArticleIds: ['article-005'],
    alertEnabled: true,
    lastTriggered: '2026-03-15T10:00:00Z',
  },
  {
    id: 'search-009',
    label: 'Drought water distribution',
    query: 'drought water tanker distribution Almería Andalusia',
    userType: 'buyer',
    filters: {
      geography: ['geo-es-almeria', 'geo-es-huelva'],
      tags: ['drought', 'water-access', 'distribution'],
    },
    reason: 'Sourcing drought response documentation and data visualizations for climate reporting.',
    matchingStoryIds: ['story-009'],
    matchingAssetIds: ['asset-033', 'asset-047', 'asset-048'],
    matchingArticleIds: ['article-007'],
    alertEnabled: true,
    lastTriggered: '2026-03-12T10:00:00Z',
  },
  {
    id: 'search-010',
    label: 'Student protest education cuts',
    query: 'student protest education university funding Bucharest Romania',
    userType: 'reader',
    filters: {
      geography: ['geo-ro-bucharest'],
      tags: ['protest', 'civic-unrest'],
    },
    reason: 'Following student mobilization coverage in Eastern Europe.',
    matchingStoryIds: ['story-008'],
    matchingAssetIds: ['asset-030', 'asset-031', 'asset-032'],
    matchingArticleIds: ['article-006'],
    alertEnabled: false,
    lastTriggered: '2026-02-20T10:00:00Z',
  },
]

export const savedSearchMap = Object.fromEntries(savedSearches.map(s => [s.id, s]))
