/**
 * Frontfiles Bulk Upload v2 — Mock Scenarios
 *
 * Three deterministic demo scenarios with realistic newsroom data.
 * No Math.random() — all data is fixed and reproducible.
 *
 * Canon guarantees:
 * - Analysis proposes, does not assign (storyGroupId always null)
 * - Story assignment requires explicit creator action
 * - PRIVATE no-price is advisory, not blocking
 * - Excluded assets yield zero exceptions
 * - Manifest Invalid is blocking
 * - Express eligibility is strict: 1 group, all complete, high confidence, no manifest-invalid
 */

import type { AssetFormat, LicenceType, PrivacyState, ValidationDeclarationState } from './types'
import type { ExtractedMetadata, MetadataConflict } from './v2-types'
import type { ScenarioId } from './v2-scenario-registry'
export type { ScenarioId } from './v2-scenario-registry'

// ── Types ──

export interface MockAsset {
  filename: string
  fileSize: number
  format: AssetFormat
  thumbnailRef?: string
}

export interface MockStoryGroupTemplate {
  name: string
  kind: 'proposed' | 'matched-existing'
  assetIndices: number[]
  existingStoryId?: string
  existingStoryTitle?: string
  existingStoryAssetCount?: number
  confidence: number
  rationale: string
}

export interface MockAnalysisTemplate {
  assetIndex: number
  declarationState: ValidationDeclarationState
  confidence: number
  duplicateOf?: number
  title: string
  description: string
  tags: string[]
  geography: string[]
  priceSuggestionCents: number
  privacySuggestion: PrivacyState
  licenceSuggestions: LicenceType[]
  // Embedded metadata from file (EXIF/IPTC/XMP/C2PA)
  extractedMetadata?: Partial<ExtractedMetadata>
  // Field-level conflicts between embedded and AI values
  conflicts?: MetadataConflict[]
}

export interface MockScenario {
  id: ScenarioId
  label: string
  description: string
  fileCount: number
  assets: MockAsset[]
  storyGroupTemplates: MockStoryGroupTemplate[]
  analysisTemplates: MockAnalysisTemplate[]
}

// ══════════════════════════════════════════════════
// SCENARIO 1: CLEAN SINGLE STORY
// ══════════════════════════════════════════════════
//
// Purpose: Express path demo. 7 assets from one Hong Kong rally.
// Express eligible: YES
// Key proofs:
//  - One proposed Story group
//  - All high confidence
//  - No manifest-invalid
//  - Asset #5 is PRIVATE with no price → advisory, not blocking
//  - Asset #3 has provenance_pending → advisory
//  - Strong price suggestions on multiple assets

