/**
 * Frontfiles Platform — Canonical Domain Types
 *
 * Authority: Canonical Specification v1.1
 * Architecture: Architecture Document v1.1
 *
 * All state machines defined here are deterministic.
 * Upload-specific types live in lib/upload/types.ts and re-export shared enums.
 */

// ══════════════════════════════════════════════
// ASSET FORMAT — Canonical 7 (Spec §6.4)
// ══════════════════════════════════════════════

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

// ══════════════════════════════════════════════
// PRIVACY STATE (Spec §6.5)
// ══════════════════════════════════════════════

export type PrivacyState = 'PUBLIC' | 'PRIVATE' | 'RESTRICTED'

export const PRIVACY_STATE_LABELS: Record<PrivacyState, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  RESTRICTED: 'Restricted',
}

// ══════════════════════════════════════════════
// VALIDATION DECLARATION STATE (Spec §7.4, §7.5)
// Authority: FCS owns Declaration state
// ══════════════════════════════════════════════

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

export const TRANSACTABLE_DECLARATION_STATES: ValidationDeclarationState[] = [
  'fully_validated',
  'provenance_pending',
  'corroborated',
  'under_review',
]

export const NON_TRANSACTABLE_DECLARATION_STATES: ValidationDeclarationState[] = [
  'manifest_invalid',
  'disputed',
  'invalidated',
]

// ══════════════════════════════════════════════
// DIRECT OFFER STATE (Spec §10.4)
// Turn-aware statuses for server-authoritative negotiation
// ══════════════════════════════════════════════

export type DirectOfferStatus =
  | 'buyer_offer_pending_creator'
  | 'creator_counter_pending_buyer'
  | 'buyer_counter_pending_creator'
  | 'accepted_pending_checkout'
  | 'declined'
  | 'expired'
  | 'auto_cancelled'
  | 'completed'

export const DIRECT_OFFER_STATUS_LABELS: Record<DirectOfferStatus, string> = {
  buyer_offer_pending_creator: 'Awaiting Creator',
  creator_counter_pending_buyer: 'Counter-offer',
  buyer_counter_pending_creator: 'Awaiting Creator',
  accepted_pending_checkout: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  auto_cancelled: 'Cancelled',
  completed: 'Completed',
}

export const TERMINAL_OFFER_STATUSES: DirectOfferStatus[] = [
  'declined', 'expired', 'auto_cancelled', 'completed',
]

// ══════════════════════════════════════════════
// ASSIGNMENT STATE (Spec §10.7–10.9, Assignment Engine Architecture v1.1)
// ══════════════════════════════════════════════

export type AssignmentClass = 'material' | 'service' | 'hybrid'

export const ASSIGNMENT_CLASS_LABELS: Record<AssignmentClass, string> = {
  material: 'Material',
  service: 'Service',
  hybrid: 'Hybrid',
}

export type AssignmentState =
  | 'brief_issued'
  | 'escrow_captured'
  | 'in_progress'
  | 'delivered'
  | 'confirmed'
  | 'disputed'
  | 'cancelled'

export const ASSIGNMENT_STATE_LABELS: Record<AssignmentState, string> = {
  brief_issued: 'Brief Issued',
  escrow_captured: 'Escrow Confirmed',
  in_progress: 'In Progress',
  delivered: 'Fulfilment Submitted',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
}

// §8.2 — Internal operational sub-states
export type AssignmentSubState =
  | 'draft'
  | 'clarification_open'
  | 'accepted_pending_escrow'
  | 'active'
  | 'milestone_due'
  | 'fulfilment_submitted'
  | 'fulfilment_processing'
  | 'review_open'
  | 'changes_requested'
  | 'ccr_pending'
  | 'provisional_release_eligible'
  | 'provisional_release_executed'
  | 'settlement_queued'
  | 'closed'

export const ASSIGNMENT_SUB_STATE_LABELS: Record<AssignmentSubState, string> = {
  draft: 'Draft',
  clarification_open: 'Clarification Open',
  accepted_pending_escrow: 'Accepted — Pending Escrow',
  active: 'Active',
  milestone_due: 'Milestone Due',
  fulfilment_submitted: 'Fulfilment Submitted',
  fulfilment_processing: 'Fulfilment Processing',
  review_open: 'Review Open',
  changes_requested: 'Changes Requested',
  ccr_pending: 'CCR Pending',
  provisional_release_eligible: 'Provisional Release Eligible',
  provisional_release_executed: 'Provisional Release Executed',
  settlement_queued: 'Settlement Queued',
  closed: 'Closed',
}

