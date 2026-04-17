// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Story Dataset
// 14 Stories: canonical discovery objects with full relationships
// ═══════════════════════════════════════════════════════════════

export interface StoryData {
  id: string
  slug: string
  title: string
  dek: string
  summary: string
  creatorId: string
  primaryGeography: string
  secondaryGeographies: string[]
  topicTags: string[]
  coverageWindow: { start: string; end: string }
  heroAssetId: string
  assetIds: string[]
  articleIds: string[]
  recommendedStoryIds: string[]
  spotlightWeight: number
  curatedEligible: boolean
  discoveryReasonHints: string[]
}

export const stories: StoryData[] = [
  // ═══════════════════════════════════════════════
  // 1. FLOOD DISPLACEMENT — Southern Brazil
  // ═══════════════════════════════════════════════
  {
    id: 'story-001',
    slug: 'guaiba-flood-displacement-2026',
    title: 'Guaíba Flood Displacement',
    dek: 'Evacuation, shelter overflow, and bridge failure in southern Brazil after the Guaíba river breached levee systems for the second time in 18 months.',
    summary: 'Comprehensive visual documentation of the March 2026 Guaíba river flood event across Porto Alegre, Canoas, and Eldorado do Sul. Covers evacuation routes, shelter capacity failures, road infrastructure collapse, and displacement camp conditions over a 12-day window.',
    creatorId: 'creator-001',
    primaryGeography: 'geo-br-poa',
    secondaryGeographies: ['geo-br-canoas', 'geo-br-eldorado'],
    topicTags: ['flood', 'displacement', 'evacuation'],
    coverageWindow: { start: '2026-03-08', end: '2026-03-19' },
    heroAssetId: 'asset-001',
    assetIds: ['asset-001', 'asset-002', 'asset-003', 'asset-004', 'asset-005'],
    articleIds: ['article-001'],
    recommendedStoryIds: ['story-011', 'story-009', 'story-014'],
    spotlightWeight: 92,
    curatedEligible: true,
    discoveryReasonHints: ['Active flood coverage', 'Strong buyer engagement this week', 'Matched by 3 saved searches'],
  },

  // ═══════════════════════════════════════════════
  // 2. PARLIAMENTARY CONFIDENCE VOTE — Lisbon
  // ═══════════════════════════════════════════════
  {
    id: 'story-002',
    slug: 'lisbon-confidence-vote-2026',
    title: 'Lisbon Confidence Vote',
    dek: 'Floor session, corridor negotiation, and public response during the March 2026 parliamentary confidence vote at the Assembleia da República.',
    summary: 'Institutional photography of the confidence vote session in Lisbon. Covers the chamber floor, corridor negotiations, press gallery, and public gathering outside São Bento Palace over two days.',
    creatorId: 'creator-002',
    primaryGeography: 'geo-pt-lisbon',
    secondaryGeographies: [],
    topicTags: ['parliament', 'municipal-politics'],
    coverageWindow: { start: '2026-03-21', end: '2026-03-22' },
    heroAssetId: 'asset-006',
    assetIds: ['asset-006', 'asset-007', 'asset-008', 'asset-009'],
    articleIds: ['article-002'],
    recommendedStoryIds: ['story-013', 'story-008'],
    spotlightWeight: 78,
    curatedEligible: true,
    discoveryReasonHints: ['Recent institutional coverage', 'Parliament cluster active'],
  },

  // ═══════════════════════════════════════════════
  // 3. COASTAL EROSION — Setúbal coast
  // ═══════════════════════════════════════════════
  {
    id: 'story-003',
    slug: 'setubal-coastal-erosion',
    title: 'Setúbal Coastal Erosion',
    dek: 'Cliff retreat, beach infrastructure loss, and impact on fishing communities along the Arrábida coastline south of Lisbon.',
    summary: 'Long-running documentation of coastal erosion between Sesimbra and Sines. Covers cliff retreat measurement, damaged fishing infrastructure, abandoned beach structures, and community interviews over a three-month reporting window.',
    creatorId: 'creator-002',
    primaryGeography: 'geo-pt-setubal',
    secondaryGeographies: ['geo-pt-sines'],
    topicTags: ['coastal-erosion', 'fishing', 'displacement'],
    coverageWindow: { start: '2026-01-10', end: '2026-03-28' },
    heroAssetId: 'asset-010',
    assetIds: ['asset-010', 'asset-011', 'asset-012'],
    articleIds: [],
    recommendedStoryIds: ['story-014', 'story-002'],
    spotlightWeight: 55,
    curatedEligible: false,
    discoveryReasonHints: ['Same geography cluster', 'Coastal impact reporting'],
  },

  // ═══════════════════════════════════════════════
  // 4. BORDER CROSSING BOTTLENECK — Evros
  // ═══════════════════════════════════════════════
  {
    id: 'story-004',
    slug: 'evros-border-bottleneck',
    title: 'Evros Border Bottleneck',
    dek: 'Processing delays, queue buildup, and aid distribution at the Kastanies–Pazarkule crossing during the February 2026 surge.',
    summary: 'On-the-ground documentation of the Evros border crossing during the February surge. Covers vehicle queues, processing center conditions, NGO distribution points, temporary shelter, and overnight staging areas at Kastanies and Orestiada.',
    creatorId: 'creator-003',
    primaryGeography: 'geo-gr-evros',
    secondaryGeographies: ['geo-gr-orestiada', 'geo-gr-alexandroupoli'],
    topicTags: ['border-crossing', 'asylum', 'displacement', 'logistics'],
    coverageWindow: { start: '2026-02-12', end: '2026-02-24' },
    heroAssetId: 'asset-013',
    assetIds: ['asset-013', 'asset-014', 'asset-015', 'asset-016'],
    articleIds: ['article-003'],
    recommendedStoryIds: ['story-001', 'story-011'],
    spotlightWeight: 85,
    curatedEligible: true,
    discoveryReasonHints: ['Active border coverage', 'Displacement cluster', 'Strong shortlist rate'],
  },

  // ═══════════════════════════════════════════════
  // 5. WILDFIRE AFTERMATH — Andalusia
  // ═══════════════════════════════════════════════
  {
    id: 'story-005',
    slug: 'huelva-wildfire-aftermath',
    title: 'Huelva Wildfire Aftermath',
    dek: 'Burn scar mapping, village recovery, and agricultural loss assessment after the January fires in western Andalusia.',
    summary: 'Data-led coverage of wildfire aftermath in Huelva province. Includes aerial burn-scar infographics, village recovery progress photography, agricultural damage assessment, and water infrastructure impact across a six-week recovery window.',
    creatorId: 'creator-008',
    primaryGeography: 'geo-es-huelva',
    secondaryGeographies: [],
    topicTags: ['wildfire', 'recovery', 'displacement'],
    coverageWindow: { start: '2026-01-22', end: '2026-03-05' },
    heroAssetId: 'asset-017',
    assetIds: ['asset-017', 'asset-018', 'asset-019'],
    articleIds: ['article-008'],
    recommendedStoryIds: ['story-009', 'story-014'],
    spotlightWeight: 62,
    curatedEligible: true,
    discoveryReasonHints: ['Wildfire cluster', 'Data visualization assets available'],
  },

  // ═══════════════════════════════════════════════
  // 6. HOSPITAL OVERLOAD — Marseille heatwave
  // ═══════════════════════════════════════════════
  {
    id: 'story-006',
    slug: 'marseille-heatwave-hospital-overload',
    title: 'Marseille Heatwave Hospital Overload',
    dek: 'Corridor overflow, triage improvisation, and staff exhaustion at Hôpital Nord during the February 2026 unseasonal heat event.',
    summary: 'Frontline documentation of hospital capacity failure during the February 2026 heat event in Marseille. Covers corridor overflow conditions, temporary triage areas, ambulance queuing, staff fatigue documentation, and municipal response coordination.',
    creatorId: 'creator-005',
    primaryGeography: 'geo-fr-marseille',
    secondaryGeographies: [],
    topicTags: ['heatwave', 'hospital-pressure', 'public-health'],
    coverageWindow: { start: '2026-02-18', end: '2026-02-25' },
    heroAssetId: 'asset-020',
    assetIds: ['asset-020', 'asset-021', 'asset-022', 'asset-023'],
    articleIds: ['article-004'],
    recommendedStoryIds: ['story-012', 'story-009'],
    spotlightWeight: 88,
    curatedEligible: true,
    discoveryReasonHints: ['Public health cluster active', 'Recent shortlist activity', 'Heatwave coverage in demand'],
  },

  // ═══════════════════════════════════════════════
  // 7. TRANSIT STRIKE — Warsaw
  // ═══════════════════════════════════════════════
  {
    id: 'story-007',
    slug: 'warsaw-transit-strike',
    title: 'Warsaw Transit Strike',
    dek: 'Empty platforms, commuter spillover, and depot picket lines during the three-day public transport stoppage in Warsaw.',
    summary: 'Multi-format coverage of the March 2026 Warsaw transit strike. Documents empty metro platforms, bus depot picket lines, commuter overflow at rail stations, and the city-wide transport disruption across three days of industrial action.',
    creatorId: 'creator-006',
    primaryGeography: 'geo-pl-warsaw',
    secondaryGeographies: ['geo-pl-lodz'],
    topicTags: ['strike', 'transit-disruption', 'civic-unrest'],
    coverageWindow: { start: '2026-03-10', end: '2026-03-12' },
    heroAssetId: 'asset-025',
    assetIds: ['asset-025', 'asset-026', 'asset-027', 'asset-028'],
    articleIds: ['article-005'],
    recommendedStoryIds: ['story-013', 'story-008'],
    spotlightWeight: 71,
    curatedEligible: false,
    discoveryReasonHints: ['Labor disruption cluster', 'Same geography as election rally'],
  },

  // ═══════════════════════════════════════════════
  // 8. STUDENT DEMONSTRATIONS — Bucharest
  // ═══════════════════════════════════════════════
  {
    id: 'story-008',
    slug: 'bucharest-student-demonstrations',
    title: 'Bucharest Student Demonstrations',
    dek: 'Campus barricades, march routes, and police response during the February education funding protests in the Romanian capital.',
    summary: 'On-campus and street-level documentation of the February 2026 student protests in Bucharest. Covers university barricade construction, march logistics, police cordon staging, and student organizing across multiple locations in central Bucharest.',
    creatorId: 'creator-007',
    primaryGeography: 'geo-ro-bucharest',
    secondaryGeographies: ['geo-ro-craiova'],
    topicTags: ['protest', 'civic-unrest', 'municipal-politics'],
    coverageWindow: { start: '2026-02-05', end: '2026-02-14' },
    heroAssetId: 'asset-030',
    assetIds: ['asset-030', 'asset-031', 'asset-032'],
    articleIds: ['article-006'],
    recommendedStoryIds: ['story-007', 'story-013', 'story-002'],
    spotlightWeight: 66,
    curatedEligible: false,
    discoveryReasonHints: ['Civic unrest cluster', 'Student protest coverage active'],
  },

  // ═══════════════════════════════════════════════
  // 9. DROUGHT RESPONSE — Almería
  // ═══════════════════════════════════════════════
  {
    id: 'story-009',
    slug: 'almeria-drought-response',
    title: 'Almería Drought Response',
    dek: 'Water tanker routes, reservoir depletion, and village distribution queues during the extended drought in eastern Andalusia.',
    summary: 'Data-driven and photographic coverage of the drought emergency in Almería. Covers water tanker delivery logistics, reservoir level documentation, village distribution queues, and agricultural abandonment.',
    creatorId: 'creator-008',
    primaryGeography: 'geo-es-almeria',
    secondaryGeographies: ['geo-es-huelva'],
    topicTags: ['drought', 'water-access', 'distribution'],
    coverageWindow: { start: '2026-02-01', end: '2026-03-15' },
    heroAssetId: 'asset-033',
    assetIds: ['asset-033', 'asset-048', 'asset-047'],
    articleIds: ['article-007'],
    recommendedStoryIds: ['story-005', 'story-006'],
    spotlightWeight: 59,
    curatedEligible: true,
    discoveryReasonHints: ['Water access cluster', 'Andalusia geography active'],
  },

  // ═══════════════════════════════════════════════
  // 10. COURT HEARING — Palermo police misconduct
  // ═══════════════════════════════════════════════
  {
    id: 'story-010',
    slug: 'palermo-police-misconduct-hearing',
    title: 'Palermo Police Misconduct Hearing',
    dek: 'Courtroom proceedings, witness arrivals, and public gallery response at the Catania tribunal during the Ferraro misconduct case.',
    summary: 'Courtroom and perimeter documentation of the Ferraro police misconduct hearing in Catania. Covers tribunal proceedings, witness arrival sequences, lawyer briefings, public gallery conditions, and street-level response outside the courthouse.',
    creatorId: 'creator-004',
    primaryGeography: 'geo-it-palermo',
    secondaryGeographies: ['geo-it-catania'],
    topicTags: ['court', 'police-accountability'],
    coverageWindow: { start: '2026-03-04', end: '2026-03-06' },
    heroAssetId: 'asset-034',
    assetIds: ['asset-034', 'asset-035', 'asset-036', 'asset-037'],
    articleIds: ['article-006b'],
    recommendedStoryIds: ['story-008', 'story-002'],
    spotlightWeight: 73,
    curatedEligible: true,
    discoveryReasonHints: ['Court proceedings cluster', 'Police accountability reporting'],
  },

  // ═══════════════════════════════════════════════
  // 11. SETTLEMENT EVICTION — Porto Alegre
  // ═══════════════════════════════════════════════
  {
    id: 'story-011',
    slug: 'porto-alegre-settlement-eviction',
    title: 'Porto Alegre Settlement Eviction',
    dek: 'Municipal enforcement, resident displacement, and community resistance during the Vila Floresta clearance operation.',
    summary: 'Street-level documentation of the contested Vila Floresta settlement eviction in Porto Alegre. Covers municipal enforcement operations, resident displacement, belongings removal, community resistance, and post-clearance conditions.',
    creatorId: 'creator-001',
    primaryGeography: 'geo-br-poa',
    secondaryGeographies: ['geo-br-gravatai'],
    topicTags: ['eviction', 'displacement', 'municipal-politics'],
    coverageWindow: { start: '2026-03-25', end: '2026-03-28' },
    heroAssetId: 'asset-038',
    assetIds: ['asset-038', 'asset-039', 'asset-040'],
    articleIds: [],
    recommendedStoryIds: ['story-001', 'story-004'],
    spotlightWeight: 68,
    curatedEligible: false,
    discoveryReasonHints: ['Same creator as flood coverage', 'Displacement cluster', 'Same geography: Porto Alegre'],
  },

  // ═══════════════════════════════════════════════
  // 12. PORT CONGESTION — Fos-sur-Mer
  // ═══════════════════════════════════════════════
  {
    id: 'story-012',
    slug: 'fos-port-congestion',
    title: 'Fos-sur-Mer Port Congestion',
    dek: 'Truck queues, container backlog, and labor dispatch bottlenecks at the Grand Port Maritime de Marseille.',
    summary: 'Logistics and labor documentation of port congestion at Fos-sur-Mer. Covers truck queue buildup, container yard overflow, labor scheduling disruption, roadside conditions for waiting drivers, and the knock-on effect on regional freight movement.',
    creatorId: 'creator-005',
    primaryGeography: 'geo-fr-fos',
    secondaryGeographies: ['geo-fr-marseille'],
    topicTags: ['port-congestion', 'logistics', 'strike'],
    coverageWindow: { start: '2026-03-01', end: '2026-03-08' },
    heroAssetId: 'asset-041',
    assetIds: ['asset-041', 'asset-042'],
    articleIds: ['article-005'],
    recommendedStoryIds: ['story-006', 'story-007'],
    spotlightWeight: 54,
    curatedEligible: false,
    discoveryReasonHints: ['Logistics cluster', 'Same geography: Marseille region'],
  },

  // ═══════════════════════════════════════════════
  // 13. ELECTION RALLY — Warsaw
  // ═══════════════════════════════════════════════
  {
    id: 'story-013',
    slug: 'warsaw-election-rally-security',
    title: 'Warsaw Election Rally Security',
    dek: 'Security perimeter staging, crowd control infrastructure, and press zone logistics at the Piłsudski Square rally.',
    summary: 'Security and logistics documentation of the pre-election rally at Piłsudski Square in Warsaw. Covers perimeter setup, crowd management infrastructure, press zone access, police staging, and rally-day crowd density.',
    creatorId: 'creator-006',
    primaryGeography: 'geo-pl-warsaw',
    secondaryGeographies: [],
    topicTags: ['election', 'civic-unrest', 'municipal-politics'],
    coverageWindow: { start: '2026-03-29', end: '2026-03-30' },
    heroAssetId: 'asset-029',
    assetIds: ['asset-029', 'asset-043', 'asset-044'],
    articleIds: [],
    recommendedStoryIds: ['story-007', 'story-008', 'story-002'],
    spotlightWeight: 76,
    curatedEligible: true,
    discoveryReasonHints: ['Election cluster', 'Same creator as transit strike', 'Same geography: Warsaw'],
  },

  // ═══════════════════════════════════════════════
  // 14. STORM DAMAGE — Setúbal coast
  // ═══════════════════════════════════════════════
  {
    id: 'story-014',
    slug: 'setubal-storm-damage-schools',
    title: 'Setúbal Storm Damage and School Closures',
    dek: 'Roof failures, flooded classrooms, and emergency school closures after the February storm system struck the Setúbal district.',
    summary: 'Post-storm documentation of school infrastructure damage and closures across the Setúbal district. Covers roof collapses, flooded classrooms, temporary shelter arrangements, municipal repair response, and community impact.',
    creatorId: 'creator-002',
    primaryGeography: 'geo-pt-setubal',
    secondaryGeographies: ['geo-pt-lisbon'],
    topicTags: ['storm', 'school-closure', 'displacement'],
    coverageWindow: { start: '2026-02-27', end: '2026-03-04' },
    heroAssetId: 'asset-045',
    assetIds: ['asset-045', 'asset-046'],
    articleIds: [],
    recommendedStoryIds: ['story-003', 'story-001', 'story-005'],
    spotlightWeight: 48,
    curatedEligible: false,
    discoveryReasonHints: ['Same geography: Setúbal', 'Same creator as coastal erosion', 'Storm damage cluster'],
  },
  // ═══════════════════════════════════════════════
  // 15. SAHEL COUP CASCADE — Mali / Burkina / Niger
  // ═══════════════════════════════════════════════
  {
    id: 'story-af-001',
    slug: 'sahel-coup-civilian-collapse',
    title: 'Sahel Coup Cascade',
    dek: 'Displacement, humanitarian access failures, and media blackouts across Mali, Burkina Faso, and Niger after successive military takeovers.',
    summary: 'Documentation of civilian life across the three Sahel states under junta control. Covers IDP camp conditions, aid convoy obstruction, press restriction enforcement, and the collapse of community journalism.',
    creatorId: 'creator-019',
    primaryGeography: 'geo-ml-bamako',
    secondaryGeographies: ['geo-bf-ouaga', 'geo-ne-niamey', 'geo-sahel'],
    topicTags: ['coup', 'displacement', 'press-freedom', 'sahel'],
    coverageWindow: { start: '2026-01-10', end: '2026-03-30' },
    heroAssetId: 'asset-af-001',
    assetIds: ['asset-af-001', 'asset-af-002', 'asset-af-003', 'asset-af-004', 'asset-af-005'],
    articleIds: [],
    recommendedStoryIds: ['story-af-002', 'story-af-003', 'story-me-002'],
    spotlightWeight: 83,
    curatedEligible: true,
    discoveryReasonHints: ['Active Sahel coverage', 'Press freedom cluster', 'High-demand geography'],
  },

  // ═══════════════════════════════════════════════
  // 16. MALI MEDIA BLACKOUT — Bamako
  // ═══════════════════════════════════════════════
  {
    id: 'story-af-002',
    slug: 'mali-junta-media-blackout',
    title: 'Mali: Junta Media Blackout',
    dek: 'Foreign media expelled, local journalists arrested, and internet cut: documenting the information desert inside military-controlled Mali.',
    summary: 'Photo and text documentation of the media environment in Bamako and the interior under military governance. Covers newsroom shutdowns, journalist detention cases, public information gaps, and the channels Malians use to navigate restricted information.',
    creatorId: 'creator-020',
    primaryGeography: 'geo-ml-bamako',
    secondaryGeographies: ['geo-ml', 'geo-sahel'],
    topicTags: ['press-freedom', 'censorship', 'coup', 'media'],
    coverageWindow: { start: '2026-02-01', end: '2026-03-25' },
    heroAssetId: 'asset-af-006',
    assetIds: ['asset-af-006', 'asset-af-007', 'asset-af-008', 'asset-af-009'],
    articleIds: [],
    recommendedStoryIds: ['story-af-001', 'story-af-003'],
    spotlightWeight: 77,
    curatedEligible: true,
    discoveryReasonHints: ['Press freedom cluster', 'News desert geography', 'Active coverage'],
  },

  // ═══════════════════════════════════════════════
  // 17. MOGADISHU IDP CRISIS — Somalia
  // ═══════════════════════════════════════════════
  {
    id: 'story-af-003',
    slug: 'mogadishu-idp-camp-crisis',
    title: 'Mogadishu IDP Camp Crisis',
    dek: "Overcrowding, disease, and evictions at Somalia's largest displacement settlements as drought and Al-Shabaab displacement converge.",
    summary: 'Ground-level documentation of the IDP crisis in and around Mogadishu. Covers camp overcrowding, water access failures, eviction waves, child malnutrition, and the strain on humanitarian organisations operating under threat.',
    creatorId: 'creator-021',
    primaryGeography: 'geo-so-mogadishu',
    secondaryGeographies: ['geo-so', 'geo-horn'],
    topicTags: ['displacement', 'famine', 'conflict', 'humanitarian'],
    coverageWindow: { start: '2025-12-01', end: '2026-03-15' },
    heroAssetId: 'asset-af-010',
    assetIds: ['asset-af-010', 'asset-af-011', 'asset-af-012', 'asset-af-013'],
    articleIds: [],
    recommendedStoryIds: ['story-af-001', 'story-af-004', 'story-001'],
    spotlightWeight: 88,
    curatedEligible: true,
    discoveryReasonHints: ['Humanitarian crisis cluster', 'High-demand geography', 'Active coverage'],
  },

  // ═══════════════════════════════════════════════
  // 18. TIGRAY RECOVERY — Ethiopia
  // ═══════════════════════════════════════════════
  {
    id: 'story-af-004',
    slug: 'tigray-recovery-documentary',
    title: 'Tigray: After the Silence',
    dek: "Three years after the peace deal, Tigray's towns rebuild slowly while displaced communities await return and journalists regain cautious access.",
    summary: "Documentary photography of post-conflict Tigray, focusing on the return of displaced communities, the physical rebuilding of towns, the reopening of aid corridors, and the fragile restoration of local media. Produced in areas previously under total media blackout.",
    creatorId: 'creator-023',
    primaryGeography: 'geo-et-tigray',
    secondaryGeographies: ['geo-et-addis', 'geo-et'],
    topicTags: ['post-conflict', 'displacement', 'recovery', 'press-freedom'],
    coverageWindow: { start: '2026-02-15', end: '2026-04-01' },
    heroAssetId: 'asset-af-016',
    assetIds: ['asset-af-016', 'asset-af-017', 'asset-af-018', 'asset-af-019'],
    articleIds: [],
    recommendedStoryIds: ['story-me-002', 'story-af-003'],
    spotlightWeight: 80,
    curatedEligible: true,
    discoveryReasonHints: ['Post-conflict cluster', 'Media blackout recovery', 'Active coverage'],
  },

  // ═══════════════════════════════════════════════
  // 19. YEMEN BLOCKADE — Sana'a / Aden
  // ═══════════════════════════════════════════════
  {
    id: 'story-me-001',
    slug: 'yemen-blockade-civilian-cost',
    title: "Yemen: The Blockade's Cost",
    dek: "Hospital supply failures, food import shutdowns, and civilian movement restrictions under Houthi and coalition blockades in northern and southern Yemen.",
    summary: "Multi-location documentation of Yemen's humanitarian crisis driven by blockade and supply chain collapse. Covers hospital medicine shortages in Sana'a, food distribution points in Aden, civilian checkpoint conditions, and the impact on displaced families from Taiz and Hodeidah.",
    creatorId: 'creator-022',
    primaryGeography: 'geo-ye-sanaa',
    secondaryGeographies: ['geo-ye-aden', 'geo-ye'],
    topicTags: ['humanitarian', 'conflict', 'food-insecurity', 'hospital'],
    coverageWindow: { start: '2026-01-20', end: '2026-03-28' },
    heroAssetId: 'asset-me-001',
    assetIds: ['asset-me-001', 'asset-me-002', 'asset-me-003', 'asset-me-004', 'asset-me-005'],
    articleIds: [],
    recommendedStoryIds: ['story-af-003', 'story-me-002'],
    spotlightWeight: 91,
    curatedEligible: true,
    discoveryReasonHints: ["Humanitarian crisis cluster", 'High-demand geography', 'Blockade coverage'],
  },

  // ═══════════════════════════════════════════════
  // 20. SUDAN CIVIL WAR — Khartoum / Port Sudan
  // ═══════════════════════════════════════════════
  {
    id: 'story-me-002',
    slug: 'sudan-civil-war-displacement',
    title: 'Sudan: War and Displacement',
    dek: 'Urban warfare, mass displacement, and humanitarian access collapse as fighting between SAF and RSF continues.',
    summary: "Documentation of Sudan's ongoing civil conflict and its humanitarian consequences. Covers civilian displacement from Khartoum, the mass movement toward Port Sudan and Chad, Darfur documentation, and humanitarian blockades at distribution points.",
    creatorId: 'creator-024',
    primaryGeography: 'geo-sd-khartoum',
    secondaryGeographies: ['geo-sd-portsudanr', 'geo-sd'],
    topicTags: ['conflict', 'displacement', 'humanitarian', 'urban-warfare'],
    coverageWindow: { start: '2025-11-01', end: '2026-04-01' },
    heroAssetId: 'asset-me-006',
    assetIds: ['asset-me-006', 'asset-me-007', 'asset-me-008', 'asset-me-009'],
    articleIds: [],
    recommendedStoryIds: ['story-af-003', 'story-af-004', 'story-001'],
    spotlightWeight: 89,
    curatedEligible: true,
    discoveryReasonHints: ['Conflict cluster', 'High-demand geography', 'Mass displacement coverage'],
  },
]

export const storyMap = Object.fromEntries(stories.map(s => [s.id, s]))
export const storyBySlug = Object.fromEntries(stories.map(s => [s.slug, s]))
