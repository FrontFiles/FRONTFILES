/**
 * Frontfiles Bulk Upload v2 — Domain Types
 *
 * Single authoritative type system for the 4-step upload flow.
 * Authority: v2 Design Specification, Canonical Specification v1.0, Architecture Document v1.0.
 *
 * Key invariants:
 * - storyGroupId is set ONLY by explicit creator action, never by analysis
 * - Exceptions are computed, not stored
 * - PRIVATE assets may commit without price or licences
 * - Declaration check = provenance only, never truth verification
 */

import type { AssetFormat, LicenceType, PrivacyState, ValidationDeclarationState } from './types'
import type { WatermarkMode } from '@/lib/watermark/types'

// Re-export AssetFormat so consumers can import it alongside the v2-shaped
// types. upload-selectors.ts and other v2-aware modules pull both from here.
export type { AssetFormat } from './types'

// ── Metadata Source Tracking ──

export type MetadataSource = 'embedded' | 'extracted' | 'ai' | 'creator'

// ── Metadata Conflict ──

export interface MetadataConflict {
  field: keyof AssetEditableFields
  embeddedValue: string
  aiValue: string
  aiConfidence: number
  resolvedBy: 'creator' | null
  resolvedValue: string | null
}

// ── Extracted Metadata (raw EXIF/IPTC/XMP) ──

export interface ExtractedMetadata {
  // EXIF
  cameraMake: string | null
  cameraModel: string | null
  iso: number | null
  aperture: string | null
  shutterSpeed: string | null
  focalLength: string | null
  // GPS
  gpsLat: number | null
  gpsLon: number | null
  gpsLocationLabel: string | null
  // IPTC
  iptcHeadline: string | null
  iptcCaption: string | null
  iptcKeywords: string[]
  iptcByline: string | null
  iptcCity: string | null
  iptcCountry: string | null
  iptcDateCreated: string | null
  iptcCopyright: string | null
  iptcCredit: string | null
  iptcSource: string | null
  // XMP
  xmpCreatorTool: string | null
  xmpRights: string | null
  // C2PA
  c2paPresent: boolean
  c2paVersion: string | null
  c2paValid: boolean | null
  c2paSignerIdentity: string | null
  // File-level
  dimensions: { width: number; height: number } | null
  durationSeconds: number | null
  colorSpace: string | null
  codec: string | null
}

// ── Flow Stages ──

export type V2Stage = 'add-files' | 'analysis' | 'review' | 'commit' | 'complete'

export const V2_STAGE_LABELS: Record<V2Stage, string> = {
  'add-files': '1. Add Files',
  'analysis': '2. Analysis',
  'review': '3. Review & Assign',
  'commit': '4. Commit to Vault',
  'complete': 'Complete',
}

export const V2_STAGE_ORDER: V2Stage[] = ['add-files', 'analysis', 'review', 'commit']

// ── Analysis Status ──

export type AnalysisStatus = 'pending' | 'uploading' | 'analysing' | 'complete' | 'failed'

// ── Duplicate Status ──

export type DuplicateStatus = 'none' | 'likely_duplicate' | 'confirmed_duplicate'

// ── Commit Outcome ──

export type CommitOutcome =
  | 'stored_not_transactable'           // PRIVATE, or declaration state prevents transactions
  | 'transactable_via_link'             // RESTRICTED + valid declaration
  | 'ready_for_discovery_and_transaction' // PUBLIC + valid declaration
  | 'excluded'
  | 'blocked'

// ── Price Suggestion ──

export interface V2PriceSuggestion {
  amount: number          // EUR cents
  confidence: number      // 0-1
  basis: string           // e.g. "photo / public / fully validated / editorial"
  factors: V2PriceFactor[]
}

export interface V2PriceFactor {
  label: string
  effect: 'increase' | 'decrease' | 'neutral'
  weight: number
}

// ── Story Candidate (alternative placement) ──

export interface StoryCandidate {
  storyGroupId: string
  score: number           // 0-1
  rationale: string
}

// ── Asset Proposal (system-generated, read-only) ──

