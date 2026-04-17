'use client'

import type { FundingCadence } from '@/lib/funding/types'
import { FUNDING_CADENCE_LABELS } from '@/lib/funding/types'

interface FundingCadenceSelectorProps {
  allowedCadences: FundingCadence[]
  selected: FundingCadence
  onSelect: (cadence: FundingCadence) => void
}

export function FundingCadenceSelector({ allowedCadences, selected, onSelect }: FundingCadenceSelectorProps) {
  if (allowedCadences.length <= 1) return null

  return (
    <div className="border-2 border-black">
      <div className="px-6 py-3 border-b border-black/10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Payment Frequency</span>
      </div>
      <div className="p-2 flex">
        {allowedCadences.map(cadence => (
          <button
            key={cadence}
            onClick={() => onSelect(cadence)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              selected === cadence
                ? 'bg-blue-600 text-white'
                : 'bg-white text-black/60 hover:bg-black/5'
            }`}
          >
            {FUNDING_CADENCE_LABELS[cadence]}
          </button>
        ))}
      </div>
    </div>
  )
}
