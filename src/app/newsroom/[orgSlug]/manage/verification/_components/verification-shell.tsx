'use client'

/**
 * Frontfiles — Verification dashboard shell (NR-D5b-i F4 +
 * NR-D5b-ii F8 swap)
 *
 * Client wrapper that composes the three P2 verification cards:
 *   - <TierHeader />   (F5) — PRD §5.1 P2 tier copy
 *   - <DnsTxtCard />   (F6) — DNS TXT challenge + recheck
 *   - <EmailCard />    (NR-D5b-ii F6) — domain-email OTP issue +
 *                       verify (replaces the NR-D5b-i stub)
 *
 * Data shape:
 *   - tier:          current verification_tier
 *   - records:       ACTIVE verification records for the company
 *   - orgSlug:       path param (used by the cards' API calls)
 *   - primaryDomain: the domain being verified (shown in copy)
 *
 * After a successful card action (DNS recheck or email verify),
 * the card calls `onChange`. We refresh the current route via
 * Next 16's `router.refresh()`, which re-runs the parent server
 * component (F3) and passes an updated `records` / `tier` tuple
 * back down. No manual fetch coordination; Next owns the cache-
 * invalidation semantics.
 *
 * Tier promotion: when both `dns_txt` and `domain_email` records
 * are active, F10's recomputeTier() flips newsroom_profiles.
 * verification_tier to verified_source. The router.refresh()
 * here is what surfaces that flip in TierHeader.
 */

import { useRouter } from 'next/navigation'

import type {
  NewsroomVerificationRecordRow,
  NewsroomVerificationTier,
} from '@/lib/db/schema'

import { DnsTxtCard } from './dns-txt-card'
import { EmailCard } from './email-card'
import { TierHeader } from './tier-header'

export function VerificationShell({
  tier,
  records,
  orgSlug,
  primaryDomain,
}: {
  tier: NewsroomVerificationTier
  records: NewsroomVerificationRecordRow[]
  orgSlug: string
  primaryDomain: string
}) {
  const router = useRouter()

  const dnsTxtRecord =
    records.find((r) => r.method === 'dns_txt') ?? null
  const emailRecord =
    records.find((r) => r.method === 'domain_email') ?? null

  function onChange() {
    router.refresh()
  }

  return (
    <div>
      <TierHeader tier={tier} />
      <DnsTxtCard
        orgSlug={orgSlug}
        primaryDomain={primaryDomain}
        currentRecord={dnsTxtRecord}
        onChange={onChange}
      />
      <EmailCard
        orgSlug={orgSlug}
        primaryDomain={primaryDomain}
        currentRecord={emailRecord}
        onChange={onChange}
      />
    </div>
  )
}
