/**
 * Frontfiles Upload — Batch-Native Types
 *
 * Replaces the serial UploadJob/UploadSession model.
 * The batch is the primary object. Assets flow through
 * a simplified state machine oriented around commit-readiness.
 */

import type {
  AssetFormat,
  UploadFailureReason,
  ValidationDeclarationState,
  PrivacyState,
  LicenceType,
  MetadataProposal,
  AnalysisResult,
  StoryRef,
} from './types'
import type { WatermarkMode } from '@/lib/watermark/types'

// ── Asset State (batch context) ──

export type BatchAssetState =
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'warning'
  | 'blocked'
  | 'committed'
  | 'failed'

export const BATCH_STATE_LABELS: Record<BatchAssetState, string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Ready',
  warning: 'Attention',
  blocked: 'Blocked',
  committed: 'Committed',
  failed: 'Failed',
}

// ── Attention Reasons ──

export type AttentionReason =
  | 'needs_story'
  | 'needs_rights'
  | 'needs_privacy'
  | 'needs_price'
  | 'needs_licences'
  | 'price_unavailable'
  | 'low_confidence'
  | 'provenance_pending'
  | 'duplicate'
  | 'unsupported_file'
  | 'manifest_invalid'
  | 'needs_metadata'

export type AttentionSeverity = 'blocking' | 'warning' | 'info'

export const ATTENTION_REASON_LABELS: Record<AttentionReason, string> = {
  needs_story: 'Needs story assignment',
  needs_rights: 'Needs rights configuration',
  needs_privacy: 'Needs privacy setting',
  needs_price: 'Needs price',
  needs_licences: 'Needs licence selection',
  price_unavailable: 'Price recommendation unavailable',
  low_confidence: 'Low metadata confidence',
  provenance_pending: 'Provenance pending',
  duplicate: 'Possible duplicate',
  unsupported_file: 'Unsupported file type',
  manifest_invalid: 'Manifest invalid, quarantined',
  needs_metadata: 'Needs metadata review',
}

export const ATTENTION_SEVERITY: Record<AttentionReason, AttentionSeverity> = {
  needs_story: 'blocking',
  needs_rights: 'blocking',
  needs_privacy: 'blocking',
  needs_price: 'blocking',
  needs_licences: 'blocking',
  price_unavailable: 'warning',
  low_confidence: 'warning',
  provenance_pending: 'info',
  duplicate: 'warning',
  unsupported_file: 'blocking',
  manifest_invalid: 'blocking',
  needs_metadata: 'blocking',
}

// ── Price Recommendation ──

export interface PriceRecommendation {
  amount: number // EUR cents
  confidence: number // 0-1
  basis: string // human-readable explanation, e.g. "photo / public / fully_validated / editorial+broadcast"
  factors: PriceFactor[]
}

export interface PriceFactor {
  label: string
  effect: 'increase' | 'decrease' | 'neutral'
  weight: number // relative importance
}

// ── Batch Asset ──

export interface BatchAsset {
  id: string
  file: File | null // null for mock data
  fileName: string
  fileSize: number
  format: AssetFormat | null
  thumbnailUrl: string | null

  // State
  state: BatchAssetState
  attentionReason: AttentionReason | null
  failureReason: UploadFailureReason | null
  uploadProgress: number // 0-100
  heldFromCommit: boolean

  // Processing results
  analysisResult: AnalysisResult | null
  metadataProposal: MetadataProposal | null
  declarationState: ValidationDeclarationState | null

  // Creator-editable fields
  title: string
  description: string
  tags: string[]
  geographicTags: string[]
  storyAssignment: StoryRef | null
  privacy: PrivacyState | null
  priceAmount: number | null // EUR cents
  enabledLicences: LicenceType[]

  // Recommendation
  priceRecommendation: PriceRecommendation | null

  // Watermark
  /** Per-asset watermark mode override. null = inherit from batch defaults / context. */
  watermarkMode: WatermarkMode | null

  // Timestamps
  createdAt: string
  committedAt: string | null
}

// ── Batch Defaults (applied at intake) ──

export interface BatchDefaults {
  storyAssignment: StoryRef | null
  privacy: PrivacyState | null
  enabledLicences: LicenceType[]
  tags: string[]
  applyRecommendedPrice: boolean
  /** Default watermark mode for assets in this batch. null = use context default. */
  watermarkMode: WatermarkMode | null
}

// ── Batch Session ──

export interface BatchSession {
  id: string
  assets: BatchAsset[]
  defaults: BatchDefaults
  screen: BatchScreen
  selectedAssetIds: string[]
  filterState: BatchFilterState
  viewMode: 'grid' | 'table'
  drawerOpen: boolean
  createdAt: string
}

export type BatchScreen =
  | 'intake'
  | 'processing'
  | 'review'
  | 'exceptions'
  | 'commit'

export interface BatchFilterState {
  state: BatchAssetState | 'all'
  format: AssetFormat | 'all'
  story: string | 'all' | 'unassigned'
  privacy: PrivacyState | 'all' | 'unset'
  attention: AttentionReason | 'all'
}

// ── Bulk Action Types ──

export type BulkActionType =
  | 'assign_story'
  | 'set_privacy'
  | 'apply_licences'
  | 'apply_recommended_price'
  | 'set_manual_price'
  | 'add_tags'
  | 'retry_analysis'
  | 'remove_from_batch'
  | 'hold_from_commit'
  | 'release_to_commit'

export type BulkApplyMode =
  | 'selected'
  | 'fill_blanks'
  | 'overwrite'

// ── Batch Summary Counters ──

export interface BatchCounters {
  total: number
  uploading: number
  processing: number
  ready: number
  warning: number
  blocked: number
  committed: number
  failed: number
}

// ── Commit Summary ──

export interface CommitSummary {
  readyAssets: BatchAsset[]
  heldAssets: BatchAsset[]
  blockedAssets: BatchAsset[]
  totalPrice: number // EUR cents sum of ready assets
  licenceSummary: Record<LicenceType, number>
  privacySummary: Record<PrivacyState, number>
  formatSummary: Record<string, number>
  storySummary: { title: string; count: number }[]
}
