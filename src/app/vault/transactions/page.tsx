'use client'

import Link from 'next/link'
import { useTransaction } from '@/lib/transaction/context'
import { centsToEur } from '@/lib/transaction/reducer'
import { LICENCE_MEDIUM_LABELS } from '@/lib/documents/types'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import type { CatalogueTransaction, CreatorPackReadiness, WhitePackArtifact, FinalizationStatus } from '@/lib/transaction/types'
import type { ArtifactStatus } from '@/lib/fulfilment/types'

// ══════════════════════════════════════════════
// STATUS BADGES
// ══════════════════════════════════════════════

const TX_BADGE: Record<FinalizationStatus, { label: string; className: string }> = {
  finalizing: { label: 'Finalizing', className: 'border-amber-500 text-amber-600' },
  documents_generating: { label: 'Documents', className: 'border-amber-500 text-amber-600' },
  awaiting_signatures: { label: 'Signatures', className: 'border-amber-500 text-amber-600' },
  package_assembling: { label: 'Packaging', className: 'border-amber-500 text-amber-600' },
  white_pack_ready: { label: 'Packs ready', className: 'border-blue-600 text-blue-600' },
  completed: { label: 'Completed', className: 'border-black text-black' },
  finalization_failed: { label: 'Failed', className: 'border-red-600 text-red-600' },
}

const ARTIFACT_BADGE: Record<ArtifactStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-slate-300 text-slate-400' },
  generated: { label: 'Generated', className: 'border-blue-600 text-blue-600' },
  available: { label: 'Available', className: 'border-black text-black' },
  failed: { label: 'Failed', className: 'border-red-600 text-red-600' },
  revoked: { label: 'Revoked', className: 'border-red-600 text-red-600' },
}

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════

export default function VaultTransactionsPage() {
  const { state } = useTransaction()
  const { transaction, creatorPackReadiness } = state

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <Link href="/vault" className="hover:text-black transition-colors">Vault</Link>
          <span>/</span>
          <span className="text-black">Transactions</span>
        </div>

        <h1 className="text-2xl font-bold text-black tracking-tight">Creator Transactions</h1>
        <p className="text-sm text-slate-500">
          Transactions where your assets were licensed. Each completed transaction produces a creator pack.
        </p>

        {!transaction ? (
          <EmptyPanel
            message="No transactions yet."
            detail="When a buyer licenses your assets, the transaction and your creator pack will appear here."
          />
        ) : (
          <>
            {/* Transaction record */}
            <Panel title="Transaction" headerStyle="black" borderStyle="emphasis">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-black">{transaction.id}</div>
                    <div className="text-[10px] text-slate-400">{new Date(transaction.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest border px-2.5 py-1 ${
                    TX_BADGE[transaction.status].className
                  }`}>
                    {TX_BADGE[transaction.status].label}
                  </span>
                </div>

                {/* Line items — creator view shows what was licensed */}
                <div className="flex flex-col divide-y divide-slate-200">
                  {transaction.lineItems.map(li => (
                    <div key={li.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-black truncate">{li.assetTitle}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-600 px-1.5 py-0.5">
                              {LICENCE_MEDIUM_LABELS[li.selectedMedium]}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Std Editorial · 1yr · non-excl
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="text-sm font-bold text-black font-mono">
                            {centsToEur(li.creatorReceivesCents)}
                          </div>
                          <div className="text-[10px] text-slate-400">net to you</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Grant: {li.licenceGrantId ?? '—'}
                        {li.certificationHashAtGrant && ` · Hash: ${li.certificationHashAtGrant}`}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Creator economics */}
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-600">Your total earnings</span>
                  <span className="text-sm font-bold text-black font-mono">
                    {centsToEur(transaction.totalCreatorReceivesCents)}
                  </span>
                </div>
              </div>
            </Panel>

            {/* Creator pack */}
            {creatorPackReadiness && (
              <Panel title="Creator pack" headerStyle="blue" borderStyle="blue">
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-slate-400 mb-2">
                    Your certified delivery artifacts for this transaction.
                  </div>
                  {creatorPackReadiness.artifacts.map(artifact => (
                    <div key={artifact.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-black">{artifact.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{artifact.artifactType}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 ${
                          ARTIFACT_BADGE[artifact.status].className
                        }`}>
                          {ARTIFACT_BADGE[artifact.status].label}
                        </span>
                        {artifact.downloadable && artifact.status === 'available' ? (
                          <button className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:underline">
                            Download
                          </button>
                        ) : artifact.status !== 'available' && artifact.status !== 'pending' ? (
                          <span className="text-[10px] text-slate-300">Unavailable</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-blue-600/20 pt-3 mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Package: {creatorPackReadiness.packageId}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black">
                      {creatorPackReadiness.packageStatus ?? '—'}
                    </span>
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  )
}