// §5 — Milestone types (class-aligned)
export type MilestoneType = 'material' | 'service' | 'hybrid'

export type MilestoneState =
  | 'pending'
  | 'active'
  | 'fulfilment_submitted'
  | 'review_open'
  | 'changes_requested'
  | 'accepted'
  | 'accepted_partial'
  | 'rejected'
  | 'disputed'
  | 'cancelled'

export const MILESTONE_STATE_LABELS: Record<MilestoneState, string> = {
  pending: 'Pending',
  active: 'Active',
  fulfilment_submitted: 'Fulfilment Submitted',
  review_open: 'Under Review',
  changes_requested: 'Changes Requested',
  accepted: 'Accepted',
  accepted_partial: 'Partially Accepted',
  rejected: 'Rejected',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
}

// §6 — Fulfilment submission types
export type FulfilmentType = 'asset' | 'service' | 'hybrid'

// §6.2 — Evidence item families
export type EvidenceItemKind =
  | 'vault_asset'
  | 'service_log'
  | 'time_location_record'
  | 'handoff_note'
  | 'attendance_confirmation'
  | 'support_document'
  | 'buyer_acknowledgement'
  | 'other'

// §10.1 — Review determinations
export type ReviewDetermination =
  | 'accepted'
  | 'accepted_partial'
  | 'changes_requested'
  | 'rejected'
  | 'dispute_opened'

export const REVIEW_DETERMINATION_LABELS: Record<ReviewDetermination, string> = {
  accepted: 'Accepted',
  accepted_partial: 'Accepted with Partial Release',
  changes_requested: 'Changes Requested',
  rejected: 'Rejected',
  dispute_opened: 'Dispute Opened',
}

// §11 — CCR state
export type CCRState = 'pending' | 'approved' | 'denied' | 'auto_denied' | 'withdrawn'

export const CCR_STATE_LABELS: Record<CCRState, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  auto_denied: 'Auto-denied (5-day window expired)',
  withdrawn: 'Withdrawn',
}

// §13.1 — Assignment dispute triggers
export type AssignmentDisputeTrigger =
  | 'creator_non_performance'
  | 'deadline_miss'
  | 'asset_failure_against_brief'
  | 'buyer_refusal_without_grounds'
  | 'service_non_compliance'
  | 'hybrid_partial_compliance'
  | 'rights_scope_disagreement'
  | 'non_response_after_fulfilment'

// ══════════════════════════════════════════════
// DISPUTE STATE (Spec §13)
// ══════════════════════════════════════════════

export type DisputeState =
  | 'filed'
  | 'under_review'
  | 'upheld'
  | 'not_upheld'
  | 'escalated_external'

export const DISPUTE_STATE_LABELS: Record<DisputeState, string> = {
  filed: 'Dispute Filed',
  under_review: 'Under Review',
  upheld: 'Dispute Upheld',
  not_upheld: 'Dispute Not Upheld',
  escalated_external: 'Escalated to External Adjudication',
}

export type DisputeType = 'catalogue' | 'commissioned' | 'article'

// ══════════════════════════════════════════════
// PAYOUT STATE (Spec §8.8, §10.3)
// ══════════════════════════════════════════════

export type PayoutState =
  | 'queued'
  | 'processing'
  | 'settled'
  | 'failed'

export const PAYOUT_STATE_LABELS: Record<PayoutState, string> = {
  queued: 'Settlement Queued',
  processing: 'Processing',
  settled: 'Settled',
  failed: 'Settlement Failed',
}

// ══════════════════════════════════════════════
// ARTICLE STATE (Spec §11)
// ══════════════════════════════════════════════

export type ArticleType = 'creator_article' | 'frontfiles_article'

export type ArticlePublishState =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'publishing_hold'
  | 'removed'

// ══════════════════════════════════════════════
// PLUGIN STATE (Spec §14.5)
// ══════════════════════════════════════════════

export type PluginTier = 'micro' | 'premium' | 'enterprise'

export type PluginSubscriptionState = 'active' | 'suspended' | 'cancelled'

// ══════════════════════════════════════════════
// TRUST BADGE (Spec §7.9–7.11)
// ══════════════════════════════════════════════

