// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/verifications/
//              email/send-otp        (NR-D5b-ii, F9)
//
// Issues a fresh 6-digit OTP for the second verification method
// (domain email). On success:
//
//   1. Validates the submitted email is at the company's
//      primary_domain (case-insensitive).
//   2. Invalidates any prior unconsumed OTP for the same
//      (company_id, email) by setting consumed_at = now().
//   3. INSERTs a new newsroom_email_otps row with the hashed
//      code, expires_at = now() + 10 minutes, and attempts = 0.
//   4. Sends the plaintext code to the user via Resend (mock-
//      mode in dev when RESEND_API_KEY_TRANSACTIONAL absent —
//      the helper still writes the audit_log row).
//
// Plaintext OTP is NEVER stored, NEVER logged, and NEVER
// returned in the API response. It exists in memory only long
// enough to (a) hash for storage, and (b) embed in the email
// body. After the route returns, the only way to recover it is
// from the email itself.
//
// Runtime: explicit `'nodejs'` (NR-D5b-i precedent). The Resend
// SDK and node:crypto are both Node-only.
//
// Response shape:
//   200 { ok: true,  expiresAt }
//   400 { ok: false, reason: 'invalid-body' }
//   400 { ok: false, reason: 'invalid-format' }
//   400 { ok: false, reason: 'wrong-domain' }
//   401 { ok: false, reason: 'unauthenticated' }
//   403 { ok: false, reason: 'forbidden' }
//   404 { ok: false, reason: 'not-found' }     — company absent
//   404 { ok: false, reason: 'feature-disabled' }
//   500 { ok: false, reason: 'internal' }
//
// Spec cross-references:
//   - directives/NR-D5b-ii-domain-email-otp.md §F9
//   - sibling: dns-txt/issue/route.ts (auth + admin-gate
//     pattern), dns-txt/recheck/route.ts (route-level error
//     shape)
//   - src/lib/email/send.ts (sendTransactionalEmail helper)
//   - src/lib/email/templates/newsroom-domain-otp.ts (F11)
//   - src/lib/newsroom/verification.ts (F4 helpers)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { sendTransactionalEmail } from '@/lib/email/send'
import { buildNewsroomDomainOtpEmail } from '@/lib/email/templates/newsroom-domain-otp'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import {
  generateOtpCode,
  hashOtpCode,
} from '@/lib/newsroom/verification'

export const runtime = 'nodejs'

const ROUTE =
  'POST /api/newsroom/orgs/[orgSlug]/verifications/email/send-otp'
const TEMPLATE_ID = 'newsroom-domain-otp'
const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const OTP_TTL_MINUTES = 10
// Mirrors the server CHECK constraint
// (newsroom_email_otps_email_format) and the F6 client regex.
const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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
  const emailInput =
    rawBody && typeof rawBody === 'object' && 'email' in rawBody
      ? (rawBody as { email: unknown }).email
      : undefined
  if (typeof emailInput !== 'string' || emailInput.length === 0) {
    return NextResponse.json(
      { ok: false, reason: 'invalid-body' },
      { status: 400 },
    )
  }
  const email = emailInput.trim().toLowerCase()
  if (!EMAIL_FORMAT.test(email)) {
    return NextResponse.json(
      { ok: false, reason: 'invalid-format' },
      { status: 400 },
    )
  }

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
      '[newsroom.email.send-otp] companies lookup failed',
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
      '[newsroom.email.send-otp] membership lookup failed',
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

  // ── primary_domain lookup ────────────────────────────────────
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
        '[newsroom.email.send-otp] profile lookup failed',
      )
    }
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  const primaryDomain = (profile.primary_domain as string).toLowerCase()

  // ── domain match (case-insensitive) ──────────────────────────
  const at = email.lastIndexOf('@')
  const domainOfEmail = at >= 0 ? email.slice(at + 1) : ''
  if (domainOfEmail !== primaryDomain) {
    return NextResponse.json(
      { ok: false, reason: 'wrong-domain' },
      { status: 400 },
    )
  }

  // ── invalidate prior unconsumed OTPs for (company, email) ────
  // D5: at most one active OTP per (company, email). Setting
  // consumed_at on prior rows prevents two valid codes from
  // existing simultaneously when the user requests a resend.
  const nowIso = new Date().toISOString()
  const { error: invalidateError } = await supabase
    .from('newsroom_email_otps')
    .update({ consumed_at: nowIso })
    .eq('company_id', companyId)
    .eq('email', email)
    .is('consumed_at', null)
  if (invalidateError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: invalidateError.code,
        rawMessage: invalidateError.message,
      },
      '[newsroom.email.send-otp] invalidate-prior failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── issue new OTP ────────────────────────────────────────────
  const code = generateOtpCode()
  const codeHash = hashOtpCode(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

  const { error: insertError } = await supabase
    .from('newsroom_email_otps')
    .insert({
      company_id: companyId,
      email,
      code_hash: codeHash,
      attempts: 0,
      expires_at: expiresAt,
    })
  if (insertError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: insertError.code,
        rawMessage: insertError.message,
      },
      '[newsroom.email.send-otp] insert failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  // ── send the email ───────────────────────────────────────────
  // Phishing-resistance note: the template intentionally
  // contains no clickable links — the OTP is the only action
  // the recipient takes.
  const { subject, html, text } = buildNewsroomDomainOtpEmail({
    code,
    primaryDomain,
    expiresInMinutes: OTP_TTL_MINUTES,
  })
  const sendResult = await sendTransactionalEmail({
    to: email,
    templateId: TEMPLATE_ID,
    subject,
    html,
    text,
    actorId: authUserId,
    tags: { method: 'domain_email', org: orgSlug },
  })
  if (!sendResult.ok) {
    // The OTP row is already persisted but the email didn't
    // ship. Mark the row consumed so the user can request a
    // fresh code without colliding with a phantom unconsumed
    // row. Best-effort — we still surface the 500 either way.
    await supabase
      .from('newsroom_email_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('email', email)
      .is('consumed_at', null)
    logger.error(
      {
        route: ROUTE,
        companyId,
        sendError: sendResult.error,
      },
      '[newsroom.email.send-otp] resend failed; OTP invalidated',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }

  logger.info(
    {
      route: ROUTE,
      companyId,
      authUserId,
      mocked: sendResult.mocked,
      messageId: sendResult.messageId,
    },
    '[newsroom.email.send-otp] otp issued',
  )
  return NextResponse.json(
    { ok: true, expiresAt },
    { status: 200 },
  )
}
