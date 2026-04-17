'use client'

import { useState } from 'react'

interface FundingStripePanelProps {
  onCardComplete: (complete: boolean) => void
  onBack: () => void
  error: string | null
}

export function FundingStripePanel({ onCardComplete, onBack, error }: FundingStripePanelProps) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')

  const handleCardChange = (num: string, exp: string, c: string) => {
    const complete = num.length >= 16 && exp.length >= 5 && c.length >= 3
    onCardComplete(complete)
  }

  return (
    <div className="border-2 border-[#0000ff]">
      <div className="px-6 py-3 border-b-2 border-[#0000ff] bg-[#0000ff]">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Payment</span>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Mock card input */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-1.5">Card Number</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 16)
              setCardNumber(v)
              handleCardChange(v, expiry, cvc)
            }}
            placeholder="4242 4242 4242 4242"
            className="w-full border-2 border-black px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0000ff] placeholder:text-black/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-1.5">Expiry</label>
            <input
              type="text"
              value={expiry}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 4)
                if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2)
                setExpiry(v)
                handleCardChange(cardNumber, v, cvc)
              }}
              placeholder="MM/YY"
              className="w-full border-2 border-black px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0000ff] placeholder:text-black/20"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-1.5">CVC</label>
            <input
              type="text"
              value={cvc}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                setCvc(v)
                handleCardChange(cardNumber, expiry, v)
              }}
              placeholder="123"
              className="w-full border-2 border-black px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0000ff] placeholder:text-black/20"
            />
          </div>
        </div>

        <p className="text-[10px] text-black/30 uppercase tracking-widest">
          Demo mode — no real charges will be made
        </p>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={onBack}
          className="text-xs font-bold uppercase tracking-wider text-black/40 hover:text-black transition-colors"
        >
          &larr; Back to selection
        </button>
      </div>
    </div>
  )
}
