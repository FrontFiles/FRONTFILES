'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AssetData } from '@/data'
import { creatorMap } from '@/data'
import { useTransaction } from '@/lib/transaction/context'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'
import { LICENCE_MEDIUM_LABELS } from '@/lib/documents/types'
import type { LicenceMedium } from '@/lib/documents/types'

interface AssetRightsModuleProps {
  asset: AssetData
}

const TRANSACTABLE_DECLARATIONS: string[] = [
  'fully_validated',
  'provenance_pending',
  'corroborated',
  'under_review',
]

export function AssetRightsModule({ asset }: AssetRightsModuleProps) {
  const router = useRouter()
  const { addToCart, isInCart } = useTransaction()
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [selectedMedium, setSelectedMedium] = useState<LicenceMedium>('newspaper')
  const [addedFeedback, setAddedFeedback] = useState(false)

  const isPublic = asset.privacyLevel === 'PUBLIC'
  const isTransactable = TRANSACTABLE_DECLARATIONS.includes(asset.validationDeclaration)
  const hasPrice = asset.price != null && asset.price > 0
  const canMakeOffer = isPublic && isTransactable && hasPrice
  const alreadyInCart = isInCart(asset.id)

  const creator = creatorMap[asset.creatorId]

  function handleAddToCart() {
    if (!asset.price || alreadyInCart) return
    addToCart({
      assetId: asset.id,
      assetTitle: asset.title,
      creatorId: asset.creatorId,
      creatorName: creator?.name ?? 'Unknown',
      thumbnailRef: asset.thumbnailRef,
      format: asset.format,
      selectedMedium,
      priceSnapshotCents: Math.round(asset.price * 100),
      certificationHashAtCart: null,
      declarationStateAtCart: asset.validationDeclaration,
    })
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 2000)
  }

  const MEDIA: LicenceMedium[] = ['newspaper', 'magazine', 'site']

  return (
    <>
      <div className="border-2 border-black">
        <div className="bg-black px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">Rights & Licensing</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Price */}
          {asset.price != null && (
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Price</span>
              <span className="text-lg font-bold font-mono text-black">&euro;{asset.price.toFixed(2)}</span>
            </div>
          )}

          {/* Licence */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Licence</span>
            <span className="text-xs text-black">Frontfiles Standard Editorial Licence</span>
            <span className="text-[10px] text-slate-400 block">Editorial only · 1 year · non-exclusive</span>
          </div>

          {/* Medium selector */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Publication medium</span>
            <div className="flex gap-1">
              {MEDIA.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMedium(m)}
                  className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                    selectedMedium === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 text-slate-400 hover:border-black hover:text-black'
                  }`}
                >
                  {LICENCE_MEDIUM_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Validation */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Declaration</span>
            <ValidationBadge state={asset.validationDeclaration} />
          </div>

          {/* Privacy */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Access</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-black">{asset.privacyLevel}</span>
          </div>

          {/* Add to Cart CTA */}
          {alreadyInCart ? (
            <button
              onClick={() => router.push('/cart')}
              className="flex items-center justify-center w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
            >
              In cart — view cart
            </button>
          ) : addedFeedback ? (
            <div className="flex items-center justify-center w-full py-2.5 text-[10px] font-bold uppercase tracking-widest bg-black text-white">
              Added to cart
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={!hasPrice}
              className="flex items-center justify-center w-full py-2.5 text-[10px] font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-[#0000cc] transition-colors disabled:bg-slate-200 disabled:text-slate-400"
            >
              Add to cart
            </button>
          )}

          {/* Direct checkout link (preserved for existing flow) */}
          <Link
            href={`/checkout/${asset.id}`}
            className="flex items-center justify-center w-full py-2 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-400 hover:border-black hover:text-black transition-colors"
          >
            Direct checkout
          </Link>

          {/* Make an Offer CTA */}
          {canMakeOffer && (
            <button
              onClick={() => setShowOfferModal(true)}
              className="flex items-center justify-center w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
            >
              Make an offer
            </button>
          )}
        </div>
      </div>

      {/* Offer Modal */}
      {showOfferModal && asset.price != null && (
        <OfferModal
          assetId={asset.id}
          assetTitle={asset.title}
          listedPrice={asset.price}
          onClose={() => setShowOfferModal(false)}
        />
      )}
    </>
  )
}

// ══════════════════════════════════════════════
// OFFER MODAL — Structured price + note
// ══════════════════════════════════════════════

function OfferModal({
  assetId,
  assetTitle,
  listedPrice,
  onClose,
}: {
  assetId: string
  assetTitle: string
  listedPrice: number
  onClose: () => void
}) {
  const [offerAmount, setOfferAmount] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedAmount = parseFloat(offerAmount)
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount < listedPrice

  const handleSubmit = () => {
    if (!isValid) {
      setError(`Offer must be between €0.01 and €${(listedPrice - 0.01).toFixed(2)}`)
      return
    }
    setError(null)
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white border-2 border-black w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-black px-5 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">Make an Offer</span>
          <button onClick={onClose} className="text-white hover:text-slate-300 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {!submitted ? (
            <div className="flex flex-col gap-4">
              {/* Asset identity */}
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-black truncate">{assetTitle}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Listed</span>
                  <div className="font-mono text-sm font-bold text-black">€{listedPrice.toFixed(2)}</div>
                </div>
              </div>

              {/* Price input — dominant */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  Your offer (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={listedPrice - 0.01}
                  value={offerAmount}
                  onChange={e => { setOfferAmount(e.target.value); setError(null) }}
                  placeholder="0.00"
                  className="h-12 px-3 border-2 border-slate-200 text-lg font-mono font-bold focus:border-black focus:outline-none"
                  autoFocus
                />
                {error && <span className="text-[10px] text-red-500">{error}</span>}
              </div>

              {/* Savings preview */}
              {isValid && (
                <div className="border border-dashed border-slate-200 px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Saving</span>
                  <span className="text-sm font-bold font-mono text-black">
                    €{(listedPrice - parsedAmount).toFixed(2)} ({Math.round(((listedPrice - parsedAmount) / listedPrice) * 100)}%)
                  </span>
                </div>
              )}

              {/* Message — negotiation note */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  Offer note
                  <span className="text-slate-300 ml-1">Optional</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Intended use, publication timing, rights context, or rationale for this offer"
                  rows={3}
                  maxLength={500}
                  className="px-3 py-2 border border-slate-200 text-xs text-black leading-relaxed resize-none focus:border-black focus:outline-none"
                />
                {message.length > 0 && (
                  <span className="text-[10px] text-slate-300 text-right">{message.length}/500</span>
                )}
              </div>

              {/* Context line */}
              <span className="text-[10px] text-slate-400">
                Must be below €{listedPrice.toFixed(2)}. Creator has 4 hours to respond. You only pay if accepted.
              </span>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!offerAmount}
                className="h-10 w-full text-xs font-bold uppercase tracking-wide bg-[#0000ff] text-white hover:bg-[#0000cc] transition-colors disabled:bg-slate-200 disabled:text-slate-400"
              >
                Submit offer
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 bg-[#0000ff] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                  <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-black">Offer submitted</div>
                <div className="text-xs text-slate-400 mt-1">
                  €{parsedAmount.toFixed(2)} — The creator has been notified.
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-9 px-6 text-xs font-bold uppercase tracking-wide border border-black text-black hover:bg-black hover:text-white transition-colors mt-2"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
