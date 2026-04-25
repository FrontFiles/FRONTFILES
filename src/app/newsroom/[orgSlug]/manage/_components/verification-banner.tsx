/**
 * Frontfiles — Newsroom verification banner (NR-D6a, F4)
 *
 * Server component. Conditional render — returns `null` when
 * state === 'none' (no banner should appear).
 *
 * PRD §5.2 P5 verbatim copy:
 *
 *   unverified | "Complete verification to publish your first
 *              | pack."
 *              | CTA "Go to verification" → P2
 *
 *   expiring   | "Your {method} verification expires on {date}.
 *              | Recheck to keep your tier."
 *              | CTA "Re-verify" → P2
 *
 *   revoked    | "Verification revoked on {date}. New packs are
 *              | blocked until re-verified."
 *              | CTA "Go to verification" → P2
 *
 * Method-label mapping for the 'expiring' copy:
 *   dns_txt              → "DNS TXT"
 *   domain_email         → "domain email"
 *   authorized_signatory → "authorized signatory"
 *
 * Date formatting: human-readable ("May 24, 2026"). Locale fixed
 * to en-US for consistency with verbatim PRD copy until i18n
 * lands as a first-class concern.
 *
 * Visual treatment is deliberately minimal — directive defers
 * brutalist polish to a future design pass; functional shape is
 * what matters here.
 *
 * Spec cross-references:
 *   - PRD.md §5.2 P5 (banner table — verbatim authority)
 *   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F4
 *   - src/lib/newsroom/dashboard.ts (BannerState type + derivation)
 */

import Link from 'next/link'

import type { NewsroomVerificationMethod } from '@/lib/db/schema'
import type { BannerState } from '@/lib/newsroom/dashboard'

const METHOD_LABEL: Record<NewsroomVerificationMethod, string> = {
  dns_txt: 'DNS TXT',
  domain_email: 'domain email',
  authorized_signatory: 'authorized signatory',
}

function formatBannerDate(iso: string): string {
  // en-US "May 24, 2026" form per PRD copy convention.
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function VerificationBanner({
  state,
  orgSlug,
  method,
  expiresAt,
  revokedAt,
}: {
  state: BannerState
  orgSlug: string
  method?: NewsroomVerificationMethod
  expiresAt?: string
  revokedAt?: string
}) {
  if (state === 'none') return null

  const verificationHref = `/${orgSlug}/manage/verification`

  if (state === 'unverified') {
    return (
      <section role="status" aria-label="Verification status">
        <p>Complete verification to publish your first pack.</p>
        <Link href={verificationHref}>Go to verification</Link>
      </section>
    )
  }

  if (state === 'expiring') {
    const methodLabel = method ? METHOD_LABEL[method] : 'verification'
    const dateLabel = expiresAt ? formatBannerDate(expiresAt) : ''
    return (
      <section role="status" aria-label="Verification status">
        <p>
          Your {methodLabel} verification expires on {dateLabel}. Recheck
          to keep your tier.
        </p>
        <Link href={verificationHref}>Re-verify</Link>
      </section>
    )
  }

  // state === 'revoked'
  const dateLabel = revokedAt ? formatBannerDate(revokedAt) : ''
  return (
    <section role="status" aria-label="Verification status">
      <p>
        Verification revoked on {dateLabel}. New packs are blocked until
        re-verified.
      </p>
      <Link href={verificationHref}>Go to verification</Link>
    </section>
  )
}
