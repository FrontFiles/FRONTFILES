'use client'

export const dynamic = 'force-dynamic'

import { use, useReducer } from 'react'
import { StateBadge } from '@/components/platform/StateBadge'
import { Panel } from '@/components/platform/Panel'
import { mockVaultAssets, mockCreatorProfile } from '@/lib/mock-data'
import {
  CHECKOUT_STEP_LABELS,
  DECLARATION_STATE_LABELS,
  LICENCE_TYPE_LABELS,
  PLATFORM_FEES,
} from '@/lib/types'
import type { CheckoutStep, LicenceType } from '@/lib/types'

interface CheckoutState {
  step: CheckoutStep
  selectedLicence: LicenceType | null
  declarationReviewed: boolean
  confirmBeforeSigning: boolean
  priceConfirmed: boolean
  paymentComplete: boolean
}

type CheckoutAction =
  | { type: 'SELECT_LICENCE'; payload: LicenceType }
  | { type: 'REVIEW_DECLARATION' }
  | { type: 'CONFIRM_BEFORE_SIGNING' }
  | { type: 'CONFIRM_PRICE' }
  | { type: 'COMPLETE_PAYMENT' }
  | { type: 'GO_BACK' }

const STEP_ORDER: CheckoutStep[] = [
  'licence_selection',
  'declaration_review',
  'confirm_before_signing',
  'price_confirmation',
  'payment_capture',
]

function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case 'SELECT_LICENCE':
      return { ...state, selectedLicence: action.payload, step: 'declaration_review' }
    case 'REVIEW_DECLARATION':
      return { ...state, declarationReviewed: true, step: 'confirm_before_signing' }
    case 'CONFIRM_BEFORE_SIGNING':
      return { ...state, confirmBeforeSigning: true, step: 'price_confirmation' }
    case 'CONFIRM_PRICE':
      return { ...state, priceConfirmed: true, step: 'payment_capture' }
    case 'COMPLETE_PAYMENT':
      return { ...state, paymentComplete: true }
    case 'GO_BACK': {
      const idx = STEP_ORDER.indexOf(state.step)
      if (idx > 0) return { ...state, step: STEP_ORDER[idx - 1] }
      return state
    }
    default:
      return state
  }
}

function createInitialCheckout(): CheckoutState {
  return {
    step: 'licence_selection',
    selectedLicence: null,
    declarationReviewed: false,
    confirmBeforeSigning: false,
    priceConfirmed: false,
    paymentComplete: false,
  }
}

