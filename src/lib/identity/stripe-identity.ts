/**
 * Frontfiles — Stripe Identity Service Boundary
 *
 * Stripe is the default provider for legal identity
 * verification AND for future payouts via Stripe Connect.
 *
 * This module is the ONE place the app talks to Stripe about
 * legal identity. Every other layer reads through the store
 * (`getLegalIdentity`, `getLegalIdentityStatusSummary`) which
 * returns our canonical shape — so the rest of the codebase
 * never has to reason about Stripe's `Account` / `Person` /
 * `requirements` structure directly.
 *
 * Phase D.1 scope:
 *   - Define the service boundary + mappers.
 *   - Provide deterministic local behavior so the
 *     IdentityDrawer + account shell UX are functional
 *     end-to-end without any networked Stripe integration.
 *   - Leave TODO markers where the real implementation
 *     will slot in once Stripe Connect is wired.
 *
 * Out of Phase D.1 scope:
 *   - No real Stripe SDK calls.
 *   - No payout methods, external accounts, or webhook handlers.
 *   - No UBO / director collection (Stripe will force that
 *     for some company types via `requirements_currently_due`
 *     when the real integration lands).
 */

import {
  attachStripeVerificationState,
  getLegalIdentity,
} from './store'
import type {
  IdentitySubjectType,
  LegalIdentityFacet,
  StripeVerificationState,
} from './types'

// ══════════════════════════════════════════════
// MAPPERS — canonical ↔ Stripe
// ══════════════════════════════════════════════

/**
 * Map a Frontfiles `IdentitySubjectType` to Stripe Connect's
 * `business_type`.
 *
 *   person  → individual
 *   company → company
 *
 * Stripe's `non_profit` / `government_entity` variants are
 * not supported by Phase D.1 — they would need an explicit
 * product decision on creator eligibility first.
 */
export function subjectTypeToStripeBusinessType(
  subject: IdentitySubjectType,
): 'individual' | 'company' {
  return subject === 'company' ? 'company' : 'individual'
}

/**
 * Minimal Stripe `Account.create` payload shape our app owns.
 * Not the full Stripe SDK type — just enough to test our
 * mapping layer and document the data flow.
 */
export interface StripeAccountCreatePayload {
  type: 'custom' | 'express' | 'standard'
  country: string | null
  business_type: 'individual' | 'company'
  business_profile?: {
    name?: string
  }
  individual?: {
    first_name?: string
    last_name?: string
    dob?: { day?: number; month?: number; year?: number } | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      country?: string | null
    }
    nationality?: string | null
  }
  company?: {
    name?: string
    tax_id?: string | null
    vat_id?: string | null
    registration_number?: string | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      country?: string | null
    }
  }
}

/**
 * Translate the canonical facet into the Stripe
 * `Account.create` payload we would send when the real
 * integration lands. Pure function, no IO.
 *
 * For company subjects the "representative" fields are NOT
 * mapped yet — Stripe requires persons to be created via a
 * separate `Account Persons` call, not inline on the account.
 * That will come with the payouts phase.
 */
export function mapLegalIdentityToStripePayload(
  facet: LegalIdentityFacet,
  accountType: 'custom' | 'express' | 'standard' = 'express',
): StripeAccountCreatePayload {
  const businessType = subjectTypeToStripeBusinessType(facet.subject_type)

  const address = {
    line1: facet.address_line_1,
    line2: facet.address_line_2,
    city: facet.city,
    state: facet.region,
    postal_code: facet.postal_code,
    country: facet.country_code,
  }

  const payload: StripeAccountCreatePayload = {
    type: accountType,
    country: facet.country_code,
    business_type: businessType,
  }

  if (businessType === 'individual') {
    const [first, ...rest] = (facet.full_legal_name ?? '').trim().split(/\s+/)
    const last = rest.join(' ') || null
    const dob = facet.date_of_birth ? parseDob(facet.date_of_birth) : null

    payload.individual = {
      first_name: first || undefined,
      last_name: last || undefined,
      dob,
      address,
      nationality: facet.nationality,
    }
  } else {
    payload.company = {
      name: facet.company_legal_name ?? undefined,
      tax_id: facet.tax_id,
      vat_id: facet.vat_number,
      registration_number: facet.company_registration_number,
      address,
    }
    payload.business_profile = {
      name: facet.company_legal_name ?? undefined,
    }
  }

  return payload
}

function parseDob(
  iso: string,
): { day?: number; month?: number; year?: number } | null {
  // Accept YYYY-MM-DD and similar.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  }
}

/**
 * Minimal shape of a Stripe `Account` response we care about.
 * Real Stripe responses have many more fields — we only map
 * what the UI reads.
 */
export interface StripeAccountSyncResponse {
  id: string
  business_type: 'individual' | 'company' | null
  charges_enabled: boolean | null
  payouts_enabled: boolean | null
  details_submitted: boolean | null
  requirements: {
    currently_due: string[]
    eventually_due: string[]
    past_due: string[]
    pending_verification: string[]
    disabled_reason: string | null
  }
}

/**
 * Translate a Stripe `Account` response into our canonical
 * `StripeVerificationState`. Pure function, no IO.
 */
