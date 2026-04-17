// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Creator Profile Dataset (derived)
//
// This file used to carry 24 hand-written `CreatorProfile`
// constants that duplicated fields already present in
// `data/creators.ts`. That drift is eliminated in Phase A:
// the single source of truth is now `data/users.ts`, and
// this module derives the `CreatorProfile` and `BuyerAccount`
// aggregate shapes at module-load time.
//
// The exported API surface (`creatorProfiles`, `buyers`,
// `profileMap`, `profileById`, `getCreatorProfile`,
// `getCreatorProfileById`) is preserved so all downstream
// consumers (creator page, frontfolio page, asset cards,
// search, social) keep working unchanged.
// ═══════════════════════════════════════════════════════════════

import type {
  CreatorProfile,
  BuyerAccount,
  LicenceType,
} from '../lib/types'
import type {
  UserSeed,
  CreatorProfileRow,
  UserWithFacets,
} from '@/lib/identity/types'
import { userSeed } from './users'
import { assets } from './assets'
import { stories } from './stories'
import { articles } from './articles'
import { collections } from './collections'

// ── Stats computation (module-load) ──────────────────────────

const _assetCounts: Record<string, number> = {}
for (const a of assets) {
  _assetCounts[a.creatorId] = (_assetCounts[a.creatorId] ?? 0) + 1
}

const _storyCounts: Record<string, number> = {}
for (const s of stories) {
  _storyCounts[s.creatorId] = (_storyCounts[s.creatorId] ?? 0) + 1
}

const _articleCounts: Record<string, number> = {}
for (const a of articles) {
  for (const cid of a.sourceCreatorIds) {
    _articleCounts[cid] = (_articleCounts[cid] ?? 0) + 1
  }
}

const _collectionCounts: Record<string, number> = {}
for (const c of collections) {
  for (const cid of c.creatorIds) {
    _collectionCounts[cid] = (_collectionCounts[cid] ?? 0) + 1
  }
}

function _stats(creatorId: string) {
  return {
    totalAssets: _assetCounts[creatorId] ?? 0,
    totalStories: _storyCounts[creatorId] ?? 0,
    totalArticles: _articleCounts[creatorId] ?? 0,
    totalCollections: _collectionCounts[creatorId] ?? 0,
  }
}

// ── Licensing defaults (non-DB display metadata) ──────────────
//
// The canonical `creator_profiles` row does not carry licensing
// availability or price-band labels; those are prototype display
// fields. This map preserves the values that used to live
// inline in the old `_pXXX` constants.

interface LicensingInfo {
  available: boolean
  licenceTypes: LicenceType[]
  priceBandLabel: string | null
}

const _licensingById: Record<string, LicensingInfo> = {
  'creator-001': { available: true, licenceTypes: ['editorial', 'commercial'], priceBandLabel: '$' },
  'creator-002': { available: true, licenceTypes: ['editorial', 'commercial'], priceBandLabel: '$' },
  'creator-003': { available: true, licenceTypes: ['editorial'], priceBandLabel: '$' },
  'creator-004': { available: true, licenceTypes: ['editorial', 'commercial'], priceBandLabel: '$' },
  'creator-005': { available: true, licenceTypes: ['editorial', 'commercial', 'broadcast'], priceBandLabel: '$$' },
  'creator-006': { available: true, licenceTypes: ['editorial', 'commercial'], priceBandLabel: '$' },
  'creator-007': { available: true, licenceTypes: ['editorial'], priceBandLabel: '$' },
  'creator-008': { available: true, licenceTypes: ['editorial', 'commercial'], priceBandLabel: '$' },
  'creator-009': { available: true, licenceTypes: ['editorial'], priceBandLabel: '$' },
  'creator-010': { available: true, licenceTypes: ['editorial', 'commercial', 'broadcast'], priceBandLabel: '$$' },
  'creator-011': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-012': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-013': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-014': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-015': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-016': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-017': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-018': { available: false, licenceTypes: [], priceBandLabel: '$' },
  'creator-019': { available: true, licenceTypes: ['editorial', 'broadcast'], priceBandLabel: '$' },
  'creator-020': { available: true, licenceTypes: ['editorial'], priceBandLabel: '$' },
  'creator-021': { available: true, licenceTypes: ['editorial'], priceBandLabel: '$' },
  'creator-022': { available: true, licenceTypes: ['editorial', 'broadcast'], priceBandLabel: '$$' },
  'creator-023': { available: true, licenceTypes: ['editorial'], priceBandLabel: '$' },
  'creator-024': { available: true, licenceTypes: ['editorial', 'broadcast'], priceBandLabel: '$$' },
}

