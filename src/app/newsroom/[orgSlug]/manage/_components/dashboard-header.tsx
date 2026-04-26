/**
 * Frontfiles — Newsroom dashboard header (NR-D6a, F3)
 *
 * Server component. Renders org name, tier badge, and "New pack"
 * CTA. CTA is gated by canCreatePack per PRD §3.4 invariant 2:
 * unverified orgs cannot create Packs.
 *
 * Tier badge copy (PRD §3.2 + §5.1 P5):
 *   - verified_source     → "Verified source"
 *   - verified_publisher  → "Verified publisher"
 *   - unverified          → no badge rendered
 *
 * CTA disabled-state tooltip is directive-derived UX (PRD silent
 * on the disabled-tooltip text). Treated as locked-by-directive,
 * consistent with the NR-D5b-ii IP-3 pattern (PRD-silent ≠
 * PRD-restrictive).
 *
 * Spec cross-references:
 *   - PRD.md §5.2 P5 (header copy)
 *   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F3
 */

import Link from 'next/link'

import type { NewsroomVerificationTier } from '@/lib/db/schema'

const TIER_BADGE: Record<NewsroomVerificationTier, string | null> = {
  unverified: null,
  verified_source: 'Verified source',
  verified_publisher: 'Verified publisher',
}

const CTA_DISABLED_TOOLTIP = 'Verify your source to create packs.'

export function DashboardHeader({
  orgSlug,
  orgName,
  tier,
  canCreatePack,
}: {
  orgSlug: string
  orgName: string
  tier: NewsroomVerificationTier
  canCreatePack: boolean
}) {
  const badge = TIER_BADGE[tier]

  return (
    <header>
      <div>
        <h1>{orgName}</h1>
        {badge ? <span aria-label="Verification tier">{badge}</span> : null}
      </div>
      {canCreatePack ? (
        <Link href={`/${orgSlug}/manage/packs/new`}>New pack</Link>
      ) : (
        <button type="button" disabled title={CTA_DISABLED_TOOLTIP}>
          New pack
        </button>
      )}
    </header>
  )
}
