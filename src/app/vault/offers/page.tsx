'use client'

import { useState } from 'react'
import { VaultLeftRail, type VaultSection } from '@/components/platform/VaultLeftRail'
import { EmptyPanel } from '@/components/platform/Panel'
import {
  DIRECT_OFFER_STATUS_LABELS,
  LICENCE_TYPE_LABELS,
  DIRECT_OFFER_MAX_ROUNDS,
  TERMINAL_OFFER_STATUSES,
} from '@/lib/types'
import type {
  PrivacyState,
  DirectOfferThread,
  DirectOfferStatus,
  DirectOfferEvent,
  DirectOfferEventType,
} from '@/lib/types'
import { mockVaultAssets } from '@/lib/mock-data'

// ══════════════════════════════════════════════
// MOCK DATA — with negotiation messages
// ══════════════════════════════════════════════

const mockThreads: DirectOfferThread[] = [
  {
    id: 'offer-thread-0001',
    assetId: 'asset-001',
    buyerId: 'buyer-001',
    creatorId: 'sarahchen',
    licenceType: 'editorial',
    listedPriceAtOpen: 15000,
    currentOfferAmount: 11000,
    currentOfferBy: 'buyer',
    roundCount: 1,
    creatorResponseWindowMinutes: 240,
    expiresAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    status: 'buyer_offer_pending_creator',
    acceptedAmount: null,
    checkoutIntentId: null,
    createdAt: '2026-04-10T09:00:00Z',
    updatedAt: '2026-04-10T09:00:00Z',
    resolvedAt: null,
    autoCancelReason: null,
  },
  {
    id: 'offer-thread-0002',
    assetId: 'asset-003',
    buyerId: 'buyer-002',
    creatorId: 'sarahchen',
    licenceType: 'commercial',
    listedPriceAtOpen: 25000,
    currentOfferAmount: 20000,
    currentOfferBy: 'creator',
    roundCount: 2,
    creatorResponseWindowMinutes: 240,
    expiresAt: new Date(Date.now() + 1 * 60 * 60_000).toISOString(),
    status: 'creator_counter_pending_buyer',
    acceptedAmount: null,
    checkoutIntentId: null,
    createdAt: '2026-04-09T14:00:00Z',
    updatedAt: '2026-04-10T08:30:00Z',
    resolvedAt: null,
    autoCancelReason: null,
  },
  {
    id: 'offer-thread-0003',
    assetId: 'asset-002',
    buyerId: 'buyer-001',
    creatorId: 'sarahchen',
    licenceType: 'editorial',
    listedPriceAtOpen: 12000,
    currentOfferAmount: 10000,
    currentOfferBy: 'buyer',
    roundCount: 1,
    creatorResponseWindowMinutes: 240,
    expiresAt: '2026-04-08T15:00:00Z',
    status: 'completed',
    acceptedAmount: 10000,
    checkoutIntentId: 'offer-intent-0001',
    createdAt: '2026-04-07T10:00:00Z',
    updatedAt: '2026-04-08T11:00:00Z',
    resolvedAt: '2026-04-08T11:00:00Z',
    autoCancelReason: null,
  },
]

const mockEvents: DirectOfferEvent[] = [
  { id: 'evt-001', threadId: 'offer-thread-0001', type: 'buyer_offer', actorId: 'buyer-001', amount: 11000, message: 'Planning a feature on flooding in Southeast Asia for our Q3 print issue. Would use this as the lead image. Single print run, 50k circulation.', metadata: null, createdAt: '2026-04-10T09:00:00Z' },
  { id: 'evt-002', threadId: 'offer-thread-0002', type: 'buyer_offer', actorId: 'buyer-002', amount: 18000, message: 'For a commercial campaign — regional digital only, 6-month usage window. Happy to discuss terms.', metadata: null, createdAt: '2026-04-09T14:00:00Z' },
  { id: 'evt-003', threadId: 'offer-thread-0002', type: 'creator_counter', actorId: 'sarahchen', amount: 20000, message: 'Appreciate the context. For commercial digital usage at this scope I can do €200. This accounts for the exclusivity premium in this geography.', metadata: null, createdAt: '2026-04-10T08:30:00Z' },
  { id: 'evt-004', threadId: 'offer-thread-0003', type: 'buyer_offer', actorId: 'buyer-001', amount: 10000, message: 'Editorial use for online long-read feature. Single publication.', metadata: null, createdAt: '2026-04-07T10:00:00Z' },
  { id: 'evt-005', threadId: 'offer-thread-0003', type: 'creator_accept', actorId: 'sarahchen', amount: 10000, message: null, metadata: null, createdAt: '2026-04-08T11:00:00Z' },
  { id: 'evt-006', threadId: 'offer-thread-0003', type: 'completed', actorId: 'system', amount: null, message: null, metadata: null, createdAt: '2026-04-08T15:00:00Z' },
]

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════

