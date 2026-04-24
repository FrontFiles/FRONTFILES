// ═══════════════════════════════════════════════════════════════
// Frontfiles — OfferDetailClient (P4 concern 4A.2.C2 Prompt 6 / §F1)
//
// Full rewrite of the SCAFFOLD component. Composes the rights
// renderer (P2), money + expiry displays (P3), action strip (P4),
// counter + reject dialogs (P5), and the state-chip SSOT (C1 §F4).
// Consumes the C1 party-profiles endpoint for counterparty identity
// and the Prompt-6-extended detail endpoint for the event trail.
//
// ─── Architecture (§R5 + §R6-pure) ──────────────────────────────
//
// Layer 1 — default export (component shell): owns useSession(),
// two fetch effects (detail + party-profiles), a mutation-state
// reducer, four mutation handlers assembled via
// `buildMutationHandlers`, and refs for the two native <dialog>
// elements.
//
// Layer 2 — `renderOfferDetailBody` (named export): pure
// args → ReactElement. No hooks, no network, no effects. Tested
// via `renderToString` in vitest's Node environment per §R6.
//
// ─── Mutation wiring (§SCOPE item 5 + §D6 + §D9) ────────────────
//
// Each mutation fires a POST, awaits the response, and on success
// triggers a detail-row refetch (§D6 — no optimistic UI). On
// failure the mutation state transitions to { status: 'error',
// kind, code, message } and the error line is rendered above the
// button strip.
//
// Counter submit synthesises the full request body from the
// dialog's (amount, note) + the current offer's unchanged
// `expires_at` + `rights` — v1 composer only changes price + note.
// Reject + cancel default `reasonCode = 'other'`; the UI does not
// prompt for a reason in v1 (§SCOPE item 7).
//
// ─── Event trail (§UI_DESIGN_GATE criterion 6) ──────────────────
//
// Flat <ol> below the Assets/Briefs section. One line per event:
//   `YYYY-MM-DD · Buyer|Creator|System · humanized event type · optional note`
// Tombstoned-user display_name values flow through `profiles`
// verbatim per `ECONOMIC_FLOW_v1.md §8.7.1` scrub sentinels.
//
// ─── Last-event-actor derivation ────────────────────────────────
//
// `OfferActions` requires a `lastEventActorRef: auth.users.id`.
// We derive it from the events list (most recent non-system event)
// + the offer's buyer_id / creator_id. System events are filtered
// out per state.ts D15.
//
// ─── Styling (§F9 / Design Canon) ───────────────────────────────
//
// Three colours only (black / Frontfiles blue / white). Radius 0.
// `font-sans` inherits the global `--font-sans` stack — platform-
// wide Neue Haas loading drift is tracked separately and not in
// this dispatch's scope (criterion 7 typography sub-clause is
// yellow platform-wide). Destructive maps to black per §D7.
// ═══════════════════════════════════════════════════════════════

'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react'

import { useSession } from '@/hooks/useSession'
import type {
  OfferAssetRow,
  OfferBriefRow,
  OfferEventActorRole,
  OfferEventViewRow,
  OfferRow,
  PartyProfile,
  PartyProfileMap,
  Rights,
} from '@/lib/offer'
import { formatExpiry } from '@/lib/offer/expiry-display'
import { formatGrossFee } from '@/lib/offer/money-display'
import { buildPartyProfileMap } from '@/lib/offer/party-profiles'
import { renderRights } from '@/lib/offer/rights-display'
import { offerStateChip } from '@/lib/offer/state-copy'

import {
  CounterComposerDialog,
  type CounterComposerDialogHandle,
} from './CounterComposerDialog'
import { OfferActions } from './OfferActions'
import {
  RejectConfirmDialog,
  type RejectConfirmDialogHandle,
} from './RejectConfirmDialog'

// ─── View + mutation types ──────────────────────────────────────

type LoadedDetail = {
  offer: OfferRow
  assets: OfferAssetRow[] | null
  briefs: OfferBriefRow[] | null
  events: OfferEventViewRow[]
}

