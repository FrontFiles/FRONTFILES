// ═══════════════════════════════════════════════════════════════
// Frontfiles — OfferDetailClient (P4 concern 4A.2 SCAFFOLD §F4)
//
// Client-side detail view for /vault/offers/[id]. Consumes
// GET /api/offers/[id] (shipped at B1) via a useSession-sourced
// Bearer token. Pairs with the pure render helper exported from
// this same file so the view layer is unit-testable under
// Vitest's Node environment.
//
// ─── Architecture (§R5 + §R6) ───────────────────────────────────
//
// Layer 1 — this component (default export): owns useSession(),
// the fetch effect keyed on (status, accessToken, id), and the
// reduction to an OfferDetailView. Orphaned by design until
// Prompt 5 wires it into the server-component wrapper at
// vault/offers/[id]/page.tsx.
//
// Layer 2 — renderOfferDetailBody (named export below): pure
// function from (view, selfUserId) → ReactElement. No hooks, no
// network, no effects. Trivially testable via renderToString
// without RTL / jsdom — the §R6 workaround for the repo's
// absent client-test infrastructure.
//
// ─── Party-role guard ───────────────────────────────────────────
//
// The role line is derived by comparing selfUserId against
// offer.buyer_id and offer.creator_id. RLS prevents a non-party
// from reaching the loaded branch (the server returns 404 /
// OFFER_NOT_FOUND before this component sees the row). The
// `You are not a party to this offer.` branch is a belt-and-
// braces guard — unreachable in production, but the right
// failure surface if a future bug slips a non-party row through.
//
// ─── Known scaffold compromises ─────────────────────────────────
//
// • Rights rendering: scaffold-grade `JSON.stringify(rights, null, 2)`
//   inside a `<pre>`. A proper rights renderer (human-readable
//   template name + bullet-listed params) is a follow-up concern;
//   replace here, not at callers.
// • Not-found branch: maps from HTTP 404 regardless of error
//   code. The §F1 / §F4 surface codes `OFFER_NOT_FOUND` and
//   `FEATURE_DISABLED` both use 404; both read as "not found"
//   to the viewer, which is honest — when the flag is off, the
//   feature genuinely isn't exposed. All other non-2xx responses
//   fall through to the generic error branch.
// • §F6 brutalist baseline: no component library, no icons, no
//   greys for text content. Focus rings are the single
//   sanctioned accessibility deviation.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useEffect, useState, type ReactElement } from 'react'

import { useSession } from '@/hooks/useSession'
import type { OfferAssetRow, OfferBriefRow, OfferRow } from '@/lib/offer'

type LoadedDetail = {
  offer: OfferRow
  assets: OfferAssetRow[] | null
  briefs: OfferBriefRow[] | null
}

export type OfferDetailView =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | ({ kind: 'loaded' } & LoadedDetail)

type Role = 'buyer' | 'creator' | 'none'

function deriveRole(offer: OfferRow, selfUserId: string | null): Role {
  if (selfUserId === null) return 'none'
  if (offer.buyer_id === selfUserId) return 'buyer'
  if (offer.creator_id === selfUserId) return 'creator'
  return 'none'
}

function roleLine(role: Role): string {
  if (role === 'buyer') return 'You are the buyer.'
  if (role === 'creator') return 'You are the creator.'
  return 'You are not a party to this offer.'
}

/**
 * Pure render helper — no hooks, no network, no effects.
 */
