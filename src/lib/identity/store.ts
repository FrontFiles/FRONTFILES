/**
 * Frontfiles — Identity Repository
 *
 * Data access layer for the canonical identity tables:
 *   users, user_granted_types, creator_profiles,
 *   buyer_accounts, buyer_company_memberships,
 *   companies, company_memberships
 *
 * DUAL MODE (same pattern as `src/lib/entitlement/store.ts`):
 *   Supabase configured → real DB queries.
 *   Supabase not configured → in-memory Maps seeded from
 *     `src/data/users.ts` at module load.
 *
 * This module is the ONLY place identity rows should be
 * read from or written to. UI code, hooks, and server
 * actions must go through the functions exported here.
 */

import { isSupabaseConfigured } from '@/lib/db/client'
import type {
  UserRow,
  UserGrantedTypeRow,
  CreatorProfileRow,
  BuyerAccountRow,
  CompanyRow,
  CompanyMembershipFullRow,
  UserWithFacets,
  UserSeed,
  CreateUserInput,
  UpdateUserCoreInput,
  UpsertCreatorProfileInput,
  UpsertBuyerAccountInput,
  UserType,
  LegalIdentityFacet,
  LegalIdentityDraftPatch,
  LegalIdentityStatusSummary,
  IdentityVerificationStatus,
  IdentitySubjectType,
  StripeVerificationState,
} from './types'

// ══════════════════════════════════════════════
// SUPABASE CLIENT (lazy — matches entitlement/store.ts)
// ══════════════════════════════════════════════

async function db() {
  const { getSupabaseClient } = await import('@/lib/db/client')
  return getSupabaseClient()
}

// ══════════════════════════════════════════════
// IN-MEMORY STORES (dev/test mode)
// ══════════════════════════════════════════════

const userStore = new Map<string, UserRow>()
const grantStore = new Map<string, UserGrantedTypeRow>()
const creatorProfileStore = new Map<string, CreatorProfileRow>() // keyed by user_id
const buyerAccountStore = new Map<string, BuyerAccountRow>() // keyed by user_id
const companyStore = new Map<string, CompanyRow>()
const companyMembershipStore = new Map<string, CompanyMembershipFullRow>()
// Phase D — legal identity facet keyed by user_id. A later
// phase will add a real `legal_identities` migration and swap
// this map for a Supabase accessor via the dual-mode pattern.
const legalIdentityStore = new Map<string, LegalIdentityFacet>()

let _seedLoaded = false

async function ensureSeedLoaded(): Promise<void> {
  if (_seedLoaded) return
  _seedLoaded = true
  // Lazy import to avoid a circular dependency between the store
  // and the seed module (the seed imports adapters / types from
  // this package, and the store reads the seed at first use).
  const { userSeed } = await import('@/data/users')
  for (const seed of userSeed) {
    putUserSeedSync(seed)
  }
}

function putUserSeedSync(seed: UserSeed): void {
  userStore.set(seed.user.id, seed.user)
  for (const g of seed.grants) grantStore.set(g.id, g)
  if (seed.creatorProfile) {
    creatorProfileStore.set(seed.creatorProfile.user_id, seed.creatorProfile)
  }
  if (seed.buyerAccount) {
    buyerAccountStore.set(seed.buyerAccount.user_id, seed.buyerAccount)
  }
  if (seed.ownedCompanies) {
    for (const c of seed.ownedCompanies) companyStore.set(c.id, c)
  }
  if (seed.companyMemberships) {
    for (const m of seed.companyMemberships) companyMembershipStore.set(m.id, m)
  }
}

// ══════════════════════════════════════════════
// ID + TIMESTAMP HELPERS
// ══════════════════════════════════════════════

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Generate a short, readable id for mock-mode rows.
 * Supabase-mode IDs come from `gen_random_uuid()` at the DB.
 */
function mockId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

// ══════════════════════════════════════════════
// READ — users
// ══════════════════════════════════════════════

export async function getUserById(userId: string): Promise<UserRow | null> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return userStore.get(userId) ?? null
  }

  const { data } = await (await db())
    .from('users')
    .select('*')
    .eq('id', userId)
    .limit(1)
    .maybeSingle()

  return (data as UserRow | null) ?? null
}

