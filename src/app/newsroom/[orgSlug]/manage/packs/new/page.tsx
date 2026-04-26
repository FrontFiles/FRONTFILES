/**
 * Frontfiles — Newsroom Pack creation page (NR-D6b, F1 — replaces
 * NR-D6a F10 placeholder)
 *
 * Server-component shell for the create-mode Pack editor. Renders
 * the PackEditorShell + DetailsForm composition or, when the org
 * is `unverified`, an empty-state with a verification CTA.
 *
 * Auth posture: this page sits under
 * `/newsroom/[orgSlug]/manage/layout.tsx` (NR-D5b-i F1a) which
 * wraps in `<AdminGate>`. The page itself uses service-role
 * (`getSupabaseClient`) for the company + profile reads — same
 * posture as NR-D5b-i F3 (verification page) and NR-D6a F2
 * (dashboard).
 *
 * Tier gate: PRD §3.4 invariant 2 — `verification_tier =
 * unverified` cannot create Packs. The empty-state copy mirrors
 * the disabled-CTA tooltip on the dashboard's "New pack" button
 * (NR-D6a F3).
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P6 (Details tab — F4 owns the verbatim copy)
 *   - PRD.md §3.4 invariant 2 (tier gate)
 *   - directives/NR-D6b-pack-creation-details-tab.md §F1
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getSupabaseClient } from '@/lib/db/client'
import type { NewsroomVerificationTier } from '@/lib/db/schema'
import { LICENCE_CLASSES } from '@/lib/newsroom/licence-classes'

import { DetailsForm } from '../[packSlug]/_components/details-form'
import { PackEditorShell } from '../[packSlug]/_components/pack-editor-shell'

export default async function NewsroomPackNewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = getSupabaseClient()

  // ── company + profile (sequential — profile needs company.id) ──
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

  // ── tier gate (PRD §3.4 invariant 2) ──
  if (tier === 'unverified') {
    return (
      <main>
        <h1>New pack</h1>
        <p>Verify your source to create packs.</p>
        <Link href={`/${orgSlug}/manage/verification`}>
          Go to verification
        </Link>
      </main>
    )
  }

  // ── create-mode editor ──
  return (
    <PackEditorShell
      orgSlug={orgSlug}
      orgName={company.name as string}
      pack={null}
      saveState="idle"
    >
      <DetailsForm
        orgSlug={orgSlug}
        pack={null}
        licenceClasses={Object.values(LICENCE_CLASSES)}
      />
    </PackEditorShell>
  )
}
