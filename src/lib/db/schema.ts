/**
 * Assignment Engine — Database Row Types
 *
 * TypeScript types that mirror the PostgreSQL tables exactly.
 * These are the "database layer" types — they map 1:1 to SQL rows.
 * Domain-level types (Assignment, Milestone, etc.) live in lib/types.ts.
 *
 * When Supabase codegen is wired, this file can be replaced by the
 * generated Database type. Until then, these hand-written types
 * keep the store and query layer type-safe.
 *
 * Naming: TableNameRow (e.g. AssignmentRow, MilestoneRow).
 * Convention: snake_case column names match SQL exactly.
 */

import type {
  AssignmentClass,
  AssignmentState,
  AssignmentSubState,
  MilestoneType,
  MilestoneState,
  FulfilmentType,
  EvidenceItemKind,
  ReviewDetermination,
  CCRState,
  AssignmentDisputeTrigger,
  AssignmentDisputeScope,
  DisputeState,
  AssignmentDisputeResolution,
  BuyerCompanyRole,
  CertificationEventType,
  AccountState,
  UserType,
  TrustTier,
  TrustBadge,
  VerificationStatus,
} from '@/lib/types'

// ══════════════════════════════════════════════
// IDENTITY ROW TYPES — 1:1 with migrations
//   20260408230008_identity_enums.sql
//   20260408230009_identity_tables.sql
//   20260413230015_companies_and_memberships.sql
//
// CANONICAL RULE (identity):
//   One human = one users row.
//   Granted types are capabilities, not separate identities.
//   creator_profiles and buyer_accounts are facets of the same user
//   via UNIQUE FK on user_id.
//   Active user type is NOT stored — it is session-only.
// ══════════════════════════════════════════════

/** buyer_accounts.buyer_type — migration 8. */
export type BuyerType = 'individual' | 'company'

/** company_memberships.status — migration 15. */
export type CompanyMembershipStatus =
  | 'active'
  | 'invited'
  | 'revoked'
  | 'left'

/** 1:1 with users SQL row (migration 9). */
export interface UserRow {
  id: string
  username: string
  display_name: string
  email: string
  avatar_url: string | null
  account_state: AccountState
  founding_member: boolean
  created_at: string
  updated_at: string
}

/** 1:1 with user_granted_types SQL row (migration 9). */
export interface UserGrantedTypeRow {
  id: string
  user_id: string
  user_type: UserType
  granted_at: string
}

/** 1:1 with creator_profiles SQL row (migration 9). */
export interface CreatorProfileRow {
  id: string
  user_id: string
  professional_title: string | null
  location_base: string | null
  website_url: string | null
  biography: string | null
  trust_tier: TrustTier
  trust_badge: TrustBadge
  verification_status: VerificationStatus
  last_verified_at: string | null
  coverage_areas: string[]
  specialisations: string[]
  media_affiliations: string[]
  press_accreditations: string[]
  published_in: string[]
  skills: string[]
  also_me_links: string[]
  created_at: string
  updated_at: string
}

/** 1:1 with buyer_accounts SQL row (migration 9). */
export interface BuyerAccountRow {
  id: string
  user_id: string
  buyer_type: BuyerType
  company_name: string | null
  vat_number: string | null
  tax_id: string | null
  created_at: string
}

/**
 * 1:1 with buyer_company_memberships SQL row (migration 9).
 * Links users to buyer_accounts with a company role.
 */
export interface BuyerCompanyMembershipRow {
  id: string
  buyer_account_id: string
  user_id: string
  role: BuyerCompanyRole
  granted_at: string
}

/** 1:1 with companies SQL row (migration 15). */
export interface CompanyRow {
  id: string
  name: string
  slug: string
  state: AccountState
  legal_name: string | null
  vat_number: string | null
  tax_id: string | null
  billing_email: string | null
  country_code: string | null
  created_by_user_id: string
  primary_buyer_account_id: string | null
  created_at: string
  updated_at: string
}

