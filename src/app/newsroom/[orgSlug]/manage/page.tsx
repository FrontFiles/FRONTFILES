/**
 * Frontfiles — Newsroom manage landing (NR-D5b-i, F2 — edits F5 stub)
 *
 * Post-signup landing. Auth gate is enforced by the parent
 * layout's <AdminGate> (F1). Real distributor dashboard (PRD §5.2
 * P5) ships in NR-D6.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getSupabaseClient } from '@/lib/db/client'
import type { NewsroomVerificationTier } from '@/lib/db/schema'

const TIER_LABELS: Record<NewsroomVerificationTier, string> = {
  unverified: 'Unverified',
  verified_source: 'Verified source',
  verified_publisher: 'Verified publisher',
}

export default async function NewsroomManagePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = getSupabaseClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (!company) notFound()

  const { data: profile } = await supabase
    .from('newsroom_profiles')
    .select('verification_tier')
    .eq('company_id', company.id)
    .maybeSingle()
  if (!profile) notFound()

  const tier = profile.verification_tier as NewsroomVerificationTier

  return (
    <main>
      <h1>{company.name}</h1>
      <p>Tier: {TIER_LABELS[tier]}</p>
      <p>Complete verification to publish your first pack.</p>
      <Link href={`/${orgSlug}/manage/verification`}>Verify your domain</Link>
    </main>
  )
}
