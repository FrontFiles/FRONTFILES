/**
 * Frontfiles — Newsroom distributor dashboard (NR-D6a, F2)
 *
 * Replaces the NR-D5b-i F2 stub with the full P5 dashboard per
 * PRD §5.2 P5. Read-only half of the distributor surface; Pack
 * creation (write side) ships in NR-D6b.
 *
 * Composition order (top to bottom):
 *   <DashboardHeader />     — org name + tier badge + New pack CTA
 *   <VerificationBanner />  — conditional 3-state banner
 *   <KpiStrip />            — status-count tiles (downloads = "—")
 *   <PackListFilters />     — server-rendered <form method="GET">
 *   <PackList />            — table with empty-state branches
 *
 * Auth posture: this page is a server component sitting under the
 * NR-D5b-i F1 layout's <AdminGate>; the gate fires client-side and
 * already enforces admin membership. The data reads here use the
 * service-role client (getSupabaseClient) — same posture as the
 * verification page (NR-D5b-i F3) and the F2 stub being replaced.
 *
 * Audit-(c) finding: newsroom_packs's RLS SELECT policy includes
 * an `OR is_newsroom_editor_or_admin(company_id)` clause, so a
 * user-JWT read would also work — but service-role keeps the
 * manage-surface read pattern uniform across all admin pages.
 *
 * Spec cross-references:
 *   - PRD.md §5.2 P5 (verbatim authority for UI copy)
 *   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F2
 *   - migration 20260425000001_newsroom_schema_foundation.sql
 *     (newsroom_packs schema, idx_newsroom_packs_company_status)
 *   - migration 20260425000003_newsroom_schema_d2b.sql
 *     (newsroom_embargoes schema for the LEFT JOIN)
 */

import { notFound } from 'next/navigation'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomEmbargoRow,
  NewsroomPackRow,
  NewsroomVerificationMethod,
  NewsroomVerificationTier,
} from '@/lib/db/schema'
import {
  canCreatePack,
  deriveBannerState,
  parseFilterParams,
} from '@/lib/newsroom/dashboard'

import { DashboardHeader } from './_components/dashboard-header'
import { KpiStrip } from './_components/kpi-strip'
import { PackList } from './_components/pack-list'
import { PackListFilters } from './_components/pack-list-filters'
import { VerificationBanner } from './_components/verification-banner'

// PostgREST/Supabase JS doesn't auto-resolve the embargo relationship
// cleanly here (newsroom_packs.embargo_id ↔ newsroom_embargoes.id is
// one of two FKs between the tables; the other is the UNIQUE FK on
// newsroom_embargoes.pack_id). Two separate queries + JS merge
// avoids the relationship-name disambiguation footgun.
type EmbargoSnapshot = Pick<NewsroomEmbargoRow, 'lift_at' | 'state'>
type PackWithEmbargo = NewsroomPackRow & {
  embargo: EmbargoSnapshot | null
}

