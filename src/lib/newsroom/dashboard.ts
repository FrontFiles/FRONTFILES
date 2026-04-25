// ═══════════════════════════════════════════════════════════════
// Frontfiles — Newsroom dashboard helpers (NR-D6a, F8)
//
// Three pure helpers driving the P5 distributor dashboard:
//
//   1. deriveBannerState({tier, records, now})
//      Returns the banner state per PRD §5.2 P5:
//        - 'unverified' wins when tier is unverified
//        - 'expiring' when any record's expires_at is within 30 days
//        - 'revoked' is shaped but unreachable from this input shape
//          (placeholder for a future revoked_at column)
//        - 'none' otherwise
//
//   2. canCreatePack(tier)
//      PRD §3.4 invariant 2: only verified tiers can create Packs.
//
//   3. parseFilterParams(params)
//      Validates URL search params against the schema enum types
//      and silently drops invalid values (the form re-renders
//      without them; the SQL query treats undefined as "no filter").
//
// Pure: no I/O, no env reads, no service-role client. Tests in
// F9 inject `now` for deterministic time math.
//
// recomputeTier (verification.ts) is intentionally NOT invoked
// here — the dashboard reads the already-persisted
// verification_tier from newsroom_profiles. recomputeTier is the
// write-path equivalent invoked by NR-D5b-i / NR-D5b-ii's verify
// routes; the dashboard is the read-path consumer.
//
// Spec cross-references:
//   - PRD.md §3.4 invariant 2 (unverified cannot create Packs)
//   - PRD.md §5.2 P5 (banner state derivation, filters)
//   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F8
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import type {
  NewsroomLicenceClass,
  NewsroomPackStatus,
  NewsroomVerificationMethod,
  NewsroomVerificationTier,
} from '@/lib/db/schema'
import { LICENCE_CLASSES } from '@/lib/newsroom/licence-classes'

// ── Banner state ──

export type BannerState = 'unverified' | 'expiring' | 'revoked' | 'none'

export interface VerificationRecordSnapshot {
  method: NewsroomVerificationMethod
  verified_at: string
  expires_at: string | null
}

export interface DeriveBannerInput {
  tier: NewsroomVerificationTier
  records: ReadonlyArray<VerificationRecordSnapshot>
  /**
   * Reference time for "expires within 30 days" math. Injected
   * here (rather than `new Date()` inside the helper) so unit
   * tests in F9 can run deterministically across timezones.
   */
  now: Date
}

export interface BannerOutput {
  state: BannerState
  method?: NewsroomVerificationMethod
  expiresAt?: string
}

const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Derives the verification banner state per PRD §5.2 P5.
 *
 * Precedence:
 *   1. tier === 'unverified'  → always 'unverified'
 *   2. any active record with expires_at < now + 30d → 'expiring'
 *      (returns the soonest expiring record's method + date)
 *   3. otherwise → 'none'
 *
 * The 'revoked' state is not reachable from the current schema
 * (no revoked_at column on newsroom_verification_records). The
 * type union supports it for the eventual landing of revocation
 * (likely NR-D17 admin surface) without breaking the F4 banner
 * component. Documented as a known limitation.
 */
export function deriveBannerState(input: DeriveBannerInput): BannerOutput {
  if (input.tier === 'unverified') {
    return { state: 'unverified' }
  }

  const cutoff = input.now.getTime() + EXPIRY_WINDOW_MS

  let soonest: VerificationRecordSnapshot | null = null
  let soonestMs = Number.POSITIVE_INFINITY
  for (const r of input.records) {
    if (r.expires_at === null) continue
    const expMs = new Date(r.expires_at).getTime()
    if (Number.isNaN(expMs)) continue
    if (expMs < cutoff && expMs < soonestMs) {
      soonest = r
      soonestMs = expMs
    }
  }

  if (soonest) {
    return {
      state: 'expiring',
      method: soonest.method,
      expiresAt: soonest.expires_at!,
    }
  }

  return { state: 'none' }
}

// ── CTA gate ──

/**
 * Whether the org can create new Packs.
 *
 * PRD §3.4 invariant 2: unverified orgs cannot create Packs. The
 * disabled-state CTA in F3 surfaces a tooltip prompting the user
 * to complete verification first.
 *
 * Future: a `revoked` flag on the profile (or a derived state from
 * revocation records) should also flip this to false. Today the
 * only reliable signal is tier itself.
 */
export function canCreatePack(tier: NewsroomVerificationTier): boolean {
  return tier !== 'unverified'
}

// ── Filter parsing ──

export interface ParsedFilters {
  status?: NewsroomPackStatus
  licence?: NewsroomLicenceClass
  /** YYYY-MM-DD; format-validated, not range-checked. */
  from?: string
  to?: string
}

const PACK_STATUS_VALUES: ReadonlyArray<NewsroomPackStatus> = [
  'draft',
  'scheduled',
  'published',
  'archived',
  'takedown',
]

const PACK_STATUS_SET: ReadonlySet<string> = new Set(PACK_STATUS_VALUES)

const LICENCE_CLASS_SET: ReadonlySet<string> = new Set(
  Object.keys(LICENCE_CLASSES),
)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parses URL search params into a typed filter object.
 *
 * Invalid values (unknown enum members, malformed dates) silently
 * drop to undefined. The form in F6 re-renders without them and
 * the SQL query in F2 treats undefined as "no filter applied".
 * This mirrors the codebase's standard search-param posture
 * (see src/app/search/page.tsx for the same shape).
 *
 * Empty strings are treated as "no value". Whitespace is trimmed.
 */
export function parseFilterParams(
  params: Record<string, string | undefined>,
): ParsedFilters {
  const out: ParsedFilters = {}

  const status = params.status?.trim()
  if (status && PACK_STATUS_SET.has(status)) {
    out.status = status as NewsroomPackStatus
  }

  const licence = params.licence?.trim()
  if (licence && LICENCE_CLASS_SET.has(licence)) {
    out.licence = licence as NewsroomLicenceClass
  }

  const from = params.from?.trim()
  if (from && ISO_DATE.test(from)) {
    out.from = from
  }

  const to = params.to?.trim()
  if (to && ISO_DATE.test(to)) {
    out.to = to
  }

  return out
}
