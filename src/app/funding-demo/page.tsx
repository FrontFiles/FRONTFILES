'use client'

import { useState } from 'react'
import { FundingEngine } from '@/components/ui/funding/funding-engine'
import { creatorSupportCase, projectFundingCase, specialCommissionCase } from '@/lib/funding/fixtures'
import type { FundingCase } from '@/lib/funding/types'

const cases: { label: string; case: FundingCase }[] = [
  { label: 'Creator Support', case: creatorSupportCase },
  { label: 'Project Funding', case: projectFundingCase },
  { label: 'Special Commission', case: specialCommissionCase },
]

export default function FundingDemoPage() {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeCase = cases[activeIndex].case

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* Header */}
      <div className="border-b-2 border-black">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]">Funding Engine</span>
          <h1 className="text-2xl font-black text-black mt-1 tracking-tight">Demo</h1>
          <p className="text-sm text-black/50 mt-1">Three case types demonstrating the full funding workflow.</p>
        </div>
      </div>

      {/* Case type switcher */}
      <div className="border-b-2 border-black bg-black">
        <div className="max-w-3xl mx-auto flex">
          {cases.map((c, i) => (
            <button
              key={c.label}
              onClick={() => setActiveIndex(i)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                i === activeIndex
                  ? 'bg-blue-600 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Funding engine */}
      <div className="max-w-3xl mx-auto py-8 px-6">
        <FundingEngine key={activeCase.id} fundingCase={activeCase} />
      </div>
    </div>
  )
}