export const CLEAN_SINGLE_STORY: MockScenario = {
  id: 'clean_single_story',
  label: 'Clean batch — 7 files, 1 story',
  description: 'Seven assets from a Hong Kong press-freedom rally. Express-eligible. Includes one PRIVATE asset to prove advisory-not-blocking rule.',
  fileCount: 7,
  assets: [
    { filename: '2026-04-06_hk-central_rally-wide_001.CR3',      fileSize: 28_400_000, format: 'photo', thumbnailRef: '/assets/172_large.jpeg' },
    { filename: '2026-04-06_hk-central_crowd-march_002.CR3',     fileSize: 31_200_000, format: 'photo', thumbnailRef: '/assets/8654_large.jpeg' },
    { filename: '2026-04-06_hk-admiralty_teargas-deploy_003.CR3', fileSize: 26_800_000, format: 'photo', thumbnailRef: '/assets/12087_large.jpeg' },
    { filename: '2026-04-06_hk-wanchai_medic-aid_004.CR3',       fileSize: 22_100_000, format: 'photo', thumbnailRef: '/assets/67_large.jpeg' },
    { filename: '2026-04-06_hk-central_banner-closeup_005.CR3',  fileSize: 18_600_000, format: 'photo', thumbnailRef: '/assets/159_large.jpeg' },
    { filename: '2026-04-06_hk-central_crowd-rear_006.CR3',      fileSize: 24_500_000, format: 'photo', thumbnailRef: '/assets/13937_large.jpeg' },
    { filename: 'cam-b_hk-rally_ambient-audio_007.WAV',          fileSize: 62_000_000, format: 'audio' },
  ],
  storyGroupTemplates: [
    {
      name: 'Hong Kong: Press Freedom Rally April 2026',
      kind: 'proposed',
      assetIndices: [0, 1, 2, 3, 4, 5, 6],
      confidence: 0.91,
      rationale: 'All 7 files share GPS cluster (22.28N, 114.15E), timestamps within 4 hours, visual similarity in protest/rally scene detection. Audio captured at same location.',
    },
  ],
  analysisTemplates: [
    {
      // Scenario A demo: embedded IPTC headline matches AI closely → no conflict, embedded preferred
      assetIndex: 0,
      declarationState: 'fully_validated',
      confidence: 0.89,
      title: 'Hong Kong: wide shot of press-freedom rally in Central',
      description: 'Thousands gather in Central district for annual press-freedom rally. Banner reads "Defend the Fourth Estate".',
      tags: ['press freedom', 'rally', 'hong kong', 'central', 'democracy'],
      geography: ['Hong Kong', 'Central', 'Chater Road'],
      priceSuggestionCents: 18500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
      extractedMetadata: {
        cameraMake: 'Canon', cameraModel: 'EOS R5', iso: 400, aperture: 'f/2.8', shutterSpeed: '1/1000',
        focalLength: '24mm', gpsLat: 22.2816, gpsLon: 114.1585, gpsLocationLabel: 'Central, Hong Kong',
        iptcHeadline: 'Press-freedom rally wide shot, Central district',
        iptcCaption: 'Annual press-freedom rally in Central. Thousands fill Chater Road.',
        iptcKeywords: ['press freedom', 'rally', 'hong kong', 'central'],
        iptcByline: 'J. Santos', iptcCity: 'Hong Kong', iptcCountry: 'China',
        iptcDateCreated: '2026-04-06T14:22:00+08:00', iptcCopyright: '© 2026 J. Santos / Frontfiles',
        iptcCredit: 'Frontfiles', iptcSource: 'Staff',
        xmpCreatorTool: 'Adobe Lightroom Classic 15.2', xmpRights: 'All rights reserved',
        c2paPresent: true, c2paVersion: '2.1', c2paValid: true, c2paSignerIdentity: 'Canon EOS R5 / J. Santos',
        dimensions: { width: 8192, height: 5464 }, colorSpace: 'sRGB',
      },
    },
    {
      // Scenario A demo: IPTC caption present, AI provides different description → conflict on description
      assetIndex: 1,
      declarationState: 'fully_validated',
      confidence: 0.92,
      title: 'Hong Kong: marchers on Des Voeux Road',
      description: 'Dense column of marchers fills Des Voeux Road during press-freedom rally.',
      tags: ['march', 'crowd', 'hong kong', 'des voeux road', 'press freedom'],
      geography: ['Hong Kong', 'Central', 'Des Voeux Road'],
      priceSuggestionCents: 21000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'broadcast'],
      extractedMetadata: {
        cameraMake: 'Canon', cameraModel: 'EOS R5', iso: 640, aperture: 'f/4.0', shutterSpeed: '1/500',
        focalLength: '70mm', gpsLat: 22.2841, gpsLon: 114.1545, gpsLocationLabel: 'Des Voeux Road, Central',
        iptcHeadline: 'March on Des Voeux Road for press freedom',
        iptcCaption: 'Marchers proceed west on Des Voeux Road. Estimated 10,000 participants.',
        iptcKeywords: ['march', 'press freedom', 'hong kong'],
        iptcByline: 'J. Santos', iptcCity: 'Hong Kong', iptcCountry: 'China',
        iptcDateCreated: '2026-04-06T15:10:00+08:00',
        c2paPresent: true, c2paVersion: '2.1', c2paValid: true, c2paSignerIdentity: 'Canon EOS R5 / J. Santos',
        dimensions: { width: 8192, height: 5464 }, colorSpace: 'sRGB',
      },
      // Description conflict: IPTC says "Estimated 10,000 participants", AI says "Dense column" — different emphasis
      conflicts: [
        {
          field: 'description',
          embeddedValue: 'Marchers proceed west on Des Voeux Road. Estimated 10,000 participants.',
          aiValue: 'Dense column of marchers fills Des Voeux Road during press-freedom rally.',
          aiConfidence: 0.92,
          resolvedBy: null,
          resolvedValue: null,
        },
      ],
    },
    {
      // Scenario B demo: IPTC city says "Admiralty" but AI infers "Wan Chai" → location conflict
      assetIndex: 2,
      declarationState: 'fully_validated',
      confidence: 0.86,
      title: 'Hong Kong: tear gas deployed near Admiralty',
      description: 'Police deploy tear gas at protest front line near Admiralty MTR station.',
      tags: ['tear gas', 'police', 'hong kong', 'admiralty', 'protest'],
      geography: ['Hong Kong', 'Wan Chai'],
      priceSuggestionCents: 26000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'broadcast'],
      extractedMetadata: {
        cameraMake: 'Sony', cameraModel: 'A7R V', iso: 1600, aperture: 'f/2.8', shutterSpeed: '1/2000',
        focalLength: '135mm', gpsLat: 22.2790, gpsLon: 114.1660, gpsLocationLabel: 'Admiralty, Hong Kong',
        iptcHeadline: 'Tear gas at Admiralty protest front',
        iptcCity: 'Admiralty', iptcCountry: 'China',
        iptcDateCreated: '2026-04-06T16:45:00+08:00', iptcByline: 'K. Tanaka',
        iptcCopyright: '© 2026 K. Tanaka',
        c2paPresent: false,
        dimensions: { width: 9504, height: 6336 }, colorSpace: 'Adobe RGB',
      },
      // Location conflict: IPTC says Admiralty, AI infers Wan Chai
      conflicts: [
        {
          field: 'geography',
          embeddedValue: 'Admiralty',
          aiValue: 'Wan Chai',
          aiConfidence: 0.72,
          resolvedBy: null,
          resolvedValue: null,
        },
      ],
    },
    {
      assetIndex: 3,
      declarationState: 'provenance_pending',
      confidence: 0.83,
      title: 'Hong Kong: volunteer medic treats injured protester',
      description: 'Volunteer medic treats injured protester in Wan Chai side street after tear gas exposure.',
      tags: ['medic', 'injury', 'tear gas', 'hong kong', 'wan chai'],
      geography: ['Hong Kong', 'Wan Chai'],
      priceSuggestionCents: 19500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
    },
    {
      assetIndex: 4,
      declarationState: 'fully_validated',
      confidence: 0.91,
      title: 'Hong Kong: close-up of press-freedom banner',
      description: 'Close-up of hand-painted Cantonese/English banner reading "Journalism Is Not A Crime".',
      tags: ['banner', 'signage', 'press freedom', 'hong kong'],
      geography: ['Hong Kong', 'Central'],
      priceSuggestionCents: 14200,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
    },
    {
      // PRIVATE asset — no price → advisory, not blocking
      assetIndex: 5,
      declarationState: 'fully_validated',
      confidence: 0.87,
      title: 'Hong Kong: rear of crowd at Chater Garden',
      description: 'View from back of crowd at Chater Garden staging area. Shows scale of turnout.',
      tags: ['crowd', 'rally', 'hong kong', 'chater garden'],
      geography: ['Hong Kong', 'Central', 'Chater Garden'],
      priceSuggestionCents: 12800,
      privacySuggestion: 'PRIVATE',
      licenceSuggestions: [],
    },
    {
      assetIndex: 6,
      declarationState: 'fully_validated',
      confidence: 0.84,
      title: 'Hong Kong: ambient audio at press-freedom rally',
      description: 'Two-minute ambient recording capturing crowd chants and loudspeaker announcements at Central rally.',
      tags: ['audio', 'ambient', 'rally', 'hong kong', 'crowd'],
      geography: ['Hong Kong', 'Central'],
      priceSuggestionCents: 8500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'broadcast'],
    },
  ],
}

// ══════════════════════════════════════════════════
// SCENARIO 2: MESSY MULTI-STORY
// ══════════════════════════════════════════════════
//
// Purpose: Hero workflow demo with ambiguity and manual intervention.
// Express eligible: NO (3 story groups, manifest-invalid, mixed confidence)
// Key proofs:
//  - 3 proposed story groups
//  - 1 manifest-invalid (asset #5) → blocking
//  - 1 duplicate (asset #14) → advisory
//  - 2 low-confidence proposals (assets #6 and #13)
//  - 1 PUBLIC asset with no price provided → blocking
//  - 1 RESTRICTED asset with no licence provided → blocking
//  - 1 PRIVATE asset missing price → advisory only
//  - Ambiguous assets (#6 could be flood or eviction)
//  - Existing-story match for Shenzhen cluster

