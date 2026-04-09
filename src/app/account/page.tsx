'use client'

import { useState } from 'react'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { StateBadge } from '@/components/platform/StateBadge'
import {
  mockBuyerAccount,
  mockLightbox,
  mockTransactions,
  mockSettlements,
  mockVaultAssets,
} from '@/lib/mock-data'
import { PAYOUT_STATE_LABELS, LICENCE_TYPE_LABELS } from '@/lib/types'

type AccountTab = 'overview' | 'transactions' | 'lightboxes' | 'settings'

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<AccountTab>('overview')
  const buyer = mockBuyerAccount

  const tabs: { key: AccountTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'lightboxes', label: 'Lightboxes' },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8 flex flex-col gap-8">
          <h1 className="text-2xl font-bold text-black tracking-tight">Account</h1>

          {/* Account summary */}
          <Panel title="Buyer account" headerStyle="black" borderStyle="emphasis">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</span>
                <span className="text-sm font-bold text-black">{buyer.displayName}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</span>
                <span className="text-sm text-black">{buyer.email}</span>
              </div>
              {buyer.companyName && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company</span>
                  <span className="text-sm text-black">{buyer.companyName}</span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Account type</span>
                <span className="text-sm text-black capitalize">{buyer.type}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</span>
                <span className="text-sm text-black capitalize">{buyer.state}</span>
              </div>
              {buyer.role && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</span>
                  <span className="text-sm text-black">{buyer.role.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>
          </Panel>

          {/* Tabs */}
          <div className="flex items-center border-b border-slate-200">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-600 text-black'
                    : 'text-slate-400 hover:text-black'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Transactions" value={mockTransactions.length} />
              <StatCard label="Lightboxes" value={1} />
              <StatCard label="Saved searches" value={buyer.savedSearchCount} />
            </div>
          )}

          {activeTab === 'transactions' && (
            mockTransactions.length > 0 ? (
              <div className="flex flex-col gap-3">
                {mockTransactions.map(txn => {
                  const asset = mockVaultAssets.find(a => a.id === txn.assetId)
                  const settlement = mockSettlements.find(s => s.transactionId === txn.id)
                  return (
                    <div key={txn.id} className="border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-black">{asset?.title ?? txn.assetId}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {txn.type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-[10px] text-slate-400">
                              {LICENCE_TYPE_LABELS[txn.licenceType]}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 mt-1">
                            {new Date(txn.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm font-bold text-black">€{(txn.buyerPays / 100).toFixed(2)}</div>
                          {settlement && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                              {PAYOUT_STATE_LABELS[settlement.state]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyPanel message="No transactions yet" detail="Licence assets to see transaction history" />
            )
          )}

          {activeTab === 'lightboxes' && (
            <div className="flex flex-col gap-3">
              <a href="/lightbox" className="border-2 border-black px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-black">{mockLightbox.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {mockLightbox.assetIds.length} assets · Updated {new Date(mockLightbox.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">View →</span>
                </div>
              </a>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex flex-col gap-4">
              <Panel title="Account settings" borderStyle="standard">
                <p className="text-xs text-slate-400">Account management features will be available here.</p>
              </Panel>
              <Panel title="Payment methods" borderStyle="standard">
                <p className="text-xs text-slate-400">Stripe payment method management placeholder.</p>
              </Panel>
              {buyer.vatNumber && (
                <Panel title="VAT details" borderStyle="standard">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">VAT Number</span>
                    <span className="text-sm font-mono text-black">{buyer.vatNumber}</span>
                  </div>
                </Panel>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-black px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">{label}</span>
      <span className="text-2xl font-bold text-black font-mono mt-1 block">{value}</span>
    </div>
  )
}
