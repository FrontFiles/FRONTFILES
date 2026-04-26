// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/verifications/
//              dns-txt/recheck    (NR-D5b-i, F9)
//
// Resolves TXT records on the company's primary_domain, compares to
// the expected `frontfiles-verify=<token>` value, and on match:
//
//   1. INSERTs a row into newsroom_verification_records (method =
//      'dns_txt', value_checked = the token, verified_at = now(),
//      expires_at = NULL — non-expiring for v1).
//   2. Calls recomputeTier() to re-derive the company's tier and
//      persist any change. Recompute failure is swallowed with a
//      log line (the verification record is authoritative; the
//      tier is derived state, not core semantic).
//
// Runtime: explicit `'nodejs'` — `node:dns/promises` is a Node-only
// stdlib API; the Edge runtime does not expose DNS resolution.
//
// Response shape:
//   200 { ok: true,  verified_at }
//   200 { ok: false, reason: 'not-found' | 'value-mismatch' | 'dns-error' }
//   401 { ok: false, reason: 'unauthenticated' }
//   403 { ok: false, reason: 'forbidden' }
//   404 { ok: false, reason: 'not-found'    }  — company absent
//   404 { ok: false, reason: 'feature-disabled' }
//   500 { ok: false, reason: 'internal' }
//
// `reason: 'dns-error'` returns HTTP 200 so the client can handle
// it as an error SHAPE rather than a transport failure — same
// shape the UI uses for 'not-found' (both → the "Wait 10 minutes"
// copy in dns-txt-card.tsx). This mirrors how `/api/newsroom/start`
// surfaces business-validation errors as 200 + structured payload.
//
// Admin gate: caller must be an active admin of the org (same
// gate as F8). Route handlers are callable directly even if the UI
// is gated.
//
// No unique constraint exists on (company_id, method) in
// newsroom_verification_records — INSERT a fresh row each recheck.
// The `active records` query in F3 / recomputeTier tolerates
// duplicates by semantics (method set is idempotent).
//
// Spec cross-references:
//   - NR-D5b-i directive §F9
//   - supabase/migrations/20260425000001_newsroom_schema_foundation.sql
//     §3 (newsroom_verification_records — service-role-only writes)
//   - src/lib/newsroom/verification.ts (F10) — deriveDnsTxtToken,
//     expectedDnsTxtRecord, recomputeTier
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { resolveTxt } from 'node:dns/promises'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import {
  deriveDnsTxtToken,
  expectedDnsTxtRecord,
  recomputeTier,
} from '@/lib/newsroom/verification'

export const runtime = 'nodejs'

const ROUTE =
  'POST /api/newsroom/orgs/[orgSlug]/verifications/dns-txt/recheck'
const TXT_PREFIX = 'frontfiles-verify='

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string }> },
): Promise<NextResponse> {
  if (!isAuthWired()) {
    return NextResponse.json(
      { ok: false, reason: 'feature-disabled' },
      { status: 404 },
    )
  }

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }

  const { orgSlug } = await context.params
  const supabase = getSupabaseClient()

  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }
  const authUserId = userData.user.id

  // ── company lookup ───────────────────────────────────────────
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (companyError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: companyError.code,
        rawMessage: companyError.message,
      },
      '[newsroom.dns-txt.recheck] companies lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!company) {
    return NextResponse.json(
      { ok: false, reason: 'not-found' },
      { status: 404 },
    )
  }
  const companyId = company.id as string

  // ── admin gate ───────────────────────────────────────────────
  const { data: membership, error: membershipError } = await supabase
    .from('company_memberships')
    .select('role, status')
    .eq('company_id', companyId)
    .eq('user_id', authUserId)
    .maybeSingle()
  if (membershipError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: membershipError.code,
        rawMessage: membershipError.message,
      },
      '[newsroom.dns-txt.recheck] membership lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (
    !membership ||
    membership.role !== 'admin' ||
    membership.status !== 'active'
  ) {
    return NextResponse.json(
      { ok: false, reason: 'forbidden' },
      { status: 403 },
    )
  }

  // ── resolve primary_domain ───────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('newsroom_profiles')
    .select('primary_domain')
    .eq('company_id', companyId)
    .maybeSingle()
  if (profileError || !profile) {
    if (profileError) {
      logger.error(
        {
          route: ROUTE,
          rawCode: profileError.code,
          rawMessage: profileError.message,
        },
        '[newsroom.dns-txt.recheck] profile lookup failed',
      )
    }
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  const primaryDomain = profile.primary_domain as string

  // ── expected record ──────────────────────────────────────────
  const expectedToken = deriveDnsTxtToken(companyId)
  const { recordValue: expectedRecord } = expectedDnsTxtRecord(
    companyId,
    primaryDomain,
  )

  // ── DNS TXT lookup ───────────────────────────────────────────
  let chunks: string[][]
  try {
    chunks = await resolveTxt(primaryDomain)
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'DNS error'
    logger.info(
      { route: ROUTE, companyId, primaryDomain, rawMessage },
      '[newsroom.dns-txt.recheck] dns lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'dns-error' },
      { status: 200 },
    )
  }

  // resolveTxt returns string[][] — each TXT record is an array of
  // string fragments to be concatenated (DNS TXT records over 255
  // chars are split into fragments at the protocol layer).
  const values = chunks.map((c) => c.join(''))
  if (!values.includes(expectedRecord)) {
    const hasPrefixOnly = values.some((v) => v.startsWith(TXT_PREFIX))
    return NextResponse.json(
      {
        ok: false,
        reason: hasPrefixOnly ? 'value-mismatch' : 'not-found',
      },
      { status: 200 },
    )
  }

  // ── persist verification record ──────────────────────────────
  const verifiedAt = new Date().toISOString()
  const { error: insertError } = await supabase
    .from('newsroom_verification_records')
    .insert({
      company_id: companyId,
      method: 'dns_txt',
      value_checked: expectedToken,
      verified_at: verifiedAt,
      expires_at: null,
    })
  if (insertError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: insertError.code,
        rawMessage: insertError.message,
      },
      '[newsroom.dns-txt.recheck] insert failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── recompute tier (best-effort) ─────────────────────────────
  try {
    const { before, after } = await recomputeTier(supabase, companyId)
    logger.info(
      { route: ROUTE, companyId, before, after },
      '[newsroom.dns-txt.recheck] tier recomputed',
    )
  } catch (err) {
    const rawMessage =
      err instanceof Error ? err.message : String(err)
    logger.error(
      { route: ROUTE, companyId, rawMessage },
      '[newsroom.dns-txt.recheck] tier recompute failed',
    )
    // Fall through — the verification record is already persisted;
    // the next successful recheck (of any method) will re-derive
    // the tier.
  }

  logger.info(
    { route: ROUTE, companyId, authUserId },
    '[newsroom.dns-txt.recheck] verified',
  )
  return NextResponse.json(
    { ok: true, verified_at: verifiedAt },
    { status: 200 },
  )
}