const STATUS_STYLES: Record<DirectOfferStatus, string> = {
  buyer_offer_pending_creator: 'border-[#0000ff] text-[#0000ff]',
  creator_counter_pending_buyer: 'border-slate-400 text-slate-500',
  buyer_counter_pending_creator: 'border-[#0000ff] text-[#0000ff]',
  accepted_pending_checkout: 'bg-black text-white border-black',
  declined: 'border-slate-300 text-slate-400',
  expired: 'border-slate-200 text-slate-300',
  auto_cancelled: 'border-slate-200 text-slate-300',
  completed: 'bg-black text-white border-black',
}

const EVENT_LABELS: Record<DirectOfferEventType, string> = {
  buyer_offer: 'Buyer offer',
  creator_counter: 'Creator counter',
  buyer_counter: 'Buyer counter',
  creator_accept: 'Creator accepted',
  buyer_accept: 'Buyer accepted',
  creator_decline: 'Creator declined',
  expired: 'Expired',
  auto_cancelled: 'Auto-cancelled',
  checkout_started: 'Checkout started',
  completed: 'Completed',
}

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════

export default function OffersPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null)

  // Live thread + event state (seeded from mock, updated by API responses)
  const [threads, setThreads] = useState<DirectOfferThread[]>(mockThreads)
  const [allEvents, setAllEvents] = useState<DirectOfferEvent[]>(mockEvents)

  const handleThreadUpdate = (updated: DirectOfferThread, updatedEvents: DirectOfferEvent[]) => {
    setThreads(prev => prev.map(t => t.id === updated.id ? updated : t))
    setAllEvents(prev => {
      const other = prev.filter(e => e.threadId !== updated.id)
      return [...other, ...updatedEvents]
    })
  }

  const activeThreads = threads.filter(t => !TERMINAL_OFFER_STATUSES.includes(t.status))
  const resolvedThreads = threads.filter(t => TERMINAL_OFFER_STATUSES.includes(t.status))

  const getAssetTitle = (assetId: string) =>
    mockVaultAssets.find(a => a.id === assetId)?.title ?? assetId

  const getThreadEvents = (threadId: string) =>
    allEvents.filter(e => e.threadId === threadId).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

  const formatTimeRemaining = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) return 'Expired'
    const hours = Math.floor(ms / 3_600_000)
    const mins = Math.floor((ms % 3_600_000) / 60_000)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        <VaultLeftRail
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          privacyFilter={privacyFilter}
          onPrivacyFilterChange={setPrivacyFilter}
          onUploadClick={() => {}}
        />
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl flex flex-col gap-8">
            <h1 className="text-2xl font-bold text-black tracking-tight">Direct Offers</h1>

            {/* Active */}
            {activeThreads.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Active ({activeThreads.length})
                </span>
                {activeThreads.map(thread => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    assetTitle={getAssetTitle(thread.assetId)}
                    events={getThreadEvents(thread.id)}
                    expanded={expandedThreadId === thread.id}
                    onToggle={() => setExpandedThreadId(expandedThreadId === thread.id ? null : thread.id)}
                    timeRemaining={formatTimeRemaining(thread.expiresAt)}
                    onThreadUpdate={handleThreadUpdate}
                  />
                ))}
              </div>
            )}

            {/* Resolved */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Resolved ({resolvedThreads.length})
              </span>
              {resolvedThreads.length > 0 ? (
                resolvedThreads.map(thread => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    assetTitle={getAssetTitle(thread.assetId)}
                    events={getThreadEvents(thread.id)}
                    expanded={expandedThreadId === thread.id}
                    onToggle={() => setExpandedThreadId(expandedThreadId === thread.id ? null : thread.id)}
                    timeRemaining={null}
                    onThreadUpdate={handleThreadUpdate}
                  />
                ))
              ) : (
                <EmptyPanel message="No resolved offers" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// THREAD CARD
// ══════════════════════════════════════════════

function ThreadCard({
  thread,
  assetTitle,
  events,
  expanded,
  onToggle,
  timeRemaining,
  onThreadUpdate,
}: {
  thread: DirectOfferThread
  assetTitle: string
  events: DirectOfferEvent[]
  expanded: boolean
  onToggle: () => void
  timeRemaining: string | null
  onThreadUpdate: (thread: DirectOfferThread, events: DirectOfferEvent[]) => void
}) {
  const [counterAmount, setCounterAmount] = useState('')
  const [counterMessage, setCounterMessage] = useState('')
  const [declineMessage, setDeclineMessage] = useState('')
  const [showDeclineForm, setShowDeclineForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isCreatorTurn =
    thread.status === 'buyer_offer_pending_creator' ||
    thread.status === 'buyer_counter_pending_creator'
  const canCounter = isCreatorTurn && thread.roundCount < DIRECT_OFFER_MAX_ROUNDS

  // Find the latest message from the counterparty (buyer message for creator view)
  const latestCounterpartyEvent = [...events]
    .reverse()
    .find(e => (e.type === 'buyer_offer' || e.type === 'buyer_counter') && e.message)

  return (
    <div className={`border-2 ${isCreatorTurn ? 'border-[#0000ff]' : 'border-black'}`}>
      {/* ── Header — always visible ── */}
      <button onClick={onToggle} className="w-full px-5 py-4 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${STATUS_STYLES[thread.status]}`}>
                {DIRECT_OFFER_STATUS_LABELS[thread.status]}
              </span>
              <span className="text-[10px] text-slate-400">
                Round {thread.roundCount}/{DIRECT_OFFER_MAX_ROUNDS}
              </span>
              {timeRemaining && (
                <span className={`text-[10px] font-mono ${timeRemaining === 'Expired' ? 'text-red-500' : 'text-slate-400'}`}>
                  {timeRemaining}
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-black truncate">{assetTitle}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {LICENCE_TYPE_LABELS[thread.licenceType]} · Listed: €{(thread.listedPriceAtOpen / 100).toFixed(2)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-lg font-bold text-black">
              €{(thread.currentOfferAmount / 100).toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400">
              {thread.currentOfferBy === 'buyer' ? 'Buyer offer' : 'Your counter'}
            </div>
          </div>
        </div>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="border-t border-slate-200">

          {/* Buyer message — prominent when creator must decide */}
          {isCreatorTurn && latestCounterpartyEvent?.message && (
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Buyer note</span>
              <p className="text-xs text-black leading-relaxed">{latestCounterpartyEvent.message}</p>
            </div>
          )}

          {/* Negotiation timeline */}
          <div className="px-5 py-4">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Negotiation</span>
            <div className="flex flex-col gap-3">
              {events.map(evt => (
                <NegotiationEvent key={evt.id} event={evt} />
              ))}
            </div>
          </div>

          {/* ── Creator action panel ── */}
          {isCreatorTurn && !showDeclineForm && (
            <div className="border-t border-slate-200 px-5 py-4">
              {/* Accept */}
              <button
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true)
                  try {
                    const res = await fetch(`/api/special-offer/${thread.id}/accept`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ actorId: thread.creatorId, role: 'creator' }),
                    })
                    if (res.ok) {
                      const { data } = await res.json()
                      onThreadUpdate(data.thread, data.events)
                    }
                  } finally { setSubmitting(false) }
                }}
                className="h-9 px-4 text-xs bg-[#0000ff] text-white font-bold uppercase tracking-wide hover:bg-[#0000cc] transition-colors disabled:opacity-50"
              >
                Accept €{(thread.currentOfferAmount / 100).toFixed(2)}
              </button>

              {/* Counter form */}
              {canCounter && (
                <div className="mt-4 border border-slate-200 p-4">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Counter-offer</span>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Counter price (€)</label>
                      <input
                        type="number"
                        value={counterAmount}
                        onChange={e => setCounterAmount(e.target.value)}
                        placeholder={(thread.currentOfferAmount / 100).toFixed(2)}
                        className="h-10 w-full px-3 border border-slate-200 text-sm font-mono font-bold focus:border-black focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        Counter note
                        <span className="text-slate-300 ml-1">Optional</span>
                      </label>
                      <textarea
                        value={counterMessage}
                        onChange={e => setCounterMessage(e.target.value)}
                        placeholder="Rationale, rights scope, pricing context"
                        rows={2}
                        maxLength={500}
                        className="px-3 py-2 border border-slate-200 text-xs text-black leading-relaxed resize-none focus:border-black focus:outline-none"
                      />
                    </div>
                    <button
                      disabled={submitting || !counterAmount}
                      onClick={async () => {
                        const cents = Math.round(parseFloat(counterAmount) * 100)
                        if (!cents || cents <= 0) return
                        setSubmitting(true)
                        try {
                          const res = await fetch(`/api/special-offer/${thread.id}/counter`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              actorId: thread.creatorId,
                              role: 'creator',
                              amount: cents,
                              message: counterMessage || null,
                            }),
                          })
                          if (res.ok) {
                            const { data } = await res.json()
                            onThreadUpdate(data.thread, data.events)
                            setCounterAmount('')
                            setCounterMessage('')
                          }
                        } finally { setSubmitting(false) }
                      }}
                      className="h-9 w-full text-xs border-2 border-black text-black font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                    >
                      Send counter
                    </button>
                  </div>
                </div>
              )}

              {!canCounter && thread.roundCount >= DIRECT_OFFER_MAX_ROUNDS && (
                <p className="text-[10px] text-slate-400 mt-3">
                  Maximum {DIRECT_OFFER_MAX_ROUNDS} negotiation rounds reached. Accept or decline.
                </p>
              )}

              {/* Decline trigger */}
              <button
                onClick={() => setShowDeclineForm(true)}
                className="mt-3 h-8 px-4 text-[10px] border border-slate-200 text-slate-400 font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors"
              >
                Decline
              </button>
            </div>
          )}

          {/* ── Decline form ── */}
          {isCreatorTurn && showDeclineForm && (
            <div className="border-t border-slate-200 px-5 py-4">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Decline offer</span>
              <div className="flex flex-col gap-3">
                <textarea
                  value={declineMessage}
                  onChange={e => setDeclineMessage(e.target.value)}
                  placeholder="Reason for declining (optional)"
                  rows={2}
                  maxLength={500}
                  className="px-3 py-2 border border-slate-200 text-xs text-black leading-relaxed resize-none focus:border-black focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true)
                      try {
                        const res = await fetch(`/api/special-offer/${thread.id}/decline`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            actorId: thread.creatorId,
                            message: declineMessage || null,
                          }),
                        })
                        if (res.ok) {
                          const { data } = await res.json()
                          onThreadUpdate(data.thread, data.events)
                          setShowDeclineForm(false)
                          setDeclineMessage('')
                        }
                      } finally { setSubmitting(false) }
                    }}
                    className="h-9 px-4 text-xs bg-black text-white font-bold uppercase tracking-wide hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Confirm decline
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(false)}
                    className="h-9 px-4 text-xs border border-slate-200 text-slate-400 font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Terminal states ── */}
          {thread.status === 'accepted_pending_checkout' && thread.acceptedAmount != null && (
            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-black">Accepted at €{(thread.acceptedAmount / 100).toFixed(2)}</span>
                <span className="text-[10px] text-slate-400">Awaiting buyer checkout</span>
              </div>
            </div>
          )}

          {thread.status === 'completed' && thread.acceptedAmount != null && (
            <div className="border-t border-slate-200 px-5 py-4 flex items-center gap-2">
              <div className="w-5 h-5 bg-black flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white">
                  <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm font-bold text-black">Completed — €{(thread.acceptedAmount / 100).toFixed(2)}</span>
            </div>
          )}

          {thread.status === 'declined' && (
            <div className="border-t border-slate-200 px-5 py-4">
              <span className="text-xs text-slate-400">Offer declined</span>
              {events.find(e => e.type === 'creator_decline')?.message && (
                <p className="text-xs text-slate-500 mt-1">
                  {events.find(e => e.type === 'creator_decline')!.message}
                </p>
              )}
            </div>
          )}

          {thread.status === 'expired' && (
            <div className="border-t border-slate-200 px-5 py-4">
              <span className="text-xs text-slate-400">Response window expired</span>
            </div>
          )}

          {thread.status === 'auto_cancelled' && thread.autoCancelReason && (
            <div className="border-t border-slate-200 px-5 py-4">
              <span className="text-xs text-slate-400">
                Auto-cancelled — {thread.autoCancelReason.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// NEGOTIATION EVENT — timeline row with message
// ══════════════════════════════════════════════

function NegotiationEvent({ event }: { event: DirectOfferEvent }) {
  const isPriceEvent = event.amount != null
  const isSystemEvent = event.actorId === 'system'

  return (
    <div className={`flex gap-3 ${isSystemEvent ? 'opacity-50' : ''}`}>
      {/* Timestamp */}
      <div className="w-24 shrink-0 pt-0.5">
        <span className="font-mono text-[10px] text-slate-300">
          {new Date(event.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          {' '}
          {new Date(event.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-bold">{EVENT_LABELS[event.type]}</span>
          {isPriceEvent && (
            <span className="font-mono text-xs font-bold text-black">€{(event.amount! / 100).toFixed(2)}</span>
          )}
        </div>
        {event.message && (
          <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{event.message}</p>
        )}
      </div>
    </div>
  )
}