export function mapStripeAccountToVerificationState(
  stripeAccount: StripeAccountSyncResponse,
): StripeVerificationState {
  return {
    connected_account_id: stripeAccount.id,
    person_id: null, // populated later from Stripe Persons API
    account_type: null, // Express vs Custom vs Standard — stored elsewhere
    business_type: stripeAccount.business_type,
    charges_enabled: stripeAccount.charges_enabled,
    payouts_enabled: stripeAccount.payouts_enabled,
    details_submitted: stripeAccount.details_submitted,
    requirements_currently_due: stripeAccount.requirements.currently_due,
    requirements_eventually_due: stripeAccount.requirements.eventually_due,
    requirements_past_due: stripeAccount.requirements.past_due,
    requirements_pending_verification:
      stripeAccount.requirements.pending_verification,
    disabled_reason: stripeAccount.requirements.disabled_reason,
    last_synced_at: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════
// SERVICE — connection lifecycle
// ══════════════════════════════════════════════

/**
 * Deterministic mock account id so the local dev path is
 * stable across refreshes.
 */
function deterministicConnectedAccountId(userId: string): string {
  return `acct_mock_${userId.replace(/[^a-z0-9]/gi, '')}`
}

/**
 * Ensure the user has a Stripe Connect account attached to
 * their legal identity facet. Creates one if missing.
 *
 * Phase D.1 — LOCAL STUB. Returns a deterministic mock
 * account id and attaches it via
 * `attachStripeVerificationState`. When the real Stripe
 * integration lands this function will:
 *
 *   1. Call `stripe.accounts.create(payload)` with the
 *      payload from `mapLegalIdentityToStripePayload`.
 *   2. Store the returned `id` on the facet.
 *   3. Call `stripe.accounts.createPerson(...)` for each
 *      representative / owner that Stripe's requirements
 *      surface.
 *
 * The signature + return shape will not change, so callers
 * written now keep working.
 */
export async function ensureStripeConnectedAccountForIdentity(
  userId: string,
  subjectType: IdentitySubjectType,
): Promise<LegalIdentityFacet> {
  const facet = await getLegalIdentity(userId)
  if (!facet) {
    throw new Error(
      `stripe-identity: cannot ensure connected account — no legal identity facet for user ${userId}`,
    )
  }

  if (facet.stripe_verification?.connected_account_id) {
    return facet
  }

  // TODO(phase-payouts): replace with real stripe.accounts.create.
  const mockId = deterministicConnectedAccountId(userId)
  const initialState: Partial<StripeVerificationState> = {
    connected_account_id: mockId,
    account_type: 'express',
    business_type: subjectTypeToStripeBusinessType(subjectType),
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    requirements_currently_due: [],
    requirements_eventually_due: [],
    requirements_past_due: [],
    requirements_pending_verification: [],
    disabled_reason: null,
    last_synced_at: new Date().toISOString(),
  }

  return attachStripeVerificationState(userId, initialState)
}

/**
 * Pull the latest requirements from Stripe and update the
 * local facet.
 *
 * Phase D.1 — LOCAL STUB. Simulates a "submitted, pending
 * verification" state so downstream UX can exercise the
 * `in_review` branch of the status normalizer. Replaced by
 * a real `stripe.accounts.retrieve` call in the payouts
 * phase.
 */
export async function syncStripeIdentityRequirements(
  userId: string,
): Promise<LegalIdentityFacet> {
  const facet = await getLegalIdentity(userId)
  if (!facet) {
    throw new Error(
      `stripe-identity: cannot sync requirements — no legal identity facet for user ${userId}`,
    )
  }

  if (!facet.stripe_verification?.connected_account_id) {
    // Nothing to sync against yet — the caller should run
    // `ensureStripeConnectedAccountForIdentity` first.
    return facet
  }

  // TODO(phase-payouts): replace with real stripe.accounts.retrieve.
  const patch: Partial<StripeVerificationState> = {
    details_submitted: true,
    charges_enabled: false,
    payouts_enabled: false,
    requirements_pending_verification: ['individual.verification.document'],
    last_synced_at: new Date().toISOString(),
  }

  return attachStripeVerificationState(userId, patch)
}

/**
 * Push the local facet to Stripe as an initial account
 * submission.
 *
 * Phase D.1 — LOCAL STUB. Runs the pure mapper so the
 * payload shape is exercised, then flips the local state
 * into a "details_submitted + pending_verification" stance
 * so the UI has something to render.
 *
 * When real Stripe lands this becomes:
 *   1. stripe.accounts.update(account_id, payload)
 *   2. stripe.accounts.createPerson(...) per representative
 *   3. return the refreshed account → map to state → attach
 */
export async function submitIdentityToStripe(
  userId: string,
): Promise<LegalIdentityFacet> {
  const facet = await getLegalIdentity(userId)
  if (!facet) {
    throw new Error(
      `stripe-identity: cannot submit — no legal identity facet for user ${userId}`,
    )
  }

  // Exercise the mapper so its signature stays alive in
  // builds even while the real call is stubbed.
  const _payload = mapLegalIdentityToStripePayload(facet)
  void _payload

  // Guarantee we have a connected account first.
  const withAccount = facet.stripe_verification?.connected_account_id
    ? facet
    : await ensureStripeConnectedAccountForIdentity(userId, facet.subject_type)

  // Simulate a successful submission followed by an
  // immediate pending-verification state.
  const patch: Partial<StripeVerificationState> = {
    details_submitted: true,
    requirements_pending_verification:
      withAccount.subject_type === 'company'
        ? ['company.verification.document']
        : ['individual.verification.document'],
    last_synced_at: new Date().toISOString(),
  }

  return attachStripeVerificationState(userId, patch)
}
