// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Bulk Upload Mock Data
// Simulates a real creator batch upload session
// ═══════════════════════════════════════════════════════════════

export type UploadFileFormat = 'Photo' | 'Video' | 'Audio' | 'Text' | 'Infographic'

export type PlacementConfidence = 'high' | 'medium' | 'low'
export type GroupType = 'proposed-new' | 'matched-existing' | 'review-needed'

export interface UploadFile {
  id: string
  filename: string
  format: UploadFileFormat
  sizeBytes: number
  thumbnailRef: string
  // Detected metadata
  captureDate: string | null
  locationDetected: string | null
  gpsPresent: boolean
  exifPresent: boolean
  c2paPresent: boolean
  // Suggestions
  suggestedTitle: string
  suggestedDescription: string
  suggestedTags: string[]
  suggestedGeoTags: string[]
  suggestedPrice: number
  priceReason: string
  // Placement
  assignedGroupId: string | null
  placementConfidence: PlacementConfidence
  placementRationale: string
  // State
  excluded: boolean
  isDuplicate: boolean
  duplicateOfId: string | null
  metadataComplete: boolean
  priceConfirmed: boolean
  // Creator overrides
  creatorTitle: string | null
  creatorDescription: string | null
  creatorTags: string[] | null
  creatorPrice: number | null
}

export interface ProposedStoryGroup {
  id: string
  type: GroupType
  suggestedTitle: string
  suggestedDek: string
  suggestedTags: string[]
  suggestedGeoTags: string[]
  dateRange: { start: string; end: string }
  locationRange: string
  heroAssetId: string | null
  fileIds: string[]
  rationale: string
  signals: string[]
  // For matched-existing
  existingStoryId: string | null
  existingStoryTitle: string | null
  existingStoryAssetCount: number | null
  // Creator overrides
  creatorTitle: string | null
  creatorDek: string | null
}

