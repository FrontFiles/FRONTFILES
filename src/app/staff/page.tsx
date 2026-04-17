'use client'

import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { creators, publicAssets, stories, articles } from '@/data'
import { mockTransactions } from '@/lib/mock-data'

const STAFF_MODULES = [
  { id: 'onboarding-queue', label: 'Onboarding Queue', description: 'Review pending creator applications', count: 3 },
  { id: 'dispute-queue', label: 'Dispute Resolution Queue', description: 'Active disputes requiring staff review', count: 1 },
  { id: 'reverification', label: 'Reverification Queue', description: 'Creators due for periodic reverification', count: 0 },
  { id: 'content-moderation', label: 'Content Moderation', description: 'Flagged assets and articles for review', count: 0 },
  { id: 'settlement-ops', label: 'Settlement Operations', description: 'Failed or pending settlements requiring intervention', count: 0 },
  { id: 'trust-management', label: 'Trust Badge Management', description: 'Upgrade or revoke trust badges', count: 0 },
  { id: 'analytics', label: 'Platform Analytics', description: 'Transaction volume, creator activity, search metrics', count: null },
  { id: 'article-review', label: 'Frontfiles Article Review', description: 'Review articles submitted for Frontfiles publication', count: 0 },
]

export default function StaffPage() {
  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8 flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-black tracking-tight">Staff Operations</h1>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border border-dashed border-slate-300 px-2 py-1">
              Staff role required
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {STAFF_MODULES.map(mod => (
              <div key={mod.id} className="border-2 border-black px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-black">{mod.label}</h2>
                  {mod.count !== null && mod.count > 0 && (
                    <span className="bg-[#0000ff] text-white text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                      {mod.count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{mod.description}</p>
              </div>
            ))}
          </div>

          {/* Quick stats — derived from data, not hardcoded */}
          <Panel title="Platform summary" headerStyle="black" borderStyle="emphasis">
            <div className="grid grid-cols-4 gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Creators</span>
                <span className="text-lg font-bold text-black font-mono">{creators.length}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total assets</span>
                <span className="text-lg font-bold text-black font-mono">{publicAssets.length}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Transactions</span>
                <span className="text-lg font-bold text-black font-mono">{mockTransactions.length}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stories</span>
                <span className="text-lg font-bold text-black font-mono">{stories.length}</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
