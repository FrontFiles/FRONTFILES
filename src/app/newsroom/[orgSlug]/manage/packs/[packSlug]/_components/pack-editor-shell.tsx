/**
 * Frontfiles — Pack editor shell (NR-D6b, F3 → NR-D9b, F1)
 *
 * Server component. Composes the top bar (breadcrumb + status
 * badge + initial save indicator + Publish CTA) and the tab nav
 * (Details + Assets + Embargo), then renders the active-tab
 * content as `children`.
 *
 * NR-D9b conversion: this shell is now `async`. When `pack !==
 * null`, it fetches the publish-precondition substrate (warranty,
 * signing-key state, asset/scan/alt-text aggregates, embargo +
 * recipient count) and derives the 7-row checklist via
 * `derivePublishChecklist`. The Publish CTA is replaced by the
 * `<PublishActions>` client wrapper, and a `<PrePublishChecklist>`
 * sidebar is mounted next to the active-tab content. When
 * `pack === null` (create-mode), the sidebar is skipped and the
 * Publish CTA stays disabled with the legacy NR-D6b tooltip.
 *
 * Caller compatibility: the 5-prop signature
 * (`{orgSlug, orgName, pack, saveState, children}`) is preserved.
 * The 4 caller pages (`new/`, `[packSlug]/`, `embargo/`,
 * `assets/`) are unchanged — the shell now does its own fetching.
 *
 * Save indicator is intentionally a static slot here. F4 of NR-D6b
 * (the `'use client'` Details form) manages its own dynamic
 * indicator inline next to its submit button.
 *
 * Disabled-tab semantics (NR-D6b audit (i)): Assets + Embargo
 * render as `<span>` (not `<button>` or `<Link>`) with tooltips
 * when `pack === null`.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P6 (top-bar layout — verbatim authority)
 *   - PRD.md §5.1 P10 (sidebar + CTA states — verbatim authority)
 *   - directives/NR-D9b-publish-flow.md §F1
 *   - src/lib/newsroom/publish-checklist.ts — derivation
 *   - src/lib/newsroom/canonical-url.ts — `packCanonicalUrl`
 */

import Link from 'next/link'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomAssetRow,
  NewsroomAssetScanResultRow,
  NewsroomEmbargoRow,
  NewsroomPackRow,
  NewsroomRightsWarrantyRow,
} from '@/lib/db/schema'
import { packCanonicalUrl } from '@/lib/newsroom/canonical-url'
import {
  derivePublishChecklist,
  type ChecklistResult,
} from '@/lib/newsroom/publish-checklist'

import { PrePublishChecklist } from './pre-publish-checklist'
import { PublishActions } from './publish-actions'

const PUBLISH_CTA_TOOLTIP_CREATE =
  'Save the pack first to enable publishing.'

const SAVE_STATE_LABEL: Record<
  'idle' | 'saving' | 'saved',
  string
> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
}

interface ShellPublishState {
  warranty: NewsroomRightsWarrantyRow | null
  embargo: NewsroomEmbargoRow | null
  recipientCount: number
  checklist: ChecklistResult
  canonicalUrl: string
}

/**
 * Fetches the publish-precondition substrate and derives the
 * checklist. Only invoked when `pack !== null` — create-mode skips
 * this entirely.
 */