export type TrustBadge = 'verified' | 'trusted'
// Tier 2 'verified_protected_source' — deferred/partner-gated

export type TrustTier = 'standard' | 'protected_source'

export type VerificationStatus = 'verified' | 'pending_reverification' | 'expired'

// ══════════════════════════════════════════════
// ACCOUNT TYPES & ROLES (Spec §5)
// ══════════════════════════════════════════════

export type AccountType = 'creator' | 'buyer_individual' | 'buyer_company' | 'reader' | 'staff'

export type BuyerCompanyRole = 'admin' | 'content_commit_holder' | 'editor'

export type AccountState = 'active' | 'suspended' | 'deleted'

/** User-facing session type — collapses buyer variants, excludes staff. */
export type UserType = 'creator' | 'buyer' | 'reader'

/**
 * Display labels for `UserType`. Phase C moved this map next to
 * the `UserType` definition so downstream consumers
 * (DiscoveryNav, CreatorGate, account pages, onboarding, etc.)
 * don't have to import from `user-context` just to render a
 * human-readable role name.
 */
export const USER_TYPE_LABELS: Record<UserType, string> = {
  creator: 'Creator',
  buyer: 'Buyer',
  reader: 'Reader',
}

export type ViewerRole = 'anonymous' | 'reader' | 'buyer' | 'owner' | 'staff'

// ══════════════════════════════════════════════
// LICENCE TYPES (Spec §10.1)
// ══════════════════════════════════════════════

export type LicenceType =
  | 'editorial'
  | 'commercial'
  | 'broadcast'
  | 'print'
  | 'digital'
  | 'web'
  | 'merchandise'

export const LICENCE_TYPE_LABELS: Record<LicenceType, string> = {
  editorial: 'Editorial',
  commercial: 'Commercial',
  broadcast: 'Broadcast',
  print: 'Print',
  digital: 'Digital',
  web: 'Web',
  merchandise: 'Merchandise',
}

// ══════════════════════════════════════════════
// EXCLUSIVE LICENCE TIERS (Spec §10.5)
// ══════════════════════════════════════════════

export type ExclusiveTier = '30_day' | '1_year' | 'perpetual'

export const EXCLUSIVE_TIER_LABELS: Record<ExclusiveTier, string> = {
  '30_day': '30-Day Exclusive',
  '1_year': '1-Year Exclusive',
  perpetual: 'Perpetual Exclusive',
}

export const EXCLUSIVE_MULTIPLIERS: Record<ExclusiveTier, number> = {
  '30_day': 3,
  '1_year': 5,
  perpetual: 10,
}

// ══════════════════════════════════════════════
// CHECKOUT (Spec §9.6)
// ══════════════════════════════════════════════

export type CheckoutStep =
  | 'licence_selection'
  | 'declaration_review'
  | 'confirm_before_signing'
  | 'price_confirmation'
  | 'payment_capture'

export const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  licence_selection: 'Licence Selection',
  declaration_review: 'Declaration Review',
  confirm_before_signing: 'Confirm Before Signing',
  price_confirmation: 'Price Confirmation',
  payment_capture: 'Payment Capture',
}

// ══════════════════════════════════════════════
// TRANSACTION ECONOMICS (Spec §4.2, §4.3)
// ══════════════════════════════════════════════

export type TransactionChannel = 'direct' | 'plugin'

export const PLATFORM_FEES = {
  direct: { creatorFee: 0.20, buyerMarkup: 0.20 },
  plugin: { creatorFee: 0.10, buyerMarkup: 0.10 },
  commissioned: { buyerMarkup: 0.10 },
  bulk: { buyerMarkup: 0 },
} as const

// ══════════════════════════════════════════════
// USERNAME (Spec §5.1)
// ══════════════════════════════════════════════
//
// Every user has exactly one username. It is globally unique, immutable after
// a 30-day grace period, and serves as the root-level public URL:
//
//   https://frontfiles.com/{username}
//
// Rules:
//   - 3–30 characters
//   - Lowercase alphanumeric + hyphens only (no leading/trailing hyphen)
//   - Must not match any platform route or reserved word
//   - One username per account; one account per username
//   - Separate from Vault ID (vault-XXXXXXXX), which is an internal identifier
//
// The username is the human-readable identity. The Vault ID is the system identifier.
// Both are permanent. Neither replaces the other.

