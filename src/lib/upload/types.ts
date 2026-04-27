/**
 * Frontfiles Upload Subsystem — Domain Types
 *
 * Authority: Canonical Specification v1.0 §6, §7, §8
 * These types model the upload-to-publish pipeline for standalone assets.
 * FCS Layer 4 (Editorial Assembly) is out of scope for standalone upload.
 */

// ── Asset Format ──
// Canonical: 7 supported formats (Spec §6.4)

export type AssetFormat =
  | 'photo'
  | 'video'
  | 'audio'
  | 'text'
  | 'illustration'
  | 'infographic'
  | 'vector'

export const ASSET_FORMAT_LABELS: Record<AssetFormat, string> = {
  photo: 'Photo',
  video: 'Video',
  audio: 'Audio',
  text: 'Text',
  illustration: 'Illustration',
  infographic: 'Infographic',
  vector: 'Vector',
}

// ── File Constraints ──
// Canonical size limits per format (Spec §6.4)

export interface FileConstraint {
  format: AssetFormat
  maxSizeBytes: number
  maxSizeLabel: string
  acceptedMimeTypes: string[]
}

export const FILE_CONSTRAINTS: FileConstraint[] = [
  {
    format: 'photo',
    maxSizeBytes: 200 * 1024 * 1024,
    maxSizeLabel: '200 MB',
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/heic', 'image/heif'],
  },
  {
    format: 'video',
    maxSizeBytes: 20 * 1024 * 1024 * 1024,
    maxSizeLabel: '20 GB',
    acceptedMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'],
  },
  {
    format: 'audio',
    maxSizeBytes: 2 * 1024 * 1024 * 1024,
    maxSizeLabel: '2 GB',
    acceptedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg'],
  },
  {
    format: 'text',
    maxSizeBytes: 50 * 1024 * 1024,
    maxSizeLabel: '50 MB',
    acceptedMimeTypes: ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  {
    format: 'illustration',
    maxSizeBytes: 500 * 1024 * 1024,
    maxSizeLabel: '500 MB',
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'application/psd', 'image/vnd.adobe.photoshop'],
  },
  {
    format: 'infographic',
    maxSizeBytes: 500 * 1024 * 1024,
    maxSizeLabel: '500 MB',
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'application/pdf'],
  },
  {
    format: 'vector',
    maxSizeBytes: 100 * 1024 * 1024,
    maxSizeLabel: '100 MB',
    acceptedMimeTypes: ['image/svg+xml', 'application/postscript', 'application/pdf'],
  },
]

// ── Upload Failure Reasons ──

export type UploadFailureReason =
  | 'unsupported_format'
  | 'file_size_exceeded'
  | 'file_corrupt'
  | 'file_empty'
  | 'transfer_failed'
  | 'ai_content_detected'
  | 'analysis_failed'
  | 'unknown'

export const FAILURE_REASON_LABELS: Record<UploadFailureReason, string> = {
  unsupported_format: 'Unsupported file format',
  file_size_exceeded: 'File exceeds size limit',
  file_corrupt: 'File appears corrupt or unreadable',
  file_empty: 'File is empty',
  transfer_failed: 'Transfer failed',
  ai_content_detected: 'AI-generated content detected. AI content is permanently excluded from the Vault.',
  analysis_failed: 'Content analysis failed',
  unknown: 'An unexpected error occurred',
}

// ── Validation Declaration States ──
// Canonical: 7 states (Spec §7.4, §7.5)
// Authority: FCS owns Declaration state, not the UI.

export type ValidationDeclarationState =
  | 'fully_validated'
  | 'provenance_pending'
  | 'manifest_invalid'
  | 'corroborated'
  | 'under_review'
  | 'disputed'
  | 'invalidated'

export const DECLARATION_STATE_LABELS: Record<ValidationDeclarationState, string> = {
  fully_validated: 'Fully Validated',
  provenance_pending: 'Provenance Pending',
  manifest_invalid: 'Manifest Invalid',
  corroborated: 'Corroborated',
  under_review: 'Under Review',
  disputed: 'Disputed',
  invalidated: 'Invalidated',
}

export const TRANSACTABLE_STATES: ValidationDeclarationState[] = [
  'fully_validated',
  'provenance_pending',
  'under_review',
]

export const NON_TRANSACTABLE_STATES: ValidationDeclarationState[] = [
  'manifest_invalid',
  'corroborated',
  'disputed',
  'invalidated',
]

// ── Manifest Review State ──

export type ManifestReviewState =
  | 'not_applicable'
  | 'quarantined'
  | 'under_staff_review'
  | 'cleared'
  | 'invalidated'

// ── Privacy State ──
// Canonical (Spec §6.5)

export type PrivacyState = 'PUBLIC' | 'PRIVATE' | 'RESTRICTED'

export const PRIVACY_STATE_DESCRIPTIONS: Record<PrivacyState, string> = {
  PUBLIC: 'Discoverable in FrontSearch and potentially transactable if the Declaration check permits.',
  PRIVATE: 'Visible to you only. Not discoverable. Not transactable.',
  RESTRICTED: 'Hidden from FrontSearch. Transactable via authorised link only.',
}

// ── Upload Job State ──
// Per-file workflow state

