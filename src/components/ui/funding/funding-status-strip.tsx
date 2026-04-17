'use client'

import type { FundingCase } from '@/lib/funding/types'

interface FundingStatusStripProps {
  fundingCase: FundingCase
}

export function FundingStatusStrip({ fundingCase }: FundingStatusStripProps) {
  const { raisedCents, goalCents, thresholdCents, totalContributors } = fundingCase
  const progressPercent = goalCents > 0 ? Math.min((raisedCents / goalCents) * 100, 100) : 0
  const thresholdPercent = goalCents > 0 && thresholdCents > 0 ? (thresholdCents / goalCents) * 100 : 0
  const thresholdMet = raisedCents >= thresholdCents

  return (
    <div className="border-2 border-black">
      <div className="px-6 py-3 border-b-2 border-black bg-black">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Progress</span>
      </div>

      <div className="px-6 py-5">
        {/* Main numbers */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-black font-mono">&euro;{(raisedCents / 100).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
          <span className="text-sm text-black/30 font-mono">/ &euro;{(goalCents / 100).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 relative">
          <div className="h-3 bg-black/5 w-full">
            <div
              className="h-full bg-[#0000ff] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Threshold marker */}
          {thresholdPercent > 0 && thresholdPercent < 100 && (
            <div
              className="absolute top-0 h-3 w-0.5 bg-black"
              style={{ left: `${thresholdPercent}%` }}
              title={`Threshold: €${(thresholdCents / 100).toFixed(2)}`}
            />
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">Backers</span>
            <span className="block text-lg font-black text-black font-mono">{totalContributors}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">Funded</span>
            <span className="block text-lg font-black text-black font-mono">{progressPercent.toFixed(0)}%</span>
          </div>
          {thresholdCents > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">Threshold</span>
              <span className={`block text-lg font-black font-mono ${thresholdMet ? 'text-emerald-600' : 'text-black'}`}>
                {thresholdMet ? 'Met' : `€${(thresholdCents / 100).toFixed(0)}`}
              </span>
            </div>
          )}
          {fundingCase.deadlineAt && (
            <div className="ml-auto text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">Days left</span>
              <span className="block text-lg font-black text-black font-mono">
                {Math.max(0, Math.ceil((new Date(fundingCase.deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
