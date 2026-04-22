// ═══════════════════════════════════════════════════════════════
// Frontfiles — /vault/offers/[id] server-component flag gate (§F2)
//
// Detail-route counterpart to the list wrapper at
// ../page.tsx. Same server-component + flag-gate-only
// architecture (§D2); the only addition is the Next 16
// async-`params` unwrap needed to hand the `id` to the client
// leaf.
//
// The client leaf consumes GET /api/offers/[id] and maps its
// 404 → a `not_found` view-state branch; there is no
// notFound() call from the client side. notFound() in this
// file is reserved for the flag-off case only.
// ═══════════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'

import { isEconomicV1UiEnabled } from '@/lib/flags'
import OfferDetailClient from './_components/OfferDetailClient'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!isEconomicV1UiEnabled()) notFound()
  const { id } = await params
  return <OfferDetailClient id={id} />
}