export async function getUserByUsername(
  username: string,
): Promise<UserRow | null> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    const lower = username.toLowerCase()
    for (const u of userStore.values()) {
      if (u.username === lower) return u
    }
    return null
  }

  const { data } = await (await db())
    .from('users')
    .select('*')
    .eq('username', username.toLowerCase())
    .limit(1)
    .maybeSingle()

  return (data as UserRow | null) ?? null
}

export async function getUserWithFacets(
  userId: string,
): Promise<UserWithFacets | null> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    const user = userStore.get(userId)
    if (!user) return null
    return {
      user,
      grantedTypes: getGrantsForUserMock(userId),
      creatorProfile: creatorProfileStore.get(userId) ?? null,
      buyerAccount: buyerAccountStore.get(userId) ?? null,
      companyMemberships: getCompanyMembershipsForUserMock(userId),
    }
  }

  const user = await getUserById(userId)
  if (!user) return null

  const client = await db()

  const [grantsRes, creatorRes, buyerRes, membershipsRes] = await Promise.all([
    client
      .from('user_granted_types')
      .select('user_type')
      .eq('user_id', userId),
    client
      .from('creator_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('buyer_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('company_memberships')
      .select('*')
      .eq('user_id', userId),
  ])

  const grantedTypes = ((grantsRes.data ?? []) as Array<{ user_type: UserType }>)
    .map((r) => r.user_type)

  return {
    user,
    grantedTypes,
    creatorProfile: (creatorRes.data as CreatorProfileRow | null) ?? null,
    buyerAccount: (buyerRes.data as BuyerAccountRow | null) ?? null,
    companyMemberships:
      ((membershipsRes.data ?? []) as CompanyMembershipFullRow[]) ?? [],
  }
}

// ══════════════════════════════════════════════
// READ — portfolio shell (Option C)
//
// The "portfolio shell" for a creator is a virtual aggregate
// over existing rows, not a dedicated `portfolios` table. It
// is exactly the `UserWithFacets` shape, scoped to users that
// hold a `creator` grant AND have a `creator_profiles` row.
//
// WHY THIS EXISTS
//
// The legacy read path for creator frontfolio pages ran through
// module-load snapshots in `src/data/profiles.ts` and
// `src/data/creator-content.ts` (`profileMap`, `profileById`,
// `creatorBySlug`). Those maps are frozen at the moment the JS
// bundle loads, so any creator written AFTER that point — i.e.
// every user who comes through onboarding — is invisible to
// handle-based lookups and hits the page's 404 branch.
//
// These two readers are the canonical live-read replacements:
//   - `getCreatorPortfolioShellByHandle(handle)` — resolves the
//     public URL segment → user → shell in one call, and is
//     what the frontfolio and creator profile pages should use.
//   - `getCreatorPortfolioShellById(userId)` — same shape, for
//     callers that already hold the canonical user id (e.g. the
//     avatar menu and session-level consumers).
//
// Both return `null` when any of:
//   - no user matches the handle / id
//   - the user does not hold the `creator` grant
//   - the user has no `creator_profiles` row
// …which is the "not a visible creator yet" condition that
// should collapse to a 404 on the public pages.
//
// A later PR can swap this for an Option B `portfolios` table
// without changing any caller: the signature and return type
// are the virtual shell, and a real table would just be a new
// persistence layout behind the same function.
// ══════════════════════════════════════════════

/**
 * Resolve a public handle (username) to the live creator
 * portfolio shell. See the section comment above for the
 * Option C rationale and null semantics.
 */
export async function getCreatorPortfolioShellByHandle(
  handle: string,
): Promise<UserWithFacets | null> {
  const user = await getUserByUsername(handle)
  if (!user) return null
  const shell = await getUserWithFacets(user.id)
  if (!shell) return null
  if (!shell.grantedTypes.includes('creator')) return null
  if (!shell.creatorProfile) return null
  return shell
}

