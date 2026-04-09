'use client'

import { useState } from 'react'
import { VaultLeftRail, type VaultSection } from '@/components/platform/VaultLeftRail'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { DISPUTE_STATE_LABELS } from '@/lib/types'
import type { PrivacyState, Dispute, DisputeState } from '@/lib/types'

const DISPUTE_STATE_STYLES: Record<DisputeState, string> = {
  filed: 'border-2 border-dashed border-black text-black',
  under_review: 'border-blue-600 text-blue-600',
  upheld: 'bg-black text-white border-black',
  not_upheld: 'border-slate-300 text-slate-400',
  escalated_external: 'border-2 border-black text-black',
}

const mockDisputes: Dispute[] = [
  {
    id: 'disp-001',
    type: 'catalogue',
    state: 'under_review',
    assetId: 'asset-001',
    assignmentId: null,
    articleId: null,
    filerId: 'buyer-001',
    respondentId: 'sarahchen',
    reason: 'Buyer claims the delivered asset resolution does not match the listed specifications.',
    filedAt: '2026-03-28T14:00:00Z',
    resolvedAt: null,
    outcome: null,
  },
]

export default function DisputesPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')

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
            <h1 className="text-2xl font-bold text-black tracking-tight">Disputes</h1>

            <Panel title="Dispute resolution" borderStyle="standard">
              <p className="text-xs text-slate-500 leading-relaxed">
                Disputes are handled through Frontfiles&apos; internal resolution process. If internal resolution is not possible, disputes may be escalated to external adjudication. Three dispute types exist: catalogue (asset quality), commissioned (assignment delivery), and article (editorial content).
              </p>
            </Panel>

            {mockDisputes.length > 0 ? (
              <div className="flex flex-col gap-3">
                {mockDisputes.map(dispute => (
                  <div key={dispute.id} className="border-2 border-black px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${DISPUTE_STATE_STYLES[dispute.state]}`}>
                          {DISPUTE_STATE_LABELS[dispute.state]}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {dispute.type}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        Filed {new Date(dispute.filedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-sm text-black leading-relaxed">{dispute.reason}</p>

                    <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
                      {dispute.assetId && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset</span>
                          <span className="text-xs text-black">{dispute.assetId}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filed by</span>
                        <span className="text-xs text-black">{dispute.filerId}</span>
                      </div>
                    </div>

                    {dispute.state === 'under_review' && (
                      <div className="mt-3">
                        <button className="h-8 px-3 text-xs border border-black text-black font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors">
                          Submit response
                        </button>
                      </div>
                    )}

                    {dispute.resolvedAt && dispute.outcome && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Outcome</span>
                        <p className="text-xs text-black">{dispute.outcome}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel message="No disputes" detail="No disputes have been filed" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