/** Regex: 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/

/** Platform routes and terms that cannot be claimed as usernames */
export const RESERVED_USERNAMES = [
  // Platform routes
  'onboarding', 'signin', 'signup', 'login', 'logout',
  'vault', 'search', 'asset', 'story', 'article',
  'lightbox', 'checkout', 'account', 'plugin', 'staff',
  'creator', 'api', 'admin', 'settings', 'help', 'support',
  'about', 'terms', 'privacy', 'legal', 'pricing',
  // Reserved terms
  'frontfiles', 'frontfolio', 'system', 'null', 'undefined',
  'root', 'mod', 'moderator', 'official', 'verified',
  'assignments', 'disputes', 'settlements', 'offers',
  'composer', 'upload', 'browse', 'discover', 'explore',
] as const

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username) && !RESERVED_USERNAMES.includes(username as typeof RESERVED_USERNAMES[number])
}

// ══════════════════════════════════════════════
// CREATOR PROFILE (Spec §5, §8.5, §8.6)
// ══════════════════════════════════════════════

export interface CreatorProfile {
  /** Unique, root-level public identifier. URL: frontfiles.com/{username} */
  username: string
  displayName: string
  professionalTitle: string
  locationBase: string
  websiteUrl: string | null
  biography: string
  avatarUrl: string | null
  trustTier: TrustTier
  trustBadge: TrustBadge
  verificationStatus: VerificationStatus
  lastVerifiedAt: string
  foundingMember: boolean
  coverageAreas: string[]
  specialisations: string[]
  mediaAffiliations: string[]
  pressAccreditations: string[]
  publishedIn: string[]
  skills: string[]
  alsoMeLinks: string[]
  stats: CreatorStats
  licensing: LicensingInfo
}

export interface CreatorStats {
  totalAssets: number
  totalStories: number
  totalArticles: number
  totalCollections: number
}

export interface LicensingInfo {
  available: boolean
  licenceTypes: LicenceType[]
  priceBandLabel: string | null
}

// ══════════════════════════════════════════════
// VAULT ASSET (Spec §6)
// ══════════════════════════════════════════════

export type PublicationState = 'PUBLISHED' | 'DRAFT' | 'UNPUBLISHED'

export interface VaultAsset {
  id: string
  title: string
  description: string
  format: AssetFormat
  thumbnailUrl: string | null
  videoUrl?: string | null
  audioUrl?: string | null
  illustrationUrl?: string | null
  textUrl?: string | null
  textExcerpt?: string | null
  privacy: PrivacyState
  declarationState: ValidationDeclarationState | null
  publication: PublicationState
  uploadedAt: string
  certifiedAt: string | null
  certificationHash: string | null
  fileSize: string
  storyId: string | null
  creatorPrice: number | null // EUR cents
  enabledLicences: LicenceType[]
  exclusiveLock: ExclusiveLockInfo | null
}

export interface ExclusiveLockInfo {
  tier: ExclusiveTier
  buyerId: string
  activatedAt: string
  expiresAt: string | null // null for perpetual
}

// ══════════════════════════════════════════════
// STORY (Spec §6)
// ══════════════════════════════════════════════

export interface Story {
  id: string
  title: string
  subtitle: string
  excerpt: string
  privacy: PrivacyState
  publication: PublicationState
  publishedAt: string | null
  contentMix: ContentMix
  assetCount: number
  coverImageUrl: string | null
}

export interface ContentMix {
  photo: number
  video: number
  audio: number
  text: number
  illustration: number
  infographic: number
  vector: number
}

// ══════════════════════════════════════════════
// ARTICLE (Spec §11)
// ══════════════════════════════════════════════

export interface Article {
  id: string
  title: string
  excerpt: string
  articleType: ArticleType
  wordCount: number
  publishState: ArticlePublishState
  publishedAt: string | null
  assemblyVerified: boolean // FCS Layer 4
  sourceAssetCount: number
  certificationHash: string | null
  editorHandle: string | null // for Frontfiles Articles
  coverImageUrl: string | null
}

// ══════════════════════════════════════════════
// COLLECTION (Spec §6)
// ══════════════════════════════════════════════

export interface Collection {
  id: string
  title: string
  itemCount: number
  privacy: PrivacyState
  thumbnails: string[]
}

