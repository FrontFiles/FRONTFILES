// ═══════════════════════════════════════════════════════════════
// Frontfiles — OffersListClient (P4 concern 4A.2 SCAFFOLD §F3)
//
// Client-side list view for /vault/offers. Consumes
// GET /api/offers (shipped at f34df12) via a useSession-sourced
// Bearer token. Pairs with the pure render helper exported from
// this same file so the view layer is unit-testable under
// Vitest's Node environment.
//
// ─── Architecture (§R5 + §R6) ───────────────────────────────────
//
// Layer 1 — this component (default export): owns useSession(),
// the fetch effect, and the reduction to an OffersListView. The
// component is orphaned by design until Prompt 5 wires it into
// the server-component wrapper at vault/offers/page.tsx (§R5).
//
// Layer 2 — renderOffersListBody (named export below): pure
// function from (view, selfUserId) → ReactElement. No hooks, no
// network, no effects. Trivially testable via renderToString
// without RTL / jsdom — the §R6 workaround for the repo's
// absent client-test infrastructure.
//
// ─── Known scaffold compromises ─────────────────────────────────
//
// • §D5 — counterparty handle fallback renders the first 8 chars
//   of the *other* party's auth_user_id. Proper handle
//   resolution lives in a follow-up concern; replace here, not
//   at callers.
// • §F6 brutalist baseline — no component library, no icons, no
//   greys for text content. Focus rings are the single
//   sanctioned accessibility deviation.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useEffect, useState, type ReactElement } from 'react'
import Link from 'next/link'

import { useSession } from '@/hooks/useSession'
import type { OfferRow } from '@/lib/offer'

// View-state union: what the component reduces (session-status,
// fetch-state) into before handing off to the pure helper.
export type OffersListView =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }
  | { kind: 'loaded'; offers: OfferRow[]; truncated: boolean }

function formatExpiresAt(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/**
 * Pure render helper — no hooks, no network, no effects.
 *
 * `selfUserId` is `auth.users.id` of the caller; used to pick the
 * *other* party's id for the §D5 counterparty-handle fallback
 * (replace at this helper with real handle resolution in a
 * follow-up concern).
 */
export function renderOffersListBody(
  view: OffersListView,
  selfUserId: string | null,
): ReactElement {
  if (view.kind === 'loading') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">Loading offers…</p>
    )
  }
  if (view.kind === 'unauthenticated') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">
        Sign in to view your offers.
      </p>
    )
  }
  if (view.kind === 'error') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">
        Could not load offers.
      </p>
    )
  }
  if (view.offers.length === 0) {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">No offers yet.</p>
    )
  }
  return (
    <div className="font-sans text-black bg-white">
      {view.truncated ? (
        <p className="text-sm px-6 py-4 border-b border-black">
          Showing first 100 offers.
        </p>
      ) : null}
      <ul className="m-0 p-0 list-none">
        {view.offers.map((offer) => {
          // §D5 counterparty fallback — replace with real handle
          // resolution in follow-up concern.
          const counterpartyId =
            selfUserId === null
              ? null
              : offer.buyer_id === selfUserId
                ? offer.creator_id
                : offer.buyer_id
          const handle =
            counterpartyId === null ? '—' : counterpartyId.slice(0, 8)
          const expires = formatExpiresAt(offer.expires_at)
          return (
            <li key={offer.id} className="border-b border-black">
              {/* focus-visible outline is the §F6-sanctioned a11y deviation. */}
              <Link
                href={`/vault/offers/${offer.id}`}
                className="grid grid-cols-5 gap-4 px-6 py-4 text-base text-black focus-visible:outline focus-visible:outline-black"
              >
                <span className="text-blue-600">{handle}</span>
                <span>{offer.target_type}</span>
                <span>{`${offer.gross_fee} ${offer.currency}`}</span>
                <span>{offer.state}</span>
                <span>{expires}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function OffersListClient(): ReactElement {
  const { session, accessToken, status } = useSession()
  const selfUserId = session?.user?.id ?? null

  const [data, setData] = useState<
    { offers: OfferRow[]; truncated: boolean } | null
  >(null)
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || accessToken === null) return
    let cancelled = false
    fetch('/api/offers', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setFetchFailed(true)
          return
        }
        const body = (await res.json()) as {
          data: { offers: OfferRow[]; truncated: boolean }
        }
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
  }, [status, accessToken])

  let view: OffersListView
  if (status === 'loading') {
    view = { kind: 'loading' }
  } else if (status === 'unauthenticated') {
    view = { kind: 'unauthenticated' }
  } else if (fetchFailed) {
    view = { kind: 'error' }
  } else if (data === null) {
    view = { kind: 'loading' }
  } else {
    view = { kind: 'loaded', offers: data.offers, truncated: data.truncated }
  }

  return (
    <div className="max-w-3xl mx-auto bg-white">
      {renderOffersListBody(view, selfUserId)}
    </div>
  )
}
