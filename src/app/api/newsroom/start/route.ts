// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/start  (NR-D5a, F3)
//
// Newsroom P1 signup endpoint. Provisions a Newsroom organisation
// from a signed-in Frontfiles user by writing three rows:
//
//   1. companies            — the org (name, slug, legal_name,
//                              country_code, created_by_user_id)
//   2. newsroom_profiles    — 1:1 extension with primary_domain;
//                              verification_tier defaults to
//                              'unverified' (PRD §5.1 P1: Pack
//                              creation blocked until
//                              verified_source, enforced at NR-D6)
//   3. company_memberships  — role='admin', status='active',
//                              invited_by = creator, activated_at
//                              = now()
//
// Returns:
//   200 { ok: true, orgSlug }                      — success
//   400 { ok: false, error, fieldErrors? }         — invalid input
//   401 { ok: false, error }                       — not signed in
//   404 { ok: false, error: 'Feature not enabled' } — flag off
//   409 { ok: false, error }                       — verified org
//                                                    already claims
//                                                    the domain
//   500 { ok: false, error }                       — internal
//
// ─── Why a route handler, not a server action (NR-D5a IP-2) ────
//
// The codebase's session lives in localStorage via
// `src/lib/supabase/browser.ts` and travels to the server as a
// Bearer token on explicit fetches. Server actions receive only
// FormData — no automatic access to the user's JWT — so an
// actions-file approach would have to either smuggle the token
// through a hidden form field (unusual for this codebase) or
// reinvent the Bearer pattern on a different plane. The house
// convention established by `POST /api/auth/ensure-actor-handle`
// is Bearer + `auth.getUser(token)` validation; this handler
// follows the same discipline. Locked with the founder during
// pre-composition HALT (see exit report §Decisions).
//
// ─── Why SERVICE-ROLE for the 3-row provisioning ────────────────
//
// The `newsroom_profiles` INSERT policy requires
// `is_newsroom_admin(company_id)` (migration 20260425000001 L582),
// which queries `company_memberships`. At the moment we'd insert
// the profile, the membership row doesn't exist yet — so under
// RLS the three inserts are chicken-and-egg and the flow is
// structurally impossible without a bootstrap seam. Service-role
// is the clean one; the token is validated via
// `supabase.auth.getUser(token)` BEFORE any write runs, so rows
// are always pinned to a real, currently-authenticated auth user.
//
// ─── Atomicity caveat ──────────────────────────────────────────
//
// supabase-js v2 does not expose SQL transactions from the Node
// client. A truly atomic 3-row create would need a
// SECURITY DEFINER function in a new migration, which NR-D5a's
// out-of-scope list forbids ("NO edits to supabase/**"). The
// handler therefore does serial inserts with best-effort
// compensating DELETEs on downstream failure. Any residual
// orphaned company (e.g. process killed between statements) is
// harmless — the random slug suffix prevents re-collision, and
// no downstream code currently treats company-without-profile /
// company-without-membership as legitimate state.
// Flagged as open question for a future directive (NR-D5b or
// later) to wrap this in an RPC function.
//
// ─── Spec cross-references ─────────────────────────────────────
//
//   - docs/public-newsroom/PRD.md §5.1 P1 (validation + post-
//     action semantics: set verification_tier=unverified; redirect
//     to P2 which is stub-served at /{orgSlug}/manage in NR-D5a)
//   - docs/public-newsroom/BUILD_CHARTER.md §4 (primitive-reuse:
//     Newsroom Organisation = companies + newsroom_profiles 1:1;
//     Newsroom admin = company_memberships role='admin')
//   - docs/public-newsroom/directives/NR-D5a-p1-signup.md §F3
//   - src/app/api/auth/ensure-actor-handle/route.ts (pattern)
// ═══════════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'

import { SignupSchema } from '@/app/newsroom/start/schema'

const ROUTE = 'POST /api/newsroom/start'
const MAX_SLUG_RETRIES = 3

// companies.slug_format (migration 20260413230015 L126) — every
// slug we pass to Postgres MUST satisfy this regex or the CHECK
// constraint rejects the INSERT.
const SLUG_FORMAT = /^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/

type SuccessBody = { ok: true; orgSlug: string }
type ErrorBody = {
  ok: false
  error: string
  fieldErrors?: Record<string, string>
}

// ─── Helpers ──────────────────────────────────────────────────

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

