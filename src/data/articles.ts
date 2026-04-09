// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Article Dataset
// 8 Articles: evidence-led editorial records with source linkage
// ═══════════════════════════════════════════════════════════════

export interface ArticleData {
  id: string
  slug: string
  title: string
  dek: string
  summary: string
  articleType: 'creator_article' | 'frontfiles_article'
  editorName: string | null
  creatorName: string | null
  sourceAssetIds: string[]
  sourceStoryIds: string[]
  sourceCreatorIds: string[]
  primaryGeography: string
  topicTags: string[]
  publishedAt: string
  heroAssetId: string
  wordCount: number
  relatedArticleIds: string[]
  relatedStoryIds: string[]
  relatedAssetIds: string[]
  recommendationReasons: string[]
  spotlightEligible: boolean
  curatedEligible: boolean
}

export const articles: ArticleData[] = [
  // ═══════════════════════════════════════════════
  // 1. FLOOD EVACUATION — Brazil
  // ═══════════════════════════════════════════════
  {
    id: 'article-001',
    slug: 'guaiba-evacuation-routes-reshaped',
    title: 'Evacuation Routes Reshaped by Floodwater and Bridge Failure',
    dek: 'How the BR-290 overpass collapse forced a 40km detour for 12,000 displaced residents during the Guaíba flood.',
    summary: 'Analysis of evacuation route disruption during the March 2026 Guaíba river flood event. Built from certified aerial photography, ground-level shelter documentation, and field audio testimony. Examines how the BR-290 bridge failure compounded displacement logistics across three municipalities.',
    articleType: 'frontfiles_article',
    editorName: 'Frontfiles Editorial',
    creatorName: null,
    sourceAssetIds: ['asset-001', 'asset-002', 'asset-003', 'asset-005'],
    sourceStoryIds: ['story-001'],
    sourceCreatorIds: ['creator-001'],
    primaryGeography: 'geo-br-poa',
    topicTags: ['flood', 'evacuation', 'displacement'],
    publishedAt: '2026-03-18T10:00:00Z',
    heroAssetId: 'asset-001',
    wordCount: 3800,
    relatedArticleIds: ['article-004', 'article-008'],
    relatedStoryIds: ['story-001', 'story-011'],
    relatedAssetIds: ['asset-004', 'asset-038'],
    recommendationReasons: ['Source-connected content', 'Same geography', 'Flood coverage cluster'],
    spotlightEligible: true,
    curatedEligible: true,
  },

  // ═══════════════════════════════════════════════
  // 2. PARLIAMENTARY CONFIDENCE VOTE — Lisbon
  // ═══════════════════════════════════════════════
  {
    id: 'article-002',
    slug: 'lisbon-confidence-vote-timeline',
    title: 'Timeline of the Lisbon Confidence Vote',
    dek: 'A certified source-image chronology of the March 21 parliamentary confidence motion at the Assembleia da República.',
    summary: 'Hour-by-hour reconstruction of the March 2026 confidence vote using certified parliamentary photographs and institutional video. Maps the floor session, corridor negotiations, press gallery activity, and street-level public response.',
    articleType: 'creator_article',
    editorName: null,
    creatorName: 'Ana Sousa',
    sourceAssetIds: ['asset-006', 'asset-007'],
    sourceStoryIds: ['story-002'],
    sourceCreatorIds: ['creator-002'],
    primaryGeography: 'geo-pt-lisbon',
    topicTags: ['parliament', 'municipal-politics'],
    publishedAt: '2026-03-24T08:00:00Z',
    heroAssetId: 'asset-006',
    wordCount: 2900,
    relatedArticleIds: ['article-006'],
    relatedStoryIds: ['story-002', 'story-013'],
    relatedAssetIds: ['asset-008', 'asset-009'],
    recommendationReasons: ['Source-connected content', 'Institutional reporting cluster'],
    spotlightEligible: true,
    curatedEligible: true,
  },

  // ═══════════════════════════════════════════════
  // 3. BORDER CROSSING — Evros
  // ═══════════════════════════════════════════════
  {
    id: 'article-003',
    slug: 'evros-bottleneck-processing-delay',
    title: 'Processing Delays and Queue Buildup at the EU External Frontier',
    dek: 'How a 12-day surge at Kastanies–Pazarkule exposed processing capacity failures across three reception points.',
    summary: 'Examination of the February 2026 border surge at Evros using certified checkpoint photography, reception center documentation, and humanitarian distribution records from two independent creators. Traces the capacity failure from the border post to downstream processing facilities.',
    articleType: 'frontfiles_article',
    editorName: 'Frontfiles Editorial',
    creatorName: null,
    sourceAssetIds: ['asset-013', 'asset-014', 'asset-016'],
    sourceStoryIds: ['story-004'],
    sourceCreatorIds: ['creator-003', 'creator-009'],
    primaryGeography: 'geo-gr-evros',
    topicTags: ['border-crossing', 'asylum', 'displacement', 'logistics'],
    publishedAt: '2026-02-28T10:00:00Z',
    heroAssetId: 'asset-013',
    wordCount: 4200,
    relatedArticleIds: ['article-001'],
    relatedStoryIds: ['story-004', 'story-001'],
    relatedAssetIds: ['asset-015'],
    recommendationReasons: ['Source-connected content', 'Displacement cluster', 'Multi-creator sourcing'],
    spotlightEligible: true,
    curatedEligible: true,
  },

  // ═══════════════════════════════════════════════
  // 4. HOSPITAL OVERFLOW — Marseille heatwave
  // ═══════════════════════════════════════════════
  {
    id: 'article-004',
    slug: 'marseille-hospital-overflow-heatwave',
    title: 'How a Hospital Overflow Story Spread Across Districts During a Heatwave',
    dek: 'Corridor conditions at Hôpital Nord and the municipal response that arrived three days late.',
    summary: 'Investigation of the hospital capacity failure during the February 2026 Marseille heat event. Built from certified corridor photography, ambulance queue video, and frontline nurse testimony. Tracks the escalation from single-facility overflow to district-wide emergency response.',
    articleType: 'frontfiles_article',
    editorName: 'Frontfiles Editorial',
    creatorName: null,
    sourceAssetIds: ['asset-020', 'asset-021'],
    sourceStoryIds: ['story-006'],
    sourceCreatorIds: ['creator-005'],
    primaryGeography: 'geo-fr-marseille',
    topicTags: ['heatwave', 'hospital-pressure', 'public-health'],
    publishedAt: '2026-03-02T10:00:00Z',
    heroAssetId: 'asset-020',
    wordCount: 3500,
    relatedArticleIds: ['article-001', 'article-007'],
    relatedStoryIds: ['story-006', 'story-012'],
    relatedAssetIds: ['asset-022', 'asset-023'],
    recommendationReasons: ['Source-connected content', 'Public health cluster', 'Same geography: Marseille'],
    spotlightEligible: true,
    curatedEligible: true,
  },

  // ═══════════════════════════════════════════════
  // 5. TRANSIT STRIKE + PORT CONGESTION — Warsaw / Marseille
  // ═══════════════════════════════════════════════
  {
    id: 'article-005',
    slug: 'transit-strike-port-congestion-dual-city',
    title: 'Transit Strike City Impact Across Terminals, Depots, and Commuter Hubs',
    dek: 'Parallel disruptions in Warsaw and Fos-sur-Mer through certified source reporting from two creators.',
    summary: 'Cross-geography analysis of labor-driven transport disruption in Warsaw and Fos-sur-Mer. Connects transit strike documentation from Warsaw metro and bus depots with port congestion footage from Fos-sur-Mer. Maps the cascading impact on commuter infrastructure and freight logistics.',
    articleType: 'frontfiles_article',
    editorName: 'Frontfiles Editorial',
    creatorName: null,
    sourceAssetIds: ['asset-025', 'asset-026', 'asset-041', 'asset-042'],
    sourceStoryIds: ['story-007', 'story-012'],
    sourceCreatorIds: ['creator-006', 'creator-005'],
    primaryGeography: 'geo-pl-warsaw',
    topicTags: ['strike', 'transit-disruption', 'port-congestion', 'logistics'],
    publishedAt: '2026-03-15T10:00:00Z',
    heroAssetId: 'asset-025',
    wordCount: 4100,
    relatedArticleIds: ['article-004'],
    relatedStoryIds: ['story-007', 'story-012', 'story-013'],
    relatedAssetIds: ['asset-027', 'asset-028'],
    recommendationReasons: ['Source-connected content', 'Multi-geography sourcing', 'Labor disruption cluster'],
    spotlightEligible: true,
    curatedEligible: true,
  },

  // ═══════════════════════════════════════════════
  // 6. STUDENT DEMONSTRATIONS — Bucharest
  // ═══════════════════════════════════════════════
  {
    id: 'article-006',
    slug: 'bucharest-student-protest-chronology',
    title: 'Campus Barricades to Parliament Steps: A Protest Chronology',
    dek: 'Ten days of student mobilization in Bucharest built from certified on-site reporting.',
    summary: 'Day-by-day chronology of the February 2026 Bucharest student demonstrations using certified barricade photography, march video, and primary source documents. Covers the escalation from campus protest to parliament-directed mobilization.',
    articleType: 'creator_article',
    editorName: null,
    creatorName: 'Elena Vasile',
    sourceAssetIds: ['asset-030', 'asset-031'],
    sourceStoryIds: ['story-008'],
    sourceCreatorIds: ['creator-007'],
    primaryGeography: 'geo-ro-bucharest',
    topicTags: ['protest', 'civic-unrest', 'municipal-politics'],
    publishedAt: '2026-02-20T10:00:00Z',
    heroAssetId: 'asset-030',
    wordCount: 3200,
    relatedArticleIds: ['article-002'],
    relatedStoryIds: ['story-008', 'story-007'],
    relatedAssetIds: ['asset-032'],
    recommendationReasons: ['Source-connected content', 'Civic unrest cluster'],
    spotlightEligible: true,
    curatedEligible: false,
  },

  // ═══════════════════════════════════════════════
  // 6b. COURT HEARING — Palermo (bonus — referenced by story-010)
  // ═══════════════════════════════════════════════
  {
    id: 'article-006b',
    slug: 'palermo-ferraro-court-chronology',
    title: 'Court-Day Chronology of the Ferraro Misconduct Case',
    dek: 'Three days at the Catania tribunal built from certified on-site court reporting.',
    summary: 'Procedural chronology of the Ferraro police misconduct hearing using certified courtroom photography and legal briefing documentation. Covers witness testimony sequences, procedural rulings, and public gallery dynamics across three hearing days.',
    articleType: 'creator_article',
    editorName: null,
    creatorName: 'Lucia Ferrante',
    sourceAssetIds: ['asset-034', 'asset-035'],
    sourceStoryIds: ['story-010'],
    sourceCreatorIds: ['creator-004'],
    primaryGeography: 'geo-it-catania',
    topicTags: ['court', 'police-accountability'],
    publishedAt: '2026-03-10T10:00:00Z',
    heroAssetId: 'asset-034',
    wordCount: 2800,
    relatedArticleIds: ['article-006'],
    relatedStoryIds: ['story-010'],
    relatedAssetIds: ['asset-036', 'asset-037'],
    recommendationReasons: ['Source-connected content', 'Court proceedings cluster'],
    spotlightEligible: true,
    curatedEligible: false,
  },

  // ═══════════════════════════════════════════════
  // 7. DROUGHT RESPONSE — Almería
  // ═══════════════════════════════════════════════
  {
    id: 'article-007',
    slug: 'almeria-drought-tanker-deliveries-mapped',
    title: 'Drought Response Mapped Through Tanker Deliveries and Village Queues',
    dek: 'How 14 villages in eastern Almería survive on a tanker schedule during the worst drought in 40 years.',
    summary: 'Data-led analysis of the drought emergency response in Almería using certified infographics, tanker route illustrations, and ground-level distribution photography. Maps the logistics of daily water delivery across 14 villages and examines the municipal coordination failures.',
    articleType: 'frontfiles_article',
    editorName: 'Frontfiles Editorial',
    creatorName: null,
    sourceAssetIds: ['asset-033', 'asset-047', 'asset-048'],
    sourceStoryIds: ['story-009'],
    sourceCreatorIds: ['creator-008'],
    primaryGeography: 'geo-es-almeria',
    topicTags: ['drought', 'water-access', 'distribution'],
    publishedAt: '2026-03-12T10:00:00Z',
    heroAssetId: 'asset-033',
    wordCount: 3600,
    relatedArticleIds: ['article-004', 'article-008'],
    relatedStoryIds: ['story-009', 'story-005'],
    relatedAssetIds: [],
    recommendationReasons: ['Source-connected content', 'Water access cluster', 'Data visualization sourcing'],
    spotlightEligible: true,
    curatedEligible: true,
  },

  // ═══════════════════════════════════════════════
  // 8. WILDFIRE RECOVERY — Huelva
  // ═══════════════════════════════════════════════
  {
    id: 'article-008',
    slug: 'huelva-wildfire-before-after-recovery',
    title: 'Wildfire Recovery Built from Before/After Source Assets',
    dek: 'Burn scar data and village recovery documentation six weeks after the Huelva fires.',
    summary: 'Recovery assessment article using certified burn-scar infographics and village-level reconstruction photography. Compares fire-advance timeline data with six-week recovery progress, examining municipal response effectiveness and agricultural loss permanence.',
    articleType: 'frontfiles_article',
    editorName: 'Frontfiles Editorial',
    creatorName: null,
    sourceAssetIds: ['asset-017', 'asset-018'],
    sourceStoryIds: ['story-005'],
    sourceCreatorIds: ['creator-008'],
    primaryGeography: 'geo-es-huelva',
    topicTags: ['wildfire', 'recovery'],
    publishedAt: '2026-03-08T10:00:00Z',
    heroAssetId: 'asset-017',
    wordCount: 2700,
    relatedArticleIds: ['article-007', 'article-001'],
    relatedStoryIds: ['story-005', 'story-009'],
    relatedAssetIds: ['asset-019'],
    recommendationReasons: ['Source-connected content', 'Wildfire cluster', 'Same Andalusia geography'],
    spotlightEligible: true,
    curatedEligible: false,
  },
]

export const articleMap = Object.fromEntries(articles.map(a => [a.id, a]))
export const articleBySlug = Object.fromEntries(articles.map(a => [a.slug, a]))
