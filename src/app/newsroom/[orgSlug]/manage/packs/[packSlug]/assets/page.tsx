/**
 * Frontfiles — Pack editor Assets tab (NR-D7a, F1)
 *
 * Server component. Renders the upload zone + per-asset rows for
 * the current draft Pack. Mirrors NR-D6b's Details-tab posture:
 * fetch via service-role, status-guard for non-draft, render the
 * editor shell with this tab's content as `children`.
 *
 * Asset list fetch: one query for newsroom_assets + one for
 * newsroom_asset_scan_results filtered by asset_id IN (...). JS
 * merges the two by asset_id. No PostgREST relationship-embed —
 * same posture as NR-D6a's pack/embargo merge (avoids the dual-
 * FK ambiguity even though there isn't one here, just for shape
 * consistency across the codebase).
 *
 * Auth: AdminGate at /manage/layout.tsx fires client-side; this
 * page is a server component sitting under it.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P7 (asset upload + per-asset row matrix)
 *   - directives/NR-D7a-asset-upload-storage-metadata.md §F1
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomAssetRow,
  NewsroomAssetScanResultRow,
  NewsroomPackRow,
  NewsroomVerificationTier,
} from '@/lib/db/schema'

import { PackEditorShell } from '../_components/pack-editor-shell'
import { AssetRow } from './_components/asset-row'
import { ScanPoller } from './_components/scan-poller'
import { UploadZone } from './_components/upload-zone'

export default async function NewsroomPackAssetsPage({
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

  // ── status guard: only drafts are editable in NR-D7a ──
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

  // ── parallel: assets + scan_results merge ──
  const { data: assetsRaw } = await supabase
    .from('newsroom_assets')
    .select('*')
    .eq('pack_id', typedPack.id)
    .order('created_at', { ascending: true })

  const assets = (assetsRaw ?? []) as NewsroomAssetRow[]

  const assetIds = assets.map((a) => a.id)
  let scanResultsByAssetId: Map<string, NewsroomAssetScanResultRow> =
    new Map()
  if (assetIds.length > 0) {
    const { data: scanRows } = await supabase
      .from('newsroom_asset_scan_results')
      .select('*')
      .in('asset_id', assetIds)
    const rows = (scanRows ?? []) as NewsroomAssetScanResultRow[]
    scanResultsByAssetId = new Map(rows.map((r) => [r.asset_id, r]))
  }

  // NR-D7b F11: live state-transition polling. Mount the
  // <ScanPoller> while at least one asset has a pending
  // scan_result; the poller calls router.refresh() every 5s and
  // the next render unmounts the poller once no pending rows
  // remain. Auto-stop is server-driven via this conditional, not
  // via the poller's internal logic.
  const hasPending = Array.from(scanResultsByAssetId.values()).some(
    (s) => s.result === 'pending',
  )

  return (
    <PackEditorShell
      orgSlug={orgSlug}
      orgName={company.name as string}
      pack={typedPack}
      saveState="saved"
    >
      <UploadZone
        orgSlug={orgSlug}
        packSlug={typedPack.slug}
        packId={typedPack.id}
      />
      {assets.length > 0 ? (
        <ul aria-label="Pack assets">
          {assets.map((asset) => (
            <li key={asset.id}>
              <AssetRow
                orgSlug={orgSlug}
                packSlug={typedPack.slug}
                asset={asset}
                scanResult={scanResultsByAssetId.get(asset.id) ?? null}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {hasPending ? <ScanPoller hasPending={hasPending} /> : null}
    </PackEditorShell>
  )
}
