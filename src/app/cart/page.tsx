'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransaction } from '@/lib/transaction/context'
import { centsToEur } from '@/lib/transaction/reducer'
import { LICENCE_MEDIUM_LABELS } from '@/lib/documents/types'
import type { LicenceMedium } from '@/lib/documents/types'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { ArticlePreview } from '@/components/article/ArticlePreview'
import { articlePreviewFromCartItem } from '@/lib/article/from-checkout'

const MEDIA: LicenceMedium[] = ['newspaper', 'magazine', 'site']

export default function CartPage() {
  const router = useRouter()
  const { state, removeFromCart, updateMedium, dispatch } = useTransaction()
  const { cart } = state

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <Link href="/search" className="hover:text-black transition-colors">Browse</Link>
          <span>/</span>
          <span className="text-black">Cart</span>
        </div>

        <h1 className="text-2xl font-bold text-black tracking-tight">Cart</h1>

        {cart.items.length === 0 ? (
          <EmptyPanel
            message="Your cart is empty."
            detail="Add assets from the catalogue to begin a licence transaction."
          />
        ) : (
          <>
            {/* Line items */}
            <div className="flex flex-col gap-3">
              {cart.items.map(item => (
                <div key={item.id} className="border border-slate-200 px-4 py-3 flex flex-col gap-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <ArticlePreview variant="compact" {...articlePreviewFromCartItem(item)} />
                    </div>
                    <div className="text-sm font-bold text-black font-mono shrink-0">
                      {centsToEur(item.lineSubtotalCents)}
                    </div>
                  </div>

                  {/* Licence info + medium selector */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Std Editorial Licence
                    </span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <div className="flex items-center gap-1">
                      {MEDIA.map(m => (
                        <button
                          key={m}
                          onClick={() => updateMedium(item.id, m)}
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border transition-colors ${
                            item.selectedMedium === m
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-slate-200 text-slate-400 hover:border-black hover:text-black'
                          }`}
                        >
                          {LICENCE_MEDIUM_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <Panel title="Order summary" borderStyle="standard">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{cart.items.length} licence{cart.items.length !== 1 ? 's' : ''}</span>
                  <span className="font-mono">{centsToEur(cart.subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Platform fee (20%)</span>
                  <span className="font-mono">{centsToEur(cart.platformFeeCents)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-black">
                  <span>Total</span>
                  <span className="font-mono">{centsToEur(cart.totalCents)}</span>
                </div>
              </div>
            </Panel>

            {/* Actions */}
            <div className="flex gap-3">
              <Link
                href="/search"
                className="h-10 px-5 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors flex items-center"
              >
                Continue browsing
              </Link>
              <button
                onClick={() => {
                  dispatch({ type: 'PROCEED_TO_REVIEW' })
                  router.push('/checkout/review')
                }}
                className="h-10 px-5 bg-blue-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-[#0000cc] transition-colors flex-1"
              >
                Proceed to review
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
