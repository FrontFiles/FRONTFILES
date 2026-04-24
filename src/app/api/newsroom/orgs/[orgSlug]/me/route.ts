// ═══════════════════════════════════════════════════════════════
// Frontfiles — GET /api/newsroom/orgs/[orgSlug]/me  (NR-D5b-i, F1c)
//
// Small helper endpoint that backs the <AdminGate> client wrapper
// (F1b). The RLS helper `is_newsroom_admin(company_id)` resolves
// under `auth.uid()`, which is only populated in a request carrying
// the user's Bearer token — so the only clean way for the browser
// to ask "am I an admin of this org?" is to post the token to a
// server endpoint that validates it and runs the membership lookup.
//
// Response:
//   200 { ok: true,  isAdmin: boolean, role: string | null }
//   401 { ok: false, error: 'Authentication required.' }
//   404 { ok: false, error: 'Not found.' }           — company absent
//   404 { ok: false, error: 'Feature not enabled.' } — flag off
//   500 { ok: false, error: 'Something went wrong.' }
//
// The endpoint does NOT return details of the user beyond the
// admin-ness for THIS org. Membership rows for other orgs are
// outside its read surface.
//
// Bearer pattern identical to /api/newsroom/start (NR-D5a) and
// /api/auth/ensure-actor-handle — see those for the carrier-only
// service-role rationale (the service-role client is used purely
// to call `auth.getUser(token)`; all membership reads go through
// the same service-role client because the lookup is a simple
// filtered read, but an RLS-scoped user-JWT client would work too).
//
// Runtime: explicit `'nodejs'` (IP-E, ratified). Not strictly
// required — Next 16 defaults API routes to Node when they import
// server-only modules — but declaring it is cheap and signals the
// invariant for future readers.
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const ROUTE = 'GET /api/newsroom/orgs/[orgSlug]/me'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export async function GET(
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
      '[newsroom.me] companies lookup failed',
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
      '[newsroom.me] membership lookup failed',
    )
    return NextResponse.json(
      { ok: false, error: 'Something went wrong.' },
      { status: 500 },
    )
  }

  const role = (membership?.role as string | undefined) ?? null
  const isAdmin =
    membership?.role === 'admin' && membership?.status === 'active'

  return NextResponse.json(
    { ok: true, isAdmin, role },
    { status: 200 },
  )
}