export default async function NewsroomManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >
}) {
  const { orgSlug } = await params
  const rawParams = await searchParams
  const supabase = getSupabaseClient()

  // ── company + profile (sequential — profile depends on company.id) ──
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (!company) notFound()

  const companyId = company.id as string

  const { data: profile } = await supabase
    .from('newsroom_profiles')
    .select('verification_tier')
    .eq('company_id', companyId)
    .maybeSingle()
  if (!profile) notFound()

  const tier = profile.verification_tier as NewsroomVerificationTier

  // ── parallel: records, packs (filtered), kpi counts ──
  const filters = parseFilterParams(flattenSearchParams(rawParams))

  // Using `*` rather than an explicit column list: Supabase JS's
  // type inference walks a string-literal column list to type the
  // returned rows. A multi-line string-concat select silently
  // drops to `GenericStringError[]`. `*` resolves to the table's
  // full row shape, which is exactly NewsroomPackRow.
  let packsQuery = supabase
    .from('newsroom_packs')
    .select('*')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })

  if (filters.status) packsQuery = packsQuery.eq('status', filters.status)
  if (filters.licence)
    packsQuery = packsQuery.eq('licence_class', filters.licence)
  if (filters.from) packsQuery = packsQuery.gte('updated_at', filters.from)
  if (filters.to) packsQuery = packsQuery.lte('updated_at', filters.to)

  const [recordsResult, packsResult, kpiCountsResult] = await Promise.all([
    supabase
      .from('newsroom_verification_records')
      .select('method, verified_at, expires_at')
      .eq('company_id', companyId),
    packsQuery,
    // KPI counts are intentionally unfiltered — they describe the org
    // overall, not the current filtered view. v1 has no real download
    // count; F7 renders "—" for that tile.
    supabase
      .from('newsroom_packs')
      .select('status')
      .eq('company_id', companyId),
  ])

  const records = (recordsResult.data ?? []) as Array<{
    method: NewsroomVerificationMethod
    verified_at: string
    expires_at: string | null
  }>
  const packs = (packsResult.data ?? []) as NewsroomPackRow[]
  const kpiRows = (kpiCountsResult.data ?? []) as Array<{
    status: NewsroomPackRow['status']
  }>

  // ── embargo merge (only if any pack has embargo_id) ──
  const embargoIds = packs
    .map((p) => p.embargo_id)
    .filter((id): id is string => id !== null)
  let embargoesById: Map<string, EmbargoSnapshot> = new Map()
  if (embargoIds.length > 0) {
    const { data: embargoData } = await supabase
      .from('newsroom_embargoes')
      .select('id, lift_at, state')
      .in('id', embargoIds)
    const rows = (embargoData ?? []) as Array<
      EmbargoSnapshot & { id: string }
    >
    embargoesById = new Map(
      rows.map((r) => [r.id, { lift_at: r.lift_at, state: r.state }]),
    )
  }

  const packsWithEmbargo: PackWithEmbargo[] = packs.map((p) => ({
    ...p,
    embargo: p.embargo_id ? embargoesById.get(p.embargo_id) ?? null : null,
  }))

  // ── derive: banner state, KPI tile values, CTA gate ──
  const banner = deriveBannerState({
    tier,
    records,
    now: new Date(),
  })
  const stats = aggregateKpis(kpiRows)
  const canCreate = canCreatePack(tier)

  return (
    <main>
      <DashboardHeader
        orgSlug={orgSlug}
        orgName={company.name as string}
        tier={tier}
        canCreatePack={canCreate}
      />
      <VerificationBanner
        state={banner.state}
        orgSlug={orgSlug}
        method={banner.method}
        expiresAt={banner.expiresAt}
      />
      <KpiStrip stats={stats} />
      <PackListFilters orgSlug={orgSlug} current={filters} />
      <PackList
        orgSlug={orgSlug}
        packs={packsWithEmbargo}
        canCreatePack={canCreate}
        filtersApplied={hasAnyFilter(filters)}
      />
    </main>
  )
}

// ─── Helpers ────────────────────────────────────────────────────

function flattenSearchParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  // Next 16 search-param values may be string | string[] | undefined.
  // The dashboard treats array values as the first entry; this is the
  // standard "scalar filter" semantic and avoids a typescript footgun
  // when the URL is hand-edited (`?status=draft&status=scheduled`).
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) out[k] = v[0]
    else out[k] = v
  }
  return out
}

function aggregateKpis(rows: ReadonlyArray<{ status: string }>): {
  totalPacks: number
  drafts: number
  scheduled: number
  published: number
  downloads30d: number
} {
  let drafts = 0
  let scheduled = 0
  let published = 0
  for (const r of rows) {
    if (r.status === 'draft') drafts++
    else if (r.status === 'scheduled') scheduled++
    else if (r.status === 'published') published++
  }
  return {
    totalPacks: rows.length,
    drafts,
    scheduled,
    published,
    // v1: no real download count yet. NR-D11 wires DistributionEvent
    // and a real 30d aggregation. F7 renders "—" for this tile.
    downloads30d: 0,
  }
}

function hasAnyFilter(filters: {
  status?: string
  licence?: string
  from?: string
  to?: string
}): boolean {
  return Boolean(
    filters.status || filters.licence || filters.from || filters.to,
  )
}
