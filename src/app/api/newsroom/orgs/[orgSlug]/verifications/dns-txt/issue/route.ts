// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/verifications/
//              dns-txt/issue     (NR-D5b-i, F8)
//
// Returns the deterministic DNS TXT challenge token for the caller's
// org. No DB write — tokens are HMAC-derived from (company_id,
// secret) so re-issuance is idempotent by construction.
//
// Response:
//   200 { token, recordName, recordValue }
//   401 { ok: false, error: 'Authentication required.' }
//   403 { ok: false, error: 'Forbidden.' }
//   404 { ok: false, error: 'Feature not enabled.' } — flag off
//   404 { ok: false, error: 'Not found.' }           — company absent
//   500 { ok: false, error: 'Something went wrong.' }
//
// Admin gate: caller must be an active admin of the org's company.
// (The /manage layout already gates the UI path, but route handlers
// are callable directly — re-gate at the route boundary.)
//
// Runtime: explicit `'nodejs'` (IP-E, ratified). Consistent with
// F9 which genuinely needs Node for `node:dns/promises`.
//
// Spec cross-references:
//   - NR-D5b-i directive §F8
//   - src/app/api/newsroom/start/route.ts (pattern — auth +
//     service-role carrier + company/membership lookup)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import {
  deriveDnsTxtToken,
  expectedDnsTxtRecord,
} from '@/lib/newsroom/verification'

export const runtime = 'nodejs'

const ROUTE =
  'POST /api/newsroom/orgs/[orgSlug]/verifications/dns-txt/issue'

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
      { ok: false, error: 'Feature not enabled.' },
      { status: 404 },
    )
  }

  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required.' },
      { status: 401 },
    )
  }

  const { orgSlug } = await context.params
  const supabase = getSupabaseClient()

  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required.' },
      { status: 401 },
    )
  }
  const authUserId = userData.user.id

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
      '[newsroom.dns-txt.issue] companies lookup failed',
    )
    return NextResponse.json(
      { ok: false, error: 'Something went wrong.' },
      { status: 500 },
    )
  }
  if (!company) {
    return NextResponse.json(
      { ok: false, error: 'Not found.' },
      { status: 404 },
    )
  }

  const { data: membership, error: membershipError } = await supabase
    .from('company_memberships')
    .select('role, status')
    .eq('company_id', company.id)
    .eq('user_id', authUserId)
    .maybeSingle()
  if (membershipError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: membershipError.code,
        rawMessage: membershipError.message,
      },
      '[newsroom.dns-txt.issue] membership lookup failed',
    )
    return NextResponse.json(
      { ok: false, error: 'Something went wrong.' },
      { status: 500 },
    )
  }
  if (
    !membership ||
    membership.role !== 'admin' ||
    membership.status !== 'active'
  ) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden.' },
      { status: 403 },
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('newsroom_profiles')
    .select('primary_domain')
    .eq('company_id', company.id)
    .maybeSingle()
  if (profileError) {
    logger.error(
      {
        route: ROUTE,
        rawCode: profileError.code,
        rawMessage: profileError.message,
      },
      '[newsroom.dns-txt.issue] profile lookup failed',
    )
    return NextResponse.json(
      { ok: false, error: 'Something went wrong.' },
      { status: 500 },
    )
  }
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: 'Newsroom profile not found.' },
      { status: 404 },
    )
  }

  const companyId = company.id as string
  const primaryDomain = profile.primary_domain as string

  const token = deriveDnsTxtToken(companyId)
  const { recordName, recordValue } = expectedDnsTxtRecord(
    companyId,
    primaryDomain,
  )

  return NextResponse.json(
    { token, recordName, recordValue },
    { status: 200 },
  )
}
