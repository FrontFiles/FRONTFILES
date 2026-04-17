'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTransaction } from '@/lib/transaction/context'
import { centsToEur, isReviewComplete } from '@/lib/transaction/reducer'
import { runFinalization } from '@/lib/transaction/finalization'
import { useUser } from '@/lib/user-context'
import { LICENCE_MEDIUM_LABELS } from '@/lib/documents/types'
import { DECLARATION_STATE_LABELS } from '@/lib/types'
import type { ValidationDeclarationState } from '@/lib/types'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { ArticlePreview } from '@/components/article/ArticlePreview'
import { articlePreviewFromCartItem } from '@/lib/article/from-checkout'

// ══════════════════════════════════════════════
// PAYMENT STATUS LABELS
// ══════════════════════════════════════════════

const PAYMENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  awaiting_payment: { label: 'Awaiting payment', className: 'border-slate-300 text-slate-400' },
  payment_processing: { label: 'Processing', className: 'border-amber-500 text-amber-600' },
  payment_succeeded: { label: 'Payment succeeded', className: 'border-black text-black' },
  payment_failed: { label: 'Payment failed', className: 'border-red-600 text-red-600' },
  requires_action: { label: 'Requires action', className: 'border-amber-500 text-amber-600' },
}

const FINALIZATION_STATUS_LABELS: Record<string, string> = {
  finalizing: 'Initializing transaction...',
  documents_generating: 'Generating canonical documents...',
  awaiting_signatures: 'Capturing signatures...',
  package_assembling: 'Assembling certified packages...',
  white_pack_ready: 'White pack ready',
  completed: 'Transaction complete',
  finalization_failed: 'Finalization failed',
}

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════

