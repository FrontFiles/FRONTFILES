// ═══════════════════════════════════════════════════════════════
// Frontfiles — /vault/offers/new server-component flag gate (P4 §F8)
//
// Pure server component. Zero data work (§D2). The only server-side
// responsibility is the ECONOMIC_V1_UI flag check; when on, it hands
// off to the client leaf for session-gated composer rendering.
//
// ─── Query params ───────────────────────────────────────────────
//
// `?asset=<id>` — optional. If present, the composer pre-fills the
// single-asset target with the given UUID and switches target_type
// to `single_asset`. Used by the `/asset/[id]` entry point to thread
// the asset forward when the buyer wants the richer composer.
// ═══════════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'

import { isEconomicV1UiEnabled } from '@/lib/flags'
import OfferComposerClient from './_components/OfferComposerClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ asset?: string | string[] }>

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  if (!isEconomicV1UiEnabled()) notFound()
  const params = await searchParams
  const assetParam = params.asset
  const initialAssetId =
    typeof assetParam === 'string' && assetParam.length > 0
      ? assetParam
      : null
  return <OfferComposerClient initialAssetId={initialAssetId} />
}
