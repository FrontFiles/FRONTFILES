'use client'

/**
 * Frontfiles — Verification tier header (NR-D5b-i, F5)
 *
 * Tier-aware copy block at the top of the P2 dashboard. Strings are
 * BOUND VERBATIM to PRD §5.1 P2 (the tier-header table).
 *
 * IP-D ratification (2026-04-24): render the PRD copy exactly —
 * do NOT append "(Coming soon)" to the `verified_source` branch
 * as the directive body suggested. The PRD's parenthetical
 * `(read-only "Coming soon" in v1)` describes how the
 * authorised-signatory METHOD CARD should render in v1.1 when
 * that card lands; NR-D5b-i has no such card to attach the
 * annotation to.
 */

import type { NewsroomVerificationTier } from '@/lib/db/schema'

const TIER_COPY: Record<NewsroomVerificationTier, string> = {
  unverified:
    'Verification status: Unverified. Complete one DNS TXT check and one domain-email check to become a Verified source.',
  verified_source:
    'Verification status: Verified source. Add an authorised-signatory attestation to become a Verified publisher.',
  verified_publisher: 'Verification status: Verified publisher.',
}

export function TierHeader({ tier }: { tier: NewsroomVerificationTier }) {
  return (
    <section>
      <p>{TIER_COPY[tier]}</p>
    </section>
  )
}
