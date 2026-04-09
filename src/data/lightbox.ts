// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Lightbox / Shortlist Dataset
// Mock buyer shortlists for Cross-Story Discovery testing
// ═══════════════════════════════════════════════════════════════

export interface LightboxData {
  id: string
  name: string
  buyerId: string
  assetIds: string[]
  createdAt: string
  updatedAt: string
  // Derived discovery data
  sourceStoryIds: string[]
  sourceCreatorIds: string[]
  connectedArticleIds: string[]
  geographyClusters: string[]
}

export const lightboxes: LightboxData[] = [
  {
    id: 'lightbox-001',
    name: 'Brazil Flood Coverage Q1',
    buyerId: 'buyer-001',
    assetIds: ['asset-001', 'asset-002', 'asset-003'],
    createdAt: '2026-03-12T10:00:00Z',
    updatedAt: '2026-03-14T16:00:00Z',
    sourceStoryIds: ['story-001'],
    sourceCreatorIds: ['creator-001'],
    connectedArticleIds: ['article-001'],
    geographyClusters: ['geo-br-poa', 'geo-br-canoas', 'geo-br-eldorado'],
  },
  {
    id: 'lightbox-002',
    name: 'Hospital & Health Pressure',
    buyerId: 'buyer-001',
    assetIds: ['asset-020', 'asset-021', 'asset-022'],
    createdAt: '2026-02-25T08:00:00Z',
    updatedAt: '2026-03-02T14:00:00Z',
    sourceStoryIds: ['story-006'],
    sourceCreatorIds: ['creator-005'],
    connectedArticleIds: ['article-004'],
    geographyClusters: ['geo-fr-marseille'],
  },
  {
    id: 'lightbox-003',
    name: 'EU Border & Migration',
    buyerId: 'buyer-001',
    assetIds: ['asset-013', 'asset-015', 'asset-016'],
    createdAt: '2026-02-20T12:00:00Z',
    updatedAt: '2026-02-22T10:00:00Z',
    sourceStoryIds: ['story-004'],
    sourceCreatorIds: ['creator-003', 'creator-009'],
    connectedArticleIds: ['article-003'],
    geographyClusters: ['geo-gr-evros', 'geo-gr-orestiada', 'geo-gr-alexandroupoli'],
  },
  {
    id: 'lightbox-004',
    name: 'Court & Accountability',
    buyerId: 'buyer-002',
    assetIds: ['asset-034', 'asset-035', 'asset-036'],
    createdAt: '2026-03-06T18:00:00Z',
    updatedAt: '2026-03-07T10:00:00Z',
    sourceStoryIds: ['story-010'],
    sourceCreatorIds: ['creator-004'],
    connectedArticleIds: ['article-006b'],
    geographyClusters: ['geo-it-catania'],
  },
]

export const lightboxMap = Object.fromEntries(lightboxes.map(l => [l.id, l]))
