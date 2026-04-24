'use client'

/**
 * Frontfiles — Verification dashboard shell (NR-D5b-i, F4)
 *
 * Client wrapper that composes the three P2 verification cards:
 *   - <TierHeader />         (F5) — PRD §5.1 P2 tier copy
 *   - <DnsTxtCard />         (F6) — DNS TXT challenge + recheck
 *   - <EmailCardStub />      (F7) — stubbed until NR-D5b-ii
 *
 * Data shape:
 *   - tier:          current verification_tier
 *   - records:       ACTIVE verification records for the company
 *   - orgSlug:       path param (used by the card's API calls)
 *   - primaryDomain: the domain being verified (shown in copy)
 *
 * After a successful DNS TXT recheck, the card calls `onChange`.
 * We refresh the current route via Next 16's `router.refresh()`,
 * which re-runs the parent server component (F3) and passes an
 * updated `records` / `tier` tuple back down. No manual fetch
 * coordination; Next owns the cache-invalidation semantics.
 */

import { useRouter } from 'next/navigation'

import type {
  NewsroomVerificationRecordRow,
  NewsroomVerificationTier,
} from '@/lib/db/schema'

import { DnsTxtCard } from './dns-txt-card'
import { EmailCardStub } from './email-card-stub'
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
      <EmailCardStub />
    </div>
  )
}