/**
 * Resolve a user id to the live creator portfolio shell.
 * See `getCreatorPortfolioShellByHandle` for the contract —
 * this is the by-id variant for callers that already hold
 * the canonical `users.id`.
 */
export async function getCreatorPortfolioShellById(
  userId: string,
): Promise<UserWithFacets | null> {
  const shell = await getUserWithFacets(userId)
  if (!shell) return null
  if (!shell.grantedTypes.includes('creator')) return null
  if (!shell.creatorProfile) return null
  return shell
}

// ══════════════════════════════════════════════
// READ — grants
// ══════════════════════════════════════════════

export async function getGrantsForUser(userId: string): Promise<UserType[]> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return getGrantsForUserMock(userId)
  }

  const { data } = await (await db())
    .from('user_granted_types')
    .select('user_type')
    .eq('user_id', userId)

  return ((data ?? []) as Array<{ user_type: UserType }>).map((r) => r.user_type)
}

function getGrantsForUserMock(userId: string): UserType[] {
  const out: UserType[] = []
  for (const g of grantStore.values()) {
    if (g.user_id === userId) out.push(g.user_type)
  }
  return out
}

// ══════════════════════════════════════════════
// READ — companies
// ══════════════════════════════════════════════

export async function listCompaniesForUser(
  userId: string,
): Promise<CompanyRow[]> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    const companyIds = new Set<string>()
    for (const m of companyMembershipStore.values()) {
      if (m.user_id === userId && m.status === 'active') {
        companyIds.add(m.company_id)
      }
    }
    const out: CompanyRow[] = []
    for (const id of companyIds) {
      const c = companyStore.get(id)
      if (c) out.push(c)
    }
    return out
  }

  const client = await db()
  const { data: memberRows } = await client
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  const ids = ((memberRows ?? []) as Array<{ company_id: string }>).map(
    (r) => r.company_id,
  )
  if (ids.length === 0) return []

  const { data } = await client
    .from('companies')
    .select('*')
    .in('id', ids)

  return ((data ?? []) as CompanyRow[]) ?? []
}

function getCompanyMembershipsForUserMock(
  userId: string,
): CompanyMembershipFullRow[] {
  const out: CompanyMembershipFullRow[] = []
  for (const m of companyMembershipStore.values()) {
    if (m.user_id === userId) out.push(m)
  }
  return out
}