export const MESSY_MULTI_STORY: MockScenario = {
  id: 'messy_multi_story',
  label: 'Mixed batch — 15 files, 3 stories',
  description: '15 files across Manila floods, Manila evictions, and Shenzhen factory. Includes duplicate, manifest-invalid, ambiguous Story candidates, mixed confidence.',
  fileCount: 15,
  assets: [
    // Manila flood cluster (7 files, indices 0-6)
    { filename: '2026-04-02_mnl-pasig_flood-aerial_001.CR3',       fileSize: 34_200_000, format: 'photo', thumbnailRef: '/assets/8900_large.jpeg' },
    { filename: '2026-04-02_mnl-marikina_boat-rescue_002.CR3',     fileSize: 28_600_000, format: 'photo', thumbnailRef: '/assets/8896_large.jpeg' },
    { filename: '2026-04-03_mnl-pasig_rescue-ops_003.MP4',         fileSize: 412_000_000, format: 'video' },
    { filename: '2026-04-03_mnl-qc_evac-centre_004.CR3',           fileSize: 22_100_000, format: 'photo', thumbnailRef: '/assets/9033_large.jpeg' },
    { filename: '2026-04-03_mnl-pasig_dispatch-update_005.txt',    fileSize: 6_200, format: 'text' },
    { filename: '2026-04-04_mnl-pasig_aftermath-cleanup_006.CR3',  fileSize: 26_400_000, format: 'photo', thumbnailRef: '/assets/9037_large.jpeg' },
    { filename: '2026-04-04_mnl-qc_survivor-interview_007.WAV',    fileSize: 58_000_000, format: 'audio' },
    // Manila eviction cluster (4 files, indices 7-10)
    { filename: '2026-04-05_mnl-tondo_eviction-standoff_008.CR3',  fileSize: 21_300_000, format: 'photo', thumbnailRef: '/assets/10033_large.jpeg' },
    { filename: '2026-04-05_mnl-tondo_families-displaced_009.CR3', fileSize: 24_800_000, format: 'photo', thumbnailRef: '/assets/371_large.jpeg' },
    { filename: '2026-04-06_mnl-tondo_police-perimeter_010.CR3',   fileSize: 27_100_000, format: 'photo', thumbnailRef: '/assets/10056_large.jpeg' },
    { filename: '2026-04-06_mnl-tondo_protest-banner_011.CR3',     fileSize: 16_400_000, format: 'photo', thumbnailRef: '/assets/150_large.jpeg' },
    // Shenzhen existing-story match (3 files, indices 11-13)
    { filename: '2026-03-28_sz-nanshan_factory-workers_012.CR3',   fileSize: 29_800_000, format: 'photo', thumbnailRef: '/assets/11847_large.jpeg' },
    { filename: '2026-03-28_sz-nanshan_factory-floor_013.CR3',     fileSize: 33_200_000, format: 'photo', thumbnailRef: '/assets/11862_large.jpeg' },
    { filename: '2026-03-29_sz-nanshan_worker-interview_014.WAV',  fileSize: 72_000_000, format: 'audio' },
    // Duplicate of file 0
    { filename: '2026-04-02_mnl-pasig_flood-aerial_001_COPY.CR3',  fileSize: 34_200_000, format: 'photo', thumbnailRef: '/assets/8900_large.jpeg' },
  ],
  storyGroupTemplates: [
    {
      name: 'Manila: Pasig River Flooding April 2026',
      kind: 'proposed',
      assetIndices: [0, 1, 2, 3, 4, 5, 6],
      confidence: 0.87,
      rationale: 'GPS cluster in Pasig River / Marikina area, timestamps April 2-4, flood/rescue scene detection in all visual assets. Text dispatch and audio interview geographically correlated.',
    },
    {
      name: 'Manila: Tondo Forced Evictions',
      kind: 'proposed',
      assetIndices: [7, 8, 9, 10],
      confidence: 0.79,
      rationale: 'GPS cluster in Tondo district, timestamps April 5-6, protest/standoff/eviction scene detection. Separate event from flood coverage.',
    },
    {
      name: "Inside Shenzhen's Silicon Shield",
      kind: 'matched-existing',
      assetIndices: [11, 12, 13],
      existingStoryId: 'story-002',
      existingStoryTitle: "Inside Shenzhen's Silicon Shield",
      existingStoryAssetCount: 12,
      confidence: 0.83,
      rationale: 'Factory interior scene detection + Shenzhen/Nanshan GPS matches existing Vault Story "Inside Shenzhen\'s Silicon Shield" with 12 published assets.',
    },
  ],
  analysisTemplates: [
    {
      // Scenario B: IPTC city says "Pasig City" but AI infers "Manila" → location conflict
      assetIndex: 0,
      declarationState: 'fully_validated',
      confidence: 0.88,
      title: 'Manila: aerial view of Pasig River flooding',
      description: 'Aerial photograph from helicopter showing extent of flooding along Pasig River. Residential areas submerged to rooftop level.',
      tags: ['flood', 'aerial', 'manila', 'pasig river', 'disaster'],
      geography: ['Manila', 'Pasig River', 'Philippines'],
      priceSuggestionCents: 24000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'broadcast'],
      extractedMetadata: {
        cameraMake: 'DJI', cameraModel: 'Mavic 3 Pro', iso: 100, aperture: 'f/2.8', shutterSpeed: '1/2000',
        focalLength: '24mm (equiv)', gpsLat: 14.5764, gpsLon: 121.0851, gpsLocationLabel: 'Pasig City, Metro Manila',
        iptcHeadline: 'Pasig River flood aerial — April 2026',
        iptcCaption: 'Aerial view showing residential flooding along Pasig River. Pasig City municipality.',
        iptcKeywords: ['flood', 'aerial', 'pasig', 'river', 'disaster'],
        iptcByline: 'M. Reyes', iptcCity: 'Pasig City', iptcCountry: 'Philippines',
        iptcDateCreated: '2026-04-02T09:15:00+08:00', iptcCopyright: '© 2026 M. Reyes',
        c2paPresent: true, c2paVersion: '2.0', c2paValid: true, c2paSignerIdentity: 'DJI / M. Reyes',
        dimensions: { width: 5280, height: 3956 }, colorSpace: 'sRGB',
      },
      conflicts: [
        {
          field: 'geography',
          embeddedValue: 'Pasig City',
          aiValue: 'Manila, Pasig River',
          aiConfidence: 0.88,
          resolvedBy: null,
          resolvedValue: null,
        },
      ],
    },
    {
      assetIndex: 1,
      declarationState: 'fully_validated',
      confidence: 0.85,
      title: 'Manila: boat rescue in flooded Marikina street',
      description: 'Philippine Coast Guard personnel navigate inflatable rescue boat through flooded residential street in Marikina.',
      tags: ['rescue', 'flood', 'boat', 'manila', 'marikina', 'coast guard'],
      geography: ['Manila', 'Marikina', 'Philippines'],
      priceSuggestionCents: 21000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
      extractedMetadata: {
        cameraMake: 'Nikon', cameraModel: 'Z9', iso: 800, aperture: 'f/4.0', shutterSpeed: '1/250',
        focalLength: '35mm', gpsLat: 14.6507, gpsLon: 121.1029, gpsLocationLabel: 'Marikina, Metro Manila',
        iptcCity: 'Marikina', iptcCountry: 'Philippines',
        iptcDateCreated: '2026-04-02T11:30:00+08:00', iptcByline: 'R. Cruz',
        c2paPresent: false,
        dimensions: { width: 8256, height: 5504 }, colorSpace: 'sRGB',
      },
    },
    {
      assetIndex: 2,
      declarationState: 'provenance_pending',
      confidence: 0.78,
      title: 'Manila: flood rescue operations video',
      description: 'Handheld video footage of rescue operations along flooded residential streets. 3 minutes 42 seconds.',
      tags: ['rescue', 'flood', 'video', 'manila', 'disaster'],
      geography: ['Manila', 'Philippines'],
      priceSuggestionCents: 48000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'broadcast'],
    },
    {
      // RESTRICTED asset — will need licence to not block
      assetIndex: 3,
      declarationState: 'fully_validated',
      confidence: 0.82,
      title: 'Manila: displaced families at Quezon City evacuation centre',
      description: 'Families sheltering at Quezon City multipurpose hall converted to flood evacuation centre.',
      tags: ['displacement', 'evacuation', 'families', 'manila', 'flood'],
      geography: ['Manila', 'Quezon City', 'Philippines'],
      priceSuggestionCents: 17500,
      privacySuggestion: 'RESTRICTED',
      licenceSuggestions: [],  // No licence suggestions → will create blocking exception
    },
    {
      assetIndex: 4,
      declarationState: 'fully_validated',
      confidence: 0.74,
      title: 'Manila: flood situation dispatch from Pasig River area',
      description: 'Text dispatch reporting on flood conditions, rescue progress, and displacement numbers along Pasig River.',
      tags: ['dispatch', 'flood', 'report', 'manila', 'pasig river'],
      geography: ['Manila', 'Philippines'],
      priceSuggestionCents: 9500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'digital'],
    },
    {
      // MANIFEST INVALID — blocking
      assetIndex: 5,
      declarationState: 'manifest_invalid',
      confidence: 0.72,
      title: 'Manila: flood aftermath cleanup',
      description: 'Residents cleaning up debris and mud after floodwaters recede in Pasig River district.',
      tags: ['aftermath', 'cleanup', 'flood', 'manila'],
      geography: ['Manila', 'Philippines'],
      priceSuggestionCents: 14500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
    },
    {
      // Low confidence — ambiguous between flood and eviction stories
      assetIndex: 6,
      declarationState: 'provenance_pending',
      confidence: 0.42,
      title: 'Manila: flood survivor interview audio',
      description: 'Audio interview with flood-displaced family in evacuation centre. Speaker discusses both flooding and prior eviction threat.',
      tags: ['interview', 'audio', 'flood', 'manila', 'displacement', 'eviction'],
      geography: ['Manila', 'Quezon City', 'Philippines'],
      priceSuggestionCents: 11000,
      privacySuggestion: 'PRIVATE',   // PRIVATE no-price → advisory only
      licenceSuggestions: [],
    },
    {
      assetIndex: 7,
      declarationState: 'fully_validated',
      confidence: 0.81,
      title: 'Manila: eviction standoff in Tondo',
      description: 'Residents face off with demolition crew backed by police in Tondo informal settlement.',
      tags: ['eviction', 'standoff', 'tondo', 'manila', 'housing'],
      geography: ['Manila', 'Tondo', 'Philippines'],
      priceSuggestionCents: 19000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
    },
    {
      assetIndex: 8,
      declarationState: 'fully_validated',
      confidence: 0.83,
      title: 'Manila: displaced families carry belongings from demolished housing',
      description: 'Families carry mattresses and possessions through rubble of demolished informal housing in Tondo.',
      tags: ['eviction', 'families', 'displacement', 'tondo', 'manila'],
      geography: ['Manila', 'Tondo', 'Philippines'],
      priceSuggestionCents: 17500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
    },
    {
      assetIndex: 9,
      declarationState: 'provenance_pending',
      confidence: 0.76,
      title: 'Manila: police maintain perimeter at Tondo demolition site',
      description: 'Police officers form perimeter around active demolition zone in Tondo while residents protest.',
      tags: ['police', 'eviction', 'perimeter', 'tondo', 'manila'],
      geography: ['Manila', 'Tondo', 'Philippines'],
      priceSuggestionCents: 16000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
    },
    {
      assetIndex: 10,
      declarationState: 'fully_validated',
      confidence: 0.86,
      title: 'Manila: anti-eviction protest banner at Tondo site',
      description: 'Hand-painted banner reading "Lupa para sa Mamamayan — Land for the People" at Tondo protest.',
      tags: ['banner', 'protest', 'eviction', 'tondo', 'manila', 'housing rights'],
      geography: ['Manila', 'Tondo', 'Philippines'],
      priceSuggestionCents: 12500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
    },
    {
      assetIndex: 11,
      declarationState: 'fully_validated',
      confidence: 0.85,
      title: 'Shenzhen: workers on electronics assembly line',
      description: 'Workers assembling consumer electronics on production line in Nanshan district factory.',
      tags: ['factory', 'workers', 'assembly', 'shenzhen', 'electronics'],
      geography: ['Shenzhen', 'Nanshan', 'China'],
      priceSuggestionCents: 22000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'commercial'],
    },
    {
      assetIndex: 12,
      declarationState: 'fully_validated',
      confidence: 0.87,
      title: 'Shenzhen: factory floor panoramic showing scale of operation',
      description: 'Wide shot showing hundreds of workers on factory floor in Shenzhen special economic zone.',
      tags: ['factory', 'panoramic', 'shenzhen', 'manufacturing', 'labour'],
      geography: ['Shenzhen', 'Nanshan', 'China'],
      priceSuggestionCents: 25000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'commercial'],
    },
    {
      // Low confidence, RESTRICTED without licence → blocking
      assetIndex: 13,
      declarationState: 'provenance_pending',
      confidence: 0.45,
      title: 'Shenzhen: factory worker interview about wages and conditions',
      description: 'Audio interview with anonymous factory worker discussing wages, overtime, and working conditions. Speaker requested anonymity.',
      tags: ['interview', 'factory', 'labour', 'shenzhen', 'wages'],
      geography: ['Shenzhen', 'China'],
      priceSuggestionCents: 11000,
      privacySuggestion: 'RESTRICTED',
      licenceSuggestions: [],  // No licence → blocking for RESTRICTED
    },
    {
      // DUPLICATE of asset 0
      assetIndex: 14,
      declarationState: 'fully_validated',
      confidence: 0.88,
      duplicateOf: 0,
      title: 'Manila: aerial view of Pasig River flooding',
      description: 'Aerial photograph from helicopter showing extent of flooding along Pasig River. Residential areas submerged to rooftop level.',
      tags: ['flood', 'aerial', 'manila', 'pasig river', 'disaster'],
      geography: ['Manila', 'Pasig River', 'Philippines'],
      priceSuggestionCents: 24000,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'broadcast'],
    },
  ],
}

