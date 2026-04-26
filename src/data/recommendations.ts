// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Recommendation Dataset
// 22 recommendation groups powering discovery rails
// ═══════════════════════════════════════════════════════════════

export type RecommendationModuleType =
  | 'more-from-story'
  | 'related-assets'
  | 'related-stories'
  | 'connected-articles'
  | 'same-geography'
  | 'same-creator'
  | 'saved-search-match'
  | 'shortlist-expansion'
  | 'spotlight'
  | 'curated'

export interface RecommendationGroup {
  id: string
  sourceType: 'asset' | 'story' | 'article' | 'search' | 'lightbox'
  sourceId: string
  title: string
  reasonLabel: string
  targetAssetIds: string[]
  targetStoryIds: string[]
  targetArticleIds: string[]
  rationale: string
  moduleType: RecommendationModuleType
}

export const recommendations: RecommendationGroup[] = [
  // ═══════════════════════════════════════════════
  // MORE FROM STORY
  // ═══════════════════════════════════════════════
  {
    id: 'rec-001',
    sourceType: 'asset',
    sourceId: 'asset-001',
    title: 'More from this Story',
    reasonLabel: 'Same Story',
    targetAssetIds: ['asset-002', 'asset-003', 'asset-004', 'asset-005'],
    targetStoryIds: [],
    targetArticleIds: [],
    rationale: 'Other assets in the Guaíba Flood Displacement Story by Marco Oliveira.',
    moduleType: 'more-from-story',
  },
  {
    id: 'rec-002',
    sourceType: 'asset',
    sourceId: 'asset-006',
    title: 'More from this Story',
    reasonLabel: 'Same Story',
    targetAssetIds: ['asset-007', 'asset-008', 'asset-009'],
    targetStoryIds: [],
    targetArticleIds: [],
    rationale: 'Other assets in the Lisbon Confidence Vote Story by Ana Sousa.',
    moduleType: 'more-from-story',
  },
  {
    id: 'rec-003',
    sourceType: 'asset',
    sourceId: 'asset-020',
    title: 'More from this Story',
    reasonLabel: 'Same Story',
    targetAssetIds: ['asset-021', 'asset-022', 'asset-023'],
    targetStoryIds: [],
    targetArticleIds: [],
    rationale: 'Other assets in the Marseille Heatwave Hospital Overload Story by Yara Boukhari.',
    moduleType: 'more-from-story',
  },
  {
    id: 'rec-004',
    sourceType: 'asset',
    sourceId: 'asset-013',
    title: 'More from this Story',
    reasonLabel: 'Same Story',
    targetAssetIds: ['asset-014', 'asset-015', 'asset-016'],
    targetStoryIds: [],
    targetArticleIds: [],
    rationale: 'Other assets in the Evros Border Bottleneck Story.',
    moduleType: 'more-from-story',
  },

  // ═══════════════════════════════════════════════
  // CONNECTED ARTICLES
  // ═══════════════════════════════════════════════
  {
    id: 'rec-005',
    sourceType: 'asset',
    sourceId: 'asset-001',
    title: 'Connected Articles',
    reasonLabel: 'Connected article',
    targetAssetIds: [],
    targetStoryIds: [],
    targetArticleIds: ['article-001'],
    rationale: 'This asset is a source in "Evacuation Routes Reshaped by Floodwater and Bridge Failure."',
    moduleType: 'connected-articles',
  },
  {
    id: 'rec-006',
    sourceType: 'asset',
    sourceId: 'asset-020',
    title: 'Connected Articles',
    reasonLabel: 'Connected article',
    targetAssetIds: [],
    targetStoryIds: [],
    targetArticleIds: ['article-004'],
    rationale: 'This asset is a source in "How a Hospital Overflow Story Spread Across Districts."',
    moduleType: 'connected-articles',
  },
  {
    id: 'rec-007',
    sourceType: 'story',
    sourceId: 'story-007',
    title: 'Connected Articles',
    reasonLabel: 'Connected article',
    targetAssetIds: [],
    targetStoryIds: [],
    targetArticleIds: ['article-005'],
    rationale: 'Assets from this Story are sources in the transit strike and port congestion analysis.',
    moduleType: 'connected-articles',
  },

  // ═══════════════════════════════════════════════
  // RELATED STORIES
  // ═══════════════════════════════════════════════
  {
    id: 'rec-008',
    sourceType: 'story',
    sourceId: 'story-001',
    title: 'Related Stories',
    reasonLabel: 'Related coverage',
    targetAssetIds: [],
    targetStoryIds: ['story-011', 'story-009', 'story-014'],
    targetArticleIds: [],
    rationale: 'Related displacement, water access, and storm damage coverage across southern Brazil and Europe.',
    moduleType: 'related-stories',
  },
  {
    id: 'rec-009',
    sourceType: 'story',
    sourceId: 'story-004',
    title: 'Related Stories',
    reasonLabel: 'Related coverage',
    targetAssetIds: [],
    targetStoryIds: ['story-001', 'story-011'],
    targetArticleIds: [],
    rationale: 'Connected displacement coverage across Evros and southern Brazil.',
    moduleType: 'related-stories',
  },
  {
    id: 'rec-010',
    sourceType: 'story',
    sourceId: 'story-007',
    title: 'Related Stories',
    reasonLabel: 'Same geography',
    targetAssetIds: [],
    targetStoryIds: ['story-013'],
    targetArticleIds: [],
    rationale: 'Both Stories cover Warsaw and share the same creator.',
    moduleType: 'related-stories',
  },

  // ═══════════════════════════════════════════════
  // SAME GEOGRAPHY
  // ═══════════════════════════════════════════════
  {
    id: 'rec-011',
    sourceType: 'asset',
    sourceId: 'asset-010',
    title: 'Same geography',
    reasonLabel: 'Same geography',
    targetAssetIds: ['asset-045', 'asset-046'],
    targetStoryIds: ['story-014'],
    targetArticleIds: [],
    rationale: 'Related assets from the Setúbal district covering storm damage and coastal erosion.',
    moduleType: 'same-geography',
  },
  {
    id: 'rec-012',
    sourceType: 'asset',
    sourceId: 'asset-017',
    title: 'Same geography',
    reasonLabel: 'Same geography',
    targetAssetIds: ['asset-033', 'asset-047', 'asset-048'],
    targetStoryIds: ['story-009'],
    targetArticleIds: ['article-007'],
    rationale: 'Related assets from Andalusia covering drought response alongside wildfire recovery.',
    moduleType: 'same-geography',
  },

  // ═══════════════════════════════════════════════
  // SAME CREATOR
  // ═══════════════════════════════════════════════
  {
    id: 'rec-013',
    sourceType: 'story',
    sourceId: 'story-001',
    title: 'More from this creator',
    reasonLabel: 'Same creator',
    targetAssetIds: ['asset-038', 'asset-039', 'asset-040'],
    targetStoryIds: ['story-011'],
    targetArticleIds: [],
    rationale: 'Marco Oliveira also covers the Vila Floresta settlement eviction in Porto Alegre.',
    moduleType: 'same-creator',
  },
  {
    id: 'rec-014',
    sourceType: 'story',
    sourceId: 'story-006',
    title: 'More from this creator',
    reasonLabel: 'Same creator',
    targetAssetIds: ['asset-041', 'asset-042'],
    targetStoryIds: ['story-012'],
    targetArticleIds: [],
    rationale: 'Yara Boukhari also covers port congestion at Fos-sur-Mer.',
    moduleType: 'same-creator',
  },
  {
    id: 'rec-015',
    sourceType: 'story',
    sourceId: 'story-002',
    title: 'More from this creator',
    reasonLabel: 'Same creator',
    targetAssetIds: [],
    targetStoryIds: ['story-003', 'story-014'],
    targetArticleIds: [],
    rationale: 'Ana Sousa also covers coastal erosion and storm damage along the Setúbal coast.',
    moduleType: 'same-creator',
  },

  // ═══════════════════════════════════════════════
  // SAVED SEARCH MATCHES
  // ═══════════════════════════════════════════════
  {
    id: 'rec-016',
    sourceType: 'search',
    sourceId: 'search-001',
    title: 'From your saved searches',
    reasonLabel: 'From your saved searches',
    targetAssetIds: ['asset-038', 'asset-039', 'asset-040'],
    targetStoryIds: ['story-011'],
    targetArticleIds: [],
    rationale: 'New content matching "Flood displacement southern Brazil" — settlement eviction in Porto Alegre.',
    moduleType: 'saved-search-match',
  },
  {
    id: 'rec-017',
    sourceType: 'search',
    sourceId: 'search-006',
    title: 'From your saved searches',
    reasonLabel: 'From your saved searches',
    targetAssetIds: ['asset-022', 'asset-023'],
    targetStoryIds: [],
    targetArticleIds: ['article-004'],
    rationale: 'New content matching "Heatwave hospital corridor" — additional documentation and published Article.',
    moduleType: 'saved-search-match',
  },

  // ═══════════════════════════════════════════════
  // SHORTLIST EXPANSION
  // ═══════════════════════════════════════════════
  {
    id: 'rec-018',
    sourceType: 'lightbox',
    sourceId: 'lightbox-001',
    title: 'Expand your shortlist',
    reasonLabel: 'Related to your shortlist',
    targetAssetIds: ['asset-004', 'asset-005', 'asset-038'],
    targetStoryIds: ['story-011'],
    targetArticleIds: ['article-001'],
    rationale: 'Based on shortlisted flood assets: additional shelter documentation and connected eviction coverage.',
    moduleType: 'shortlist-expansion',
  },
  {
    id: 'rec-019',
    sourceType: 'lightbox',
    sourceId: 'lightbox-001',
    title: 'Full Stories from shortlisted assets',
    reasonLabel: 'Same Story',
    targetAssetIds: [],
    targetStoryIds: ['story-001', 'story-006'],
    targetArticleIds: [],
    rationale: 'Your shortlisted assets belong to these Stories. View the full coverage packages.',
    moduleType: 'shortlist-expansion',
  },

  // ═══════════════════════════════════════════════
  // SPOTLIGHT
  // ═══════════════════════════════════════════════
  {
    id: 'rec-020',
    sourceType: 'asset',
    sourceId: 'asset-001',
    title: 'Editor\'s Pick',
    reasonLabel: 'Recently surfaced in Spotlight',
    targetAssetIds: ['asset-013', 'asset-020', 'asset-025', 'asset-029', 'asset-034'],
    targetStoryIds: [],
    targetArticleIds: [],
    rationale: 'Top-engagement assets across active coverage clusters this week.',
    moduleType: 'spotlight',
  },

  // ═══════════════════════════════════════════════
  // ARTICLE → SOURCE STORIES
  // ═══════════════════════════════════════════════
  {
    id: 'rec-021',
    sourceType: 'article',
    sourceId: 'article-005',
    title: 'Source-connected Stories',
    reasonLabel: 'Source-connected content',
    targetAssetIds: [],
    targetStoryIds: ['story-007', 'story-012'],
    targetArticleIds: [],
    rationale: 'This Article draws source assets from these two Stories.',
    moduleType: 'related-stories',
  },
  {
    id: 'rec-022',
    sourceType: 'article',
    sourceId: 'article-001',
    title: 'Related Articles',
    reasonLabel: 'Related coverage',
    targetAssetIds: [],
    targetStoryIds: [],
    targetArticleIds: ['article-004', 'article-008'],
    rationale: 'Related displacement and recovery coverage from Marseille and Huelva.',
    moduleType: 'connected-articles',
  },
]

export const recommendationMap = Object.fromEntries(recommendations.map(r => [r.id, r]))

// Helper: get recommendations for a given source
export function getRecommendationsFor(sourceType: string, sourceId: string): RecommendationGroup[] {
  return recommendations.filter(r => r.sourceType === sourceType && r.sourceId === sourceId)
}

// Helper: get recommendations by module type
export function getRecommendationsByType(moduleType: RecommendationModuleType): RecommendationGroup[] {
  return recommendations.filter(r => r.moduleType === moduleType)
}
