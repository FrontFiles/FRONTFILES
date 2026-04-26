// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Editor's Pick Spotlight Dataset
// Automated recommendation surface — no editorial judgement implied
// Validation Declaration state has ZERO ranking weight
// ═══════════════════════════════════════════════════════════════

export interface SpotlightItem {
  id: string
  objectType: 'asset' | 'story' | 'article'
  objectId: string
  recencyScore: number    // 0–100, higher = more recent activity
  engagementScore: number // 0–100, higher = more buyer engagement
  spotlightWeight: number // combined weight for ranking
  displayReason: string
}

export const spotlightItems: SpotlightItem[] = [
  // ── Top tier: active coverage clusters ──
  {
    id: 'spot-001',
    objectType: 'asset',
    objectId: 'asset-001',
    recencyScore: 88,
    engagementScore: 94,
    spotlightWeight: 92,
    displayReason: 'Strong buyer engagement this week',
  },
  {
    id: 'spot-002',
    objectType: 'story',
    objectId: 'story-001',
    recencyScore: 90,
    engagementScore: 91,
    spotlightWeight: 92,
    displayReason: 'Active in tracked geography',
  },
  {
    id: 'spot-003',
    objectType: 'asset',
    objectId: 'asset-020',
    recencyScore: 82,
    engagementScore: 90,
    spotlightWeight: 88,
    displayReason: 'Recent shortlist activity',
  },
  {
    id: 'spot-004',
    objectType: 'story',
    objectId: 'story-006',
    recencyScore: 80,
    engagementScore: 88,
    spotlightWeight: 88,
    displayReason: 'New certified coverage in this cluster',
  },
  {
    id: 'spot-005',
    objectType: 'asset',
    objectId: 'asset-013',
    recencyScore: 78,
    engagementScore: 86,
    spotlightWeight: 85,
    displayReason: 'Active in tracked geography',
  },

  // ── Mid tier: strong engagement or recent activity ──
  {
    id: 'spot-006',
    objectType: 'article',
    objectId: 'article-001',
    recencyScore: 85,
    engagementScore: 78,
    spotlightWeight: 82,
    displayReason: 'New certified coverage in this cluster',
  },
  {
    id: 'spot-007',
    objectType: 'asset',
    objectId: 'asset-006',
    recencyScore: 72,
    engagementScore: 80,
    spotlightWeight: 78,
    displayReason: 'Strong buyer engagement this week',
  },
  {
    id: 'spot-008',
    objectType: 'story',
    objectId: 'story-013',
    recencyScore: 92,
    engagementScore: 68,
    spotlightWeight: 76,
    displayReason: 'New certified coverage in this cluster',
  },
  {
    id: 'spot-009',
    objectType: 'asset',
    objectId: 'asset-034',
    recencyScore: 70,
    engagementScore: 74,
    spotlightWeight: 73,
    displayReason: 'Recent shortlist activity',
  },
  {
    id: 'spot-010',
    objectType: 'asset',
    objectId: 'asset-025',
    recencyScore: 68,
    engagementScore: 72,
    spotlightWeight: 71,
    displayReason: 'Active in tracked geography',
  },

  // ── Lower tier: steady engagement ──
  {
    id: 'spot-011',
    objectType: 'story',
    objectId: 'story-011',
    recencyScore: 85,
    engagementScore: 60,
    spotlightWeight: 68,
    displayReason: 'New certified coverage in this cluster',
  },
  {
    id: 'spot-012',
    objectType: 'article',
    objectId: 'article-005',
    recencyScore: 70,
    engagementScore: 66,
    spotlightWeight: 68,
    displayReason: 'Strong buyer engagement this week',
  },
  {
    id: 'spot-013',
    objectType: 'story',
    objectId: 'story-008',
    recencyScore: 60,
    engagementScore: 68,
    spotlightWeight: 66,
    displayReason: 'Active in tracked geography',
  },
  {
    id: 'spot-014',
    objectType: 'asset',
    objectId: 'asset-029',
    recencyScore: 90,
    engagementScore: 55,
    spotlightWeight: 65,
    displayReason: 'New certified coverage in this cluster',
  },
  {
    id: 'spot-015',
    objectType: 'article',
    objectId: 'article-002',
    recencyScore: 65,
    engagementScore: 62,
    spotlightWeight: 64,
    displayReason: 'Recent shortlist activity',
  },
  {
    id: 'spot-016',
    objectType: 'story',
    objectId: 'story-005',
    recencyScore: 55,
    engagementScore: 65,
    spotlightWeight: 62,
    displayReason: 'Active in tracked geography',
  },
  {
    id: 'spot-017',
    objectType: 'asset',
    objectId: 'asset-033',
    recencyScore: 58,
    engagementScore: 60,
    spotlightWeight: 59,
    displayReason: 'Active in tracked geography',
  },
  {
    id: 'spot-018',
    objectType: 'story',
    objectId: 'story-003',
    recencyScore: 50,
    engagementScore: 56,
    spotlightWeight: 55,
    displayReason: 'Ongoing documentation in this geography',
  },
  {
    id: 'spot-019',
    objectType: 'story',
    objectId: 'story-012',
    recencyScore: 52,
    engagementScore: 54,
    spotlightWeight: 54,
    displayReason: 'Recent shortlist activity',
  },
  {
    id: 'spot-020',
    objectType: 'story',
    objectId: 'story-014',
    recencyScore: 45,
    engagementScore: 48,
    spotlightWeight: 48,
    displayReason: 'Ongoing documentation in this geography',
  },
]

// Sorted by spotlight weight descending
export const spotlightRanked = [...spotlightItems].sort((a, b) => b.spotlightWeight - a.spotlightWeight)