function errorResponse(
  httpStatus: number,
  body: ErrorBody,
): NextResponse {
  return NextResponse.json(body, { status: httpStatus })
}

/**
 * Six base36 characters of entropy (~31 bits). `randomBytes(4)`
 * gives a uniformly-distributed uint32; `.toString(36)` is at
 * most 7 chars (log36(2^32) ≈ 6.19), at least 1. Slice-then-pad
 * normalises every output to exactly 6 chars.
 */
function randomSuffix(): string {
  const n = randomBytes(4).readUInt32BE(0)
  return n.toString(36).slice(0, 6).padStart(6, '0')
}

/**
 * Normalise an organisation name to a slug base (no suffix):
 *   - NFKD + lowercase
 *   - non-alphanumeric runs → '-'
 *   - collapse consecutive '-' (redundant after the +-quantified
 *     replace above but kept for defence-in-depth)
 *   - trim leading/trailing '-'
 *   - truncate to 60 chars
 *
 * Returns 'org' when the input normalises to an empty string, so
 * the downstream suffix step always has a valid prefix.
 */
function slugifyBase(orgName: string): string {
  const normalised = orgName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return normalised || 'org'
}

/**
 * Attach a 6-char base36 suffix to the base slug, leaving room for
 * a joining hyphen. Falls back to 'org-{suffix}' if the candidate
 * somehow fails the DDL-side CHECK. Returns an empty string only
 * if even the fallback cannot pass — treated as a bug at the call
 * site.
 */
function withSuffix(base: string): string {
  const suffix = randomSuffix()
  const room = 60 - 1 - suffix.length
  const trimmed = base.slice(0, room) || 'org'
  const candidate = `${trimmed}-${suffix}`
  if (SLUG_FORMAT.test(candidate)) return candidate
  const rescued = `org-${suffix}`
  return SLUG_FORMAT.test(rescued) ? rescued : ''
}

