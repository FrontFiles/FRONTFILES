/**
 * Frontfiles — Identity Module Types
 *
 * Aggregate types used by the identity store layer.
 * DB row types live in `@/lib/db/schema` and are re-exported here
 * so callers can import everything they need from `@/lib/identity`.
 */

import type {
  UserRow,
  UserGrantedTypeRow,
  CreatorProfileRow,
  BuyerAccountRow,
  BuyerCompanyMembershipRow,
  CompanyRow,
  CompanyMembershipFullRow,
  BuyerType,
  CompanyMembershipStatus,
} from '@/lib/db/schema'

import type { UserType } from '@/lib/types'

export type {
  UserRow,
  UserGrantedTypeRow,
  CreatorProfileRow,
  BuyerAccountRow,
  BuyerCompanyMembershipRow,
  CompanyRow,
  CompanyMembershipFullRow,
  BuyerType,
  CompanyMembershipStatus,
  UserType,
}

// ══════════════════════════════════════════════
// AGGREGATE — a user with all facets attached
//
// This is the shape returned by `getUserWithFacets`.
// Callers that only need the session shell should pick
// `user` out of this. Callers that need the creator
// profile or buyer account pick the matching facet.
// ══════════════════════════════════════════════

export interface UserWithFacets {
  user: UserRow
  grantedTypes: UserType[]
  creatorProfile: CreatorProfileRow | null
  buyerAccount: BuyerAccountRow | null
  companyMemberships: CompanyMembershipFullRow[]
}

// ══════════════════════════════════════════════
// SEED — the shape used by data/users.ts to pre-populate
// the in-memory store in mock mode and to generate
// SQL INSERTs in supabase/seed.sql.
// ══════════════════════════════════════════════

export interface UserSeed {
  user: UserRow
  grants: UserGrantedTypeRow[]
  creatorProfile?: CreatorProfileRow
  buyerAccount?: BuyerAccountRow
  companyMemberships?: CompanyMembershipFullRow[]
  /** Companies founded by this user (e.g. buyer_account owner). */
  ownedCompanies?: CompanyRow[]
}

// ══════════════════════════════════════════════
// CREATE INPUTS — narrow shapes for store mutations.
// These only carry the writable fields; the store
// fills in id, timestamps, and any server defaults.
// ══════════════════════════════════════════════

export interface CreateUserInput {
  /**
   * Optional explicit primary key. When provided, the store
   * writes this value as `users.id`. This is the seam that
   * lets onboarding adopt a freshly-minted Supabase auth user
   * id — migration 9 documents that `users.id` is designed to
   * equal `auth.users.id`, and the onboarding account-creation
   * server action enforces that rule by passing the auth user
   * id in here.
   *
   * When omitted, the mock store generates a short readable
   * id and the real store lets Postgres fill `gen_random_uuid()`.
   */
  id?: string
  username: string
  display_name: string
  email: string
  avatar_url?: string | null
  founding_member?: boolean
}

export interface UpdateUserCoreInput {
  display_name?: string
  email?: string
  avatar_url?: string | null
}

export interface UpsertCreatorProfileInput {
  user_id: string
  professional_title?: string | null
  location_base?: string | null
  website_url?: string | null
  biography?: string | null
  trust_tier?: CreatorProfileRow['trust_tier']
  trust_badge?: CreatorProfileRow['trust_badge']
  verification_status?: CreatorProfileRow['verification_status']
  last_verified_at?: string | null
  coverage_areas?: string[]
  specialisations?: string[]
  media_affiliations?: string[]
  press_accreditations?: string[]
  published_in?: string[]
  skills?: string[]
  also_me_links?: string[]
}

export interface UpsertBuyerAccountInput {
  user_id: string
  buyer_type: BuyerType
  company_name?: string | null
  vat_number?: string | null
  tax_id?: string | null
}

// ══════════════════════════════════════════════
// LEGAL IDENTITY — Phase D canonical facet
//
// This is the internal trust facet used to gate future
// Stripe Connect payouts, high-value licensing, assignment
// funding, and other trust-sensitive actions.
//
// Rules:
//   1. Frontfiles OWNS the canonical identity data. Stripe-
//      specific status lives on `stripe_verification` as
//      nested provider metadata.
//   2. One normalized facet per user. Room for UBO/owners
//      is preserved via the optional representative fields
//      and will grow into a relation when Stripe requires
//      it for company subjects.
//   3. The facet lifecycle is explicit: not_started → draft
//      → submitted → verified | requirements_due |
//      needs_resubmission | rejected.
//   4. A later phase will back this with a real migration
//      (`legal_identities` table). Until then the store keeps
//      it in-memory next to the other identity facets and the
//      field names use snake_case so the migration is trivial.
// ══════════════════════════════════════════════

