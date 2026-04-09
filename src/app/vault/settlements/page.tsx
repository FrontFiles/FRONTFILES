'use client'

import { useState } from 'react'
import { VaultLeftRail, type VaultSection } from '@/components/platform/VaultLeftRail'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { mockTransactions, mockSettlements, mockVaultAssets } from '@/lib/mock-data'
import { PAYOUT_STATE_LABELS, PLATFORM_FEES } from '@/lib/types'
import type { PrivacyState } from '@/lib/types'

export default function SettlementsPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')

  const totalEarnings = mockSettlements.reduce((sum, s) => sum + s.amount, 0)
  const settledAmount = mockSettlements.filter(s => s.state === 'settled').reduce((sum, s) => sum + s.amount, 0)
  const pendingAmount = mockSettlements.filter(s => s.state !== 'settled').reduce((sum, s) => sum + s.amount, 0)

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
            <h1 className="text-2xl font-bold text-black tracking-tight">Settlements</h1>

            {/* Earnings summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border-2 border-black px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Total earnings</span>
                <span className="text-2xl font-bold text-black font-mono block mt-1">€{(totalEarnings / 100).toFixed(2)}</span>
              </div>
              <div className="border-2 border-black px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Settled</span>
                <span className="text-2xl font-bold text-black font-mono block mt-1">€{(settledAmount / 100).toFixed(2)}</span>
              </div>
              <div className="border border-dashed border-slate-300 px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Pending</span>
                <span className="text-2xl font-bold text-slate-400 font-mono block mt-1">€{(pendingAmount / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Fee structure */}
            <Panel title="Platform fee structure" borderStyle="standard">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Direct catalogue</span>
                  <span className="text-sm text-black">Creator fee: {PLATFORM_FEES.direct.creatorFee * 100}% · Buyer markup: {PLATFORM_FEES.direct.buyerMarkup * 100}%</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Plugin catalogue</span>
                  <span className="text-sm text-black">Creator fee: {PLATFORM_FEES.plugin.creatorFee * 100}% · Buyer markup: {PLATFORM_FEES.plugin.buyerMarkup * 100}%</span>
                </div>
              </div>
            </Panel>

            {/* Settlement history */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settlement history</span>
              {mockSettlements.length > 0 ? (
                mockSettlements.map(settlement => {
                  const txn = mockTransactions.find(t => t.id === settlement.transactionId)
                  const asset = txn ? mockVaultAssets.find(a => a.id === txn.assetId) : null
                  return (
                    <div key={settlement.id} className="border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-bold text-black">{asset?.title ?? settlement.transactionId}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {PAYOUT_STATE_LABELS[settlement.state]}
                            </span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-[10px] text-slate-400 uppercase">{settlement.route}</span>
                          </div>
                          {settlement.reference && (
                            <div className="font-mono text-[10px] text-slate-400 mt-1">{settlement.reference}</div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm font-bold text-black">€{(settlement.amount / 100).toFixed(2)}</div>
                          {settlement.settledAt && (
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                              {new Date(settlement.settledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <EmptyPanel message="No settlements yet" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