// ══════════════════════════════════════════════
// WRITE — users
// ══════════════════════════════════════════════

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const username = input.username.toLowerCase()
  const now = nowIso()
  // `input.id` is the seam for onboarding to pass in the
  // Supabase auth user id so that `users.id === auth.users.id`
  // (see migration 9, comment at the top of users table).
  // When absent, mock mode generates a short readable id and
  // the real store lets Postgres default `gen_random_uuid()`.
  const id = input.id ?? mockId('user')

  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    // Enforce the unique constraints the DB would enforce.
    for (const u of userStore.values()) {
      if (u.username === username) {
        throw new Error(`Username '${username}' is already taken`)
      }
      if (u.email === input.email) {
        throw new Error(`Email '${input.email}' is already registered`)
      }
      if (u.id === id) {
        // Defensive — the caller should have adopted this row
        // via `getUserById` before reaching createUser. Throwing
        // here prevents a silent overwrite if the contract is
        // broken elsewhere.
        throw new Error(`User with id '${id}' already exists`)
      }
    }

    const row: UserRow = {
      id,
      username,
      display_name: input.display_name,
      email: input.email,
      avatar_url: input.avatar_url ?? null,
      account_state: 'active',
      founding_member: input.founding_member ?? false,
      created_at: now,
      updated_at: now,
    }
    userStore.set(row.id, row)
    return row
  }

  const { data, error } = await (await db())
    .from('users')
    .insert({
      // Always pass the id explicitly — in real mode this is
      // the Supabase auth user id adopted by the onboarding
      // server action. If the caller omits it, Postgres will
      // fill in gen_random_uuid() via the column default, but
      // that path is no longer used by onboarding.
      ...(input.id !== undefined ? { id: input.id } : {}),
      username,
      display_name: input.display_name,
      email: input.email,
      avatar_url: input.avatar_url ?? null,
      founding_member: input.founding_member ?? false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as UserRow
}

export async function updateUserCore(
  userId: string,
  input: UpdateUserCoreInput,
): Promise<UserRow> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    const existing = userStore.get(userId)
    if (!existing) throw new Error(`User ${userId} not found`)
    const updated: UserRow = {
      ...existing,
      ...(input.display_name !== undefined ? { display_name: input.display_name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.avatar_url !== undefined ? { avatar_url: input.avatar_url } : {}),
      updated_at: nowIso(),
    }
    userStore.set(userId, updated)
    return updated
  }

  const { data, error } = await (await db())
    .from('users')
    .update({
      ...(input.display_name !== undefined ? { display_name: input.display_name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.avatar_url !== undefined ? { avatar_url: input.avatar_url } : {}),
    })
    .eq('id', userId)
    .select('*')
    .single()

  if (error) throw error
  return data as UserRow
}

// ══════════════════════════════════════════════
// WRITE — grants
// ══════════════════════════════════════════════

export async function grantUserType(
  userId: string,
  userType: UserType,
): Promise<UserGrantedTypeRow> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    // Dedupe — schema has UNIQUE(user_id, user_type).
    for (const g of grantStore.values()) {
      if (g.user_id === userId && g.user_type === userType) return g
    }
    const row: UserGrantedTypeRow = {
      id: mockId('grant'),
      user_id: userId,
      user_type: userType,
      granted_at: nowIso(),
    }
    grantStore.set(row.id, row)
    return row
  }

  const { data, error } = await (await db())
    .from('user_granted_types')
    .upsert(
      { user_id: userId, user_type: userType },
      { onConflict: 'user_id,user_type' },
    )
    .select('*')
    .single()

  if (error) throw error
  return data as UserGrantedTypeRow
}

export async function revokeUserType(
  userId: string,
  userType: UserType,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    for (const [id, g] of grantStore.entries()) {
      if (g.user_id === userId && g.user_type === userType) {
        grantStore.delete(id)
      }
    }
    return
  }

  const { error } = await (await db())
    .from('user_granted_types')
    .delete()
    .eq('user_id', userId)
    .eq('user_type', userType)

  if (error) throw error
}

// ══════════════════════════════════════════════
// WRITE — creator_profiles
// ══════════════════════════════════════════════