export default function CheckoutReviewPage() {
  const router = useRouter()
  const { state, dispatch } = useTransaction()
  const { sessionUser } = useUser()
  const { cart, review, payment, transaction } = state

  // Guard: if cart is empty, redirect
  if (cart.items.length === 0 && !transaction) {
    return (
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <EmptyPanel message="No items to review." detail="Add assets to your cart first." />
          <Link href="/search" className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-blue-600 hover:underline">
            Browse catalogue
          </Link>
        </div>
      </div>
    )
  }

  // If finalization is running or complete, redirect to transaction page
  if (transaction && (transaction.status === 'completed' || transaction.status === 'white_pack_ready')) {
    router.push(`/transaction/${transaction.id}`)
    return null
  }

  const allReviewed = isReviewComplete(state)
  const isPaymentPhase = state.phase === 'payment' || payment !== null
  const isFinalizingPhase = state.phase === 'finalization'

  async function handleCompletePayment() {
    const paymentId = `pay-${Date.now()}`

    dispatch({ type: 'INITIATE_PAYMENT', payload: { paymentId } })
    dispatch({ type: 'PAYMENT_PROCESSING' })

    // Simulate payment processing
    await new Promise(r => setTimeout(r, 800))

    dispatch({ type: 'PAYMENT_SUCCEEDED' })

    // Wait briefly then start finalization
    await new Promise(r => setTimeout(r, 400))

    await runFinalization(cart, paymentId, dispatch, sessionUser.displayName)

    // Navigate to delivery — use 'latest' since state.transaction
    // may not be updated in this closure yet
    router.push('/transaction/latest')
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <Link href="/cart" className="hover:text-black transition-colors">Cart</Link>
          <span>/</span>
          <span className="text-black">Review & Payment</span>
        </div>

        <h1 className="text-2xl font-bold text-black tracking-tight">Checkout Review</h1>

        {/* Phase indicator */}
        <div className="flex items-center gap-0">
          {(['review', 'payment', 'finalization'] as const).map((phase, i) => {
            const labels = { review: 'Review', payment: 'Payment', finalization: 'Finalization' }
            const currentIdx = ['review', 'payment', 'finalization'].indexOf(state.phase)
            return (
              <div key={phase} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                  i === currentIdx ? 'bg-blue-600 text-white' :
                  i < currentIdx ? 'bg-black text-white' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  <span>{i + 1}</span>
                  <span className="hidden sm:inline">{labels[phase]}</span>
                </div>
                {i < 2 && <div className={`w-4 h-px ${i < currentIdx ? 'bg-black' : 'bg-slate-200'}`} />}
              </div>
            )
          })}
        </div>

        {/* ═══ FINALIZATION IN PROGRESS ═══ */}
        {isFinalizingPhase && transaction && (
          <Panel title="Transaction finalization" headerStyle="blue" borderStyle="blue">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold text-black">
                  {FINALIZATION_STATUS_LABELS[transaction.status] ?? transaction.status}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Payment succeeded. Creating canonical transaction records, documents, licence grants, and certified packages.
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Transaction: {transaction.id}
              </div>
            </div>
          </Panel>
        )}

        {/* ═══ ASSET SUMMARY ═══ */}
        {!isFinalizingPhase && (
          <Panel title="Assets & licences" headerStyle="black" borderStyle="emphasis">
            <div className="flex flex-col divide-y divide-slate-200">
              {cart.items.map(item => (
                <div key={item.id} className="py-5 first:pt-1 last:pb-1 flex flex-col gap-4">
                  <ArticlePreview variant="standard" {...articlePreviewFromCartItem(item)} />
                  <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          {item.licenceName}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-600 px-1.5 py-0.5">
                          {LICENCE_MEDIUM_LABELS[item.selectedMedium]}
                        </span>
                        <span className="text-[10px] text-slate-400">1 year · non-exclusive · editorial only</span>
                      </div>
                      {item.declarationStateAtCart && (
                        <div className="text-[10px] text-slate-400">
                          Declaration: {DECLARATION_STATE_LABELS[item.declarationStateAtCart as ValidationDeclarationState] ?? item.declarationStateAtCart}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold text-black font-mono shrink-0">
                      {centsToEur(item.lineSubtotalCents)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* ═══ REVIEW CONFIRMATIONS ═══ */}
        {!isPaymentPhase && !isFinalizingPhase && (
          <Panel title="Confirm before payment" headerStyle="black" borderStyle="emphasis">
            <div className="flex flex-col gap-3">
              <ConfirmCheckbox
                checked={review.declarationsReviewed}
                onToggle={() => dispatch({ type: 'CONFIRM_DECLARATIONS' })}
                label="I have reviewed the validation declarations for all assets"
              />
              <ConfirmCheckbox
                checked={review.termsConfirmed}
                onToggle={() => dispatch({ type: 'CONFIRM_TERMS' })}
                label="I agree to the Frontfiles Standard Editorial Licence terms (editorial only, single medium, 1 year, non-exclusive)"
              />
              <ConfirmCheckbox
                checked={review.pricingConfirmed}
                onToggle={() => dispatch({ type: 'CONFIRM_PRICING' })}
                label={`I confirm the total amount of ${centsToEur(cart.totalCents)} (incl. platform fee)`}
              />
              <ConfirmCheckbox
                checked={review.billingIdentityConfirmed}
                onToggle={() => dispatch({ type: 'CONFIRM_BILLING_IDENTITY' })}
                label="I confirm my billing identity for this transaction"
              />
            </div>
          </Panel>
        )}

        {/* ═══ PRICING SUMMARY ═══ */}
        {!isFinalizingPhase && (
          <Panel title="Pricing" borderStyle="standard">
            <div className="flex flex-col gap-2">
              {cart.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm text-slate-600">
                  <span className="truncate max-w-[300px]">{item.assetTitle}</span>
                  <span className="font-mono">{centsToEur(item.lineSubtotalCents)}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 flex justify-between text-sm text-slate-600">
                <span>Platform fee (20%)</span>
                <span className="font-mono">{centsToEur(cart.platformFeeCents)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-black">
                <span>Total</span>
                <span className="font-mono">{centsToEur(cart.totalCents)}</span>
              </div>
            </div>
          </Panel>
        )}

        {/* ═══ PAYMENT ═══ */}
        {!isPaymentPhase && !isFinalizingPhase && (
          <div className="flex gap-3">
            <Link
              href="/cart"
              className="h-10 px-5 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors flex items-center"
            >
              Back to cart
            </Link>
            <button
              disabled={!allReviewed}
              onClick={() => {
                dispatch({ type: 'READY_FOR_PAYMENT' })
              }}
              className={`h-10 px-5 text-xs font-bold uppercase tracking-wide transition-colors flex-1 ${
                allReviewed
                  ? 'bg-blue-600 text-white hover:bg-[#0000cc]'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              Proceed to payment
            </button>
          </div>
        )}

        {isPaymentPhase && !isFinalizingPhase && (
          <Panel title="Payment" headerStyle="black" borderStyle="emphasis">
            <div className="flex flex-col gap-4">
              <div className="border border-slate-200 px-4 py-6 text-center">
                <div className="text-2xl font-bold text-black font-mono mb-2">
                  {centsToEur(cart.totalCents)}
                </div>
                <p className="text-xs text-slate-400">Stripe payment integration placeholder</p>
              </div>

              {payment && (
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 ${
                    PAYMENT_STATUS_LABELS[payment.status]?.className ?? ''
                  }`}>
                    {PAYMENT_STATUS_LABELS[payment.status]?.label ?? payment.status}
                  </span>
                  {payment.failureReason && (
                    <span className="text-[10px] text-red-600">{payment.failureReason}</span>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => dispatch({ type: 'BACK_TO_CART' })}
                  className="h-9 px-4 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCompletePayment}
                  disabled={payment?.status === 'payment_processing'}
                  className="h-9 px-4 bg-black text-white text-xs font-bold uppercase tracking-wide hover:bg-blue-600 transition-colors flex-1"
                >
                  {payment?.status === 'payment_processing' ? 'Processing...' : 'Complete payment'}
                </button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONFIRM CHECKBOX
// ══════════════════════════════════════════════

function ConfirmCheckbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      disabled={checked}
      className="flex items-start gap-3 text-left group"
    >
      <div className={`w-4 h-4 border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
        checked ? 'bg-black border-black' : 'border-slate-300 group-hover:border-black'
      }`}>
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white">
            <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${checked ? 'text-black' : 'text-slate-500'}`}>{label}</span>
    </button>
  )
}
