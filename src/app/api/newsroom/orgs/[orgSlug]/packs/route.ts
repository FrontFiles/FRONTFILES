// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/newsroom/orgs/[orgSlug]/packs  (NR-D6b, F5)
//
// Creates a new draft Pack. Auth + admin-membership + tier gate +
// zod-validated body + slug uniqueness pre-check + service-role
// INSERT, returning the inserted row.
//
// Service-role posture: getSupabaseClient() bypasses RLS for the
// INSERT. The auth context (supabase.auth.getUser(token)) is used
// only for caller identity (→ created_by_user_id) and the
// membership-table check. IP-3 ratified: direct membership query
// with role === 'admin' (not the RPC; not editor-widening). The
// RLS policy is the floor — the route is the policy enforcer.
//
// Tier gate: PRD §3.4 invariant 2 — `verification_tier =
// unverified` cannot create Packs. Defense in depth alongside
// F1's page-level tier gate.
//
// Slug uniqueness: pre-check via SELECT before INSERT. The DB
// also enforces `newsroom_packs_slug_unique UNIQUE (company_id,
// slug)` so a race between two concurrent INSERTs falls into a
// 500 with a Postgres unique-violation. The pre-check converts
// the common case to a clean 409 user-facing error.
//
// Response shape:
//   201 { ok: true,  pack }
//   400 { ok: false, reason: 'invalid-body' | 'validation', errors? }
//   401 { ok: false, reason: 'unauthenticated' }
//   403 { ok: false, reason: 'forbidden' | 'unverified' }
//   404 { ok: false, reason: 'not-found' | 'feature-disabled' }
//   409 { ok: false, reason: 'slug-conflict' }
//   500 { ok: false, reason: 'internal' }
//
// Spec cross-references:
//   - directives/NR-D6b-pack-creation-details-tab.md §F5
//   - sibling routes: dns-txt/issue (NR-D5b-i F8), email/send-otp
//     (NR-D5b-ii F9) — same auth/admin pattern
//   - src/lib/newsroom/pack-form.ts (createPackSchema)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'
import { createPackSchema } from '@/lib/newsroom/pack-form'

export const runtime = 'nodejs'

const ROUTE = 'POST /api/newsroom/orgs/[orgSlug]/packs'

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
      '[newsroom.packs.create] companies lookup failed',
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

  // ── admin gate (direct membership query, admin-only — IP-3) ──
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
      '[newsroom.packs.create] membership lookup failed',
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

  // ── tier gate (PRD §3.4 invariant 2) ─────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('newsroom_profiles')
    .select('verification_tier')
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
        '[newsroom.packs.create] profile lookup failed',
      )
    }
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (profile.verification_tier === 'unverified') {
    return NextResponse.json(
      { ok: false, reason: 'unverified' },
      { status: 403 },
    )
  }

  // ── zod validation ───────────────────────────────────────────
  const parsed = createPackSchema.safeParse(rawBody)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || '_root'
      if (!errors[path]) errors[path] = issue.message
    }
    return NextResponse.json(
      { ok: false, reason: 'validation', errors },
      { status: 400 },
    )
  }
  const data = parsed.data

  // ── slug uniqueness pre-check ────────────────────────────────
  const { data: existing, error: existingError } = await supabase
    .from('newsroom_packs')
    .select('id')
    .eq('company_id', companyId)
    .eq('slug', data.slug)
    .maybeSingle()
  if (existingError) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        rawCode: existingError.code,
        rawMessage: existingError.message,
      },
      '[newsroom.packs.create] slug uniqueness check failed',
    )
    return NextResponse.json(
      { ok: false, reason: 'internal' },
      { status: 500 },
    )
  }
  if (existing) {
    return NextResponse.json(
      { ok: false, reason: 'slug-conflict' },
      { status: 409 },
    )
  }

  // ── INSERT ───────────────────────────────────────────────────
  // status / visibility default to 'draft' / 'private' per the
  // newsroom_packs migration. created_at / updated_at are also
  // DB defaults; we don't set them here.
  const { data: pack, error: insertError } = await supabase
    .from('newsroom_packs')
    .insert({
      company_id: companyId,
      slug: data.slug,
      title: data.title,
      subtitle: data.subtitle ?? null,
      description: data.description,
      credit_line: data.credit_line,
      licence_class: data.licence_class,
      created_by_user_id: authUserId,
    })
    .select()
    .single()
  if (insertError || !pack) {
    logger.error(
      {
        route: ROUTE,
        companyId,
        authUserId,
        rawCode: insertError?.code,
        rawMessage: insertError?.message,
      },
      '[newsroom.packs.create] insert failed',
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
      packId: (pack as { id: string }).id,
      slug: data.slug,
    },
    '[newsroom.packs.create] pack created',
  )
  return NextResponse.json({ ok: true, pack }, { status: 201 })
}