export async function upsertCreatorProfile(
  input: UpsertCreatorProfileInput,
): Promise<CreatorProfileRow> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    const existing = creatorProfileStore.get(input.user_id)
    const now = nowIso()

    const merged: CreatorProfileRow = {
      id: existing?.id ?? mockId('cprof'),
      user_id: input.user_id,
      professional_title:
        input.professional_title ?? existing?.professional_title ?? null,
      location_base: input.location_base ?? existing?.location_base ?? null,
      website_url: input.website_url ?? existing?.website_url ?? null,
      biography: input.biography ?? existing?.biography ?? null,
      trust_tier: input.trust_tier ?? existing?.trust_tier ?? 'standard',
      trust_badge: input.trust_badge ?? existing?.trust_badge ?? 'verified',
      verification_status:
        input.verification_status ?? existing?.verification_status ?? 'verified',
      last_verified_at:
        input.last_verified_at ?? existing?.last_verified_at ?? null,
      coverage_areas: input.coverage_areas ?? existing?.coverage_areas ?? [],
      specialisations: input.specialisations ?? existing?.specialisations ?? [],
      media_affiliations:
        input.media_affiliations ?? existing?.media_affiliations ?? [],
      press_accreditations:
        input.press_accreditations ?? existing?.press_accreditations ?? [],
      published_in: input.published_in ?? existing?.published_in ?? [],
      skills: input.skills ?? existing?.skills ?? [],
      also_me_links: input.also_me_links ?? existing?.also_me_links ?? [],
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }

    creatorProfileStore.set(input.user_id, merged)
    return merged
  }

  const { data, error } = await (await db())
    .from('creator_profiles')
    .upsert(
      {
        user_id: input.user_id,
        ...(input.professional_title !== undefined
          ? { professional_title: input.professional_title }
          : {}),
        ...(input.location_base !== undefined
          ? { location_base: input.location_base }
          : {}),
        ...(input.website_url !== undefined
          ? { website_url: input.website_url }
          : {}),
        ...(input.biography !== undefined
          ? { biography: input.biography }
          : {}),
        ...(input.trust_tier !== undefined
          ? { trust_tier: input.trust_tier }
          : {}),
        ...(input.trust_badge !== undefined
          ? { trust_badge: input.trust_badge }
          : {}),
        ...(input.verification_status !== undefined
          ? { verification_status: input.verification_status }
          : {}),
        ...(input.last_verified_at !== undefined
          ? { last_verified_at: input.last_verified_at }
          : {}),
        ...(input.coverage_areas !== undefined
          ? { coverage_areas: input.coverage_areas }
          : {}),
        ...(input.specialisations !== undefined
          ? { specialisations: input.specialisations }
          : {}),
        ...(input.media_affiliations !== undefined
          ? { media_affiliations: input.media_affiliations }
          : {}),
        ...(input.press_accreditations !== undefined
          ? { press_accreditations: input.press_accreditations }
          : {}),
        ...(input.published_in !== undefined
          ? { published_in: input.published_in }
          : {}),
        ...(input.skills !== undefined ? { skills: input.skills } : {}),
        ...(input.also_me_links !== undefined
          ? { also_me_links: input.also_me_links }
          : {}),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()

  if (error) throw error
  return data as CreatorProfileRow
}

// ══════════════════════════════════════════════
// WRITE — buyer_accounts
// ══════════════════════════════════════════════

export async function upsertBuyerAccount(
  input: UpsertBuyerAccountInput,
): Promise<BuyerAccountRow> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    const existing = buyerAccountStore.get(input.user_id)
    const row: BuyerAccountRow = {
      id: existing?.id ?? mockId('buyer'),
      user_id: input.user_id,
      buyer_type: input.buyer_type,
      company_name: input.company_name ?? existing?.company_name ?? null,
      vat_number: input.vat_number ?? existing?.vat_number ?? null,
      tax_id: input.tax_id ?? existing?.tax_id ?? null,
      created_at: existing?.created_at ?? nowIso(),
    }
    buyerAccountStore.set(input.user_id, row)
    return row
  }

  const { data, error } = await (await db())
    .from('buyer_accounts')
    .upsert(
      {
        user_id: input.user_id,
        buyer_type: input.buyer_type,
        ...(input.company_name !== undefined
          ? { company_name: input.company_name }
          : {}),
        ...(input.vat_number !== undefined
          ? { vat_number: input.vat_number }
          : {}),
        ...(input.tax_id !== undefined ? { tax_id: input.tax_id } : {}),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()

  if (error) throw error
  return data as BuyerAccountRow
}

// ══════════════════════════════════════════════
// LEGAL IDENTITY — Phase D
//
// Canonical legal identity facet used for trust-sensitive
// actions and as the gate for future Stripe Connect payouts.
//
// Stripe is the default verification provider. Provider-
// specific state lives on `stripe_verification` as nested
// metadata; the canonical status stays app-owned so the UI
// can render without reaching into Stripe's shape.
//
// Phase D.1 keeps this in-memory (next to the other facets).
// A later phase will swap the dual-mode branches over to a
// real `legal_identities` migration using the existing
// `isSupabaseConfigured()` gate.
//
// Payouts-phase plug-in points (for the phase after D.1):
//   - `status === 'verified'` gates `POST /api/payout-methods`.
//   - `stripe_verification.payouts_enabled === true` gates
//     scheduled payout runs.
//   - `stripe_verification.requirements_past_due.length > 0`
//     will suspend payouts until the facet is back in
//     `verified`.
//   - UBO / representative collection attaches as a sibling
//     table (`legal_identity_representatives`) — the single
//     `representative_full_name` / `representative_title`
//     fields here are the minimum viable representative for
//     Stripe Express accounts.
// ══════════════════════════════════════════════

function emptyLegalIdentity(
  userId: string,
  subjectType: IdentitySubjectType,
): LegalIdentityFacet {
  const now = nowIso()
  return {
    id: mockId('legal'),
    user_id: userId,
    subject_type: subjectType,
    status: 'not_started',
    provider: 'none',
    provider_ref: null,
    provider_status: null,
    full_legal_name: null,
    date_of_birth: null,
    country_code: null,
    nationality: null,
    address_line_1: null,
    address_line_2: null,
    city: null,
    region: null,
    postal_code: null,
    company_legal_name: null,
    company_registration_number: null,
    vat_number: null,
    tax_id: null,
    representative_full_name: null,
    representative_title: null,
    submitted_at: null,
    verified_at: null,
    rejected_at: null,
    rejection_reason: null,
    last_reviewed_at: null,
    created_at: now,
    updated_at: now,
    stripe_verification: null,
  }
}

/**
 * Returns the legal identity facet for a user, or `null` if
 * the user has never touched the flow. Callers that want a
 * ready-to-edit draft should follow up with
 * `upsertLegalIdentityDraft`.
 */
export async function getLegalIdentity(
  userId: string,
): Promise<LegalIdentityFacet | null> {
  await ensureSeedLoaded()
  return legalIdentityStore.get(userId) ?? null
}

/**
 * Create or patch a draft legal identity for a user.
 *
 * First call on a user transitions `not_started → draft`.
 * Subsequent draft saves re-apply the patch without
 * advancing status — explicit `submitLegalIdentity` is the
 * only path to `submitted`.
 *
 * Patch semantics: each field in `patch` overwrites the
 * stored value. Fields omitted from the patch are left
 * untouched — there is no implicit clear-to-null.
 */
export async function upsertLegalIdentityDraft(
  userId: string,
  patch: LegalIdentityDraftPatch,
): Promise<LegalIdentityFacet> {
  await ensureSeedLoaded()
  const existing = legalIdentityStore.get(userId)
  const base =
    existing ??
    emptyLegalIdentity(userId, patch.subject_type ?? 'person')

  const merged: LegalIdentityFacet = {
    ...base,
    ...(patch.subject_type !== undefined
      ? { subject_type: patch.subject_type }
      : {}),
    ...(patch.full_legal_name !== undefined
      ? { full_legal_name: patch.full_legal_name }
      : {}),
    ...(patch.date_of_birth !== undefined
      ? { date_of_birth: patch.date_of_birth }
      : {}),
    ...(patch.country_code !== undefined
      ? { country_code: patch.country_code }
      : {}),
    ...(patch.nationality !== undefined
      ? { nationality: patch.nationality }
      : {}),
    ...(patch.address_line_1 !== undefined
      ? { address_line_1: patch.address_line_1 }
      : {}),
    ...(patch.address_line_2 !== undefined
      ? { address_line_2: patch.address_line_2 }
      : {}),
    ...(patch.city !== undefined ? { city: patch.city } : {}),
    ...(patch.region !== undefined ? { region: patch.region } : {}),
    ...(patch.postal_code !== undefined
      ? { postal_code: patch.postal_code }
      : {}),
    ...(patch.company_legal_name !== undefined
      ? { company_legal_name: patch.company_legal_name }
      : {}),
    ...(patch.company_registration_number !== undefined
      ? {
          company_registration_number: patch.company_registration_number,
        }
      : {}),
    ...(patch.vat_number !== undefined
      ? { vat_number: patch.vat_number }
      : {}),
    ...(patch.tax_id !== undefined ? { tax_id: patch.tax_id } : {}),
    ...(patch.representative_full_name !== undefined
      ? { representative_full_name: patch.representative_full_name }
      : {}),
    ...(patch.representative_title !== undefined
      ? { representative_title: patch.representative_title }
      : {}),
    updated_at: nowIso(),
  }

  // not_started → draft on first write; never advance past
  // submitted from this path.
  if (merged.status === 'not_started') merged.status = 'draft'

  legalIdentityStore.set(userId, merged)
  return merged
}

/**
 * Explicit lifecycle transition. Submits the draft to Stripe
 * (the default provider) and advances status:
 *
 *   not_started | draft → submitted
 *
 * Anything already past `draft` is a no-op — callers should
 * re-route users into the drawer in the appropriate state
 * rather than re-submitting silently.
 */
export async function submitLegalIdentity(
  userId: string,
): Promise<LegalIdentityFacet> {
  await ensureSeedLoaded()
  const existing = legalIdentityStore.get(userId)
  if (!existing) {
    throw new Error(
      `legal identity: cannot submit — no draft exists for user ${userId}`,
    )
  }

  if (existing.status !== 'not_started' && existing.status !== 'draft') {
    // Already downstream of submit. Return unchanged.
    return existing
  }

  const now = nowIso()
  const updated: LegalIdentityFacet = {
    ...existing,
    status: 'submitted',
    provider: 'stripe',
    submitted_at: now,
    updated_at: now,
  }
  legalIdentityStore.set(userId, updated)
  return updated
}

/**
 * Attach or update Stripe-specific verification state on the
 * legal identity facet. Called by the `stripe-identity.ts`
 * service after it syncs a Stripe Connect account.
 *
 * Side effect: app-facing status is recomputed from Stripe's
 * requirements arrays, so a single Stripe sync call can
 * transition the facet into `requirements_due`,
 * `needs_resubmission`, `verified`, or `rejected`.
 */
export async function attachStripeVerificationState(
  userId: string,
  stripeStatePatch: Partial<StripeVerificationState>,
): Promise<LegalIdentityFacet> {
  await ensureSeedLoaded()
  const existing = legalIdentityStore.get(userId)
  if (!existing) {
    throw new Error(
      `legal identity: cannot attach Stripe state — facet missing for user ${userId}`,
    )
  }

  const merged: StripeVerificationState = {
    // Defaults for a fresh Stripe connection
    connected_account_id:
      existing.stripe_verification?.connected_account_id ??
      stripeStatePatch.connected_account_id ??
      '',
    person_id: existing.stripe_verification?.person_id ?? null,
    account_type: existing.stripe_verification?.account_type ?? null,
    business_type: existing.stripe_verification?.business_type ?? null,
    charges_enabled: existing.stripe_verification?.charges_enabled ?? null,
    payouts_enabled: existing.stripe_verification?.payouts_enabled ?? null,
    details_submitted: existing.stripe_verification?.details_submitted ?? null,
    requirements_currently_due:
      existing.stripe_verification?.requirements_currently_due ?? [],
    requirements_eventually_due:
      existing.stripe_verification?.requirements_eventually_due ?? [],
    requirements_past_due:
      existing.stripe_verification?.requirements_past_due ?? [],
    requirements_pending_verification:
      existing.stripe_verification?.requirements_pending_verification ?? [],
    disabled_reason: existing.stripe_verification?.disabled_reason ?? null,
    last_synced_at: existing.stripe_verification?.last_synced_at ?? null,
    ...stripeStatePatch,
  }

  const now = nowIso()
  const nextStatus = normalizeStripeToAppStatus(existing.status, merged)

  const updated: LegalIdentityFacet = {
    ...existing,
    provider: 'stripe',
    provider_ref: merged.connected_account_id || existing.provider_ref,
    provider_status: merged.disabled_reason ?? existing.provider_status,
    status: nextStatus,
    stripe_verification: merged,
    last_reviewed_at: now,
    updated_at: now,
    ...(nextStatus === 'verified' && existing.verified_at === null
      ? { verified_at: now }
      : {}),
    ...(nextStatus === 'rejected' && existing.rejected_at === null
      ? { rejected_at: now, rejection_reason: merged.disabled_reason }
      : {}),
  }
  legalIdentityStore.set(userId, updated)
  return updated
}

/**
 * Normalize Stripe's three-bucket requirements model plus
 * the `charges_enabled` / `payouts_enabled` / `disabled_reason`
 * signals into one of our app-facing statuses.
 *
 * Rules, evaluated top-to-bottom (first match wins):
 *   1. disabled_reason set        → rejected
 *   2. past_due requirements      → needs_resubmission
 *   3. currently_due requirements → requirements_due
 *   4. charges_enabled === true   → verified
 *      && details_submitted === true
 *   5. pending_verification       → in_review
 *   6. fall back to current       (no change)
 *
 * This is the normalization layer that lets the rest of the
 * app ignore Stripe's shape entirely.
 */
function normalizeStripeToAppStatus(
  current: IdentityVerificationStatus,
  stripe: StripeVerificationState,
): IdentityVerificationStatus {
  if (stripe.disabled_reason) return 'rejected'
  if (stripe.requirements_past_due.length > 0) return 'needs_resubmission'
  if (stripe.requirements_currently_due.length > 0) return 'requirements_due'
  if (stripe.charges_enabled === true && stripe.details_submitted === true) {
    return 'verified'
  }
  if (stripe.requirements_pending_verification.length > 0) return 'in_review'
  return current
}

const IDENTITY_STATUS_LABEL: Record<IdentityVerificationStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft saved',
  submitted: 'Submitted',
  requirements_due: 'More information needed',
  in_review: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
  needs_resubmission: 'Action required',
}

