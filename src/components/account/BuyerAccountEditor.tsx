'use client'

import { useState } from 'react'
import { Panel } from '@/components/platform/Panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { upsertBuyerAccount } from '@/lib/identity/store'
import type { SessionUser } from '@/lib/user-context'
import type { BuyerAccountRow, BuyerType } from '@/lib/db/schema'

interface BuyerAccountEditorProps {
  sessionUser: SessionUser
  buyerAccount: BuyerAccountRow | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Phase C — Buyer facet editor.
 *
 * Owns:
 *   • buyer_accounts.{buyer_type, company_name,
 *     vat_number, tax_id}
 *   (all via upsertBuyerAccount)
 *
 * The wider company-admin surface (billing email, country,
 * company member management) lives on `/account/companies`
 * and in Phase D / E work. VAT / tax id live here because
 * they are on the `buyer_accounts` row itself per the
 * canonical schema.
 */
export function BuyerAccountEditor({
  sessionUser,
  buyerAccount,
}: BuyerAccountEditorProps) {
  const [buyerType, setBuyerType] = useState<BuyerType>(
    buyerAccount?.buyer_type ?? 'individual',
  )
  const [companyName, setCompanyName] = useState<string>(
    buyerAccount?.company_name ?? '',
  )
  const [vatNumber, setVatNumber] = useState<string>(
    buyerAccount?.vat_number ?? '',
  )
  const [taxId, setTaxId] = useState<string>(buyerAccount?.tax_id ?? '')

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const companyNameOk =
    buyerType !== 'company' || companyName.trim().length > 0
  const canSave = companyNameOk && status !== 'saving'

  async function handleSave() {
    if (!canSave) return
    setStatus('saving')
    setError(null)
    try {
      await upsertBuyerAccount({
        user_id: sessionUser.id,
        buyer_type: buyerType,
        company_name:
          buyerType === 'company' ? companyName.trim() : null,
        vat_number: vatNumber.trim() || null,
        tax_id: taxId.trim() || null,
      })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Buyer account" headerStyle="black">
        <div className="flex flex-col gap-5">
          {/* Buyer type */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
              Buyer type
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <BuyerTypeCard
                label="Individual"
                selected={buyerType === 'individual'}
                onSelect={() => setBuyerType('individual')}
                description="You license assets under your own name."
              />
              <BuyerTypeCard
                label="Company"
                selected={buyerType === 'company'}
                onSelect={() => setBuyerType('company')}
                description="You license on behalf of a company or editorial team."
              />
            </div>
          </div>

          {/* Company name — only when buyer type is company */}
          {buyerType === 'company' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
                Company name
              </span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Reuters News Desk"
                className={inputClass}
              />
              {!companyNameOk && (
                <span className="text-[11px] text-red-600">
                  Company name is required when buyer type is &quot;Company&quot;.
                </span>
              )}
            </label>
          )}

          {/* VAT number */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
              VAT number
            </span>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="EU buyers — e.g. IE1234567T"
              className={cn(inputClass, 'font-mono')}
            />
            <span className="text-[11px] text-slate-400">
              Optional. Collected here, validated against invoices at checkout.
            </span>
          </label>

          {/* Tax ID (non-VAT jurisdictions) */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
              Tax ID
            </span>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="EIN / TIN — non-VAT jurisdictions"
              className={cn(inputClass, 'font-mono')}
            />
            <span className="text-[11px] text-slate-400">
              Optional. Applies to US and other non-VAT jurisdictions.
            </span>
          </label>

          {/* Save row */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                'h-10 px-5 font-bold text-[11px] rounded-none uppercase tracking-[0.12em]',
                canSave
                  ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed',
              )}
            >
              {status === 'saving' ? 'Saving…' : 'Save buyer details'}
            </Button>
            {status === 'saved' && (
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0000ff]">
                ✓ Saved
              </span>
            )}
            {error && <span className="text-[11px] text-red-600">{error}</span>}
          </div>
        </div>
      </Panel>
    </div>
  )
}

function BuyerTypeCard({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'text-left border-2 px-4 py-3 transition-colors',
        selected
          ? 'border-[#0000ff] bg-[#f0f0ff]'
          : 'border-black bg-white hover:bg-slate-50',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            'w-4 h-4 border-2 flex items-center justify-center shrink-0',
            selected ? 'border-[#0000ff] bg-[#0000ff]' : 'border-black',
          )}
        >
          {selected && (
            <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
              <path
                d="M1.5 5L4 7.5L8.5 2.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <span
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.14em]',
            selected ? 'text-[#0000ff]' : 'text-black',
          )}
        >
          {label}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        {description}
      </p>
    </button>
  )
}

const inputClass =
  'w-full h-10 px-3 text-sm border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]'