// ══════════════════════════════════════════════════
// SCENARIO 3: SCALE BATCH 50+
// ══════════════════════════════════════════════════
//
// Purpose: Scale stress test with 60 assets.
// Express eligible: NO (6 story groups, manifest-invalid, mixed confidence)
//
// Cluster breakdown:
//  Bangkok protests:    18 assets (indices 0-17)
//  Jakarta flooding:    14 assets (indices 18-31)
//  Taipei tech summit:  10 assets (indices 32-41)
//  Myanmar border:       8 assets (indices 42-49)
//  Seoul labour strike:  6 assets (indices 50-55)
//  Unclustered/misc:     4 assets (indices 56-59)
//
// Key proofs:
//  - 2 manifest-invalid (indices 16, 30)
//  - 4 duplicates (indices 17, 31, 49, 59)
//  - 5+ ambiguous assets (cross-cluster candidates)
//  - 5 PRIVATE advisory-only cases
//  - 4 PUBLIC/RESTRICTED commercial blockers (no price or no licence)
//  - 2 excluded assets
//  - Mix of high/medium/low confidence
//  - Mixed formats: photo, video, audio, text, illustration

// Deterministic seeded pseudo-random for repeatable "variation"
function seeded(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

const SCALE_PHOTO_POOL = [
  // Original pool
  '/assets/172_large.jpeg', '/assets/150_large.jpeg', '/assets/159_large.jpeg',
  '/assets/67_large.jpeg',  '/assets/371_large.jpeg',
  '/assets/5813_large.jpeg', '/assets/6244_large.jpeg', '/assets/7291_large.jpeg',
  '/assets/7303_large.jpeg', '/assets/7309_large.jpeg',
  '/assets/8654_large.jpeg', '/assets/8896_large.jpeg', '/assets/8900_large.jpeg',
  '/assets/8903_large.jpeg', '/assets/8936_large.jpeg', '/assets/9033_large.jpeg',
  '/assets/9037_large.jpeg', '/assets/9043_large.jpeg', '/assets/10025_large.jpeg',
  '/assets/10033_large.jpeg', '/assets/10045_large.jpeg', '/assets/10056_large.jpeg',
  '/assets/10062_large.jpeg', '/assets/11847_large.jpeg', '/assets/11862_large.jpeg',
  '/assets/12087_large.jpeg', '/assets/12280_large.jpeg', '/assets/12435_large.jpeg',
  '/assets/12480_large.jpeg', '/assets/12948_large.jpeg', '/assets/13139_large.jpeg',
  '/assets/13937_large.jpeg', '/assets/14615_large.jpeg', '/assets/15024_large.jpeg',
  '/assets/3578_large.jpeg',  '/assets/4398_large.jpeg',  '/assets/6245_large.jpeg',
  // Expanded pool — batch 3+
  '/assets/368_large.jpeg',  '/assets/388_large.jpeg',  '/assets/393_large.jpeg',
  '/assets/395_large.jpeg',  '/assets/399_large.jpeg',  '/assets/522_large.jpeg',
  '/assets/524_large.jpeg',  '/assets/525_large.jpeg',  '/assets/527_large.jpeg',
  '/assets/529_large.jpeg',  '/assets/530_large.jpeg',  '/assets/589_large.jpeg',
  '/assets/988_large.jpeg',  '/assets/1052_large.jpeg', '/assets/1327_large.jpeg',
  '/assets/1416_large.jpeg', '/assets/1559_large.jpeg', '/assets/1725_large.jpeg',
  '/assets/1834_large.jpeg', '/assets/1837_large.jpeg', '/assets/1843_large.jpeg',
  '/assets/1844_large.jpeg', '/assets/1887_large.jpeg', '/assets/1956_large.jpeg',
  '/assets/1979_large.jpeg', '/assets/2001_large.jpeg', '/assets/2128_large.jpeg',
  '/assets/2301_large.jpeg', '/assets/2342_large.jpeg', '/assets/2344_large.jpeg',
  '/assets/2434_large.jpeg', '/assets/2481_large.jpeg', '/assets/2487_large.jpeg',
  '/assets/2661_large.jpeg', '/assets/2663_large.jpeg', '/assets/2665_large.jpeg',
  '/assets/2914_large.jpeg', '/assets/2916_large.jpeg', '/assets/3096_large.jpeg',
  '/assets/3240_large.jpeg', '/assets/3289_large.jpeg', '/assets/3291_large.jpeg',
  '/assets/3352_large.jpeg', '/assets/3600_large.jpeg', '/assets/3765_large.jpeg',
  '/assets/3801_large.jpeg', '/assets/3956_large.jpeg', '/assets/4078_large.jpeg',
  '/assets/4142_large.jpeg', '/assets/4375_large.jpeg', '/assets/4400_large.jpeg',
  '/assets/5036_large.jpeg', '/assets/5066_large.jpeg', '/assets/5247_large.jpeg',
  '/assets/5411_large.jpeg', '/assets/5418_large.jpeg', '/assets/5420_large.jpeg',
  '/assets/5427_large.jpeg', '/assets/5520_large.jpeg', '/assets/5559_large.jpeg',
  '/assets/6019_large.jpeg', '/assets/6142_large.jpeg', '/assets/6250_large.jpeg',
  '/assets/6774_large.jpeg', '/assets/7052_large.jpeg', '/assets/7353_large.jpeg',
  '/assets/7395_large.jpeg', '/assets/7429_large.jpeg', '/assets/7461_large.jpeg',
  '/assets/7484_large.jpeg', '/assets/7493_large.jpeg', '/assets/7589_large.jpeg',
  '/assets/7608_large.jpeg', '/assets/7613_large.jpeg', '/assets/7683_large.jpeg',
  '/assets/7730_large.jpeg', '/assets/7756_large.jpeg', '/assets/7872_large.jpeg',
  '/assets/7944_large.jpeg', '/assets/8300_large.jpeg', '/assets/8317_large.jpeg',
  '/assets/8477_large.jpeg', '/assets/8636_large.jpeg', '/assets/8641_large.jpeg',
  '/assets/8651_large.jpeg', '/assets/8665_large.jpeg', '/assets/8679_large.jpeg',
  '/assets/8815_large.jpeg', '/assets/8867_large.jpeg', '/assets/8946_large.jpeg',
  '/assets/8956_large.jpeg', '/assets/8961_large.jpeg', '/assets/8963_large.jpeg',
  '/assets/8968_large.jpeg', '/assets/9023_large.jpeg', '/assets/9029_large.jpeg',
  '/assets/9075_large.jpeg', '/assets/9108_large.jpeg', '/assets/9132_large.jpeg',
  '/assets/9241_large.jpeg', '/assets/9327_large.jpeg', '/assets/9337_large.jpeg',
  '/assets/9339_large.jpeg', '/assets/9344_large.jpeg', '/assets/9446_large.jpeg',
  '/assets/9514_large.jpeg', '/assets/9626_large.jpeg', '/assets/9632_large.jpeg',
  '/assets/9740_large.jpeg', '/assets/9745_large.jpeg', '/assets/9758_large.jpeg',
  '/assets/10041_large.jpeg', '/assets/10215_large.jpeg', '/assets/10216_large.jpeg',
  '/assets/10230_large.jpeg', '/assets/10231_large.jpeg', '/assets/10610_large.jpeg',
  '/assets/11003_large.jpeg', '/assets/11638_large.jpeg', '/assets/11641_large.jpeg',
  '/assets/11648_large.jpeg', '/assets/12107_large.jpeg', '/assets/12391_large.jpeg',
  '/assets/12659_large.jpeg', '/assets/12958_large.jpeg', '/assets/13152_large.jpeg',
  '/assets/13334_large.jpeg', '/assets/13415_large.jpeg', '/assets/14008_large.jpeg',
  '/assets/14715_large.jpeg', '/assets/14926_large.jpeg',
]

function buildScaleAssets(): MockAsset[] {
  const a: MockAsset[] = []
  let photoCount = 0

  const nextThumb = () => SCALE_PHOTO_POOL[photoCount++ % SCALE_PHOTO_POOL.length]

  // Bangkok protests — 18 files
  const bkkFormats: AssetFormat[] = ['photo','photo','photo','photo','video','photo','photo','audio','photo','photo','photo','text','photo','photo','video','photo','photo','photo']
  for (let i = 0; i < 18; i++) {
    const fmt = bkkFormats[i]
    const ext = fmt === 'photo' ? 'CR3' : fmt === 'video' ? 'MP4' : fmt === 'audio' ? 'WAV' : 'txt'
    const base = fmt === 'video' ? 320_000_000 : fmt === 'audio' ? 48_000_000 : fmt === 'text' ? 5_800 : 18_000_000
    a.push({ filename: `2026-04-05_bkk-ratchaprasong_protest-${String(i+1).padStart(2,'0')}.${ext}`, fileSize: base + Math.round(seeded(i) * 12_000_000), format: fmt, ...(fmt === 'photo' ? { thumbnailRef: nextThumb() } : {}) })
  }

  // Jakarta flooding — 14 files
  const jktFormats: AssetFormat[] = ['photo','photo','photo','video','photo','photo','photo','audio','photo','photo','photo','photo','illustration','photo']
  for (let i = 0; i < 14; i++) {
    const fmt = jktFormats[i]
    const ext = fmt === 'photo' ? 'CR3' : fmt === 'video' ? 'MP4' : fmt === 'audio' ? 'WAV' : fmt === 'illustration' ? 'png' : 'CR3'
    const base = fmt === 'video' ? 380_000_000 : fmt === 'audio' ? 55_000_000 : fmt === 'illustration' ? 8_500_000 : 20_000_000
    a.push({ filename: `2026-04-03_jkt-kemang_flood-${String(i+1).padStart(2,'0')}.${ext}`, fileSize: base + Math.round(seeded(20+i) * 10_000_000), format: fmt, ...(fmt === 'photo' ? { thumbnailRef: nextThumb() } : {}) })
  }

  // Taipei tech summit — 10 files
  const tpeFormats: AssetFormat[] = ['photo','photo','photo','video','photo','photo','photo','photo','video','photo']
  for (let i = 0; i < 10; i++) {
    const fmt = tpeFormats[i]
    const ext = fmt === 'photo' ? 'CR3' : 'MP4'
    const base = fmt === 'video' ? 440_000_000 : 16_000_000
    a.push({ filename: `2026-04-04_tpe-xinyi_techsummit-${String(i+1).padStart(2,'0')}.${ext}`, fileSize: base + Math.round(seeded(40+i) * 8_000_000), format: fmt, ...(fmt === 'photo' ? { thumbnailRef: nextThumb() } : {}) })
  }

  // Myanmar border — 8 files
  const mmrFormats: AssetFormat[] = ['photo','photo','photo','video','photo','audio','photo','photo']
  for (let i = 0; i < 8; i++) {
    const fmt = mmrFormats[i]
    const ext = fmt === 'photo' ? 'CR3' : fmt === 'video' ? 'MP4' : 'WAV'
    const base = fmt === 'video' ? 290_000_000 : fmt === 'audio' ? 42_000_000 : 15_000_000
    a.push({ filename: `2026-04-01_mmr-maesot_border-${String(i+1).padStart(2,'0')}.${ext}`, fileSize: base + Math.round(seeded(50+i) * 6_000_000), format: fmt, ...(fmt === 'photo' ? { thumbnailRef: nextThumb() } : {}) })
  }

  // Seoul labour strike — 6 files
  const selFormats: AssetFormat[] = ['photo','photo','video','photo','audio','photo']
  for (let i = 0; i < 6; i++) {
    const fmt = selFormats[i]
    const ext = fmt === 'photo' ? 'CR3' : fmt === 'video' ? 'MP4' : 'WAV'
    const base = fmt === 'video' ? 260_000_000 : fmt === 'audio' ? 36_000_000 : 19_000_000
    a.push({ filename: `2026-04-06_sel-yeouido_strike-${String(i+1).padStart(2,'0')}.${ext}`, fileSize: base + Math.round(seeded(60+i) * 7_000_000), format: fmt, ...(fmt === 'photo' ? { thumbnailRef: nextThumb() } : {}) })
  }

  // Unclustered misc — 4 files
  a.push({ filename: 'SGP_marina-bay_nightscape_001.CR3',           fileSize: 22_000_000, format: 'photo', thumbnailRef: nextThumb() })
  a.push({ filename: 'unknown-source_field-recording_untagged.WAV', fileSize: 8_200_000,  format: 'audio' })
  a.push({ filename: '2026-04-03_jkt-kemang_flood-aerial-DUPE.CR3', fileSize: 34_200_000, format: 'photo', thumbnailRef: SCALE_PHOTO_POOL[0] })
  a.push({ filename: '2026-04-05_bkk-ratchaprasong_protest-DUPE.CR3', fileSize: 24_000_000, format: 'photo', thumbnailRef: SCALE_PHOTO_POOL[1] })

  return a
}

function buildScaleAnalysis(): MockAnalysisTemplate[] {
  const t: MockAnalysisTemplate[] = []

  // Bangkok — 18 assets
  const bkkTitles = [
    'Bangkok: crowd gathers at Democracy Monument', 'Bangkok: student leaders address rally', 'Bangkok: riot police form line on Ratchadamri',
    'Bangkok: aerial drone footage of protest march', 'Bangkok: protester shields against water cannon', 'Bangkok: medic station near Siam intersection',
    'Bangkok: ambient audio of crowd chants', 'Bangkok: confrontation at police barrier', 'Bangkok: hand-drawn protest placards',
    'Bangkok: women-led contingent on Rama I Road', 'Bangkok: text dispatch from protest zone',
    'Bangkok: night vigil at Democracy Monument', 'Bangkok: tear gas deployed at Ratchaprasong',
    'Bangkok: drone footage of night protest', 'Bangkok: injured protester receives first aid',
    'Bangkok: protest aftermath at dawn (MANIFEST INVALID)', 'Bangkok: duplicate of protest scene 01',
    'Bangkok: police water cannon truck deployment',
  ]
  const bkkDeclarations: ValidationDeclarationState[] = [
    'fully_validated','fully_validated','fully_validated','provenance_pending','fully_validated',
    'fully_validated','fully_validated','fully_validated','fully_validated','provenance_pending',
    'fully_validated','fully_validated','fully_validated','fully_validated','fully_validated',
    'fully_validated','manifest_invalid','fully_validated',
  ]
  const bkkPrivacy: PrivacyState[] = [
    'PUBLIC','PUBLIC','PUBLIC','PUBLIC','PUBLIC',
    'PRIVATE','PUBLIC','PUBLIC','PUBLIC','PUBLIC',
    'PUBLIC','PRIVATE','PUBLIC','PUBLIC','PRIVATE',
    'PUBLIC','PUBLIC','PUBLIC',
  ]
  const bkkConfidence = [0.88,0.91,0.84,0.79,0.86,0.82,0.75,0.87,0.90,0.83,0.71,0.85,0.78,0.80,0.73,0.69,0.88,0.86]

  for (let i = 0; i < 18; i++) {
    const tpl: MockAnalysisTemplate = {
      assetIndex: i,
      declarationState: bkkDeclarations[i],
      confidence: bkkConfidence[i],
      title: bkkTitles[i],
      description: `Documentation of April 2026 democracy protests in Bangkok. ${bkkTitles[i]}.`,
      tags: ['protest', 'bangkok', 'thailand', 'democracy'],
      geography: ['Bangkok', 'Ratchaprasong', 'Thailand'],
      priceSuggestionCents: 14000 + i * 800,
      privacySuggestion: bkkPrivacy[i],
      licenceSuggestions: bkkPrivacy[i] === 'PRIVATE' ? [] : ['editorial'],
    }
    if (i === 17) tpl.duplicateOf = 0  // duplicate
    t.push(tpl)
  }

  // Jakarta — 14 assets
  const jktDeclarations: ValidationDeclarationState[] = [
    'fully_validated','fully_validated','provenance_pending','fully_validated','fully_validated',
    'fully_validated','fully_validated','provenance_pending','fully_validated','fully_validated',
    'fully_validated','fully_validated','manifest_invalid','fully_validated',
  ]
  const jktPrivacy: PrivacyState[] = [
    'PUBLIC','PUBLIC','PUBLIC','PUBLIC','RESTRICTED',
    'PUBLIC','PRIVATE','PUBLIC','PUBLIC','PUBLIC',
    'PUBLIC','PUBLIC','PUBLIC','PUBLIC',
  ]
  const jktConfidence = [0.86,0.84,0.77,0.89,0.81,0.83,0.68,0.79,0.85,0.82,0.80,0.76,0.73,0.87]

  for (let i = 0; i < 14; i++) {
    const tpl: MockAnalysisTemplate = {
      assetIndex: 18 + i,
      declarationState: jktDeclarations[i],
      confidence: jktConfidence[i],
      title: `Jakarta: monsoon flooding scene ${i + 1}`,
      description: `Documentation of monsoon flooding in Jakarta's Kemang district, April 2026.`,
      tags: ['flood', 'jakarta', 'indonesia', 'monsoon', 'kemang'],
      geography: ['Jakarta', 'Kemang', 'Indonesia'],
      priceSuggestionCents: 12000 + i * 600,
      privacySuggestion: jktPrivacy[i],
      licenceSuggestions: jktPrivacy[i] === 'PRIVATE' ? [] : (jktPrivacy[i] === 'RESTRICTED' ? [] : ['editorial']),
    }
    if (i === 13) tpl.duplicateOf = 18  // duplicate of first Jakarta
    t.push(tpl)
  }

  // Taipei — 10 assets
  for (let i = 0; i < 10; i++) {
    t.push({
      assetIndex: 32 + i,
      declarationState: 'fully_validated',
      confidence: 0.82 + seeded(100 + i) * 0.12,
      title: `Taipei: Asia-Pacific tech summit day ${Math.ceil((i + 1) / 3)}`,
      description: `Coverage of Asia-Pacific Technology Summit at Taipei International Convention Center, Xinyi District.`,
      tags: ['tech', 'summit', 'taipei', 'taiwan', 'AI', 'semiconductor'],
      geography: ['Taipei', 'Xinyi District', 'Taiwan'],
      priceSuggestionCents: 15000 + i * 500,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial', 'commercial'],
    })
  }

  // Myanmar — 8 assets
  const mmrDeclarations: ValidationDeclarationState[] = [
    'fully_validated','provenance_pending','fully_validated','fully_validated',
    'provenance_pending','fully_validated','fully_validated','fully_validated',
  ]
  const mmrPrivacy: PrivacyState[] = ['PUBLIC','PUBLIC','PUBLIC','PUBLIC','RESTRICTED','RESTRICTED','PRIVATE','PUBLIC']

  for (let i = 0; i < 8; i++) {
    const tpl: MockAnalysisTemplate = {
      assetIndex: 42 + i,
      declarationState: mmrDeclarations[i],
      confidence: 0.74 + seeded(110 + i) * 0.16,
      title: `Myanmar border: documentation scene ${i + 1}`,
      description: `Documentation of border situation near Mae Sot, Tak Province. Refugee movement and humanitarian conditions.`,
      tags: ['border', 'myanmar', 'mae sot', 'refugees', 'humanitarian'],
      geography: ['Mae Sot', 'Tak Province', 'Thailand-Myanmar border'],
      priceSuggestionCents: 13000 + i * 700,
      privacySuggestion: mmrPrivacy[i],
      licenceSuggestions: mmrPrivacy[i] === 'PRIVATE' ? [] : (mmrPrivacy[i] === 'RESTRICTED' ? [] : ['editorial']),
    }
    if (i === 7) tpl.duplicateOf = 42  // duplicate of first Myanmar
    t.push(tpl)
  }

  // Seoul — 6 assets
  const selPrivacy: PrivacyState[] = ['PUBLIC','PUBLIC','PUBLIC','PRIVATE','PUBLIC','PUBLIC']
  for (let i = 0; i < 6; i++) {
    t.push({
      assetIndex: 50 + i,
      declarationState: i === 4 ? 'provenance_pending' : 'fully_validated',
      confidence: 0.80 + seeded(120 + i) * 0.14,
      title: `Seoul: Yeouido labour strike day ${i + 1}`,
      description: `Coverage of metalworkers' labour strike outside National Assembly in Yeouido, Seoul.`,
      tags: ['strike', 'labour', 'seoul', 'yeouido', 'metalworkers'],
      geography: ['Seoul', 'Yeouido', 'South Korea'],
      priceSuggestionCents: 11000 + i * 500,
      privacySuggestion: selPrivacy[i],
      licenceSuggestions: selPrivacy[i] === 'PRIVATE' ? [] : ['editorial'],
    })
  }

  // Unclustered — 4 assets
  t.push({
    assetIndex: 56,
    declarationState: 'fully_validated',
    confidence: 0.55,
    title: 'Singapore: Marina Bay nightscape',
    description: 'Night photograph of Singapore Marina Bay skyline from Esplanade bridge.',
    tags: ['nightscape', 'singapore', 'marina bay', 'skyline'],
    geography: ['Singapore'],
    priceSuggestionCents: 10000,
    privacySuggestion: 'PRIVATE',
    licenceSuggestions: [],
  })
  t.push({
    assetIndex: 57,
    declarationState: 'provenance_pending',
    confidence: 0.32,
    title: 'Unknown: untagged field recording',
    description: 'Unidentified audio recording with no embedded metadata. Ambient sounds, possibly urban.',
    tags: [],
    geography: [],
    priceSuggestionCents: 3000,
    privacySuggestion: 'PRIVATE',
    licenceSuggestions: [],
  })
  t.push({
    assetIndex: 58,
    declarationState: 'fully_validated',
    confidence: 0.86,
    duplicateOf: 18,
    title: 'Jakarta: monsoon flooding aerial (DUPLICATE)',
    description: 'Duplicate of earlier Jakarta flood aerial photograph.',
    tags: ['flood', 'aerial', 'jakarta'],
    geography: ['Jakarta', 'Indonesia'],
    priceSuggestionCents: 24000,
    privacySuggestion: 'PUBLIC',
    licenceSuggestions: ['editorial'],
  })
  t.push({
    assetIndex: 59,
    declarationState: 'fully_validated',
    confidence: 0.88,
    duplicateOf: 0,
    title: 'Bangkok: protest scene 01 (DUPLICATE)',
    description: 'Duplicate of Bangkok protest scene 01.',
    tags: ['protest', 'bangkok'],
    geography: ['Bangkok', 'Thailand'],
    priceSuggestionCents: 14000,
    privacySuggestion: 'PUBLIC',
    licenceSuggestions: ['editorial'],
  })

  return t
}

export const SCALE_BATCH_50_PLUS: MockScenario = {
  id: 'scale_batch_50_plus',
  label: 'Scale batch — 60 files, 6 stories',
  description: '60 files across Bangkok, Jakarta, Taipei, Myanmar, Seoul + unclustered. Tests scale, mixed formats, existing-story matches, duplicates, manifest-invalid.',
  fileCount: 60,
  assets: buildScaleAssets(),
  storyGroupTemplates: [
    {
      name: 'Bangkok: April 2026 Democracy Protests',
      kind: 'proposed',
      assetIndices: Array.from({ length: 18 }, (_, i) => i),
      confidence: 0.85,
      rationale: 'GPS cluster in Ratchaprasong/Democracy Monument area. Protest scene detection. Timestamps within 48 hours.',
    },
    {
      name: 'Jakarta: Monsoon Flooding April 2026',
      kind: 'proposed',
      assetIndices: Array.from({ length: 14 }, (_, i) => 18 + i),
      confidence: 0.82,
      rationale: 'Jakarta/Kemang GPS cluster. Flood/rescue scene detection. Timestamps April 3-5.',
    },
    {
      name: 'Taipei: Asia-Pacific Tech Summit 2026',
      kind: 'proposed',
      assetIndices: Array.from({ length: 10 }, (_, i) => 32 + i),
      confidence: 0.89,
      rationale: 'Xinyi District GPS. Conference/tech scene detection. Consistent timestamps and venue metadata.',
    },
    {
      name: 'Myanmar Border Crisis',
      kind: 'matched-existing',
      assetIndices: Array.from({ length: 8 }, (_, i) => 42 + i),
      existingStoryId: 'story-003',
      existingStoryTitle: 'Myanmar Border Crisis: Mae Sot Corridor',
      existingStoryAssetCount: 14,
      confidence: 0.77,
      rationale: 'Mae Sot GPS matches existing Vault Story with 14 published assets. Border/refugee scene detection.',
    },
    {
      name: 'Seoul: Yeouido Metalworkers Strike',
      kind: 'proposed',
      assetIndices: Array.from({ length: 6 }, (_, i) => 50 + i),
      confidence: 0.81,
      rationale: 'Yeouido GPS cluster. Labour/strike scene detection. Consistent timestamps.',
    },
    {
      name: 'Unclustered Assets',
      kind: 'proposed',
      assetIndices: [56, 57, 58, 59],
      confidence: 0.28,
      rationale: 'Low-confidence grouping of assets that did not cluster with main events. Review recommended.',
    },
  ],
  analysisTemplates: buildScaleAnalysis(),
}

// ══════════════════════════════════════════════════
// C2.2 §3.1 — Archive-scale fixtures (programmatically generated)
// ══════════════════════════════════════════════════
//
// Three deterministic fixtures for the 4-mode density router. Built by
// `buildArchiveScenario` — no Math.random; stable IDs from index.
//
//   archive_150_mixed         — 150 assets, 3 implied clusters
//   archive_500_single_shoot  — 500 assets, 1 large cluster
//   archive_1500_decade       — 1,500 assets, 12 clusters
//
// Per IPII-12: extends existing SCENARIO_REGISTRY (DevHarness compatibility).

interface ArchiveScenarioSpec {
  id: ScenarioId
  label: string
  count: number
  clusters: Array<{ name: string; size: number; rationale: string }>
}

function buildArchiveScenario(spec: ArchiveScenarioSpec): MockScenario {
  const assets: MockAsset[] = []
  const storyGroupTemplates: MockStoryGroupTemplate[] = []
  const analysisTemplates: MockAnalysisTemplate[] = []

  let idx = 0
  for (let c = 0; c < spec.clusters.length; c++) {
    const cluster = spec.clusters[c]
    const startIdx = idx
    const clusterAssetIndices: number[] = []

    for (let i = 0; i < cluster.size; i++) {
      const assetIndex = idx
      const filename = `${spec.id}_c${c}_${String(i).padStart(4, '0')}.jpg`
      const fileSize = 1_500_000 + (i * 7919) % 3_000_000 // deterministic size variation
      assets.push({
        filename,
        fileSize,
        format: 'photo',
      })
      clusterAssetIndices.push(assetIndex)
      analysisTemplates.push({
        assetIndex,
        declarationState: 'provenance_pending',
        confidence: 0.6 + (i % 4) * 0.1, // 0.6 / 0.7 / 0.8 / 0.9
        title: `${cluster.name} — frame ${i + 1}`,
        description: `Synthetic asset ${i + 1} in cluster "${cluster.name}".`,
        tags: ['archive', cluster.name.toLowerCase().replace(/\s+/g, '-')],
        geography: ['archive-test'],
        priceSuggestionCents: 12000 + (i % 8) * 1500, // €120 to €225
        privacySuggestion: 'PUBLIC',
        licenceSuggestions: ['editorial'],
      })
      idx++
    }

    storyGroupTemplates.push({
      name: cluster.name,
      kind: 'proposed',
      assetIndices: clusterAssetIndices,
      confidence: 0.85,
      rationale: cluster.rationale,
    })
  }

  return {
    id: spec.id,
    label: spec.label,
    description: `${spec.count} programmatically-generated assets across ${spec.clusters.length} cluster(s) for Archive-mode density testing.`,
    fileCount: spec.count,
    assets,
    storyGroupTemplates,
    analysisTemplates,
  }
}

export const ARCHIVE_150_MIXED: MockScenario = buildArchiveScenario({
  id: 'archive_150_mixed',
  label: 'Archive — 150 files, 3 implied clusters',
  count: 150,
  clusters: [
    { name: 'Lisbon Climate March 2026', size: 60, rationale: 'Visual + temporal proximity (single afternoon)' },
    { name: 'Setúbal Coastal Erosion 2025', size: 50, rationale: 'Same coastline; multiple visits over a month' },
    { name: 'Évora Wildfire Aftermath', size: 40, rationale: 'Single event; overlapping geo metadata' },
  ],
})

export const ARCHIVE_500_SINGLE_SHOOT: MockScenario = buildArchiveScenario({
  id: 'archive_500_single_shoot',
  label: 'Archive — 500 files, 1 large cluster',
  count: 500,
  clusters: [
    {
      name: 'Carnaval do Porto 2026',
      size: 500,
      rationale: 'Single multi-day event; 500 frames captured continuously',
    },
  ],
})

export const ARCHIVE_1500_DECADE: MockScenario = buildArchiveScenario({
  id: 'archive_1500_decade',
  label: 'Archive — 1,500 files, 12 clusters',
  count: 1500,
  clusters: [
    { name: '2016 Refugee Corridor', size: 100, rationale: 'Reportage series, March-May 2016' },
    { name: '2017 Catalonia Referendum', size: 150, rationale: 'Multiple cities; same week' },
    { name: '2018 Algarve Wildfires', size: 100, rationale: 'Summer 2018; geo-clustered' },
    { name: '2019 Portuguese Election', size: 120, rationale: 'Campaign trail; multiple rallies' },
    { name: '2020 Pandemic Lockdown', size: 200, rationale: 'Lisbon empty streets, March-May 2020' },
    { name: '2021 Climate Summit Glasgow', size: 80, rationale: 'COP26 coverage' },
    { name: '2022 Ukraine Border', size: 120, rationale: 'February-April 2022' },
    { name: '2023 Lampedusa Crisis', size: 100, rationale: 'Migrant landing event' },
    { name: '2024 European Elections', size: 150, rationale: 'Multi-country campaign coverage' },
    { name: '2025 Lisbon Floods', size: 130, rationale: 'October 2025 flooding' },
    { name: '2026 Carnaval Lisboa', size: 100, rationale: 'Spring 2026 carnival' },
    { name: 'Misc / Unclustered', size: 150, rationale: 'Long-tail individual assignments' },
  ],
})

// ── Scenario Registry ──

export const SCENARIOS: Record<ScenarioId, MockScenario> = {
  clean_single_story: CLEAN_SINGLE_STORY,
  messy_multi_story: MESSY_MULTI_STORY,
  scale_batch_50_plus: SCALE_BATCH_50_PLUS,
  archive_150_mixed: ARCHIVE_150_MIXED,
  archive_500_single_shoot: ARCHIVE_500_SINGLE_SHOOT,
  archive_1500_decade: ARCHIVE_1500_DECADE,
}

export const SCENARIO_LIST = Object.values(SCENARIOS)