// ══════════════════════════════════════════════
// CERTIFICATION EVENT LOG (Architecture §6)
// ══════════════════════════════════════════════

export type CertificationEventType =
  | 'upload'
  | 'fcs_layer_complete'
  | 'declaration_change'
  | 'badge_change'
  | 'transaction'
  | 'publication'
  | 'privacy_change'
  | 'dispute_filed'
  | 'dispute_resolved'
  | 'reverification'
  // Assignment Engine events (Architecture v1.1 §4)
  | 'assignment_created'
  | 'assignment_accepted'
  | 'escrow_captured'
  | 'escrow_released'
  | 'milestone_activated'
  | 'milestone_accepted'
  | 'fulfilment_submitted'
  | 'review_recorded'
  | 'ccr_submitted'
  | 'ccr_resolved'
  | 'assignment_disputed'
  | 'dispute_determination'
  | 'provisional_release'
  | 'assignment_cancelled'
  | 'settlement_queued'
  | 'review_window_opened'

export interface CertificationEvent {
  id: string
  type: CertificationEventType
  description: string
  timestamp: string
  metadata: Record<string, unknown> | null
}

// ══════════════════════════════════════════════
// DIRECT OFFER THREAD (Spec §10.4)
// Server-authoritative negotiation for PUBLIC assets
// ══════════════════════════════════════════════

export const DIRECT_OFFER_MAX_ROUNDS = 3
export const DIRECT_OFFER_DEFAULT_RESPONSE_MINUTES = 240 // 4 hours
export const DIRECT_OFFER_MIN_RESPONSE_MINUTES = 30
export const DIRECT_OFFER_MAX_RESPONSE_MINUTES = 1440 // 24 hours

export interface DirectOfferThread {
  id: string
  assetId: string
  buyerId: string
  creatorId: string
  licenceType: LicenceType
  listedPriceAtOpen: number // EUR cents — snapshot at thread creation
  currentOfferAmount: number // EUR cents — latest live offer
  currentOfferBy: 'buyer' | 'creator'
  roundCount: number // 1-based, max DIRECT_OFFER_MAX_ROUNDS (starts at 1 on initial offer)
  creatorResponseWindowMinutes: number
  expiresAt: string // ISO — current offer expiry
  status: DirectOfferStatus
  acceptedAmount: number | null // EUR cents — locked on acceptance
  checkoutIntentId: string | null // links to checkout flow
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  autoCancelReason: DirectOfferAutoCancelReason | null
}

export type DirectOfferAutoCancelReason =
  | 'privacy_changed'
  | 'declaration_non_transactable'
  | 'exclusive_activated'
  | 'asset_delisted'

export type DirectOfferEventType =
  | 'buyer_offer'
  | 'creator_counter'
  | 'buyer_counter'
  | 'creator_accept'
  | 'buyer_accept'
  | 'creator_decline'
  | 'expired'
  | 'auto_cancelled'
  | 'checkout_started'
  | 'completed'

export interface DirectOfferEvent {
  id: string
  threadId: string
  type: DirectOfferEventType
  actorId: string
  amount: number | null // EUR cents — null for non-price events
  message: string | null // negotiation note — licensing context, rationale, usage
  metadata: Record<string, unknown> | null
  createdAt: string
}

// ══════════════════════════════════════════════
// ASSIGNMENT ENGINE — Full Domain Objects
// (Assignment Engine Architecture v1.1 §4)
// ══════════════════════════════════════════════

/**
 * Master commissioned work contract between Buyer and Creator/Contributor.
 * System of record: Assignment Engine.
 */
export interface Assignment {
  id: string
  buyerId: string
  creatorId: string
  assignmentClass: AssignmentClass
  state: AssignmentState
  subState: AssignmentSubState
  plan: AssignmentPlan
  milestones: Milestone[]
  rightsRecord: AssignmentRightsRecord
  escrow: EscrowRecord
  ccrHistory: CommissionChangeRequest[]
  createdAt: string
  acceptedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
}

/**
 * Structured operating plan defining class, milestones, deadlines, acceptance
 * basis, and release logic. (Architecture §4)
 */
export interface AssignmentPlan {
  scope: string
  deadline: string
  acceptanceCriteria: string
  requiredEvidenceTypes: EvidenceItemKind[]
  reviewWindowDays: number
  notes: string | null
}