export interface UploadBatch {
  id: string
  creatorId: string
  files: UploadFile[]
  proposedGroups: ProposedStoryGroup[]
  currentStep: number
  analysisComplete: boolean
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════
// Mock: 18-file batch from Marco Oliveira
// Mixed: flood aftermath + settlement eviction + one stray
// ═══════════════════════════════════════════════════════════════

const floodFiles: UploadFile[] = [
  {
    id: 'uf-001',
    filename: 'DSC_4821_poa_flood_levee.jpg',
    format: 'Photo',
    sizeBytes: 14200000,
    thumbnailRef: '/assets/8654_large.jpeg',
    captureDate: '2026-04-02T08:22:00Z',
    locationDetected: 'Sarandi, Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Floodwater at levee perimeter, Sarandi district',
    suggestedDescription: 'Ground-level photograph of floodwater reaching the levee perimeter wall in the Sarandi district of Porto Alegre. Debris line visible at the 0.8m mark. Morning light.',
    suggestedTags: ['flood', 'displacement', 'evacuation'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 240,
    priceReason: 'Photo, verified creator, strong editorial utility, active flood cluster',
    assignedGroupId: 'pg-001',
    placementConfidence: 'high',
    placementRationale: 'Same capture window, same GPS cluster, flood event indicators',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-002',
    filename: 'DSC_4835_poa_shelter_queue.jpg',
    format: 'Photo',
    sizeBytes: 11800000,
    thumbnailRef: '/assets/12087_large.jpeg',
    captureDate: '2026-04-02T11:45:00Z',
    locationDetected: 'Canoas, Rio Grande do Sul',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Shelter intake queue at Canoas municipal center',
    suggestedDescription: 'Displaced residents queuing for shelter registration at the Canoas municipal sports center. Approximately 150 people visible, personal belongings in bags.',
    suggestedTags: ['flood', 'displacement', 'evacuation'],
    suggestedGeoTags: ['Canoas', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 200,
    priceReason: 'Photo, documentary value, shelter documentation',
    assignedGroupId: 'pg-001',
    placementConfidence: 'high',
    placementRationale: 'Same day, nearby geography, same event cluster',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-003',
    filename: 'MOV_4841_bridge_damage.mp4',
    format: 'Video',
    sizeBytes: 87000000,
    thumbnailRef: '/assets/13937_large.jpeg',
    captureDate: '2026-04-02T14:10:00Z',
    locationDetected: 'Eldorado do Sul',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Bridge approach damage assessment, BR-290 overpass',
    suggestedDescription: 'Video walkthrough of structural damage at the BR-290 overpass approach in Eldorado do Sul. Visible cracks in support columns, water marks at 2.1m height. 52 seconds.',
    suggestedTags: ['flood', 'evacuation'],
    suggestedGeoTags: ['Eldorado do Sul', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 420,
    priceReason: 'Video, infrastructure documentation, high editorial utility',
    assignedGroupId: 'pg-001',
    placementConfidence: 'high',
    placementRationale: 'Same day, nearby geography, flood infrastructure damage',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-004',
    filename: 'DSC_4850_restinga_corridor.jpg',
    format: 'Photo',
    sizeBytes: 12400000,
    thumbnailRef: '/assets/10025_large.jpeg',
    captureDate: '2026-04-03T09:30:00Z',
    locationDetected: 'Restinga, Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Shelter corridor overflow at Restinga sports complex',
    suggestedDescription: 'Families sleeping in the corridor of the Restinga sports complex. Main shelter hall at capacity. Improvised bedding and personal belongings.',
    suggestedTags: ['flood', 'displacement'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 200,
    priceReason: 'Photo, shelter conditions documentation',
    assignedGroupId: 'pg-001',
    placementConfidence: 'high',
    placementRationale: 'Next day, same city, same flood event continuation',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-005',
    filename: 'REC_interview_fatima.wav',
    format: 'Audio',
    sizeBytes: 24500000,
    thumbnailRef: '/assets/12087_large.jpeg',
    captureDate: '2026-04-03T14:00:00Z',
    locationDetected: 'Canoas, Rio Grande do Sul',
    gpsPresent: false,
    exifPresent: false,
    c2paPresent: false,
    suggestedTitle: 'Displaced resident interview, Canoas shelter',
    suggestedDescription: 'Audio interview with displaced resident at the Canoas municipal shelter describing evacuation conditions, document loss, and shelter capacity issues.',
    suggestedTags: ['flood', 'displacement', 'evacuation'],
    suggestedGeoTags: ['Canoas', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 140,
    priceReason: 'Audio, field testimony, editorial value',
    assignedGroupId: 'pg-001',
    placementConfidence: 'medium',
    placementRationale: 'Same geography, same time window, weak file metadata but location matches',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: false,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-006',
    filename: 'DSC_4822_poa_flood_levee_alt.jpg',
    format: 'Photo',
    sizeBytes: 14100000,
    thumbnailRef: '/assets/8654_large.jpeg',
    captureDate: '2026-04-02T08:23:00Z',
    locationDetected: 'Sarandi, Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Floodwater at levee perimeter (alternate angle)',
    suggestedDescription: 'Second angle of floodwater at the Sarandi levee perimeter. Similar framing to DSC_4821, slightly wider composition.',
    suggestedTags: ['flood', 'displacement'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 180,
    priceReason: 'Photo, alternate angle, lower unique editorial value',
    assignedGroupId: 'pg-001',
    placementConfidence: 'high',
    placementRationale: 'Same capture window, same GPS, near-duplicate detected',
    excluded: false,
    isDuplicate: true,
    duplicateOfId: 'uf-001',
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-007',
    filename: 'DSC_4860_road_cleanup.jpg',
    format: 'Photo',
    sizeBytes: 10200000,
    thumbnailRef: '/assets/2374_large.jpeg',
    captureDate: '2026-04-04T07:15:00Z',
    locationDetected: 'Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Road cleanup crew, post-flood debris removal',
    suggestedDescription: 'Municipal cleanup crew removing flood debris from a residential street in Porto Alegre. Heavy equipment and manual clearing visible.',
    suggestedTags: ['flood', 'recovery'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 180,
    priceReason: 'Photo, recovery documentation',
    assignedGroupId: 'pg-001',
    placementConfidence: 'medium',
    placementRationale: 'Same city, 2 days later, flood recovery continuation',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
]

const evictionFiles: UploadFile[] = [
  {
    id: 'uf-008',
    filename: 'DSC_4901_vila_floresta_entrance.jpg',
    format: 'Photo',
    sizeBytes: 13500000,
    thumbnailRef: '/assets/9043_large.jpeg',
    captureDate: '2026-04-05T08:00:00Z',
    locationDetected: 'Vila Floresta, Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Municipal enforcement at Vila Floresta settlement entrance',
    suggestedDescription: 'Enforcement officers and construction equipment at the Vila Floresta informal settlement entrance. Residents confronting the enforcement line.',
    suggestedTags: ['eviction', 'displacement', 'municipal-politics'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 220,
    priceReason: 'Photo, eviction documentation, editorial urgency',
    assignedGroupId: 'pg-002',
    placementConfidence: 'high',
    placementRationale: 'Different event cluster, eviction keywords, different location within same city',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-009',
    filename: 'MOV_4910_belongings_removal.mp4',
    format: 'Video',
    sizeBytes: 112000000,
    thumbnailRef: '/assets/2024_large.jpeg',
    captureDate: '2026-04-05T10:30:00Z',
    locationDetected: 'Vila Floresta, Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Residents removing belongings during settlement clearance',
    suggestedDescription: 'Video of residents carrying furniture and personal items from Vila Floresta structures ahead of demolition deadline. 68 seconds.',
    suggestedTags: ['eviction', 'displacement'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 380,
    priceReason: 'Video, eviction documentation, strong editorial utility',
    assignedGroupId: 'pg-002',
    placementConfidence: 'high',
    placementRationale: 'Same location, same day, same event',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-010',
    filename: 'DSC_4920_post_clearance_aerial.jpg',
    format: 'Photo',
    sizeBytes: 16800000,
    thumbnailRef: '/assets/2374_large.jpeg',
    captureDate: '2026-04-06T06:45:00Z',
    locationDetected: 'Vila Floresta, Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Post-clearance aerial view of Vila Floresta site',
    suggestedDescription: 'Drone photograph of the Vila Floresta site after clearance. Foundation remnants and scattered debris visible.',
    suggestedTags: ['eviction', 'displacement'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 260,
    priceReason: 'Photo, aerial, post-event documentation',
    assignedGroupId: 'pg-002',
    placementConfidence: 'high',
    placementRationale: 'Same GPS cluster, next-day coverage, same event conclusion',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-011',
    filename: 'REC_community_leader.wav',
    format: 'Audio',
    sizeBytes: 18200000,
    thumbnailRef: '/assets/9043_large.jpeg',
    captureDate: '2026-04-05T15:00:00Z',
    locationDetected: null,
    gpsPresent: false,
    exifPresent: false,
    c2paPresent: false,
    suggestedTitle: 'Community leader statement on eviction enforcement',
    suggestedDescription: 'Audio recording of Vila Floresta community leader describing the enforcement timeline, resident displacement, and municipal communication failures.',
    suggestedTags: ['eviction', 'displacement', 'municipal-politics'],
    suggestedGeoTags: ['Porto Alegre', 'Brazil'],
    suggestedPrice: 130,
    priceReason: 'Audio, testimony, editorial context',
    assignedGroupId: 'pg-002',
    placementConfidence: 'medium',
    placementRationale: 'Same day as eviction cluster, weak metadata but filename and date match',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: false,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
]

const existingMatchFiles: UploadFile[] = [
  {
    id: 'uf-012',
    filename: 'DSC_4780_guaiba_water_level.jpg',
    format: 'Photo',
    sizeBytes: 11200000,
    thumbnailRef: '/assets/8654_large.jpeg',
    captureDate: '2026-03-18T16:00:00Z',
    locationDetected: 'Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Guaiba river water level marker, pre-breach monitoring',
    suggestedDescription: 'Water level measurement at the Guaiba river monitoring station showing level at 4.8m, approaching the 5.1m breach threshold.',
    suggestedTags: ['flood'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 160,
    priceReason: 'Photo, monitoring documentation, pre-event context',
    assignedGroupId: 'pg-003',
    placementConfidence: 'high',
    placementRationale: 'Matched existing Story: same geography, same flood event, earlier date = pre-event documentation',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-013',
    filename: 'DSC_4785_guaiba_sandbagging.jpg',
    format: 'Photo',
    sizeBytes: 10800000,
    thumbnailRef: '/assets/10025_large.jpeg',
    captureDate: '2026-03-19T09:00:00Z',
    locationDetected: 'Porto Alegre',
    gpsPresent: true,
    exifPresent: true,
    c2paPresent: false,
    suggestedTitle: 'Sandbag reinforcement at Guaiba river embankment',
    suggestedDescription: 'Volunteers and municipal workers reinforcing sandbag barriers along the Guaiba river embankment ahead of the predicted flood surge.',
    suggestedTags: ['flood', 'evacuation'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul', 'Brazil'],
    suggestedPrice: 180,
    priceReason: 'Photo, preparation documentation, contextual value',
    assignedGroupId: 'pg-003',
    placementConfidence: 'high',
    placementRationale: 'Matched existing Story: same geography, same flood event cluster, preparation phase',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: true,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
]

const reviewNeededFiles: UploadFile[] = [
  {
    id: 'uf-014',
    filename: 'IMG_2201.jpg',
    format: 'Photo',
    sizeBytes: 8400000,
    thumbnailRef: '/assets/4398_large.jpeg',
    captureDate: null,
    locationDetected: null,
    gpsPresent: false,
    exifPresent: false,
    c2paPresent: false,
    suggestedTitle: 'Unidentified street scene',
    suggestedDescription: 'Street-level photograph with no embedded metadata. Location and date could not be determined from file data.',
    suggestedTags: [],
    suggestedGeoTags: [],
    suggestedPrice: 120,
    priceReason: 'Photo, no metadata, lower confidence placement',
    assignedGroupId: null,
    placementConfidence: 'low',
    placementRationale: 'No timestamp, no GPS, no EXIF. Cannot cluster automatically.',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: false,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
  {
    id: 'uf-015',
    filename: 'flood_data_overview.svg',
    format: 'Infographic',
    sizeBytes: 2100000,
    thumbnailRef: '/assets/12480_large.jpeg',
    captureDate: null,
    locationDetected: null,
    gpsPresent: false,
    exifPresent: false,
    c2paPresent: false,
    suggestedTitle: 'Flood data overview infographic',
    suggestedDescription: 'SVG infographic file. Content analysis suggests flood-related data visualization. No embedded geolocation.',
    suggestedTags: ['flood'],
    suggestedGeoTags: [],
    suggestedPrice: 300,
    priceReason: 'Infographic, data visualization, higher format value',
    assignedGroupId: null,
    placementConfidence: 'low',
    placementRationale: 'Flood keyword in filename, likely related to flood Story but cannot confirm automatically',
    excluded: false,
    isDuplicate: false,
    duplicateOfId: null,
    metadataComplete: false,
    priceConfirmed: false,
    creatorTitle: null,
    creatorDescription: null,
    creatorTags: null,
    creatorPrice: null,
  },
]

// ═══════════════════════════════════════════════════════════════
// Proposed Story Groups
// ═══════════════════════════════════════════════════════════════

export const mockProposedGroups: ProposedStoryGroup[] = [
  {
    id: 'pg-001',
    type: 'proposed-new',
    suggestedTitle: 'April 2026 Guaiba River Flood — Porto Alegre',
    suggestedDek: 'Levee breach, shelter overflow, and infrastructure damage across Porto Alegre, Canoas, and Eldorado do Sul during the April 2026 flood event.',
    suggestedTags: ['flood', 'displacement', 'evacuation', 'recovery'],
    suggestedGeoTags: ['Porto Alegre', 'Canoas', 'Eldorado do Sul', 'Rio Grande do Sul'],
    dateRange: { start: '2026-04-02', end: '2026-04-04' },
    locationRange: 'Porto Alegre metro area',
    heroAssetId: 'uf-001',
    fileIds: ['uf-001', 'uf-002', 'uf-003', 'uf-004', 'uf-005', 'uf-006', 'uf-007'],
    rationale: '7 files clustered by GPS proximity, capture window (Apr 2\u20134), and flood-event indicators. Strong time and geography signal.',
    signals: ['time cluster: 3-day window', 'geography signal: Porto Alegre metro', 'likely same event: flood indicators', 'strong metadata match: 5 of 7 files'],
    existingStoryId: null,
    existingStoryTitle: null,
    existingStoryAssetCount: null,
    creatorTitle: null,
    creatorDek: null,
  },
  {
    id: 'pg-002',
    type: 'proposed-new',
    suggestedTitle: 'Vila Floresta Settlement Eviction — Porto Alegre',
    suggestedDek: 'Municipal enforcement, resident displacement, and community resistance during the Vila Floresta clearance operation in April 2026.',
    suggestedTags: ['eviction', 'displacement', 'municipal-politics'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul'],
    dateRange: { start: '2026-04-05', end: '2026-04-06' },
    locationRange: 'Vila Floresta, Porto Alegre',
    heroAssetId: 'uf-008',
    fileIds: ['uf-008', 'uf-009', 'uf-010', 'uf-011'],
    rationale: '4 files clustered by GPS (Vila Floresta area), capture window (Apr 5\u20136), and eviction/settlement indicators. Distinct from flood cluster.',
    signals: ['time cluster: 2-day window', 'geography signal: Vila Floresta GPS', 'likely same event: eviction indicators', 'distinct from flood cluster'],
    existingStoryId: null,
    existingStoryTitle: null,
    existingStoryAssetCount: null,
    creatorTitle: null,
    creatorDek: null,
  },
  {
    id: 'pg-003',
    type: 'matched-existing',
    suggestedTitle: 'Guaiba Flood Displacement',
    suggestedDek: 'Pre-event monitoring assets that match the existing March 2026 flood Story.',
    suggestedTags: ['flood', 'evacuation'],
    suggestedGeoTags: ['Porto Alegre', 'Rio Grande do Sul'],
    dateRange: { start: '2026-03-18', end: '2026-03-19' },
    locationRange: 'Porto Alegre',
    heroAssetId: null,
    fileIds: ['uf-012', 'uf-013'],
    rationale: '2 files from March 18\u201319 match the existing "Guaiba Flood Displacement" Story (story-001) by geography, event cluster, and pre-event timing.',
    signals: ['matched existing Story: story-001', 'same geography: Porto Alegre', 'same flood event: pre-breach phase', 'strong metadata match'],
    existingStoryId: 'story-001',
    existingStoryTitle: 'Guaiba Flood Displacement',
    existingStoryAssetCount: 5,
    creatorTitle: null,
    creatorDek: null,
  },
]

// ═══════════════════════════════════════════════════════════════
// Full batch
// ═══════════════════════════════════════════════════════════════

export const mockUploadBatch: UploadBatch = {
  id: 'batch-001',
  creatorId: 'creator-001',
  files: [...floodFiles, ...evictionFiles, ...existingMatchFiles, ...reviewNeededFiles],
  proposedGroups: mockProposedGroups,
  currentStep: 0,
  analysisComplete: false,
  createdAt: '2026-04-06T10:00:00Z',
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

export function getUnassignedFiles(batch: UploadBatch): UploadFile[] {
  return batch.files.filter(f => !f.assignedGroupId && !f.excluded)
}

export function getGroupFiles(batch: UploadBatch, groupId: string): UploadFile[] {
  return batch.files.filter(f => f.assignedGroupId === groupId)
}

export function getBatchStats(batch: UploadBatch) {
  const files = batch.files.filter(f => !f.excluded)
  const formats: Record<string, number> = {}
  files.forEach(f => { formats[f.format] = (formats[f.format] || 0) + 1 })

  const withGps = files.filter(f => f.gpsPresent).length
  const withExif = files.filter(f => f.exifPresent).length
  const withDate = files.filter(f => f.captureDate).length
  const duplicates = files.filter(f => f.isDuplicate).length
  const incomplete = files.filter(f => !f.metadataComplete).length
  const unassigned = files.filter(f => !f.assignedGroupId).length
  const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0)
  const totalSuggestedPrice = files.reduce((s, f) => s + f.suggestedPrice, 0)

  return {
    totalFiles: files.length,
    formats,
    withGps,
    withExif,
    withDate,
    duplicates,
    incomplete,
    unassigned,
    totalSize,
    totalSuggestedPrice,
    newStories: batch.proposedGroups.filter(g => g.type === 'proposed-new').length,
    existingMatches: batch.proposedGroups.filter(g => g.type === 'matched-existing').length,
  }
}