export interface AssetProposal {
  title: string
  description: string
  tags: string[]
  geography: string[]
  priceSuggestion: V2PriceSuggestion | null
  privacySuggestion: PrivacyState | null
  licenceSuggestions: LicenceType[]
  confidence: number      // 0-1, overall metadata confidence
  rationale: string
  storyCandidates: StoryCandidate[]
}

// ── Asset Editable Fields (creator-authoritative) ──

export interface AssetEditableFields {
  title: string
  description: string
  tags: string[]
  geography: string[]
  captureDate: string | null
  privacy: PrivacyState | null
  licences: LicenceType[]
  price: number | null    // EUR cents
  /**
   * D2.9 follow-up — creator-controlled flag indicating whether the asset
   * is available for social-platform licensing (Instagram, TikTok, X, etc.).
   * Independent of the `licences` checklist (which carries the contractual
   * use-rights). Defaults to false; toggled in the inspector.
   */
  socialLicensable: boolean
  metadataSource: Partial<Record<keyof Omit<AssetEditableFields, 'metadataSource'>, MetadataSource>>
}

// ── V2 Asset ──

export interface V2Asset {
  id: string
  filename: string
  fileSize: number
  format: AssetFormat | null
  file: File | null
  thumbnailRef: string | null

  // Exclusion
  excluded: boolean

  // Story assignment — ONLY set by explicit creator action
  storyGroupId: string | null

  // System-generated proposal (read-only after analysis)
  proposal: AssetProposal | null

  // Creator-editable fields
  editable: AssetEditableFields

  // Metadata conflicts (embedded vs AI, resolved by creator)
  conflicts: MetadataConflict[]

  // Raw extracted metadata (EXIF/IPTC/XMP/C2PA)
  extractedMetadata: ExtractedMetadata | null

  // Declaration state (provenance only, never truth)
  declarationState: ValidationDeclarationState | null

  // Duplicate detection
  duplicateStatus: DuplicateStatus
  duplicateOfId: string | null

  // Analysis pipeline state
  analysisStatus: AnalysisStatus
  uploadProgress: number  // 0-100

  // Existing story match info
  existingStoryMatch: { storyId: string; storyTitle: string; assetCount: number } | null

  // Timestamps
  createdAt: string
  committedAt: string | null
}

// ── Story Group ──

export type StoryGroupKind = 'proposed' | 'matched-existing' | 'creator'

export interface V2StoryGroup {
  id: string
  name: string
  kind: StoryGroupKind
  proposedAssetIds: string[]  // system-generated, read-only
  existingStoryId: string | null
  existingStoryTitle: string | null
  existingStoryAssetCount: number | null
  rationale: string
  confidence: number         // 0-1
  createdAt: string
  // ── D2.1 additions (per UX-SPEC-V4 §15.3 / D-PLAN §3.2 spec exception) ──
  //
  // These two fields are optional on V2StoryGroup so existing v2-*
  // construction sites compile unchanged. v3-hydration.ts ALWAYS sets
  // them when bridging to V3State, so V3 consumers see them as populated.
  // (V3 components may treat them as required via narrowed type if needed.)
  /** Explicit cover asset; null = no explicit, render falls back to first in sequence. */
  coverAssetId?: string | null
  /** Ordered asset ids = canonical reading order. Defaults to [...proposedAssetIds] at hydration. */
  sequence?: string[]
  /**
   * D2.10 — story-level location (single primary). Maps to per-asset
   * geography via "Apply to all in story" button: each asset's
   * editable.geography becomes [story.location] when bulk-applied.
   * Defaults to ''.
   */
  location?: string
  /**
   * D2.10 — story-level date (ISO date, e.g., '2026-04-15').
   * Maps to per-asset captureDate via "Apply to all in story".
   * Defaults to null.
   */
  date?: string | null
}

// ── Exception Types ──

export type ExceptionType =
  | 'needs_story'
  | 'needs_privacy'
  | 'needs_price'
  | 'needs_licences'
  | 'manifest_invalid'
  | 'unresolved_conflict'
  | 'no_price_private'
  | 'no_licences_private'
  | 'duplicate_unresolved'
  | 'low_confidence'
  | 'provenance_pending'