/**
 * Contractual checkpoint — smallest unit carrying scope, evidence, review,
 * release, refund, or dispute logic. (Architecture §5)
 */
export interface Milestone {
  id: string
  assignmentId: string
  ordinal: number
  title: string
  scopeSummary: string
  milestoneType: MilestoneType
  state: MilestoneState
  dueDate: string
  acceptanceCriteria: string
  requiredEvidenceTypes: EvidenceItemKind[]
  releasableAmountCents: number
  partialAcceptancePermitted: boolean
  reviewWindowDays: number
  fulfilmentSubmissions: FulfilmentSubmission[]
  reviewDetermination: ReviewRecord | null
  createdAt: string
  completedAt: string | null
}

/**
 * Structured submission package against a Milestone. (Architecture §6)
 */
export interface FulfilmentSubmission {
  id: string
  milestoneId: string
  fulfilmentType: FulfilmentType
  evidenceItems: EvidenceItem[]
  creatorNotes: string | null
  submittedAt: string
}

/**
 * Single proof object inside a Fulfilment Submission. (Architecture §6.2)
 */
export interface EvidenceItem {
  id: string
  kind: EvidenceItemKind
  label: string
  description: string | null
  // For vault_asset kind
  vaultAssetId: string | null
  // For document-based kinds
  fileRef: string | null
  fileName: string | null
  fileSizeBytes: number | null
  // For service_log kind
  serviceLog: ServiceLog | null
  createdAt: string
}

/**
 * Structured record of service work performed. (Architecture §4)
 */
export interface ServiceLog {
  date: string
  startTime: string | null
  endTime: string | null
  location: string | null
  role: string
  completedDuties: string
}

/**
 * Rights, permissions, restrictions, and term logic. (Architecture §7)
 * Separate sections for service terms and asset-rights terms in Hybrid.
 */
export interface AssignmentRightsRecord {
  // Asset rights (Material + Hybrid)
  assetRights: {
    usageRights: string
    exclusivityTerms: string | null
    permittedModifications: string | null
    duration: string | null
    territory: string | null
    publicationScope: string | null
  } | null
  // Service terms (Service + Hybrid)
  serviceTerms: {
    scopeOfWork: string
    confidentiality: string | null
    attendanceObligations: string | null
    operationalRestrictions: string | null
    reimbursementTerms: string | null
    liabilityFraming: string | null
  } | null
}

/**
 * Platform mirror of Stripe escrow state. (Architecture §9)
 * Stripe Connect is authoritative; this is the Assignment Engine mirror.
 */
export interface EscrowRecord {
  stripePaymentIntentId: string | null
  totalCapturedCents: number
  totalReleasedCents: number
  totalRefundedCents: number
  totalFrozenCents: number
  capturedAt: string | null
  // Per-milestone breakdown is derived from milestones[].releasableAmountCents
}

/**
 * Formal request to amend scope, price, timing, etc. (Architecture §11)
 * 5 business day response window. Auto-denied on expiry.
 */
export interface CommissionChangeRequest {
  id: string
  assignmentId: string
  requesterId: string // creator or buyer
  state: CCRState
  amendedFields: CCRAmendedField[]
  rationale: string
  responseDeadline: string // 5 business days from submission
  respondedAt: string | null
  responseNote: string | null
  createdAt: string
}

export interface CCRAmendedField {
  field: string // 'scope' | 'price' | 'deadline' | 'milestone_structure' | etc.
  currentValue: string
  proposedValue: string
}

/**
 * Recorded outcome of fulfilment review. (Architecture §10)
 */
export interface ReviewRecord {
  id: string
  milestoneId: string
  reviewerId: string
  reviewerRole: BuyerCompanyRole | 'staff'
  determination: ReviewDetermination
  acceptedAmountCents: number | null // for partial release
  notes: string
  evidenceBasis: string // structured reference to what was reviewed
  createdAt: string
}

// ══════════════════════════════════════════════
// ASSIGNMENT DISPUTE CASE (Architecture v1.1 §13)
// Supports milestone-level and assignment-level disputes.
// ══════════════════════════════════════════════

export type AssignmentDisputeScope = 'milestone' | 'assignment'

export type AssignmentDisputeResolution =
  | 'full_release'
  | 'partial_release'
  | 'full_refund'
  | 'partial_refund'
  | 'no_action'

