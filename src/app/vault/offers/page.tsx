'use client'

import { useState, useReducer } from 'react'
import { VaultLeftRail, type VaultSection } from '@/components/platform/VaultLeftRail'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { OFFER_STATE_LABELS } from '@/lib/types'
import type { PrivacyState, DirectOffer, OfferState } from '@/lib/types'

// Mock offer data
const mockOffers: DirectOffer[] = [
  {
    id: 'offer-001',
    assetId: 'asset-001',
    buyerId: 'buyer-001',
    creatorId: 'sarahchen',
    state: 'pending',
    currentAmount: 20000,
    listedPrice: 15000,
    counterRound: 0,
    maxRounds: 3,
    responseWindowHours: 48,
    expiresAt: '2026-04-05T11:00:00Z',
    createdAt: '2026-04-01T11:00:00Z',
  },
  {
    id: 'offer-002',
    assetId: 'asset-002',
    buyerId: 'buyer-001',
    creatorId: 'sarahchen',
    state: 'accepted',
    currentAmount: 14000,
    listedPrice: 12000,
    counterRound: 1,
    maxRounds: 3,
    responseWindowHours: 48,
    expiresAt: '2026-03-30T11:00:00Z',
    createdAt: '2026-03-28T11:00:00Z',
  },
]

const OFFER_STATE_STYLES: Record<OfferState, string> = {
  pending: 'border-blue-600 text-blue-600',
  countered: 'border-slate-400 text-slate-500',
  accepted: 'bg-black text-white border-black',
  rejected: 'border-slate-300 text-slate-400',
  expired: 'border-slate-200 text-slate-300',
  cancelled: 'border-slate-200 text-slate-300',
}

export default function OffersPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')

  const pendingOffers = mockOffers.filter(o => o.state === 'pending' || o.state === 'countered')
  const resolvedOffers = mockOffers.filter(o => o.state !== 'pending' && o.state !== 'countered')

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

            {/* Pending offers */}
            {pendingOffers.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Pending ({pendingOffers.length})
                </span>
                {pendingOffers.map(offer => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
            )}

            {/* Resolved offers */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Resolved ({resolvedOffers.length})
              </span>
              {resolvedOffers.length > 0 ? (
                resolvedOffers.map(offer => (
                  <OfferCard key={offer.id} offer={offer} />
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

function OfferCard({ offer }: { offer: DirectOffer }) {
  return (
    <div className="border-2 border-black px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${OFFER_STATE_STYLES[offer.state]}`}>
              {OFFER_STATE_LABELS[offer.state]}
            </span>
            <span className="text-[10px] text-slate-400">
              Round {offer.counterRound}/{offer.maxRounds}
            </span>
          </div>
          <div className="text-sm text-black">Asset: {offer.assetId}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            Listed: €{(offer.listedPrice / 100).toFixed(2)} · Offered: €{(offer.currentAmount / 100).toFixed(2)}
          </div>
          <div className="font-mono text-[10px] text-slate-400 mt-1">
            Expires: {new Date(offer.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-lg font-bold text-black">€{(offer.currentAmount / 100).toFixed(2)}</div>
          {offer.state === 'pending' && (
            <div className="flex gap-2 mt-2">
              <button className="h-8 px-3 text-xs bg-blue-600 text-white font-bold uppercase tracking-wide hover:bg-blue-700 transition-colors">
                Accept
              </button>
              <button className="h-8 px-3 text-xs border border-black text-black font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors">
                Counter
              </button>
              <button className="h-8 px-3 text-xs border border-slate-200 text-slate-400 font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors">
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
