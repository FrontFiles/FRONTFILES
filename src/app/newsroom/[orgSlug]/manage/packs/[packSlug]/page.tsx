/**
 * Frontfiles — Newsroom Pack edit page (NR-D6b, F2)
 *
 * Server-component shell for the edit-mode Pack editor. Fetches
 * the existing draft and renders PackEditorShell + DetailsForm.
 * Non-draft packs short-circuit to a stub message — only drafts
 * are editable in this directive (PRD §3.3 + invariant: state
 * transitions land in NR-D9).
 *
 * Auth: same as F1 — sits under <AdminGate> (NR-D5b-i F1a) and
 * uses service-role for the page-level fetch (NR-D6a F2 / NR-D5b-i
 * F3 precedent). The audit-confirmed RLS posture on
 * newsroom_packs (NR-D6a audit (c)) permits both service-role and
 * user-JWT reads, but service-role is the standing manage-surface
 * pattern.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P6 (Details tab — F4 owns the verbatim copy)
 *   - PRD.md §3.3 (state machine — only draft is editable here)
 *   - directives/NR-D6b-pack-creation-details-tab.md §F2
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomPackRow,
  NewsroomVerificationTier,
} from '@/lib/db/schema'
import { LICENCE_CLASSES } from '@/lib/newsroom/licence-classes'

import { DetailsForm } from './_components/details-form'
import { PackEditorShell } from './_components/pack-editor-shell'

export default async function NewsroomPackEditPage({
  params,
}: {
  params: Promise<{ orgSlug: string; packSlug: string }>
}) {
  const { orgSlug, packSlug } = await params
  const supabase = getSupabaseClient()

  // ── company + profile (sequential — profile depends on company.id) ──
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

  // ── pack lookup by (company_id, slug) ──
  const { data: pack } = await supabase
    .from('newsroom_packs')
    .select('*')
    .eq('company_id', company.id)
    .eq('slug', packSlug)
    .maybeSingle()
  if (!pack) notFound()

  const typedPack = pack as NewsroomPackRow

  // ── tier gate (matches F1 posture for unverified orgs) ──
  if (tier === 'unverified') {
    return (
      <main>
        <h1>{typedPack.title}</h1>
        <p>Verify your source to manage packs.</p>
        <Link href={`/${orgSlug}/manage/verification`}>
          Go to verification
        </Link>
      </main>
    )
  }

  // ── status guard: only drafts are editable in NR-D6b ──
  // Scheduled / published / archived / takedown all flow through
  // NR-D9's state-machine RPC; this directive doesn't reach them.
  if (typedPack.status !== 'draft') {
    return (
      <main>
        <h1>{typedPack.title}</h1>
        <p>
          This pack is no longer editable. Status: {typedPack.status}.
        </p>
        <Link href={`/${orgSlug}/manage`}>Back to dashboard</Link>
      </main>
    )
  }

  // ── edit-mode editor ──
  return (
    <PackEditorShell
      orgSlug={orgSlug}
      orgName={company.name as string}
      pack={typedPack}
      saveState="saved"
    >
      <DetailsForm
        orgSlug={orgSlug}
        pack={typedPack}
        licenceClasses={Object.values(LICENCE_CLASSES)}
      />
    </PackEditorShell>
  )
}
