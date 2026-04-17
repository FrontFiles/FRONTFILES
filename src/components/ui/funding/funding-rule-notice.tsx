'use client'

import type { PaymentRule, FundingCadence } from '@/lib/funding/types'
import { FUNDING_CADENCE_LABELS } from '@/lib/funding/types'

interface FundingRuleNoticeProps {
  paymentRule: PaymentRule
  selectedCadence: FundingCadence
  resolvedAmountCents: number
}

export function FundingRuleNotice({ paymentRule, selectedCadence, resolvedAmountCents }: FundingRuleNoticeProps) {
  if (resolvedAmountCents <= 0) return null

  const feeCents = Math.round(resolvedAmountCents * paymentRule.platformFeePercent / 100)
  const creatorReceivesCents = resolvedAmountCents - feeCents

  return (
    <div className="border-2 border-dashed border-black/20 px-6 py-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/30 block mb-2">Payment Details</span>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-black/60">Your contribution</span>
          <span className="font-bold font-mono text-black">&euro;{(resolvedAmountCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-black/60">Platform fee ({paymentRule.platformFeePercent}%)</span>
          <span className="font-mono text-black/40">&minus;&euro;{(feeCents / 100).toFixed(2)}</span>
        </div>
        <div className="border-t border-black/10 pt-1.5 flex justify-between text-sm">
          <span className="font-bold text-black">Creator receives</span>
          <span className="font-black font-mono text-[#0000ff]">&euro;{(creatorReceivesCents / 100).toFixed(2)}</span>
        </div>
        {selectedCadence !== 'one_time' && (
          <div className="pt-1">
            <span className="text-[10px] text-black/30 uppercase tracking-widest">
              Billed {FUNDING_CADENCE_LABELS[selectedCadence].toLowerCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