export default function CheckoutPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params)
  const asset = mockVaultAssets.find(a => a.id === assetId)
  const [state, dispatch] = useReducer(checkoutReducer, null, createInitialCheckout)

  if (!asset) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-2xl font-bold text-black">Asset not found</h1>
        </div>
      </div>
    )
  }

  const listedPrice = asset.creatorPrice ?? 0
  const buyerMarkup = Math.round(listedPrice * PLATFORM_FEES.direct.buyerMarkup)
  const buyerPays = listedPrice + buyerMarkup
  const creatorReceives = listedPrice - Math.round(listedPrice * PLATFORM_FEES.direct.creatorFee)

  const currentStepIdx = STEP_ORDER.indexOf(state.step)

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <a href={`/asset/${asset.id}`} className="hover:text-black transition-colors">Asset</a>
            <span>/</span>
            <span className="text-black">Checkout</span>
          </div>

          <h1 className="text-2xl font-bold text-black tracking-tight">Licence Checkout</h1>

          {/* Step indicator */}
          <div className="flex items-center gap-0">
            {STEP_ORDER.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                  i === currentStepIdx ? 'bg-[#0000ff] text-white' :
                  i < currentStepIdx ? 'bg-black text-white' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  <span>{i + 1}</span>
                  <span className="hidden sm:inline">{CHECKOUT_STEP_LABELS[step]}</span>
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <div className={`w-4 h-px ${i < currentStepIdx ? 'bg-black' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Asset summary */}
          <div className="border border-slate-200 px-4 py-3 flex items-center gap-4">
            <div className="w-16 h-12 bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold font-mono text-slate-300">{asset.format.toUpperCase().slice(0, 3)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-black truncate">{asset.title}</div>
              <div className="text-[10px] text-slate-400">by {mockCreatorProfile.displayName}</div>
            </div>
          </div>

          {/* Payment complete */}
          {state.paymentComplete && (
            <Panel title="Transaction complete" borderStyle="blue">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0000ff] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                      <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-black">Licence acquired</div>
                    <div className="text-xs text-slate-500">Certified Package will be delivered to your account.</div>
                  </div>
                </div>
                <div className="border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Certified Package</span>
                    <span className="text-[10px] font-bold text-[#0000ff] uppercase tracking-wide">Certificate + Licence + Invoice + Receipt</span>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* Step 1: Licence selection */}
          {state.step === 'licence_selection' && (
            <Panel title="Step 1: Select licence type" headerStyle="black" borderStyle="emphasis">
              <div className="flex flex-col gap-2">
                {asset.enabledLicences.map(lt => (
                  <button
                    key={lt}
                    onClick={() => dispatch({ type: 'SELECT_LICENCE', payload: lt })}
                    className="flex items-center justify-between px-4 py-3 border border-slate-200 hover:border-black transition-colors text-left"
                  >
                    <span className="text-sm font-bold text-black">{LICENCE_TYPE_LABELS[lt]}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Select →</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {/* Step 2: Declaration review */}
          {state.step === 'declaration_review' && (
            <Panel title="Step 2: Review Validation Declaration" headerStyle="black" borderStyle="emphasis">
              <div className="flex flex-col gap-4">
                {asset.declarationState && (
                  <div className="flex items-center gap-2">
                    <StateBadge variant={asset.declarationState} />
                    <span className="text-xs text-slate-500">{DECLARATION_STATE_LABELS[asset.declarationState]}</span>
                  </div>
                )}
                <p className="text-xs text-slate-600 leading-relaxed">
                  This asset has been processed by the Frontfiles Certification System (FCS). The Validation Declaration above reflects the current provenance and integrity status. By proceeding, you acknowledge this declaration.
                </p>
                {asset.certificationHash && (
                  <div className="font-mono text-[10px] text-slate-400 break-all">
                    Hash: {asset.certificationHash}
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => dispatch({ type: 'GO_BACK' })} className="h-9 px-4 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors">
                    Back
                  </button>
                  <button onClick={() => dispatch({ type: 'REVIEW_DECLARATION' })} className="h-9 px-4 bg-[#0000ff] text-white text-xs font-bold uppercase tracking-wide hover:bg-[#0000cc] transition-colors flex-1">
                    I have reviewed the declaration
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {/* Step 3: Confirm before signing */}
          {state.step === 'confirm_before_signing' && (
            <Panel title="Step 3: Confirm before signing" headerStyle="black" borderStyle="emphasis">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Licence type</span>
                    <span className="text-sm font-bold text-black">{state.selectedLicence ? LICENCE_TYPE_LABELS[state.selectedLicence] : '·'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset</span>
                    <span className="text-sm text-black truncate">{asset.title}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  By proceeding, you agree to the Frontfiles Licence Agreement for the selected licence type. This agreement will be included in your Certified Package.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => dispatch({ type: 'GO_BACK' })} className="h-9 px-4 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors">
                    Back
                  </button>
                  <button onClick={() => dispatch({ type: 'CONFIRM_BEFORE_SIGNING' })} className="h-9 px-4 bg-[#0000ff] text-white text-xs font-bold uppercase tracking-wide hover:bg-[#0000cc] transition-colors flex-1">
                    Confirm and proceed to payment
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {/* Step 4: Price confirmation */}
          {state.step === 'price_confirmation' && (
            <Panel title="Step 4: Price confirmation" headerStyle="black" borderStyle="emphasis">
              <div className="flex flex-col gap-4">
                <div className="divide-y divide-slate-200">
                  <PriceLine label="Listed price" amount={listedPrice} />
                  <PriceLine label="Platform fee (20%)" amount={buyerMarkup} />
                  <PriceLine label="You pay" amount={buyerPays} bold />
                </div>
                <div className="border border-dashed border-slate-200 px-3 py-2">
                  <span className="text-[10px] text-slate-400">
                    Creator receives: €{(creatorReceives / 100).toFixed(2)} · Platform: €{((buyerPays - creatorReceives) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => dispatch({ type: 'GO_BACK' })} className="h-9 px-4 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors">
                    Back
                  </button>
                  <button onClick={() => dispatch({ type: 'CONFIRM_PRICE' })} className="h-9 px-4 bg-[#0000ff] text-white text-xs font-bold uppercase tracking-wide hover:bg-[#0000cc] transition-colors flex-1">
                    Confirm price
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {/* Step 5: Payment capture */}
          {state.step === 'payment_capture' && !state.paymentComplete && (
            <Panel title="Step 5: Payment" headerStyle="black" borderStyle="emphasis">
              <div className="flex flex-col gap-4">
                <div className="border border-slate-200 px-4 py-6 text-center">
                  <div className="text-2xl font-bold text-black font-mono mb-2">€{(buyerPays / 100).toFixed(2)}</div>
                  <p className="text-xs text-slate-400">Stripe payment integration placeholder</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => dispatch({ type: 'GO_BACK' })} className="h-9 px-4 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors">
                    Back
                  </button>
                  <button onClick={() => dispatch({ type: 'COMPLETE_PAYMENT' })} className="h-9 px-4 bg-black text-white text-xs font-bold uppercase tracking-wide hover:bg-[#0000ff] transition-colors flex-1">
                    Complete payment
                  </button>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

function PriceLine({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${bold ? 'font-bold text-black' : 'text-slate-600'}`}>{label}</span>
      <span className={`font-mono text-sm ${bold ? 'font-bold text-black' : 'text-slate-600'}`}>
        €{(amount / 100).toFixed(2)}
      </span>
    </div>
  )
}
