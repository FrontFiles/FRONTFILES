'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PRIVACY_STATE_DESCRIPTIONS, LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import type { UploadJob, PrivacyState, PriceInput, LicenceType } from '@/lib/upload/types'

interface RightsConfigPanelProps {
  job: UploadJob
  onSetPrivacy: (privacy: PrivacyState) => void
  onSetPricing: (pricing: PriceInput) => void
  onSetLicences: (licences: LicenceType[]) => void
}

const PRIVACY_OPTIONS: PrivacyState[] = ['PUBLIC', 'PRIVATE', 'RESTRICTED']

export function RightsConfigPanel({ job, onSetPrivacy, onSetPricing, onSetLicences }: RightsConfigPanelProps) {
  const [priceInput, setPriceInput] = useState(
    job.pricing?.amount ? (job.pricing.amount / 100).toFixed(2) : ''
  )

  const isConfigurable = job.state === 'awaiting_rights_configuration' || job.state === 'readiness_blocked' || job.state === 'ready_for_publish'

  if (!isConfigurable) return null

  const needsPricing = job.privacy !== 'PRIVATE' && job.privacy !== null

  function handlePriceChange(value: string) {
    setPriceInput(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) {
      onSetPricing({
        amount: Math.round(num * 100),
        currency: 'EUR',
        priceBandGuidance: '€50–€200',
      })
    }
  }

  function toggleLicence(licence: LicenceType) {
    const current = job.enabledLicences
    if (current.includes(licence)) {
      onSetLicences(current.filter(l => l !== licence))
    } else {
      onSetLicences([...current, licence])
    }
  }

  return (
    <div className="border-2 border-black">
      <div className="px-6 py-3 bg-black">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Rights configuration</span>
      </div>
      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Privacy */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Privacy state</span>
          <div className="flex flex-col gap-1.5">
            {PRIVACY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => onSetPrivacy(opt)}
                className={cn(
                  'flex flex-col px-4 py-3 border-2 transition-colors text-left',
                  job.privacy === opt
                    ? 'border-[#0000ff] bg-[#0000ff]/5'
                    : 'border-slate-200 hover:border-black'
                )}
              >
                <span className="text-sm font-bold text-black">{opt}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{PRIVACY_STATE_DESCRIPTIONS[opt]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pricing — only for transactable privacy states */}
        {needsPricing && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Creator pricing</span>
            <p className="text-xs text-slate-500">
              Set your price. The platform provides Price Band guidance only and never sets prices. You retain full pricing sovereignty.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-black">€</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={priceInput}
                onChange={e => handlePriceChange(e.target.value)}
                className="h-9 w-32 border-2 border-black text-sm rounded-none focus-visible:border-[#0000ff] focus-visible:ring-0 font-mono"
                placeholder="0.00"
              />
              <span className="text-xs text-slate-400">EUR</span>
            </div>
            {job.pricing?.priceBandGuidance && (
              <div className="border border-dashed border-slate-300 px-3 py-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Price Band guidance</span>
                <span className="text-xs text-slate-500 ml-2">{job.pricing.priceBandGuidance}</span>
              </div>
            )}
          </div>
        )}

        {/* Licence types */}
        {needsPricing && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Licence types</span>
            <p className="text-xs text-slate-500">
              Select which licence types are available for this asset.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(LICENCE_TYPE_LABELS) as [LicenceType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleLicence(key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                    job.enabledLicences.includes(key)
                      ? 'bg-black text-white'
                      : 'border border-slate-300 text-slate-500 hover:border-black hover:text-black'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
