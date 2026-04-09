'use client'

import { useState } from 'react'
import { VaultLeftRail, type VaultSection } from '@/components/platform/VaultLeftRail'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { StateBadge } from '@/components/platform/StateBadge'
import { mockVaultAssets } from '@/lib/mock-data'
import { LICENCE_TYPE_LABELS, EXCLUSIVE_TIER_LABELS, EXCLUSIVE_MULTIPLIERS } from '@/lib/types'
import type { PrivacyState } from '@/lib/types'

export default function PricingPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')

  const pricedAssets = mockVaultAssets.filter(a => a.creatorPrice !== null)
  const unpricedAssets = mockVaultAssets.filter(a => a.creatorPrice === null)

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        <VaultLeftRail
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          privacyFilter={privacyFilter}
          onPrivacyFilterChange={setPrivacyFilter}
          onUploadClick={() => {}}
        />
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-black tracking-tight">Pricing & Licences</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {pricedAssets.length} priced
                </span>
                <span className="text-[10px] text-slate-300">·</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {unpricedAssets.length} unpriced
                </span>
              </div>
            </div>

            {/* Exclusive licence tiers reference */}
            <Panel title="Exclusive licence multipliers" borderStyle="blue">
              <div className="grid grid-cols-3 gap-4">
                {(Object.entries(EXCLUSIVE_TIER_LABELS) as [string, string][]).map(([tier, label]) => (
                  <div key={tier} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
                    <span className="text-lg font-bold text-black font-mono">
                      {EXCLUSIVE_MULTIPLIERS[tier as keyof typeof EXCLUSIVE_MULTIPLIERS]}×
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Priced assets */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Priced assets
              </span>
              {pricedAssets.map(asset => (
                <div key={asset.id} className="border border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-black truncate">{asset.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">{asset.format}</span>
                      {asset.declarationState && <StateBadge variant={asset.declarationState} />}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-black">€{(asset.creatorPrice! / 100).toFixed(2)}</div>
                    <div className="flex gap-1 mt-1 justify-end">
                      {asset.enabledLicences.map(lt => (
                        <span key={lt} className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                          {lt}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Unpriced */}
            {unpricedAssets.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Unpriced assets
                </span>
                {unpricedAssets.map(asset => (
                  <div key={asset.id} className="border border-dashed border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-500 truncate">{asset.title}</div>
                      <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">{asset.format}</span>
                    </div>
                    <button className="h-8 px-3 text-xs border border-black text-black font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors">
                      Set price
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