export type UploadJobState =
  | 'selecting'       // file selected, pre-validation
  | 'validating'      // checking format, size, type
  | 'rejected'        // failed pre-validation
  | 'ingesting'       // uploading bytes
  | 'uploaded'        // bytes received, awaiting analysis
  | 'analysing'       // FCS L1-L2 in progress
  | 'flagged'         // analysis flagged, creator review required
  | 'manifest_invalid'// C2PA manifest corrupt/unverifiable, quarantined
  | 'ready_for_completion'     // analysis done, metadata proposals ready
  | 'awaiting_creator_confirmation' // creator reviewing metadata
  | 'awaiting_story_assignment'     // metadata confirmed, needs Story
  | 'awaiting_rights_configuration' // Story assigned, needs privacy/price
  | 'readiness_blocked'             // missing required fields
  | 'ready_for_publish'             // all requirements met
  | 'publishing'                    // committing to Vault
  | 'published'                     // live in Vault
  | 'failed'                        // terminal failure

// ── Proposal Field ──
// AI-proposed metadata that requires creator confirmation

export interface ProposalField<T = string> {
  value: T
  source: 'ai' | 'extracted' | 'creator'
  confidence: number | null // 0-1, null if creator-provided
  confirmed: boolean
}

// ── Metadata Proposal ──

export interface MetadataProposal {
  title: ProposalField
  description: ProposalField
  tags: ProposalField<string[]>
  geographicTags: ProposalField<string[]>
  suggestedStoryId: string | null
  suggestedStoryTitle: string | null
}

// ── Analysis Result ──
// Output from FCS L1-L2 processing

export interface AnalysisResult {
  contentReadingComplete: boolean
  metadataExtractionComplete: boolean
  c2paDetected: boolean
  c2paVersion: string | null         // e.g. "2.2", "2.0", null
  c2paValid: boolean | null          // null if not detected
  manifestInvalid: boolean
  conflictZoneAlert: boolean
  extractedMetadata: ExtractedMetadata
  layerOneComplete: boolean
  layerTwoComplete: boolean
  declarationState: ValidationDeclarationState | null // set after L3
}

export interface ExtractedMetadata {
  exifData: Record<string, string> | null
  gpsCoordinates: { lat: number; lng: number } | null
  timestamp: string | null
  cameraModel: string | null
  detectedObjects: string[]
  detectedScenes: string[]
  detectedLocation: string | null
}

// ── Story Reference ──

export interface StoryRef {
  id: string
  title: string
  assetCount: number
  isNew: boolean
}

// ── Price Input ──

export interface PriceInput {
  amount: number | null    // creator-set price in EUR cents
  currency: 'EUR'
  priceBandGuidance: string | null // e.g. "€50–€200" advisory only
}

// ── Licence Selection ──
// Creator enables/disables per asset (Spec §10.3)

export type LicenceType =
  | 'editorial'
  | 'commercial'
  | 'broadcast'
  | 'print'
  | 'digital'
  | 'web'
  | 'merchandise'
  | 'creative_commons'

export const LICENCE_TYPE_LABELS: Record<LicenceType, string> = {
  editorial: 'Editorial',
  commercial: 'Commercial',
  broadcast: 'Broadcast',
  print: 'Print',
  digital: 'Digital',
  web: 'Web',
  merchandise: 'Merchandise',
  creative_commons: 'Creative Commons',
}

// ── Upload Job ──
// Represents a single file progressing through the upload pipeline

export interface UploadJob {
  id: string
  file: File
  fileName: string
  fileSize: number
  format: AssetFormat | null
  state: UploadJobState
  failureReason: UploadFailureReason | null
  uploadProgress: number  // 0-100
  analysisResult: AnalysisResult | null
  metadataProposal: MetadataProposal | null
  confirmedMetadata: {
    title: string
    description: string
    tags: string[]
    geographicTags: string[]
  } | null
  storyAssignment: StoryRef | null
  privacy: PrivacyState | null
  pricing: PriceInput | null
  enabledLicences: LicenceType[]
  declarationState: ValidationDeclarationState | null
  manifestReviewState: ManifestReviewState
  createdAt: string
  publishedAt: string | null
}

// ── Upload Session ──
// Groups multiple upload jobs in a single batch

export interface UploadSession {
  id: string
  jobs: UploadJob[]
  createdAt: string
  activeJobId: string | null  // currently viewed/editing job
}

// ── Publish Readiness ──

export interface PublishReadinessCheck {
  metadataComplete: boolean
  storyAssigned: boolean
  privacySelected: boolean
  pricingSet: boolean
  declarationTransactable: boolean
  noManifestInvalid: boolean
  allRequirementsMet: boolean
  blockers: string[]
}

// ── Upload Events ──
// Compatible with CEL-oriented event model

export type UploadEventType =
  | 'upload_started'
  | 'upload_progressed'
  | 'file_rejected'
  | 'upload_completed'
  | 'analysis_started'
  | 'analysis_completed'
  | 'metadata_extracted'
  | 'c2pa_detected'
  | 'c2pa_missing'
  | 'manifest_invalid_detected'
  | 'creator_review_required'
  | 'metadata_proposal_generated'
  | 'creator_confirmed_metadata'
  | 'story_created'
  | 'story_assigned'
  | 'privacy_selected'
  | 'pricing_updated'
  | 'publish_attempted'
  | 'publish_blocked'
  | 'publish_completed'

export interface UploadEvent {
  id: string
  type: UploadEventType
  jobId: string
  sessionId: string
  timestamp: string
  detail: string
  metadata: Record<string, unknown> | null
}