export type ExceptionSeverity = 'blocking' | 'advisory'

export interface V2Exception {
  type: ExceptionType
  severity: ExceptionSeverity
  label: string
}

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  needs_story: 'Needs Story assignment',
  needs_privacy: 'Needs privacy setting',
  needs_price: 'Needs price',
  needs_licences: 'Needs licence selection',
  manifest_invalid: 'Declaration invalid — cannot publish',
  unresolved_conflict: 'Unresolved metadata conflict',
  no_price_private: 'No price set (private, non-blocking)',
  no_licences_private: 'No licences set (private, non-blocking)',
  duplicate_unresolved: 'Possible duplicate',
  low_confidence: 'Low metadata confidence',
  provenance_pending: 'Provenance pending',
}

// ── Filter ──

export type V2FilterPreset = 'all' | 'blocking' | 'advisory' | 'unassigned' | 'duplicates' | 'excluded' | 'assigned' | 'processing' | 'failed' | 'ready' | 'conflicts' | 'missing-required' | 'private-ready'

export interface V2Filter {
  preset: V2FilterPreset
  storyGroupId: string | null
  format: AssetFormat | null
  privacy: PrivacyState | null
  declaration: ValidationDeclarationState | null
  hasConflicts: boolean | null
}

// ── Batch Defaults ──

export interface V2Defaults {
  privacy: PrivacyState | null
  licences: LicenceType[]
  tags: string[]
  /** Default watermark mode for assets in this batch. null = use context default. */
  watermarkMode: WatermarkMode | null
}

// ── UI State ──

export type DensityMode = 'comfortable' | 'compact'

export type MobileTab = 'stories' | 'assets' | 'detail'

export type TableColumn =
  | 'select' | 'thumbnail' | 'title' | 'format' | 'story' | 'privacy'
  | 'price' | 'declaration' | 'status'
  // Secondary columns
  | 'filename' | 'location' | 'captureDate' | 'tags' | 'licence'
  | 'description' | 'source' | 'confidence' | 'duplicate' | 'size'

export const DEFAULT_COLUMNS: TableColumn[] = [
  'select', 'thumbnail', 'title', 'format', 'story', 'privacy', 'price', 'declaration', 'status',
]

export const SECONDARY_COLUMNS: TableColumn[] = [
  'filename', 'location', 'captureDate', 'tags', 'licence', 'description', 'source', 'confidence', 'duplicate', 'size',
]

export interface V2UIState {
  selectedAssetIds: string[]
  selectedStoryGroupId: string | null
  focusedAssetId: string | null
  filter: V2Filter
  searchQuery: string
  sortField: 'filename' | 'format' | 'story' | 'privacy' | 'price' | 'status' | 'declaration' | 'issues' | 'title' | 'size' | 'captureDate' | 'confidence' | 'location'
  sortDirection: 'asc' | 'desc'
  density: DensityMode
  mobileTab: MobileTab
  visibleColumns: TableColumn[]
  inspectorCollapsed: boolean
  newsroomMode: boolean
  storyProposalsBannerOpen: boolean
  expressEligible: boolean
  expressAccepted: boolean
  reviewEnteredEarly: boolean
}

// ── Root State ──

export interface V2State {
  batch: {
    id: string
    currentStage: V2Stage
    createdAt: string
    committedAt: string | null
    newsroomMode: boolean
  }
  assetsById: Record<string, V2Asset>
  assetOrder: string[]
  storyGroupsById: Record<string, V2StoryGroup>
  storyGroupOrder: string[]
  ui: V2UIState
  defaults: V2Defaults
}

// ── Completion Summary ──

export interface V2CompletionSummary {
  totalCommitted: number
  totalExcluded: number
  totalBlocked: number
  totalListedValue: number  // EUR cents
  stories: {
    id: string
    name: string
    assetCount: number
    listedValue: number
    isNew: boolean
    vaultUrl: string
  }[]
  outcomeBreakdown: {
    stored: number
    transactableViaLink: number
    readyForDiscovery: number
  }
}
