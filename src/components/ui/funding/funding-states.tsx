'use client'

interface FundingSuccessProps {
  message: string
  amountCents: number
  onReset: () => void
}

export function FundingSuccess({ message, amountCents, onReset }: FundingSuccessProps) {
  return (
    <div className="border-2 border-emerald-600">
      <div className="px-6 py-3 border-b-2 border-emerald-600 bg-emerald-600">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Payment Confirmed</span>
      </div>
      <div className="px-6 py-8 text-center">
        <div className="w-12 h-12 border-2 border-emerald-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-lg font-black text-black">{message}</p>
        <p className="text-2xl font-black font-mono text-[#0000ff] mt-2">&euro;{(amountCents / 100).toFixed(2)}</p>
        <p className="text-xs text-black/40 mt-3 uppercase tracking-widest">A confirmation email will be sent to your account</p>
        <button
          onClick={onReset}
          className="mt-6 px-6 py-2.5 border-2 border-black text-xs font-bold uppercase tracking-wider text-black hover:bg-black hover:text-white transition-colors"
        >
          Make another contribution
        </button>
      </div>
    </div>
  )
}

interface FundingErrorProps {
  error: string
  onDismiss: () => void
  onRetry: () => void
}

export function FundingError({ error, onDismiss, onRetry }: FundingErrorProps) {
  return (
    <div className="border-2 border-red-600">
      <div className="px-6 py-3 border-b-2 border-red-600 bg-red-600">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Payment Failed</span>
      </div>
      <div className="px-6 py-8 text-center">
        <div className="w-12 h-12 border-2 border-red-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className="text-sm text-red-700">{error}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-6 py-2.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={onDismiss}
            className="px-6 py-2.5 border-2 border-black text-xs font-bold uppercase tracking-wider text-black hover:bg-black hover:text-white transition-colors"
          >
            Change payment
          </button>
        </div>
      </div>
    </div>
  )
}

interface FundingUnavailableProps {
  reason: string
}

export function FundingUnavailable({ reason }: FundingUnavailableProps) {
  return (
    <div className="border-2 border-dashed border-black/20 px-6 py-8 text-center">
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/20 block mb-2">Funding Unavailable</span>
      <p className="text-sm text-black/40">{reason}</p>
    </div>
  )
}