export type OfferDetailView =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | ({ kind: 'loaded' } & LoadedDetail)

export type MutationKind = 'accept' | 'counter' | 'reject' | 'cancel'

export type MutationState =
  | { status: 'idle' }
  | { status: 'submitting'; kind: MutationKind }
  | { status: 'error'; kind: MutationKind; code: string; message: string }

type MutationStrip = 'idle' | 'submitting' | 'error'

function mutationStrip(s: MutationState): MutationStrip {
  if (s.status === 'submitting') return 'submitting'
  if (s.status === 'error') return 'error'
  return 'idle'
}

export type DialogRefs = {
  counterRef: RefObject<CounterComposerDialogHandle | null>
  rejectRef: RefObject<RejectConfirmDialogHandle | null>
}

// ─── Pure helpers (exported for testability) ────────────────────

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
 * Derive `lastEventActorRef` (an auth.users.id, or null) from the
 * events list. Filters out `system` sentinel events per state.ts
 * D15, walks the events from most-recent backward, and maps the
 * first non-system event's `actor_role` to the corresponding
 * party's user_id via the offer row. Returns null when no
 * non-system events exist (edge case that shouldn't happen post
 * offer.created but handled defensively).
 */
export function deriveLastEventActorUserId(
  events: readonly OfferEventViewRow[],
  offer: OfferRow,
): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const evt = events[i]
    if (evt === undefined) continue
    if (evt.actor_role === 'system') continue
    if (evt.actor_role === 'buyer') return offer.buyer_id
    if (evt.actor_role === 'creator') return offer.creator_id
  }
  return null
}

/**
 * Humanize `event_type` for the round-history trail. Unknown values
 * fall through verbatim so a spec drift is visible, not silently
 * masked.
 */
export function humanizeEventType(event_type: string): string {
  switch (event_type) {
    case 'offer.created':
      return 'opened the offer'
    case 'offer.countered':
      return 'countered'
    case 'offer.accepted':
      return 'accepted'
    case 'offer.rejected':
      return 'rejected'
    case 'offer.cancelled':
      return 'cancelled'
    case 'offer.expired':
      return 'expired'
    default:
      return event_type
  }
}

export function capitalizeRole(role: OfferEventActorRole): string {
  return role === 'buyer' ? 'Buyer' : role === 'creator' ? 'Creator' : 'System'
}

/**
 * Best-effort note extraction from a ledger-event payload. Payload
 * shape is unknown at this layer (§8.2 discipline); the event trail
 * is informational, so missing notes degrade gracefully.
 */
export function extractEventNote(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const note = (payload as Record<string, unknown>).note
  if (typeof note === 'string' && note.trim().length > 0) return note
  return null
}

function errorLinePrefix(kind: MutationKind): string {
  switch (kind) {
    case 'accept':
      return 'Could not accept offer.'
    case 'counter':
      return 'Could not counter offer.'
    case 'reject':
      return 'Could not reject offer.'
    case 'cancel':
      return 'Could not cancel offer.'
  }
}

function buildCounterpartyLine(
  counterpartyId: string | null,
  profile: PartyProfile | undefined,
): string | null {
  if (counterpartyId === null) return null
  if (profile === undefined) {
    // Fallback: show id prefix when party-profiles did not resolve
    // this party (flag-off short-circuit or RLS-gated branch).
    return `Counterparty: ${counterpartyId.slice(0, 8)}…`
  }
  return `Counterparty: ${profile.display_name} (@${profile.username})`
}

// ─── Mutation handler factory (exported for Prompt 9 tests) ─────

export interface MutationHandlerDeps {
  accessToken: string
  offerId: string
  offer: OfferRow
  refetchDetail: () => Promise<void>
  setMutationState: (s: MutationState) => void
  closeCounter: () => void
  closeReject: () => void
  fetchImpl?: typeof fetch
}

