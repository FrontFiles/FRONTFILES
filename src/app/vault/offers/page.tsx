// ═══════════════════════════════════════════════════════════════
// Frontfiles — /vault/offers server-component flag gate (§F2)
//
// Replaces the legacy 561-LoC "Special Offers" mock that predated
// the spec-canonical offer contract shipped at P4 Part B1/B2. See
// P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md §F5 for the retirement
// rationale and §F2 for the canonical pattern this file implements.
//
// This page is a pure server component. It does zero data work
// (§D2): the only server-side responsibility is the ECONOMIC_V1_UI
// flag check; when on, it hands off to the client leaf for
// session-gated fetch and rendering.
// ═══════════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'

import { isEconomicV1UiEnabled } from '@/lib/flags'
import OffersListClient from './_components/OffersListClient'

export const dynamic = 'force-dynamic'

export default function Page() {
  if (!isEconomicV1UiEnabled()) notFound()
  return <OffersListClient />
}