export interface AssignmentDisputeCase {
  id: string
  assignmentId: string
  milestoneId: string | null // null = assignment-level
  scope: AssignmentDisputeScope
  trigger: AssignmentDisputeTrigger
  state: DisputeState
  filerId: string
  filerRole: 'buyer' | 'creator'
  contestedAmountCents: number
  reason: string
  counterEvidence: string | null
  resolution: AssignmentDisputeResolution | null
  resolvedAmountCents: number | null
  staffReviewerId: string | null
  staffNotes: string | null
  filedAt: string
  counterEvidenceDeadline: string | null
  resolvedAt: string | null
  externalEscalationDeadline: string | null // 30 days post provisional release
}

// ══════════════════════════════════════════════
// DISPUTE (Spec §13) — Catalogue / Article disputes
// ══════════════════════════════════════════════

export interface Dispute {
  id: string
  type: DisputeType
  state: DisputeState
  assetId: string | null
  assignmentId: string | null
  articleId: string | null
  filerId: string
  respondentId: string
  reason: string
  filedAt: string
  resolvedAt: string | null
  outcome: string | null
}

// ══════════════════════════════════════════════
// SETTLEMENT (Spec §8.8)
// ══════════════════════════════════════════════

export interface Settlement {
  id: string
  transactionId: string
  creatorId: string
  amount: number // EUR cents
  state: PayoutState
  route: 'sepa' | 'wise'
  queuedAt: string
  settledAt: string | null
  reference: string | null
}

// ══════════════════════════════════════════════
// LIGHTBOX (Spec §9.5)
// ══════════════════════════════════════════════

export interface Lightbox {
  id: string
  name: string
  buyerId: string
  assetIds: string[]
  createdAt: string
  updatedAt: string
}

// ══════════════════════════════════════════════
// CERTIFIED PACKAGE (Spec §10.2)
// ══════════════════════════════════════════════

export interface CertifiedPackage {
  id: string
  transactionId: string
  assetId: string
  buyerId: string
  creatorId: string
  generatedAt: string
  contents: {
    certificate: boolean
    licenceAgreement: boolean
    invoice: boolean
    paymentReceipt: boolean
  }
}

// ══════════════════════════════════════════════
// TRANSACTION (Spec §9.6, §10)
// ══════════════════════════════════════════════

export type TransactionType =
  | 'direct_catalogue'
  | 'plugin_catalogue'
  | 'direct_offer'
  | 'exclusive_licence'
  | 'bulk'
  | 'assignment'
  | 'creator_article'
  | 'frontfiles_article'

export interface Transaction {
  id: string
  type: TransactionType
  channel: TransactionChannel
  assetId: string
  buyerId: string
  creatorId: string
  licenceType: LicenceType
  listedPrice: number
  buyerPays: number
  creatorReceives: number
  platformEarns: number
  completedAt: string
  certifiedPackageId: string | null
  settlementId: string | null
}

// ══════════════════════════════════════════════
// BUYER ACCOUNT (Spec §5, §9)
// ══════════════════════════════════════════════

export interface BuyerAccount {
  id: string
  type: 'individual' | 'company'
  displayName: string
  email: string
  companyName: string | null
  vatNumber: string | null
  state: AccountState
  role: BuyerCompanyRole | null
  lightboxes: Lightbox[]
  savedSearchCount: number
}

// ══════════════════════════════════════════════
// PLUGIN SUBSCRIPTION (Spec §14.5)
// ══════════════════════════════════════════════

export interface PluginSubscription {
  id: string
  buyerId: string
  tier: PluginTier
  state: PluginSubscriptionState
  monthlyPrice: number // EUR cents
  startedAt: string
  expiresAt: string | null
}

// ══════════════════════════════════════════════
// SAVED SEARCH (Spec §12.7)
// ══════════════════════════════════════════════

export interface SavedSearch {
  id: string
  userId: string
  query: string
  filters: Record<string, unknown>
  createdAt: string
  alertEnabled: boolean
}

// ══════════════════════════════════════════════
// SOCIAL — Likes, Follows, Comments, Messages
// ══════════════════════════════════════════════

export type ContentTarget =
  | { type: 'asset'; id: string }
  | { type: 'story'; id: string }
  | { type: 'article'; id: string }

export interface SocialCounts {
  likes: number
  comments: number
  userLiked: boolean
}

