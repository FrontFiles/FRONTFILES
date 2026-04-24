/**
 * Frontfiles — Newsroom P2 verification dashboard (NR-D5b-i, F3)
 *
 * Server component at `/{orgSlug}/manage/verification`. Fetches the
 * newsroom profile (verification_tier, primary_domain) and the
 * company's active verification records, then hands both to
 * <VerificationShell /> which owns the interactive surface.
 *
 * Gate is enforced by the parent <AdminGate /> in F1 (client-side).
 * Per IP-B (ratified 2026-04-24) the SSR payload contains tier +
 * value_checked tokens before the gate fires; the security analysis
 * classified those as public-equivalent (tokens are DNS-record
 * challenges, tier is public on the org page).
 *
 * "Active" means `expires_at IS NULL OR expires_at > now()` — the
 * same posture recomputeTier uses when it derives the tier. The
 * filter runs here in TS (rather than in SQL) because the index on
 * newsroom_verification_records uses a composite (company_id,
 * method, expires_at) instead of a partial predicate (NR-D1
 * migration noted PostgreSQL rejects now() in partial predicates
 * as non-IMMUTABLE).
 *
 * Spec cross-references:
 *   - PRD §5.1 P2 (verification-dashboard layout)
 *   - NR-D5b-i directive §F3
 */

import { notFound } from 'next/navigation'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomVerificationRecordRow,
  NewsroomVerificationTier,
} from '@/lib/db/schema'

import { VerificationShell } from './_components/verification-shell'

export default async function NewsroomVerificationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = getSupabaseClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (!company) notFound()

  const { data: profile } = await supabase
    .from('newsroom_profiles')
    .select('verification_tier, primary_domain')
    .eq('company_id', company.id)
    .maybeSingle()
  if (!profile) notFound()

  const { data: records } = await supabase
    .from('newsroom_verification_records')
    .select('*')
    .eq('company_id', company.id)
    .order('verified_at', { ascending: false })

  const nowIso = new Date().toISOString()
  const activeRecords: NewsroomVerificationRecordRow[] = (
    (records ?? []) as NewsroomVerificationRecordRow[]
  ).filter((r) => r.expires_at === null || r.expires_at > nowIso)

  const tier = profile.verification_tier as NewsroomVerificationTier
  const primaryDomain = profile.primary_domain as string

  return (
    <main>
      <h1>Verification status</h1>
      <VerificationShell
        tier={tier}
        records={activeRecords}
        orgSlug={orgSlug}
        primaryDomain={primaryDomain}
      />
    </main>
  )
}