export interface MutationHandlers {
  onAccept: () => Promise<void>
  onCounter: (amount: number, note: string | null) => Promise<void>
  onReject: () => Promise<void>
  onCancel: () => Promise<void>
}

export function buildMutationHandlers(
  deps: MutationHandlerDeps,
): MutationHandlers {
  const {
    accessToken,
    offerId,
    offer,
    refetchDetail,
    setMutationState,
    closeCounter,
    closeReject,
    fetchImpl = fetch,
  } = deps

  async function postJson(
    path: string,
    body: unknown,
    kind: MutationKind,
  ): Promise<void> {
    setMutationState({ status: 'submitting', kind })
    try {
      const res = await fetchImpl(path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let code = 'UNKNOWN'
        let message = 'Unknown error'
        try {
          const parsed = (await res.json()) as {
            error?: { code?: string; message?: string }
          }
          if (parsed.error?.code !== undefined) code = parsed.error.code
          if (parsed.error?.message !== undefined) {
            message = parsed.error.message
          }
        } catch {
          // Fall through to default.
        }
        setMutationState({ status: 'error', kind, code, message })
        return
      }
      setMutationState({ status: 'idle' })
      await refetchDetail()
    } catch {
      setMutationState({
        status: 'error',
        kind,
        code: 'NETWORK_ERROR',
        message: 'Network error',
      })
    }
  }

  return {
    onAccept: () => postJson(`/api/offers/${offerId}/accept`, {}, 'accept'),
    onCounter: async (amount, note) => {
      // Compose the B2 counter body. `expires_at` + `rights` +
      // composition stay unchanged this round — v1 composer only
      // changes price + note. Echoing `offer.rights` verbatim passes
      // `RightsSchema` because it was validated on the prior write.
      await postJson(
        `/api/offers/${offerId}/counter`,
        {
          newGrossFee: amount,
          newNote: note ?? '',
          newExpiresAt: offer.expires_at,
          newRights: offer.rights,
        },
        'counter',
      )
      closeCounter()
    },
    onReject: async () => {
      await postJson(
        `/api/offers/${offerId}/reject`,
        { reasonCode: 'other' },
        'reject',
      )
      closeReject()
    },
    onCancel: () =>
      postJson(
        `/api/offers/${offerId}/cancel`,
        { reasonCode: 'other' },
        'cancel',
      ),
  }
}

// ─── Pure render helper (exported, test surface) ────────────────

export interface RenderOfferDetailBodyArgs {
  view: OfferDetailView
  selfUserId: string | null
  profiles: PartyProfileMap
  mutationState: MutationState
  refs: DialogRefs
  onAccept: () => void
  onCounterOpen: () => void
  onCounterSubmit: (amount: number, note: string | null) => void
  onRejectOpen: () => void
  onRejectConfirm: () => void
  onCancel: () => void
  /** Override for deterministic expiry rendering in tests. */
  now?: Date
}