const IDENTITY_NEXT_ACTION: Record<IdentityVerificationStatus, string> = {
  not_started: 'Start verification',
  draft: 'Continue',
  submitted: 'Review',
  requirements_due: 'Resolve requirements',
  in_review: 'Review',
  verified: 'View',
  rejected: 'Contact support',
  needs_resubmission: 'Resolve requirements',
}

/**
 * Build the UX-facing summary from the canonical facet plus
 * any Stripe state. UI code should prefer this over reading
 * the raw facet — it means the provider normalization lives
 * in one place.
 */
export async function getLegalIdentityStatusSummary(
  userId: string,
): Promise<LegalIdentityStatusSummary> {
  const facet = await getLegalIdentity(userId)

  if (!facet) {
    return {
      status: 'not_started',
      subjectType: null,
      provider: 'none',
      displayName: '—',
      isVerified: false,
      canSubmit: false,
      requiresAttention: false,
      statusLabel: IDENTITY_STATUS_LABEL.not_started,
      nextActionLabel: IDENTITY_NEXT_ACTION.not_started,
      hasStripeConnection: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    }
  }

  const stripe = facet.stripe_verification
  const status = facet.status

  const displayName =
    facet.subject_type === 'company'
      ? facet.company_legal_name ?? facet.full_legal_name ?? '—'
      : facet.full_legal_name ?? '—'

  const canSubmit =
    (status === 'draft' || status === 'not_started') &&
    // Minimum viable submit: full name + country code.
    // Stripe will enforce richer requirements via its own
    // requirements arrays once the account syncs.
    (facet.subject_type === 'person'
      ? !!facet.full_legal_name && !!facet.country_code
      : !!facet.company_legal_name && !!facet.country_code)

  const requiresAttention =
    status === 'requirements_due' ||
    status === 'needs_resubmission' ||
    status === 'rejected'

  return {
    status,
    subjectType: facet.subject_type,
    provider: facet.provider,
    displayName,
    isVerified: status === 'verified',
    canSubmit,
    requiresAttention,
    statusLabel: IDENTITY_STATUS_LABEL[status],
    nextActionLabel: IDENTITY_NEXT_ACTION[status],
    hasStripeConnection: !!stripe?.connected_account_id,
    chargesEnabled: stripe?.charges_enabled === true,
    payoutsEnabled: stripe?.payouts_enabled === true,
  }
}

// ══════════════════════════════════════════════
// STORE MANAGEMENT (test + explicit seeding)
// ══════════════════════════════════════════════

/** Insert or overwrite a user seed in the in-memory store. */
export function putUserSeed(seed: UserSeed): void {
  putUserSeedSync(seed)
  _seedLoaded = true
}

/** Reset the in-memory store. Test-only. */
export function _resetStore(): void {
  userStore.clear()
  grantStore.clear()
  creatorProfileStore.clear()
  buyerAccountStore.clear()
  companyStore.clear()
  companyMembershipStore.clear()
  legalIdentityStore.clear()
  _seedLoaded = false
}
