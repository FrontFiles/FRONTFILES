'use client'

import type { FundingCadence } from '@/lib/funding/types'
import { FUNDING_CADENCE_LABELS } from '@/lib/funding/types'

interface FundingSummaryProps {
  resolvedAmountCents: number
  selectedCadence: FundingCadence
  step: string
  processing: boolean
  onContinue: () => void
  onSubmit: () => void
  disabled?: boolean
}

export function FundingSummary({
  resolvedAmountCents,
  selectedCadence,
  step,
  processing,
  onContinue,
  onSubmit,
  disabled,
}: FundingSummaryProps) {
  const showAmount = resolvedAmountCents > 0

  return (
    <div className="border-2 border-black bg-black px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          {showAmount ? (
            <>
              <span className="text-2xl font-black text-white font-mono">&euro;{(resolvedAmountCents / 100).toFixed(2)}</span>
              {selectedCadence !== 'one_time' && (
                <span className="text-xs text-white/40 ml-2 uppercase tracking-widest">
                  / {FUNDING_CADENCE_LABELS[selectedCadence].toLowerCase()}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-white/40 uppercase tracking-widest font-bold">Select an amount</span>
          )}
        </div>

        {step === 'select' && (
          <button
            onClick={onContinue}
            disabled={!showAmount || disabled}
            className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              showAmount && !disabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        )}

        {(step === 'payment' || step === 'confirm') && (
          <button
            onClick={onSubmit}
            disabled={processing || disabled}
            className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              processing
                ? 'bg-white/10 text-white/30 cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" style={{ borderRadius: '50%' }} />
                Processing...
              </span>
            ) : (
              `Pay €${(resolvedAmountCents / 100).toFixed(2)}`
            )}
          </button>
        )}
      </div>
    </div>
  )
}