/**
 * 1:1 with company_memberships SQL row (migration 15).
 *
 * NOTE: A narrower variant of this type already exists in
 * `src/lib/entitlement/types.ts` (as `CompanyMembershipRow`)
 * — that one intentionally exposes only the fields the
 * entitlement decision layer needs. This row type is the
 * full, canonical column-for-column mirror for the identity
 * layer. The two are structurally compatible on the
 * overlapping fields.
 */
export interface CompanyMembershipFullRow {
  id: string
  company_id: string
  user_id: string
  role: BuyerCompanyRole
  status: CompanyMembershipStatus
  invited_by: string | null
  invited_at: string
  activated_at: string | null
  left_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

// ══════════════════════════════════════════════
// ROW TYPES — 1:1 with PostgreSQL tables
// ══════════════════════════════════════════════

export interface AssignmentRow {
  id: string
  buyer_id: string
  creator_id: string
  assignment_class: AssignmentClass
  state: AssignmentState
  sub_state: AssignmentSubState
  // Flattened AssignmentPlan
  scope: string
  deadline: string
  acceptance_criteria: string
  required_evidence_types: string[] // EvidenceItemKind values
  review_window_days: number
  plan_notes: string | null
  // Lifecycle
  created_at: string
  accepted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export interface AssignmentRightsRecordRow {
  id: string
  assignment_id: string
  // Asset rights (NULL for pure service)
  asset_usage_rights: string | null
  asset_exclusivity_terms: string | null
  asset_permitted_modifications: string | null
  asset_duration: string | null
  asset_territory: string | null
  asset_publication_scope: string | null
  // Service terms (NULL for pure material)
  service_scope_of_work: string | null
  service_confidentiality: string | null
  service_attendance_obligations: string | null
  service_operational_restrictions: string | null
  service_reimbursement_terms: string | null
  service_liability_framing: string | null
  created_at: string
}

export interface EscrowRecordRow {
  id: string
  assignment_id: string
  stripe_payment_intent_id: string | null
  total_captured_cents: number
  total_released_cents: number
  total_refunded_cents: number
  total_frozen_cents: number
  captured_at: string | null
  created_at: string
}

export interface MilestoneRow {
  id: string
  assignment_id: string
  ordinal: number
  title: string
  scope_summary: string
  milestone_type: MilestoneType
  state: MilestoneState
  due_date: string
  acceptance_criteria: string
  required_evidence_types: string[] // EvidenceItemKind values
  releasable_amount_cents: number
  partial_acceptance_permitted: boolean
  review_window_days: number
  created_at: string
  completed_at: string | null
}

export interface FulfilmentSubmissionRow {
  id: string
  milestone_id: string
  fulfilment_type: FulfilmentType
  creator_notes: string | null
  submitted_at: string
}

export interface EvidenceItemRow {
  id: string
  fulfilment_submission_id: string
  kind: EvidenceItemKind
  label: string
  description: string | null
  vault_asset_id: string | null
  file_ref: string | null
  file_name: string | null
  file_size_bytes: number | null
  created_at: string
}

export interface ServiceLogRow {
  id: string
  evidence_item_id: string
  log_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  role: string
  completed_duties: string
}

export type ReviewerRole = BuyerCompanyRole | 'staff'

export interface ReviewRecordRow {
  id: string
  milestone_id: string
  reviewer_id: string
  reviewer_role: ReviewerRole
  determination: ReviewDetermination
  accepted_amount_cents: number | null
  notes: string
  evidence_basis: string
  created_at: string
}

export interface CommissionChangeRequestRow {
  id: string
  assignment_id: string
  requester_id: string
  state: CCRState
  rationale: string
  response_deadline: string
  responded_at: string | null
  response_note: string | null
  created_at: string
}

export interface CCRAmendedFieldRow {
  id: string
  ccr_id: string
  field: string
  current_value: string
  proposed_value: string
}

export type DisputeFilerRole = 'buyer' | 'creator'

export interface AssignmentDisputeCaseRow {
  id: string
  assignment_id: string
  milestone_id: string | null
  scope: AssignmentDisputeScope
  trigger: AssignmentDisputeTrigger
  state: DisputeState
  filer_id: string
  filer_role: DisputeFilerRole
  contested_amount_cents: number
  reason: string
  counter_evidence: string | null
  resolution: AssignmentDisputeResolution | null
  resolved_amount_cents: number | null
  staff_reviewer_id: string | null
  staff_notes: string | null
  filed_at: string
  counter_evidence_deadline: string | null
  resolved_at: string | null
  external_escalation_deadline: string | null
}

export interface AssignmentEventRow {
  id: string
  assignment_id: string
  milestone_id: string | null
  event_type: string // CertificationEventType — stored as text for extensibility
  description: string
  actor_id: string
  actor_role: string
  metadata: Record<string, unknown>
  idempotency_key: string | null
  created_at: string
}

// ══════════════════════════════════════════════
// SPECIAL OFFER THREAD ROW (Spec §10.4)
// ══════════════════════════════════════════════

export interface SpecialOfferThreadRow {
  id: string
  asset_id: string
  buyer_id: string
  creator_id: string
  licence_type: string // LicenceType
  listed_price_at_open: number // EUR cents
  current_offer_amount: number // EUR cents
  current_offer_by: 'buyer' | 'creator'
  round_count: number
  creator_response_window_minutes: number
  expires_at: string
  status: string // SpecialOfferStatus
  accepted_amount: number | null
  checkout_intent_id: string | null
  auto_cancel_reason: string | null // SpecialOfferAutoCancelReason
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface SpecialOfferEventRow {
  id: string
  thread_id: string
  event_type: string // SpecialOfferEventType
  actor_id: string
  amount: number | null // EUR cents
  message: string | null // negotiation note
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface OfferCheckoutIntentRow {
  id: string
  thread_id: string
  asset_id: string
  buyer_id: string
  creator_id: string
  licence_type: string // LicenceType
  negotiated_amount: number // EUR cents
  created_at: string
}

// ══════════════════════════════════════════════
// TABLE NAME CONSTANTS
// ══════════════════════════════════════════════

export const TABLES = {
  assignments: 'assignments',
  assignment_rights_records: 'assignment_rights_records',
  escrow_records: 'escrow_records',
  milestones: 'milestones',
  fulfilment_submissions: 'fulfilment_submissions',
  evidence_items: 'evidence_items',
  service_logs: 'service_logs',
  review_records: 'review_records',
  commission_change_requests: 'commission_change_requests',
  ccr_amended_fields: 'ccr_amended_fields',
  assignment_dispute_cases: 'assignment_dispute_cases',
  assignment_events: 'assignment_events',
  special_offer_threads: 'special_offer_threads',
  special_offer_events: 'special_offer_events',
  offer_checkout_intents: 'offer_checkout_intents',
  // Identity layer (migrations 9, 15)
  users: 'users',
  user_granted_types: 'user_granted_types',
  creator_profiles: 'creator_profiles',
  buyer_accounts: 'buyer_accounts',
  buyer_company_memberships: 'buyer_company_memberships',
  companies: 'companies',
  company_memberships: 'company_memberships',
  // FFF Sharing (Post) layer — migrations 20260416000001..3
  posts: 'posts',
  // External providers — migrations 20260417000001..3
  external_connections: 'external_connections',
  external_credentials: 'external_credentials',
  external_webhook_events: 'external_webhook_events',
} as const

export type TableName = (typeof TABLES)[keyof typeof TABLES]

// ══════════════════════════════════════════════
// FFF SHARING (POSTS) ROW TYPES — 1:1 with migrations
//   20260416000001_post_enums.sql
//   20260416000002_post_tables.sql
//   20260416000003_post_indexes.sql
//
// NOT to be confused with the existing `/share/[token]`
// preview-link system. Those live under `src/data/shares.ts` +
// `src/lib/share/metadata.ts` and are unchanged.
// ══════════════════════════════════════════════

/** posts.attachment_type — migration 20260416000001. */
export type PostAttachmentType = 'asset' | 'story' | 'article' | 'collection'

/** posts.visibility — migration 20260416000001. v1 uses 'public' only in behaviour. */
export type PostVisibility = 'public' | 'connections'

/** posts.status — migration 20260416000001. */
export type PostStatus = 'published' | 'removed' | 'hidden_by_author'

/**
 * 1:1 with posts SQL row (migration 20260416000002).
 *
 * `attachment_id` is not FK-bound at the SQL level because three
 * of the four target tables (stories, articles, collections) are
 * still seed-only. Existence is enforced in
 * `src/lib/post/validation.ts` + `hydrate.ts` until they land.
 *
 * `attachment_creator_user_id` is a snapshot at post-time — it
 * preserves attribution if the source entity is later removed.
 */
export interface PostRow {
  id: string
  author_user_id: string
  body: string
  attachment_type: PostAttachmentType
  attachment_id: string
  attachment_creator_user_id: string
  repost_of_post_id: string | null
  visibility: PostVisibility
  status: PostStatus
  published_at: string
  created_at: string
  updated_at: string
}

// ══════════════════════════════════════════════
// EXTERNAL PROVIDERS — 1:1 with migrations
//   20260417000001_provider_enums.sql
//   20260417000002_provider_tables.sql
//   20260417000003_provider_indexes.sql
//
// Provider key is intentionally `string` (validated against the
// application registry in `lib/providers/registry.ts`) so adding
// a new provider is zero-migration.
// ══════════════════════════════════════════════

export type ProviderCategory =
  | 'payments'
  | 'identity_verification'
  | 'payouts'
  | 'storage'
  | 'mail'
  | 'calendar'
  | 'analytics'
  | 'crm'
  | 'enterprise_sso'

export type ProviderAuthType =
  | 'api_key'
  | 'oauth2'
  | 'oauth2_pkce'
  | 'connect_oauth'
  | 'webhook_only'
  | 'none'

export type ProviderOwnerType = 'user' | 'company' | 'workspace' | 'platform'

export type ProviderConnectionStatus =
  | 'pending'
  | 'active'
  | 'revoked'
  | 'error'
  | 'reauth_required'

export type ProviderWebhookSignatureStatus =
  | 'verified'
  | 'rejected'
  | 'unverified'

export type ProviderWebhookProcessingStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'dead_letter'

/** 1:1 with `external_connections` SQL row. */
export interface ExternalConnectionRow {
  id: string
  provider: string
  category: ProviderCategory
  owner_type: ProviderOwnerType
  /** NULL only when `owner_type='platform'`. */
  owner_id: string | null
  external_account_id: string
  account_label: string | null
  status: ProviderConnectionStatus
  granted_scopes: string[]
  created_by_user_id: string | null
  created_at: string
  revoked_at: string | null
  last_synced_at: string | null
  metadata: Record<string, unknown>
}

/** 1:1 with `external_credentials` SQL row. NEVER stores plaintext. */
export interface ExternalCredentialRow {
  id: string
  connection_id: string
  auth_type: ProviderAuthType
  /**
   * Opaque pointer into a real secret store. Format adapter-defined:
   * `stripe:acct_xxx:secret_key`, `google:user_123:refresh_token`.
   * The literal `plain:` prefix is rejected by a SQL CHECK to
   * make accidental plaintext storage loud.
   */
  secret_ref: string
  refreshable: boolean
  expires_at: string | null
  last_rotated_at: string | null
  scopes_granted: string[]
  created_at: string
  updated_at: string
}

/** 1:1 with `external_webhook_events` SQL row. */
export interface ExternalWebhookEventRow {
  id: string
  provider: string
  external_event_id: string
  event_type: string
  payload: Record<string, unknown>
  signature_status: ProviderWebhookSignatureStatus
  processing_status: ProviderWebhookProcessingStatus
  connection_id: string | null
  received_at: string
  processed_at: string | null
  retry_count: number
  error_message: string | null
}

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000001)
//
// Schema foundation for the public newsroom distribution
// subsystem. See docs/public-newsroom/PRD.md for canonical
// semantics and docs/public-newsroom/BUILD_CHARTER.md for
// the primitive-reuse mapping.
// ══════════════════════════════════════════════

export type NewsroomVerificationTier =
  | 'unverified'
  | 'verified_source'
  | 'verified_publisher'

export type NewsroomVerificationMethod =
  | 'dns_txt'
  | 'domain_email'
  | 'authorized_signatory'

export type NewsroomPackStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'
  | 'takedown'

export type NewsroomPackVisibility =
  | 'private'
  | 'restricted'
  | 'public'
  | 'tombstone'

export type NewsroomLicenceClass =
  | 'press_release_verbatim'
  | 'editorial_use_only'
  | 'promotional_use'
  | 'cc_attribution'
  | 'cc_public_domain'

export type NewsroomAssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'text'

export interface NewsroomProfileRow {
  company_id: string
  verification_tier: NewsroomVerificationTier
  verified_at: string | null
  primary_domain: string
  logo_asset_id: string | null
  suspended: boolean
  suspended_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomVerificationRecordRow {
  id: string
  company_id: string
  method: NewsroomVerificationMethod
  value_checked: string
  verified_at: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomPackRow {
  id: string
  company_id: string
  slug: string
  title: string
  subtitle: string | null
  description: string
  credit_line: string
  licence_class: NewsroomLicenceClass
  publish_at: string | null
  embargo_id: string | null
  rights_warranty_id: string | null
  status: NewsroomPackStatus
  visibility: NewsroomPackVisibility
  published_at: string | null
  archived_at: string | null
  takedown_at: string | null
  takedown_reason: string | null
  c2pa_signing_enabled: boolean
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export interface NewsroomAssetRow {
  id: string
  pack_id: string
  kind: NewsroomAssetKind
  mime_type: string
  original_filename: string
  storage_url: string
  file_size_bytes: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  checksum_sha256: string
  caption: string | null
  alt_text: string | null
  is_trademark_asset: boolean
  c2pa_manifest_stored: boolean
  created_at: string
  updated_at: string
}

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000002)
//
// Schema extensions Part A: publish-precondition surface.
// Scan results, renditions, rights warranty, corrections.
// See docs/public-newsroom/directives/NR-D2a-asset-pack-
// extensions.md for canonical semantics.
// ══════════════════════════════════════════════

export type NewsroomScanResult =
  | 'pending'
  | 'clean'
  | 'flagged'
  | 'error'

export type NewsroomRenditionKind =
  | 'thumbnail'
  | 'web'
  | 'print'
  | 'social'

export type NewsroomRenditionFormat =
  | 'jpeg'
  | 'webp'
  | 'png'
  | 'mp4'
  | 'gif'

export interface NewsroomAssetScanResultRow {
  id: string
  asset_id: string
  scanner_suite: string
  scanner_version: string
  result: NewsroomScanResult
  flagged_categories: string[]
  scanned_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomAssetRenditionRow {
  id: string
  asset_id: string
  kind: NewsroomRenditionKind
  storage_url: string
  width: number
  height: number
  format: NewsroomRenditionFormat
  file_size_bytes: number
  generated_at: string
  created_at: string
  updated_at: string
}

export interface NewsroomRightsWarrantyRow {
  id: string
  pack_id: string
  subject_releases_confirmed: boolean
  third_party_content_cleared: boolean
  music_cleared: boolean
  narrative_text: string | null
  confirmed_by_user_id: string
  confirmed_at: string
  created_at: string
  updated_at: string
}

export interface NewsroomCorrectionRow {
  id: string
  pack_id: string
  correction_text: string
  issued_at: string
  issued_by_user_id: string
  created_at: string
  updated_at: string
}

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000003)
//
// Schema extensions Part B: embargo workflow + consumer
// identity (Path A email-first Recipient).
// See docs/public-newsroom/directives/
//   NR-D2b-embargo-consumer-identity.md for canonical
//   semantics and Build Charter §4 for primitive mapping.
// ══════════════════════════════════════════════

export type NewsroomEmbargoState =
  | 'active'
  | 'lifted'
  | 'cancelled'

export interface NewsroomOutletRow {
  id: string
  name: string
  domain: string
  verified: boolean
  created_at: string
  updated_at: string
}

export interface NewsroomRecipientRow {
  id: string
  email: string
  user_id: string | null
  outlet_id: string | null
  name: string | null
  verified: boolean
  created_at: string
  updated_at: string
}

export interface NewsroomEmbargoRow {
  id: string
  pack_id: string
  lift_at: string
  policy_text: string
  state: NewsroomEmbargoState
  lifted_at: string | null
  cancelled_at: string | null
  notify_on_lift: boolean
  created_at: string
  updated_at: string
}

export interface NewsroomEmbargoRecipientRow {
  id: string
  embargo_id: string
  recipient_id: string
  access_token: string
  invited_at: string
  first_accessed_at: string | null
  last_accessed_at: string | null
  access_count: number
  revoked_at: string | null
  created_at: string
  updated_at: string
}

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000004)
//
// Schema extensions Part C-i: provenance stack.
// Signing keys, distribution events, download receipts.
// See docs/public-newsroom/directives/
//   NR-D2c-i-provenance-stack.md for canonical semantics.
// ══════════════════════════════════════════════

export type NewsroomDistributionEventType =
  | 'pack_view'
  | 'asset_view'
  | 'asset_download'
  | 'pack_zip_download'
  | 'embed_render'
  | 'preview_access'

export type NewsroomDistributionSource =
  | 'web'
  | 'embed'
  | 'api'
  | 'email_link'

export type NewsroomSigningAlgorithm = 'ed25519'

export type NewsroomSigningKeyStatus =
  | 'active'
  | 'rotated'
  | 'revoked'

export interface NewsroomSigningKeyRow {
  id: string
  kid: string
  algorithm: NewsroomSigningAlgorithm
  public_key_pem: string
  private_key_ref: string
  status: NewsroomSigningKeyStatus
  rotated_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomDistributionEventRow {
  id: string
  pack_id: string
  asset_id: string | null
  recipient_id: string | null
  anon_session_id: string | null
  event_type: NewsroomDistributionEventType
  source: NewsroomDistributionSource
  outlet_domain: string | null
  user_agent: string | null
  ip_country: string | null
  occurred_at: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface NewsroomDownloadReceiptRow {
  id: string
  distribution_event_id: string
  pack_id: string
  asset_id: string | null
  recipient_id: string | null
  licence_class: NewsroomLicenceClass
  credit_line: string
  terms_summary: string
  content_hash_sha256: string
  signing_key_kid: string
  signed_at: string
  signature: string
  receipt_url: string
  created_at: string
}

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000005)
//
// Schema extensions Part C-ii: governance + subscriptions.
// Claims, admin users, admin audit events, beat subscriptions.
// FINAL schema directive of Phase NR-1.
// See docs/public-newsroom/directives/
//   NR-D2c-ii-claims-admin-subscriptions.md for canonical
//   semantics.
// ══════════════════════════════════════════════

export type NewsroomClaimReasonCategory =
  | 'trademark_infringement'
  | 'copyright'
  | 'defamation'
  | 'privacy'
  | 'embargo_breach'
  | 'other'

export type NewsroomClaimStatus =
  | 'submitted'
  | 'reviewing'
  | 'upheld'
  | 'dismissed'
  | 'withdrawn'

export type NewsroomAdminRole =
  | 'viewer'
  | 'reviewer'
  | 'operator'
  | 'security'

export type NewsroomAdminTargetType =
  | 'organization'
  | 'pack'
  | 'asset'
  | 'verification_record'
  | 'signing_key'
  | 'claim'

export type NewsroomBeatNotifyOn =
  | 'new_pack'
  | 'embargo_lift'
  | 'update'

export interface NewsroomClaimRow {
  id: string
  pack_id: string
  asset_id: string | null
  reporter_email: string
  reporter_name: string | null
  reason_category: NewsroomClaimReasonCategory
  reason_text: string
  status: NewsroomClaimStatus
  submitted_at: string
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomAdminUserRow {
  user_id: string
  role: NewsroomAdminRole
  mfa_enabled: boolean
  assigned_at: string
  assigned_by_user_id: string | null
  revoked_at: string | null
  revoked_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomAdminAuditEventRow {
  id: string
  admin_user_id: string
  cosigner_admin_user_id: string | null
  action: string
  target_type: NewsroomAdminTargetType
  target_id: string
  reason: string
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  source_ip: string | null
  occurred_at: string
  created_at: string
}

export interface NewsroomBeatSubscriptionRow {
  id: string
  recipient_id: string
  company_id: string
  notify_on: NewsroomBeatNotifyOn
  created_at: string
  updated_at: string
}