// ── Adapter: UserSeed → CreatorProfile ────────────────────────

function toCreatorProfile(seed: UserSeed): CreatorProfile | null {
  const row: CreatorProfileRow | undefined = seed.creatorProfile
  if (!row) return null
  const userId = seed.user.id
  return {
    username: seed.user.username,
    displayName: seed.user.display_name,
    professionalTitle: row.professional_title ?? '',
    locationBase: row.location_base ?? '',
    websiteUrl: row.website_url,
    biography: row.biography ?? '',
    avatarUrl: seed.user.avatar_url,
    trustTier: row.trust_tier,
    trustBadge: row.trust_badge,
    verificationStatus: row.verification_status,
    lastVerifiedAt: row.last_verified_at ?? '',
    foundingMember: seed.user.founding_member,
    coverageAreas: row.coverage_areas,
    specialisations: row.specialisations,
    mediaAffiliations: row.media_affiliations,
    pressAccreditations: row.press_accreditations,
    publishedIn: row.published_in,
    skills: row.skills,
    alsoMeLinks: row.also_me_links,
    stats: _stats(userId),
    licensing: _licensingById[userId] ?? {
      available: false,
      licenceTypes: [],
      priceBandLabel: null,
    },
  }
}

// ── Adapter: UserWithFacets → CreatorProfile (live read path) ─
//
// This is the bridge the creator profile + frontfolio pages use
// to render live `UserWithFacets` shells (from the identity
// store) via the existing `CreatorProfile` UI shape. It is the
// same field-for-field mapping as `toCreatorProfile(seed)`, but
// reads from the canonical row types instead of a module-load
// `UserSeed`, which means newly-onboarded creators become
// visible as soon as their `creator_profiles` row lands — the
// bug this PR fixes.
//
// `stats` and `licensing` are display-only prototype fields
// not stored in canonical rows:
//
//   - `stats` is computed from the same module-load content
//     counters (`_assetCounts`, `_storyCounts`, …) as the
//     legacy path. That is still correct here because content
//     fixtures have not moved — a newly-onboarded creator
//     simply has zero counts across the board, which is the
//     right answer.
//   - `licensing` falls back to a safe "unavailable" default
//     for user ids that are missing from `_licensingById`
//     (which today covers only the 24 seeded creators).
//
// Returns `null` when the shell has no `creator_profiles` row.
// Pages should treat that as "not a visible creator" and
// render their existing 404 branch — the store-side reader
// `getCreatorPortfolioShellByHandle` already filters out that
// case, so this null is a belt-and-braces guard.

/**
 * Build a `CreatorProfile` from a live `UserWithFacets` shell.
 * See the block comment above for field mapping, the
 * null-return contract, and the prototype `stats` / `licensing`
 * fallback behaviour.
 */
export function buildCreatorProfileFromShell(
  shell: UserWithFacets,
): CreatorProfile | null {
  const row = shell.creatorProfile
  if (!row) return null
  const userId = shell.user.id
  return {
    username: shell.user.username,
    displayName: shell.user.display_name,
    professionalTitle: row.professional_title ?? '',
    locationBase: row.location_base ?? '',
    websiteUrl: row.website_url,
    biography: row.biography ?? '',
    avatarUrl: shell.user.avatar_url,
    trustTier: row.trust_tier,
    trustBadge: row.trust_badge,
    verificationStatus: row.verification_status,
    lastVerifiedAt: row.last_verified_at ?? '',
    foundingMember: shell.user.founding_member,
    coverageAreas: row.coverage_areas,
    specialisations: row.specialisations,
    mediaAffiliations: row.media_affiliations,
    pressAccreditations: row.press_accreditations,
    publishedIn: row.published_in,
    skills: row.skills,
    alsoMeLinks: row.also_me_links,
    stats: _stats(userId),
    licensing: _licensingById[userId] ?? {
      available: false,
      licenceTypes: [],
      priceBandLabel: null,
    },
  }
}

