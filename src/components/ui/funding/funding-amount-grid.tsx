'use client'

import { useState } from 'react'
import type { FundingCase, FundingTier } from '@/lib/funding/types'

interface FundingAmountGridProps {
  fundingCase: FundingCase
  selectedTierId: string | null
  customAmountCents: number | null
  onSelectTier: (tierId: string) => void
  onSetCustomAmount: (amountCents: number) => void
}

export function FundingAmountGrid({
  fundingCase,
  selectedTierId,
  customAmountCents,
  onSelectTier,
  onSetCustomAmount,
}: FundingAmountGridProps) {
  const { paymentRule, tiers } = fundingCase
  const [customInput, setCustomInput] = useState('')
  const [showOther, setShowOther] = useState(false)

  // Fixed amount — no grid needed
  if (paymentRule.type === 'fixed' && paymentRule.fixedAmountCents) {
    return (
      <div className="border-2 border-black">
        <div className="px-6 py-3 border-b border-black/10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Amount</span>
        </div>
        <div className="px-6 py-5 text-center">
          <span className="text-3xl font-black text-black font-mono">&euro;{(paymentRule.fixedAmountCents / 100).toFixed(2)}</span>
          <span className="block text-xs text-black/40 mt-1 uppercase tracking-widest">Fixed commission fee</span>
        </div>
      </div>
    )
  }

  // Tiered with tiers
  if (tiers.length > 0) {
    return (
      <div className="border-2 border-black">
        <div className="px-6 py-3 border-b-2 border-black bg-black">
          <span className="text-sm font-bold text-white uppercase tracking-wide">Choose your level</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, i) => (
            <TierCard
              key={tier.id}
              tier={tier}
              selected={selectedTierId === tier.id}
              onSelect={() => onSelectTier(tier.id)}
              isLast={i === tiers.length - 1}
            />
          ))}
          {/* Other — custom amount */}
          {!showOther ? (
            <button
              onClick={() => setShowOther(true)}
              className={`text-left p-4 border-r border-b border-black/10 transition-colors ${
                customAmountCents !== null && selectedTierId === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-white hover:bg-black/5'
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${customAmountCents !== null && selectedTierId === null ? 'text-white/70' : 'text-[#0000ff]'}`}>Other</span>
                <span className={`text-lg font-black font-mono ${customAmountCents !== null && selectedTierId === null ? 'text-white' : 'text-black/30'}`}>
                  {customAmountCents !== null && selectedTierId === null ? `€${(customAmountCents / 100).toFixed(0)}` : '€...'}
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${customAmountCents !== null && selectedTierId === null ? 'text-white/80' : 'text-black/50'}`}>Enter your own amount.</p>
            </button>
          ) : (
            <div className="p-4 border-r border-b border-black/10 bg-[#0000ff]/5 border-l-2 border-l-[#0000ff]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] block mb-2">Custom Amount</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-black">&euro;</span>
                <input
                  type="number"
                  autoFocus
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value)
                    const val = Math.round(parseFloat(e.target.value) * 100)
                    if (!isNaN(val) && val > 0) onSetCustomAmount(val)
                  }}
                  onBlur={() => { if (!customInput) setShowOther(false) }}
                  placeholder={`Min ${(paymentRule.minimumCents / 100).toFixed(0)}`}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#0000ff]"
                  min={paymentRule.minimumCents / 100}
                  step="5"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Open amount without tiers — suggested amounts grid
  return (
    <div className="border-2 border-black">
      <div className="px-6 py-3 border-b-2 border-black bg-black">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Select Amount</span>
      </div>
      <div className="grid grid-cols-3 gap-0">
        {paymentRule.suggestedAmountsCents.map(amount => (
          <button
            key={amount}
            onClick={() => { setShowOther(false); onSetCustomAmount(amount) }}
            className={`py-4 text-center border-r border-b border-black/10 transition-colors ${
              customAmountCents === amount && !showOther
                ? 'bg-blue-600 text-white'
                : 'bg-white text-black hover:bg-black/5'
            }`}
          >
            <span className="text-lg font-black font-mono">&euro;{(amount / 100).toFixed(0)}</span>
          </button>
        ))}
        {/* Other button */}
        <button
          onClick={() => setShowOther(true)}
          className={`py-4 text-center border-r border-b border-black/10 transition-colors ${
            showOther
              ? 'bg-blue-600 text-white'
              : 'bg-white text-black hover:bg-black/5'
          }`}
        >
          <span className="text-lg font-black font-mono">Other</span>
        </button>
      </div>
      {showOther && (
        <div className="px-4 py-3 border-t border-black/10 bg-[#0000ff]/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] block mb-2">Enter amount</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-black">&euro;</span>
            <input
              type="number"
              autoFocus
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value)
                const val = Math.round(parseFloat(e.target.value) * 100)
                if (!isNaN(val) && val > 0) onSetCustomAmount(val)
              }}
              placeholder={`Min ${(paymentRule.minimumCents / 100).toFixed(0)}`}
              className="w-full border-2 border-black px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#0000ff]"
              min={paymentRule.minimumCents / 100}
              step="5"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tier Card ──

function TierCard({ tier, selected, onSelect, isLast }: { tier: FundingTier; selected: boolean; onSelect: () => void; isLast: boolean }) {
  const soldOut = tier.maxBackers !== null && tier.currentBackers >= tier.maxBackers

  return (
    <button
      onClick={soldOut ? undefined : onSelect}
      disabled={soldOut}
      className={`text-left p-4 border-r border-b border-black/10 transition-colors ${
        soldOut
          ? 'opacity-40 cursor-not-allowed'
          : selected
            ? 'bg-blue-600 text-white'
            : 'bg-white hover:bg-black/5'
      }`}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-xs font-bold uppercase tracking-wider ${selected ? 'text-white/70' : 'text-[#0000ff]'}`}>{tier.name}</span>
        <span className={`text-lg font-black font-mono ${selected ? 'text-white' : 'text-black'}`}>&euro;{(tier.amountCents / 100).toFixed(0)}</span>
      </div>
      <p className={`text-[11px] leading-relaxed mb-2 ${selected ? 'text-white/80' : 'text-black/50'}`}>{tier.description}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {tier.perks.map(perk => (
          <span key={perk} className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
            selected ? 'bg-white/20 text-white' : 'bg-black/5 text-black/40'
          }`}>{perk}</span>
        ))}
      </div>
      <div className={`text-[10px] font-mono ${selected ? 'text-white/60' : 'text-black/30'}`}>
        {soldOut ? 'SOLD OUT' : `${tier.currentBackers}${tier.maxBackers ? `/${tier.maxBackers}` : ''} backers`}
      </div>
    </button>
  )
}