// ─── Handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Flag gate. Consistent with every other auth-fronted route
  //    in this codebase — a 404 when the feature is off keeps the
  //    surface area invisible in unwired environments.
  if (!isAuthWired()) {
    return errorResponse(404, {
      ok: false,
      error: 'Feature not enabled.',
    })
  }

  // 2. Bearer extract. Mirrors src/lib/auth/require-actor.ts.
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return errorResponse(401, {
      ok: false,
      error: 'You need to be signed in to create a newsroom.',
    })
  }

  // 3. JSON body parse. Malformed body surfaces as 400 rather
  //    than throwing out to Next's default error handler.
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return errorResponse(400, { ok: false, error: 'Invalid request body.' })
  }

  // 4. Zod validation. Field-level errors are surfaced back to
  //    the client for inline display; the client form already
  //    performs the same .safeParse as a UX hint, but the server
  //    is the authoritative validation layer.
  const parsed = SignupSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = typeof issue.path[0] === 'string' ? issue.path[0] : ''
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return errorResponse(400, {
      ok: false,
      error: 'Invalid input',
      fieldErrors,
    })
  }

  const { orgName, legalName, primaryDomain, countryCode } = parsed.data

  // 5. Validate token → auth user id. The service-role client
  //    acts purely as the carrier for `auth.getUser(token)`;
  //    the token argument short-circuits the session path, so
  //    the key only authorises the verify call. Same shape as
  //    /api/auth/ensure-actor-handle and requireActor.
  const supabase = getSupabaseClient()
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return errorResponse(401, {
      ok: false,
      error: 'You need to be signed in to create a newsroom.',
    })
  }
  const authUserId = userData.user.id

  // 6. Three-row provisioning. Slug collisions retry with a fresh
  //    suffix (astronomically unlikely at 6 base36 chars, but the
  //    directive calls for defence-in-depth). After the company
  //    row lands, profile + membership are written serially with
  //    compensating DELETEs on downstream failure — not truly
  //    atomic, but the best we can do from supabase-js without a
  //    SECURITY DEFINER function (see module header).
  const base = slugifyBase(orgName)
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = withSuffix(base)
    if (!slug) {
      logger.error(
        { route: ROUTE, authUserId, orgName, base },
        '[newsroom.start] slug generation failed format check',
      )
      return errorResponse(500, {
        ok: false,
        error: 'Something went wrong.',
      })
    }

    // ── companies ──────────────────────────────────────────────
    const { data: companyRow, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: orgName,
        slug,
        legal_name: legalName,
        country_code: countryCode,
        created_by_user_id: authUserId,
      })
      .select('id, slug')
      .single()

    if (companyError) {
      // 23505 = unique_violation; retry with a fresh suffix.
      if (companyError.code === '23505') {
        continue
      }
      logger.error(
        {
          route: ROUTE,
          authUserId,
          rawCode: companyError.code,
          rawMessage: companyError.message,
        },
        '[newsroom.start] companies insert failed',
      )
      return errorResponse(500, {
        ok: false,
        error: 'Something went wrong.',
      })
    }

    const companyId = companyRow.id as string
    const orgSlug = companyRow.slug as string

    // ── newsroom_profiles ──────────────────────────────────────
    // verification_tier defaults to 'unverified' per the DDL; we
    // do not set it explicitly to avoid drift if the default ever
    // changes.
    const { error: profileError } = await supabase
      .from('newsroom_profiles')
      .insert({
        company_id: companyId,
        primary_domain: primaryDomain,
      })

    if (profileError) {
      // Rollback: remove the orphaned company. Service-role
      // bypasses RLS, so the DELETE succeeds regardless of
      // membership state.
      const { error: rollbackError } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId)
      if (rollbackError) {
        logger.error(
          {
            route: ROUTE,
            authUserId,
            companyId,
            rawCode: rollbackError.code,
            rawMessage: rollbackError.message,
          },
          '[newsroom.start] orphaned company rollback failed',
        )
      }

      // 23505 on newsroom_profiles fires only via the partial
      // unique index on primary_domain WHERE verification_tier !=
      // 'unverified' — structurally impossible for a brand-new
      // 'unverified' row, but surface the PRD-mandated copy just
      // in case an admin has pre-promoted a profile out-of-band.
      if (profileError.code === '23505') {
        return errorResponse(409, {
          ok: false,
          error:
            'This domain is already registered by a verified organisation.',
        })
      }

      logger.error(
        {
          route: ROUTE,
          authUserId,
          companyId,
          rawCode: profileError.code,
          rawMessage: profileError.message,
        },
        '[newsroom.start] newsroom_profiles insert failed',
      )
      return errorResponse(500, {
        ok: false,
        error: 'Something went wrong.',
      })
    }

    // ── company_memberships ────────────────────────────────────
    // status='active' triggers the cm_active_needs_ts CHECK (L207
    // of migration 20260413230015), so activated_at must be set.
    const now = new Date().toISOString()
    const { error: membershipError } = await supabase
      .from('company_memberships')
      .insert({
        company_id: companyId,
        user_id: authUserId,
        role: 'admin',
        status: 'active',
        invited_by: authUserId,
        activated_at: now,
      })

    if (membershipError) {
      // Rollback: remove the profile then the company. Order
      // matters because newsroom_profiles.company_id is ON DELETE
      // RESTRICT — the company DELETE would fail if the profile
      // is still attached.
      const { error: profileRollbackError } = await supabase
        .from('newsroom_profiles')
        .delete()
        .eq('company_id', companyId)
      if (profileRollbackError) {
        logger.error(
          {
            route: ROUTE,
            authUserId,
            companyId,
            rawCode: profileRollbackError.code,
            rawMessage: profileRollbackError.message,
          },
          '[newsroom.start] orphaned profile rollback failed',
        )
      }
      const { error: companyRollbackError } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId)
      if (companyRollbackError) {
        logger.error(
          {
            route: ROUTE,
            authUserId,
            companyId,
            rawCode: companyRollbackError.code,
            rawMessage: companyRollbackError.message,
          },
          '[newsroom.start] orphaned company rollback failed',
        )
      }

      logger.error(
        {
          route: ROUTE,
          authUserId,
          companyId,
          rawCode: membershipError.code,
          rawMessage: membershipError.message,
        },
        '[newsroom.start] company_memberships insert failed',
      )
      return errorResponse(500, {
        ok: false,
        error: 'Something went wrong.',
      })
    }

    logger.info(
      { route: ROUTE, authUserId, companyId, orgSlug },
      '[newsroom.start] ok',
    )
    return NextResponse.json<SuccessBody>(
      { ok: true, orgSlug },
      { status: 200 },
    )
  }

  logger.error(
    { route: ROUTE, authUserId, orgName },
    '[newsroom.start] exhausted slug retries',
  )
  return errorResponse(500, {
    ok: false,
    error: 'Could not allocate a unique slug, please retry.',
  })
}