async function loadPublishState(
  orgSlug: string,
  pack: NewsroomPackRow,
): Promise<ShellPublishState> {
  const supabase = getSupabaseClient()

  // Parallel fetches: warranty, signing key, assets, embargo.
  // Scan results, alt-text aggregate, and recipient count are
  // sequential (depend on the assets / embargo lookup).
  const [warrantyRes, signingKeyRes, assetsRes, embargoRes] =
    await Promise.all([
      pack.rights_warranty_id !== null
        ? supabase
            .from('newsroom_rights_warranties')
            .select('*')
            .eq('id', pack.rights_warranty_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('newsroom_signing_keys')
        .select('kid', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('newsroom_assets')
        .select('*')
        .eq('pack_id', pack.id),
      pack.embargo_id !== null
        ? supabase
            .from('newsroom_embargoes')
            .select('*')
            .eq('id', pack.embargo_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

  const warranty =
    (warrantyRes.data as NewsroomRightsWarrantyRow | null) ?? null

  // signingKeyRes.count is non-null when query succeeds. Treat
  // any falsy as no key (defensive — surface as missing).
  const hasActiveSigningKey =
    typeof signingKeyRes.count === 'number' && signingKeyRes.count > 0

  const assets = (assetsRes.data ?? []) as NewsroomAssetRow[]
  const assetCount = assets.length

  // Alt-text deficit: count image-kind assets without alt_text.
  const imagesMissingAltCount = assets.filter(
    (a) =>
      a.kind === 'image' &&
      (a.alt_text === null || a.alt_text.trim().length === 0),
  ).length

  // Scan results: fetch by asset_id IN (...); compute count by
  // result. Orphan rows (asset without scan_result) handled by the
  // derivation (treated as 'scanning').
  const scanCounts = { pending: 0, clean: 0, flagged: 0, error: 0 }
  if (assetCount > 0) {
    const assetIds = assets.map((a) => a.id)
    const { data: scanRows } = await supabase
      .from('newsroom_asset_scan_results')
      .select('result')
      .in('asset_id', assetIds)
    for (const r of (scanRows ?? []) as Pick<
      NewsroomAssetScanResultRow,
      'result'
    >[]) {
      switch (r.result) {
        case 'pending':
          scanCounts.pending += 1
          break
        case 'clean':
          scanCounts.clean += 1
          break
        case 'flagged':
          scanCounts.flagged += 1
          break
        case 'error':
          scanCounts.error += 1
          break
      }
    }
  }

  const embargo =
    (embargoRes.data as NewsroomEmbargoRow | null) ?? null

  let recipientCount = 0
  if (embargo !== null) {
    const { count } = await supabase
      .from('newsroom_embargo_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('embargo_id', embargo.id)
      .is('revoked_at', null)
    recipientCount = typeof count === 'number' ? count : 0
  }

  const checklist = derivePublishChecklist({
    pack,
    warranty,
    embargo:
      embargo !== null
        ? {
            id: embargo.id,
            lift_at: embargo.lift_at,
            policy_text: embargo.policy_text,
            recipientCount,
          }
        : null,
    assetCount,
    imagesMissingAltCount,
    scanCounts,
    hasActiveSigningKey,
  })

  const canonicalUrl = packCanonicalUrl(orgSlug, pack.slug)

  return {
    warranty,
    embargo,
    recipientCount,
    checklist,
    canonicalUrl,
  }
}

export async function PackEditorShell({
  orgSlug,
  orgName,
  pack,
  saveState,
  children,
}: {
  orgSlug: string
  orgName: string
  pack: NewsroomPackRow | null
  saveState: 'idle' | 'saving' | 'saved'
  children: React.ReactNode
}) {
  const breadcrumbTitle = pack?.title ?? 'New pack'
  const detailsHref = pack
    ? `/${orgSlug}/manage/packs/${pack.slug}`
    : `/${orgSlug}/manage/packs/new`

  // Only fetch publish state for an existing pack.
  const publishState =
    pack !== null ? await loadPublishState(orgSlug, pack) : null

  return (
    <main>
      {/* ── Top bar ── */}
      <header>
        <nav aria-label="Breadcrumb">
          <Link href={`/${orgSlug}/manage`}>{orgName}</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/${orgSlug}/manage`}>Packs</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{breadcrumbTitle}</span>
        </nav>

        <div>
          {/* Status badge — pack.status when present, "Draft" in
              create mode (the new/page.tsx flow only renders the
              shell with pack=null on first composition). */}
          <span aria-label={`Status: ${pack?.status ?? 'draft'}`}>
            {(pack?.status ?? 'draft').replace(/^./, (c) => c.toUpperCase())}
          </span>

          {/* Initial save indicator (server-rendered). F4 of NR-D6b
              has its own live indicator next to the submit button. */}
          <span aria-live="polite">{SAVE_STATE_LABEL[saveState]}</span>

          {/* Publish CTA. Create mode: disabled with legacy tooltip.
              Edit mode: <PublishActions> client wrapper drives the
              modal flow. */}
          {pack !== null && publishState !== null ? (
            <PublishActions
              orgSlug={orgSlug}
              packSlug={pack.slug}
              packId={pack.id}
              packTitle={pack.title}
              packLicenceClass={pack.licence_class}
              packCreditLine={pack.credit_line}
              packPublishAt={pack.publish_at}
              warrantyConfirmed={publishState.warranty !== null}
              embargo={
                publishState.embargo !== null
                  ? {
                      lift_at: publishState.embargo.lift_at,
                      recipientCount: publishState.recipientCount,
                    }
                  : null
              }
              ctaLabel={publishState.checklist.ctaLabel}
              ctaDisabled={publishState.checklist.ctaDisabled}
              missing={publishState.checklist.missing}
              canonicalUrl={publishState.canonicalUrl}
            />
          ) : (
            <button
              type="button"
              disabled
              title={PUBLISH_CTA_TOOLTIP_CREATE}
            >
              Publish
            </button>
          )}
        </div>
      </header>

      {/* ── Tab nav ── (unchanged from NR-D6b) */}
      <nav aria-label="Pack editor tabs">
        <Link href={detailsHref} aria-current="page">
          Details
        </Link>
        {pack ? (
          <Link
            href={`/${orgSlug}/manage/packs/${pack.slug}/assets`}
            aria-current="page"
          >
            Assets
          </Link>
        ) : (
          <span
            aria-disabled="true"
            title="Save the pack first to upload assets."
          >
            Assets
          </span>
        )}
        {pack ? (
          <Link
            href={`/${orgSlug}/manage/packs/${pack.slug}/embargo`}
            aria-current="page"
          >
            Embargo
          </Link>
        ) : (
          <span
            aria-disabled="true"
            title="Save the pack first to set up an embargo."
          >
            Embargo
          </span>
        )}
      </nav>

      {/* ── Active tab content (children) + checklist sidebar ── */}
      <div>
        <section>{children}</section>
        {publishState !== null ? (
          <PrePublishChecklist items={publishState.checklist.items} />
        ) : null}
      </div>
    </main>
  )
}