export interface CommentAuthor {
  username: string
  displayName: string
  professionalTitle: string
  trustBadge: TrustBadge | null
}

export interface Comment {
  id: string
  targetType: 'asset' | 'story' | 'article'
  targetId: string
  author: CommentAuthor
  body: string
  createdAt: string
  parentId: string | null
}

export interface Conversation {
  id: string
  participants: CommentAuthor[]
  lastMessage: DirectMessage
  unreadCount: number
  createdAt: string
}

export interface DirectMessage {
  id: string
  conversationId: string
  sender: CommentAuthor
  body: string
  createdAt: string
  read: boolean
}

export interface ConnectionState {
  connections: number
  isConnected: boolean
  isBlocked: boolean
}

// ══════════════════════════════════════════════
// FFF SHARING — Posts (domain types)
//
// Distinct from the `/share/[token]` preview-link system under
// `src/data/shares.ts` + `src/lib/share/metadata.ts`. Posts are
// authenticated, in-product social feed objects that attach to
// exactly one Frontfiles content entity.
//
// The DB row type lives in `src/lib/db/schema.ts` as `PostRow`.
// The types below are the domain / service-layer shapes used by
// the UI — keyed by camelCase, with resolved attachment + author
// info (no snake_case or raw FKs).
// ══════════════════════════════════════════════

export type PostAttachmentKind =
  | 'asset'
  | 'story'
  | 'article'
  | 'collection'

/** Minimal pointer to the Frontfiles entity a post attaches to. */
export interface PostAttachmentRef {
  kind: PostAttachmentKind
  id: string
  /** Denormalised at post-time — preserves attribution if the source is later removed. */
  creatorUserId: string
}

/** Service-layer post (raw — no hydrated attachment yet). */
export interface Post {
  id: string
  authorUserId: string
  body: string
  attachment: PostAttachmentRef
  /** NULL for originals. Set for reposts. */
  repostOfPostId: string | null
  visibility: 'public' | 'connections'
  status: 'published' | 'removed' | 'hidden_by_author'
  publishedAt: string
  createdAt: string
  updatedAt: string
}

/** Author summary as rendered on a post card. */
export interface PostAuthor {
  userId: string
  username: string
  displayName: string
  professionalTitle: string
  trustBadge: TrustBadge | null
  avatarUrl: string | null
}

/**
 * Hydrated attachment — the thing the PostAttachmentEmbed draws.
 * Discriminated by `kind`; `preview` is already a delivery-safe URL
 * resolved via `resolveProtectedUrl` / existing thumbnail refs.
 *
 * `originalCreator` is always populated (denormalised on the row)
 * so the UI can show an attribution chip even when the author of
 * the post is NOT the creator of the attached entity.
 */
export type HydratedPostAttachment =
  | {
      kind: 'asset'
      id: string
      title: string
      format: AssetFormat
      previewUrl: string | null
      originalCreator: PostAuthor
    }
  | {
      kind: 'story'
      id: string
      title: string
      subtitle: string
      assetCount: number
      previewUrl: string | null
      originalCreator: PostAuthor
    }
  | {
      kind: 'article'
      id: string
      title: string
      excerpt: string
      wordCount: number
      previewUrl: string | null
      originalCreator: PostAuthor
    }
  | {
      kind: 'collection'
      id: string
      title: string
      itemCount: number
      thumbnails: string[]
      originalCreator: PostAuthor
    }

/**
 * Fully hydrated post — what the feed UI consumes.
 *
 * For reposts, `repostOf` is populated with the hydrated parent
 * (one level only; deeper chains render via permalinks on the
 * detail page, not nested cards — keeps the feed editorial).
 * `repostOf` may be `null` when the parent was removed; in that
 * case the feed renders a "quoted post removed" placeholder but
 * still shows the denormalised attachment on the outer card.
 */
export interface PostCard {
  id: string
  author: PostAuthor
  body: string
  attachment: HydratedPostAttachment
  repostOf: PostCard | null
  /** True when `repostOfPostId` is set but the parent could not be hydrated. */
  repostOfRemoved: boolean
  visibility: 'public' | 'connections'
  publishedAt: string
  /** Stubbed until Module 6 wires real social counters. */
  likeCount: number
  commentCount: number
  repostCount: number
  /** True if the viewing user has liked this post (stubbed to false for now). */
  viewerLiked: boolean
}
