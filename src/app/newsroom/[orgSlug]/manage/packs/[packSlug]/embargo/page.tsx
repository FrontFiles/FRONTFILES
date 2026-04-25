/**
 * Frontfiles — Pack editor Embargo tab (NR-D8, F2)
 *
 * Server component. Renders the embargo form + recipients
 * list for the current draft pack. Mirrors the NR-D7a Assets
 * tab posture: service-role fetch, draft-only guard, render
 * the editor shell with this tab's content as `children`.
 *
 * Recipient data shape: two-query merge between
 * `newsroom_embargo_recipients` (token + access_count + revoke
 * state) and `newsroom_recipients` (email + name). Same
 * pattern NR-D6a uses for pack/embargo and NR-D7a uses for
 * pack/scan_result.
 *
 * Auth: AdminGate at /manage/layout.tsx fires client-side;
 * this page is a server component sitting under it.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P8 (toggle + fields + recipients)
 *   - directives/NR-D8-embargo-configuration.md §F2
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomEmbargoRecipientRow,
  NewsroomEmbargoRow,
  NewsroomPackRow,
  NewsroomRecipientRow,
  NewsroomVerificationTier,
} from '@/lib/db/schema'

import { PackEditorShell } from '../_components/pack-editor-shell'
import { EmbargoForm } from './_components/embargo-form'
import { RecipientsList } from './_components/recipients-list'

export type RecipientSnapshot = NewsroomEmbargoRecipientRow & {
  recipient: Pick<
    NewsroomRecipientRow,
    'id' | 'email' | 'name' | 'outlet_id'
  > | null
}

export default async function NewsroomPackEmbargoPage({
  params,
}: {
  params: Promise<{ orgSlug: string; packSlug: string }>
}) {
  const { orgSlug, packSlug } = await params
  const supabase = getSupabaseClient()

  // ── company + profile (sequential) ──
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

  // ── pack lookup ──
  const { data: pack } = await supabase
    .from('newsroom_packs')
    .select('*')
    .eq('company_id', company.id)
    .eq('slug', packSlug)
    .maybeSingle()
  if (!pack) notFound()

  const typedPack = pack as NewsroomPackRow

  // ── tier gate ──
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

  // ── status guard: only drafts editable in NR-D8 ──
  // NR-D9 will add post-schedule actions (early-lift, revoke) per
  // PRD §5.1 P8; for now, the embargo surface is draft-only.
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

  // ── embargo lookup (nullable) ──
  const { data: embargoRow } = await supabase
    .from('newsroom_embargoes')
    .select('*')
    .eq('pack_id', typedPack.id)
    .maybeSingle()
  const embargo = (embargoRow as NewsroomEmbargoRow | null) ?? null

  // ── recipients lookup + newsroom_recipients merge (two-query) ──
  // Only fires if an embargo row exists. Merging by recipient_id
  // mirrors NR-D6a's pack/embargo merge and NR-D7a's
  // pack/scan_result merge — established codebase pattern.
  let recipients: RecipientSnapshot[] = []
  if (embargo) {
    const { data: erRows } = await supabase
      .from('newsroom_embargo_recipients')
      .select('*')
      .eq('embargo_id', embargo.id)
      .order('created_at', { ascending: true })

    const erList = (erRows ?? []) as NewsroomEmbargoRecipientRow[]

    const recipientIds = erList.map((r) => r.recipient_id)
    let recipientById: Map<
      string,
      Pick<NewsroomRecipientRow, 'id' | 'email' | 'name' | 'outlet_id'>
    > = new Map()
    if (recipientIds.length > 0) {
      const { data: recRows } = await supabase
        .from('newsroom_recipients')
        .select('id, email, name, outlet_id')
        .in('id', recipientIds)
      const rows = (recRows ?? []) as Array<
        Pick<NewsroomRecipientRow, 'id' | 'email' | 'name' | 'outlet_id'>
      >
      recipientById = new Map(rows.map((r) => [r.id, r]))
    }

    recipients = erList.map((er) => ({
      ...er,
      recipient: recipientById.get(er.recipient_id) ?? null,
    }))
  }

  return (
    <PackEditorShell
      orgSlug={orgSlug}
      orgName={company.name as string}
      pack={typedPack}
      saveState="saved"
    >
      <EmbargoForm
        orgSlug={orgSlug}
        packSlug={typedPack.slug}
        embargo={embargo}
      />
      {embargo ? (
        <RecipientsList
          orgSlug={orgSlug}
          packSlug={typedPack.slug}
          embargoId={embargo.id}
          recipients={recipients}
        />
      ) : null}
    </PackEditorShell>
  )
}