/** Who the legal identity applies to. */
export type IdentitySubjectType = 'person' | 'company'

/**
 * App-facing canonical status. Stripe state contributes to
 * this via `getLegalIdentityStatusSummary`, but this enum is
 * the source of truth for UI rendering.
 */
export type IdentityVerificationStatus =
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'requirements_due'
  | 'in_review'
  | 'verified'
  | 'rejected'
  | 'needs_resubmission'

/**
 * Which provider owns verification for this facet.
 *
 * Payouts-phase note: today `stripe` means Stripe Identity /
 * Connect verification only. A future phase adds:
 *   - a payout-method facet (external_account / bank_account)
 *     attached to the same Stripe Connect account id, and
 *   - a webhook ingest that keeps `StripeVerificationState`
 *     in sync with Stripe-side account updates.
 * Those live alongside this facet rather than inside it.
 */
export type IdentityVerificationProvider = 'stripe' | 'manual' | 'none'

/**
 * Normalized Stripe Connect verification state. This is NOT
 * a raw Stripe API mirror — it's a stable, named projection
 * the app can code against. Mappers in `stripe-identity.ts`
 * convert between this and Stripe's `Account` / `Person`
 * shapes.
 *
 * Future payouts phase: `charges_enabled` / `payouts_enabled`
 * are the gates that let the creator actually receive
 * money. Until both are true, payouts are deferred to a
 * manual queue.
 */
export interface StripeVerificationState {
  connected_account_id: string
  person_id: string | null
  account_type: 'custom' | 'express' | 'standard' | null
  business_type: 'individual' | 'company' | null
  charges_enabled: boolean | null
  payouts_enabled: boolean | null
  details_submitted: boolean | null
  requirements_currently_due: string[]
  requirements_eventually_due: string[]
  requirements_past_due: string[]
  requirements_pending_verification: string[]
  disabled_reason: string | null
  last_synced_at: string | null
}

/**
 * Canonical legal identity facet. One row per user.
 *
 * Person fields apply when `subject_type === 'person'`.
 * Company fields apply when `subject_type === 'company'`.
 * The row holds both sets because Stripe's person/company
 * boundary occasionally overlaps (address applies to both;
 * company accounts still carry a representative person),
 * and splitting the facet would duplicate the lifecycle.
 */
export interface LegalIdentityFacet {
  id: string
  user_id: string

  subject_type: IdentitySubjectType
  status: IdentityVerificationStatus
  provider: IdentityVerificationProvider
  /** Provider-issued identifier, e.g. Stripe account id. */
  provider_ref: string | null
  /** Raw provider status string, stored for audit/debugging. */
  provider_status: string | null

  // ── Person / individual ────────────────────
  full_legal_name: string | null
  date_of_birth: string | null
  country_code: string | null
  nationality: string | null

  // ── Address (applies to both subject types) ─
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  region: string | null
  postal_code: string | null

  // ── Company ─────────────────────────────────
  company_legal_name: string | null
  company_registration_number: string | null
  vat_number: string | null
  tax_id: string | null

  // ── Authorised representative (company) ────
  // Phase D.1 collects a single primary representative.
  // UBO / director collection will be added if/when Stripe
  // requirements force it — see stripe-identity.ts notes.
  representative_full_name: string | null
  representative_title: string | null

  // ── Lifecycle timestamps ────────────────────
  submitted_at: string | null
  verified_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  last_reviewed_at: string | null
  created_at: string
  updated_at: string

  // ── Nested provider state ───────────────────
  stripe_verification: StripeVerificationState | null
}

/**
 * Patch used by `upsertLegalIdentityDraft`. Every field is
 * optional so callers can save partial drafts.
 */
export type LegalIdentityDraftPatch = Partial<
  Omit<
    LegalIdentityFacet,
    | 'id'
    | 'user_id'
    | 'status'
    | 'provider'
    | 'provider_ref'
    | 'provider_status'
    | 'submitted_at'
    | 'verified_at'
    | 'rejected_at'
    | 'rejection_reason'
    | 'last_reviewed_at'
    | 'created_at'
    | 'updated_at'
    | 'stripe_verification'
  >
> & {
  subject_type?: IdentitySubjectType
}

/**
 * Derived UX summary. Consumers render this directly; they
 * should NOT recompute "is verified" / "needs attention" logic
 * themselves — it belongs in `getLegalIdentityStatusSummary`.
 */
export interface LegalIdentityStatusSummary {
  status: IdentityVerificationStatus
  subjectType: IdentitySubjectType | null
  provider: IdentityVerificationProvider
  displayName: string
  isVerified: boolean
  canSubmit: boolean
  requiresAttention: boolean
  statusLabel: string
  nextActionLabel: string
  hasStripeConnection: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}
