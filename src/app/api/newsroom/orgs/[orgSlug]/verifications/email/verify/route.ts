// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/verifications/
//              email/verify          (NR-D5b-ii, F10)
//
// Verifies a 6-digit OTP previously issued by send-otp. On match:
//
//   1. Marks the OTP row consumed_at = now() to prevent re-use.
//   2. INSERTs a row into newsroom_verification_records (method
//      = 'domain_email', value_checked = the email,
//      verified_at = now(), expires_at = NULL — non-expiring
//      for v1).
//   3. Calls recomputeTier() to derive the company's tier and
//      persist any change. THIS IS WHERE TIER PROMOTION FIRES
//      FOR THE FIRST TIME on Frontfiles: a company that has both
//      an active dns_txt record and an active domain_email
//      record now resolves to verified_source. Recompute
//      failure is swallowed with a log line (the verification
//      record is authoritative; tier is derived state).
//
// On mismatch: increments attempts. At attempts >= 5, marks
// consumed_at = now() to invalidate the row, forcing the user
// to request a fresh code.
//
// Plaintext code is consumed in-memory only — never logged
// (security parity with send-otp).
//
// Runtime: explicit `'nodejs'` (NR-D5b-i precedent).
//
// Response shape:
//   200 { ok: true,  verified_at }
//   400 { ok: false, reason: 'invalid-body' }
//   400 { ok: false, reason: 'no-active-otp' }
//   400 { ok: false, reason: 'expired' }
//   400 { ok: false, reason: 'too-many-attempts' }
//   400 { ok: false, reason: 'wrong-code', attemptsRemaining }
//   401 { ok: false, reason: 'unauthenticated' }
//   403 { ok: false, reason: 'forbidden' }
//   404 { ok: false, reason: 'not-found' }
//   404 { ok: false, reason: 'feature-disabled' }
//   500 { ok: false, reason: 'internal' }
//
// Spec cross-references:
//   - directives/NR-D5b-ii-domain-email-otp.md §F10
//   - sibling: send-otp/route.ts (sister route)
//   - dns-txt/recheck/route.ts (precedent for recomputeTier
//     swallow-on-error + verification_record INSERT pattern)
//   - src/lib/newsroom/verification.ts (F4 helpers, F11
//     recomputeTier from NR-D5b-i)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import {
  recomputeTier,
  verifyOtpCode,
} from '@/lib/newsroom/verification'

export const runtime = 'nodejs'

const ROUTE =
  'POST /api/newsroom/orgs/[orgSlug]/verifications/email/verify'
const ATTEMPTS_CAP = 5

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

  // ── body parse ───────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }
  const { email: emailInput, code: codeInput } = rawBody as {
    email?: unknown
    code?: unknown
  }
  if (
    typeof emailInput !== 'string' ||
    emailInput.length === 0 ||
    typeof codeInput !== 'string' ||
    codeInput.length === 0
  ) {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }
  const email = emailInput.trim().toLowerCase()
  const code = codeInput.trim()

  const supabase = getSupabaseClient()

  // ── auth ─────────────────────────────────────────────────────
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
      '[newsroom.email.verify] companies lookup failed',
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
      '[newsroom.email.verify] membership lookup failed',
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

  // ── load latest active OTP ───────────────────────────────────
  const { data: otpRow, error: otpError } = await supabase
    .from('newsroom_email_otps')
    .select('id, code_hash, attempts, expires_at')
    .eq('company_id', companyId)
    .eq('email', email)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (otpError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: otpError.code,
        rawMessage: otpError.message,
      },
      '[newsroom.email.verify] otp lookup failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (!otpRow) {
    return NextResponse.json(
      { ok: false, reason: 'no-active-otp' },
      { status: 400 },
    )
  }

  const otpId = otpRow.id as string
  const codeHash = otpRow.code_hash as string
  const attempts = otpRow.attempts as number
  const expiresAtIso = otpRow.expires_at as string

  // ── expiry check ─────────────────────────────────────────────
  if (new Date(expiresAtIso).getTime() <= Date.now()) {
    // Mark consumed so the row doesn't keep returning from
    // the active-OTP query on subsequent verify attempts.
    await supabase
      .from('newsroom_email_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otpId)
    return NextResponse.json(
      { ok: false, reason: 'expired' },
      { status: 400 },
    )
  }

  // ── attempts cap ─────────────────────────────────────────────
  if (attempts >= ATTEMPTS_CAP) {
    await supabase
      .from('newsroom_email_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otpId)
    return NextResponse.json(
      { ok: false, reason: 'too-many-attempts' },
      { status: 400 },
    )
  }

  // ── verify code ──────────────────────────────────────────────
  if (!verifyOtpCode(code, codeHash)) {
    const newAttempts = attempts + 1
    const shouldInvalidate = newAttempts >= ATTEMPTS_CAP
    const updatePayload: {
      attempts: number
      consumed_at?: string
    } = { attempts: newAttempts }
    if (shouldInvalidate) {
      updatePayload.consumed_at = new Date().toISOString()
    }
    const { error: updateError } = await supabase
      .from('newsroom_email_otps')
      .update(updatePayload)
      .eq('id', otpId)
    if (updateError) {
      logger.error(
        {
          route: ROUTE,
          companyId,
          rawCode: updateError.code,
          rawMessage: updateError.message,
        },
        '[newsroom.email.verify] attempts update failed',
      )
      return NextResponse.json(
        { ok: false, reason: 'internal' },
        { status: 500 },
      )
    }
    return NextResponse.json(
      {
        ok: false,
        reason: shouldInvalidate ? 'too-many-attempts' : 'wrong-code',
        attemptsRemaining: Math.max(0, ATTEMPTS_CAP - newAttempts),
      },
      { status: 400 },
    )
  }

  // ── success: consume OTP ─────────────────────────────────────
  const verifiedAt = new Date().toISOString()
  const { error: consumeError } = await supabase
    .from('newsroom_email_otps')
    .update({ consumed_at: verifiedAt })
    .eq('id', otpId)
  if (consumeError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: consumeError.code,
        rawMessage: consumeError.message,
      },
      '[newsroom.email.verify] consume failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── persist verification record ──────────────────────────────
  const { error: insertError } = await supabase
    .from('newsroom_verification_records')
    .insert({
      company_id: companyId,
      method: 'domain_email',
      value_checked: email,
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
      '[newsroom.email.verify] insert verification_record failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── recompute tier (best-effort; tier-promotion fires here) ──
  // First time on Frontfiles: when both dns_txt and
  // domain_email records are active, computeTier returns
  // 'verified_source' and recomputeTier UPDATEs the
  // newsroom_profiles row.
  try {
    const { before, after } = await recomputeTier(supabase, companyId)
    logger.info(
      { route: ROUTE, companyId, before, after },
      '[newsroom.email.verify] tier recomputed',
    )
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err)
    logger.error(
      { route: ROUTE, companyId, rawMessage },
      '[newsroom.email.verify] tier recompute failed',
    )
    // Fall through — verification record is persisted; the
    // next successful recheck of any method will re-derive
    // the tier (matches NR-D5b-i recheck route's posture).
  }

  logger.info(
    { route: ROUTE, companyId, authUserId },
    '[newsroom.email.verify] verified',
  )
  return NextResponse.json(
    { ok: true, verified_at: verifiedAt },
    { status: 200 },
  )
}