export function renderOfferDetailBody(
  args: RenderOfferDetailBodyArgs,
): ReactElement {
  const {
    view,
    selfUserId,
    profiles,
    mutationState,
    refs,
    onAccept,
    onCounterOpen,
    onCounterSubmit,
    onRejectOpen,
    onRejectConfirm,
    onCancel,
    now,
  } = args

  if (view.kind === 'loading') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">
        Loading offer…
      </p>
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
      <p className="font-sans text-sm text-black px-6 py-4">
        Offer not found.
      </p>
    )
  }
  if (view.kind === 'error') {
    return (
      <p className="font-sans text-sm text-black px-6 py-4">
        Could not load this offer.
      </p>
    )
  }

  const { offer, assets, briefs, events } = view
  const role = deriveRole(offer, selfUserId)
  const expiryNow = now ?? new Date()
  const moneyLine =
    role === 'buyer' || role === 'creator'
      ? formatGrossFee(
          offer.gross_fee,
          offer.currency,
          offer.platform_fee_bps,
          role,
        )
      : `${offer.gross_fee} ${offer.currency}`
  const expiryLine = formatExpiry(offer.expires_at, expiryNow)
  const isAssetBranch =
    offer.target_type === 'single_asset' || offer.target_type === 'asset_pack'

  const counterpartyId =
    role === 'buyer'
      ? offer.creator_id
      : role === 'creator'
        ? offer.buyer_id
        : null
  const counterpartyProfile =
    counterpartyId !== null ? profiles[counterpartyId] : undefined
  const counterpartyLine = buildCounterpartyLine(
    counterpartyId,
    counterpartyProfile,
  )

  const lastEventActorRef = deriveLastEventActorUserId(events, offer)

  // Counter-round count per SPECIAL_OFFER_SPEC.md §C.3 L109-111
  // (3-round cap — 4th counter blocked).
  const counterCount = events.filter(
    (e) => e.event_type === 'offer.countered',
  ).length
  const roundLimitReached = counterCount >= 3

  const strip = mutationStrip(mutationState)

  const errorBlock =
    mutationState.status === 'error' ? (
      <div className="px-6 pt-4">
        <p className="text-sm font-bold text-black">
          {errorLinePrefix(mutationState.kind)}
        </p>
        <details className="text-[10px] uppercase tracking-widest text-black mt-1">
          <summary>Details</summary>
          <span>{`${mutationState.code} — ${mutationState.message}`}</span>
        </details>
      </div>
    ) : null

  return (
    <div className="font-sans text-black bg-white">
      <section className="px-6 py-4 border-b border-black">
        <h1 className="text-lg">{`Offer ${offer.id.slice(0, 8)}`}</h1>
        <p className="text-sm">{roleLine(role)}</p>
        {counterpartyLine !== null && (
          <p className="text-sm">{counterpartyLine}</p>
        )}
        <p className="text-sm">{`Status: ${offerStateChip(offer.state)}`}</p>
        <p className="text-sm">{moneyLine}</p>
        <p className="text-sm">{`Expiry: ${expiryLine}`}</p>
      </section>

      <section className="px-6 py-4 border-b border-black">
        <p className="text-base">Note</p>
        <p className="font-sans text-sm whitespace-pre-wrap">
          {offer.current_note ?? '—'}
        </p>
      </section>

      <section className="px-6 py-4 border-b border-black">
        {isAssetBranch ? (
          <>
            <p className="text-base">Assets</p>
            {assets === null || assets.length === 0 ? (
              <p className="text-sm">(none)</p>
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
            <p className="text-base">Briefs</p>
            {briefs === null || briefs.length === 0 ? (
              <p className="text-sm">(none)</p>
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

      <section className="px-6 py-4 border-b border-black">
        <p className="text-base">Rights</p>
        <div className="text-sm">{renderRights(offer.rights as Rights)}</div>
      </section>

      <section className="px-6 py-4 border-b border-black">
        <p className="text-base">Round history</p>
        {events.length === 0 ? (
          <p className="text-sm">No events yet.</p>
        ) : (
          <ol className="text-sm">
            {events.map((evt) => {
              const date = evt.created_at.slice(0, 10)
              const actor = capitalizeRole(evt.actor_role)
              const verb = humanizeEventType(evt.event_type)
              const note = extractEventNote(evt.payload)
              const base = `${date} · ${actor} · ${verb}`
              return (
                <li key={evt.id}>
                  {note !== null ? `${base} — ${note}` : base}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {role !== 'none' && selfUserId !== null && (
        <>
          {errorBlock}
          <section className="px-6 py-4">
            <OfferActions
              offer={offer}
              selfUserId={selfUserId}
              lastEventActorRef={lastEventActorRef}
              mutationState={strip}
              onAccept={onAccept}
              onCounter={onCounterOpen}
              onReject={onRejectOpen}
              onCancel={onCancel}
            />
          </section>
          <CounterComposerDialog
            ref={refs.counterRef}
            onSubmit={onCounterSubmit}
            roundLimitReached={roundLimitReached}
          />
          <RejectConfirmDialog ref={refs.rejectRef} onConfirm={onRejectConfirm} />
        </>
      )}
    </div>
  )
}

// ─── Component shell ────────────────────────────────────────────

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
  const [profiles, setProfiles] = useState<PartyProfileMap>({})
  const [mutationState, setMutationState] = useState<MutationState>({
    status: 'idle',
  })

  const counterRef = useRef<CounterComposerDialogHandle | null>(null)
  const rejectRef = useRef<RejectConfirmDialogHandle | null>(null)

  // Refetch trigger — bumped after a successful mutation so the
  // detail-fetch effect below re-runs and pulls the new offer state
  // + event trail.
  const [refetchCounter, setRefetchCounter] = useState(0)
  const refetchDetail = useCallback(async () => {
    setRefetchCounter((n) => n + 1)
  }, [])

  // Detail fetch. Keyed on (status, accessToken, id, refetchCounter).
  useEffect(() => {
    if (status !== 'authenticated' || accessToken === null) return
    let cancelled = false
    setFetchFailed(false)
    setNotFound(false)
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
  }, [status, accessToken, id, refetchCounter])

  // Party-profiles fetch — once per (buyer_id, creator_id). Q2
  // ratified: counterparty identity is stable across state
  // transitions, so no refetch after mutations.
  const buyerId = data?.offer.buyer_id
  const creatorId = data?.offer.creator_id
  useEffect(() => {
    if (status !== 'authenticated' || accessToken === null) return
    if (buyerId === undefined || creatorId === undefined) return
    const idsCsv = [buyerId, creatorId].join(',')
    let cancelled = false
    fetch(`/api/offers/party-profiles?ids=${encodeURIComponent(idsCsv)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) return
        const body = (await res.json()) as { users: PartyProfile[] }
        if (cancelled) return
        setProfiles(buildPartyProfileMap(body.users ?? []))
      })
      .catch(() => {
        // Graceful-empty — counterparty line falls back to id prefix.
      })
    return () => {
      cancelled = true
    }
  }, [status, accessToken, buyerId, creatorId])

  // Stable close-closures — declared outside useMemo so the memo
  // body never dereferences `.current` during render (lint rule:
  // "Cannot access refs during render"). The closures themselves
  // run only when invoked (post-fetch success), not at memo creation.
  const closeCounter = useCallback(() => {
    counterRef.current?.close()
  }, [])
  const closeReject = useCallback(() => {
    rejectRef.current?.close()
  }, [])

  const handlers = useMemo<MutationHandlers>(() => {
    if (accessToken === null || data === null) {
      const noop = async (): Promise<void> => {}
      return { onAccept: noop, onCounter: noop, onReject: noop, onCancel: noop }
    }
    // The factory stores `closeCounter` / `closeReject` inside handler
    // closures; `.current` is read only when a handler runs (post-
    // fetch success), never during render. The `react-hooks/refs`
    // rule traces through the useCallback-stable closures and fires a
    // false positive — safe to suppress.
    // eslint-disable-next-line react-hooks/refs
    return buildMutationHandlers({
      accessToken,
      offerId: id,
      offer: data.offer,
      refetchDetail,
      setMutationState,
      closeCounter,
      closeReject,
    })
  }, [accessToken, id, data, refetchDetail, closeCounter, closeReject])

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
    view = { kind: 'loaded', ...data }
  }

  const onCounterOpen = useCallback(() => counterRef.current?.show(), [])
  const onRejectOpen = useCallback(() => rejectRef.current?.show(), [])

  return (
    <div className="max-w-3xl mx-auto bg-white">
      {renderOfferDetailBody({
        view,
        selfUserId,
        profiles,
        mutationState,
        refs: { counterRef, rejectRef },
        onAccept: () => void handlers.onAccept(),
        onCounterOpen,
        onCounterSubmit: (amount, note) => void handlers.onCounter(amount, note),
        onRejectOpen,
        onRejectConfirm: () => void handlers.onReject(),
        onCancel: () => void handlers.onCancel(),
      })}
    </div>
  )
}