export function renderOfferDetailBody(
  view: OfferDetailView,
  selfUserId: string | null,
): ReactElement {
  if (view.kind === 'loading') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">Loading offer…</p>
    )
  }
  if (view.kind === 'unauthenticated') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">
        Sign in to view this offer.
      </p>
    )
  }
  if (view.kind === 'not_found') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">Offer not found.</p>
    )
  }
  if (view.kind === 'error') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">
        Could not load this offer.
      </p>
    )
  }

  const { offer, assets, briefs } = view
  const role = deriveRole(offer, selfUserId)
  const expires = offer.expires_at.slice(0, 10)
  const feePercent = offer.platform_fee_bps / 100
  // Single template literal — renderToString otherwise inserts
  // <!-- --> separators between adjacent JSX expressions.
  const moneyLine = `${offer.gross_fee} ${offer.currency} · platform fee ${feePercent}%`
  const isAssetBranch =
    offer.target_type === 'single_asset' || offer.target_type === 'asset_pack'

  return (
    <div className="font-sans text-black bg-white">
      <section className="px-6 py-4 border-b border-black">
        <h1 className="text-lg">{`Offer ${offer.id.slice(0, 8)}`}</h1>
        <p className="text-sm">{roleLine(role)}</p>
        <p className="text-sm">{`State: ${offer.state}`}</p>
        <p className="text-sm">{moneyLine}</p>
        <p className="text-sm">{`Expires: ${expires}`}</p>
      </section>

      <section className="px-6 py-4 border-b border-black">
        <p className="text-base">Note:</p>
        <pre className="font-sans text-sm whitespace-pre-wrap">
          {offer.current_note ?? '—'}
        </pre>
      </section>

      <section className="px-6 py-4 border-b border-black">
        {isAssetBranch ? (
          <>
            <p className="text-base">Assets:</p>
            {assets === null ? (
              <p className="text-sm">(missing)</p>
            ) : (
              <ol className="text-sm">
                {assets.map((asset) => (
                  <li key={`${asset.position}-${asset.asset_id}`}>
                    {`${asset.position}. ${asset.asset_id.slice(0, 8)}`}
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <>
            <p className="text-base">Briefs:</p>
            {briefs === null ? (
              <p className="text-sm">(missing)</p>
            ) : (
              <ol className="text-sm">
                {briefs.map((brief) => {
                  const title = brief.spec?.title ?? '—'
                  const format = brief.spec?.deliverable_format ?? '—'
                  const days =
                    brief.spec?.deadline_offset_days != null
                      ? `${brief.spec.deadline_offset_days}d`
                      : '—'
                  return (
                    <li key={brief.position}>
                      {`${brief.position}. ${title} — ${format}, ${days}`}
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}
      </section>

      <section className="px-6 py-4">
        <p className="text-base">Rights:</p>
        {/* Scaffold-grade: JSON.stringify is a placeholder for a proper
            rights renderer. Replace here, not at callers. */}
        <pre className="font-sans text-sm whitespace-pre-wrap">
          {JSON.stringify(offer.rights, null, 2)}
        </pre>
      </section>
    </div>
  )
}

export default function OfferDetailClient({
  id,
}: {
  id: string
}): ReactElement {
  const { session, accessToken, status } = useSession()
  const selfUserId = session?.user?.id ?? null

  const [data, setData] = useState<LoadedDetail | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || accessToken === null) return
    let cancelled = false
    fetch(`/api/offers/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          setFetchFailed(true)
          return
        }
        const body = (await res.json()) as { data: LoadedDetail }
        if (cancelled) return
        setData(body.data)
      })
      .catch(() => {
        if (cancelled) return
        setFetchFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [status, accessToken, id])

  let view: OfferDetailView
  if (status === 'loading') {
    view = { kind: 'loading' }
  } else if (status === 'unauthenticated') {
    view = { kind: 'unauthenticated' }
  } else if (notFound) {
    view = { kind: 'not_found' }
  } else if (fetchFailed) {
    view = { kind: 'error' }
  } else if (data === null) {
    view = { kind: 'loading' }
  } else {
    view = {
      kind: 'loaded',
      offer: data.offer,
      assets: data.assets,
      briefs: data.briefs,
    }
  }

  return (
    <div className="max-w-3xl mx-auto bg-white">
      {renderOfferDetailBody(view, selfUserId)}
    </div>
  )
}