// ════════════════════════════════════════════════════════════════
// Creator Profiles (derived, ordered to match legacy profiles.ts)
// ════════════════════════════════════════════════════════════════

/**
 * Ordered list of creator profiles, derived from the canonical
 * `userSeed`. The order is: founding members (001–010),
 * then non-founding full profiles (019–024), then sparse
 * profiles (011–018) — matching the legacy ordering so
 * spotlight and discovery rendering remains identical.
 */
export const creatorProfiles: CreatorProfile[] = (() => {
  const order = [
    'creator-001',
    'creator-002',
    'creator-003',
    'creator-004',
    'creator-005',
    'creator-006',
    'creator-007',
    'creator-008',
    'creator-009',
    'creator-010',
    'creator-019',
    'creator-020',
    'creator-021',
    'creator-022',
    'creator-023',
    'creator-024',
    'creator-011',
    'creator-012',
    'creator-013',
    'creator-014',
    'creator-015',
    'creator-016',
    'creator-017',
    'creator-018',
  ]
  const byId: Record<string, CreatorProfile> = {}
  for (const seed of userSeed) {
    const p = toCreatorProfile(seed)
    if (p) byId[seed.user.id] = p
  }
  return order.map((id) => byId[id]).filter((p): p is CreatorProfile => !!p)
})()

// ════════════════════════════════════════════════════════════════
// Buyer Accounts (derived from userSeed buyer facets)
//
// The legacy `BuyerAccount` type carries flat display_name +
// email fields that canonically live on `users`. This adapter
// joins them back together for backward compatibility.
// ════════════════════════════════════════════════════════════════

function toBuyerAccount(seed: UserSeed): BuyerAccount | null {
  const ba = seed.buyerAccount
  if (!ba) return null
  return {
    id: seed.user.id,
    type: ba.buyer_type,
    displayName: seed.user.display_name,
    email: seed.user.email,
    companyName: ba.company_name,
    vatNumber: ba.vat_number,
    state: seed.user.account_state,
    // Legacy `role` field — not in the canonical buyer_accounts
    // table. Defaulted to 'content_commit_holder' for the two
    // seeded buyers to preserve the old fixture behaviour.
    role: 'content_commit_holder',
    lightboxes: [],
    savedSearchCount: 0,
  }
}

export const buyers: BuyerAccount[] = userSeed
  .map(toBuyerAccount)
  .filter((b): b is BuyerAccount => !!b)

// ════════════════════════════════════════════════════════════════
// Lookup helpers (API preserved)
// ════════════════════════════════════════════════════════════════

/** Keyed by username (= creator slug) */
export const profileMap: Record<string, CreatorProfile> = Object.fromEntries(
  creatorProfiles.map((p) => [p.username, p]),
)

/** Keyed by creator ID (e.g. 'creator-001') */
export const profileById: Record<string, CreatorProfile> = (() => {
  const map: Record<string, CreatorProfile> = {}
  for (const seed of userSeed) {
    const p = seed.creatorProfile ? profileMap[seed.user.username] : null
    if (p) map[seed.user.id] = p
  }
  return map
})()

/**
 * Look up a profile by handle (username / slug).
 *
 * @deprecated Reads a module-load snapshot and is invisible to
 * users created after the bundle loaded (every user who comes
 * through onboarding). Use
 * `getCreatorPortfolioShellByHandle(handle)` from
 * `@/lib/identity/store` plus `buildCreatorProfileFromShell`
 * in new code. This export is retained only for the handful of
 * legacy consumers that still read it synchronously during
 * render; all of them must migrate off it.
 */
export function getCreatorProfile(handle: string): CreatorProfile | undefined {
  return profileMap[handle]
}

/**
 * Look up a profile by creator ID (e.g. 'creator-001').
 *
 * @deprecated See `getCreatorProfile` — same module-load
 * snapshot limitation, same replacement path. Use
 * `getCreatorPortfolioShellById(userId)` from
 * `@/lib/identity/store` plus `buildCreatorProfileFromShell`.
 */
export function getCreatorProfileById(id: string): CreatorProfile | undefined {
  return profileById[id]
}
