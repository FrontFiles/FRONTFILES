'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTransaction } from '@/lib/transaction/context'
import { centsToEur } from '@/lib/transaction/reducer'
import { LICENCE_MEDIUM_LABELS } from '@/lib/documents/types'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { ArticlePreview } from '@/components/article/ArticlePreview'
import { articlePreviewFromTransactionLineItem } from '@/lib/article/from-checkout'
import type {
  WhitePackReadiness,
  WhitePackArtifact,
  DocumentReadinessItem,
  FinalizationStatus,
  WhitePackReadinessStatus,
  DocumentReadinessStatus,
  SignatureReadinessStatus,
} from '@/lib/transaction/types'
import type { ArtifactStatus } from '@/lib/fulfilment/types'

// ══════════════════════════════════════════════
// STATUS STYLING
// ══════════════════════════════════════════════

const FINALIZATION_BADGE: Record<FinalizationStatus, { label: string; className: string }> = {
  finalizing: { label: 'Finalizing', className: 'border-amber-500 text-amber-600' },
  documents_generating: { label: 'Documents generating', className: 'border-amber-500 text-amber-600' },
  awaiting_signatures: { label: 'Awaiting signatures', className: 'border-amber-500 text-amber-600' },
  package_assembling: { label: 'Package assembling', className: 'border-amber-500 text-amber-600' },
  white_pack_ready: { label: 'White pack ready', className: 'border-blue-600 text-blue-600' },
  completed: { label: 'Completed', className: 'border-black text-black' },
  finalization_failed: { label: 'Failed', className: 'border-red-600 text-red-600' },
}

const READINESS_BADGE: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not started', className: 'border-slate-300 text-slate-400' },
  pending: { label: 'Pending', className: 'border-amber-500 text-amber-600' },
  partial: { label: 'Partial', className: 'border-amber-500 text-amber-600' },
  ready: { label: 'Ready', className: 'border-black text-black' },
  blocked: { label: 'Blocked', className: 'border-red-600 text-red-600' },
  documents_pending: { label: 'Documents pending', className: 'border-amber-500 text-amber-600' },
  signatures_pending: { label: 'Signatures pending', className: 'border-amber-500 text-amber-600' },
  package_building: { label: 'Building', className: 'border-amber-500 text-amber-600' },
  partially_ready: { label: 'Partially ready', className: 'border-amber-500 text-amber-600' },
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

export default function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { state } = useTransaction()
  const { transaction, whitePackReadiness, payment } = state

  // For this prototype, we match the current transaction by ID or show the latest
  const tx = transaction && (transaction.id === id || id === 'latest') ? transaction : null

  if (!tx) {
    return (
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <EmptyPanel message="Transaction not found." detail={`No transaction with ID ${id}`} />
        </div>
      </div>
    )
  }

  const badge = FINALIZATION_BADGE[tx.status]
  const wpReady = whitePackReadiness

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <Link href="/cart" className="hover:text-black transition-colors">Cart</Link>
          <span>/</span>
          <span className="text-black">Transaction</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black tracking-tight">Transaction</h1>
            <div className="text-[10px] font-mono text-slate-400 mt-1">{tx.id}</div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest border px-2.5 py-1 ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        {/* ═══ TRANSACTION SUMMARY ═══ */}
        <Panel title="Transaction record" headerStyle="black" borderStyle="emphasis">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Transaction ID" value={tx.id} mono />
            <Field label="Payment ID" value={tx.paymentId} mono />
            <Field label="Payment status" value={payment?.status === 'payment_succeeded' ? 'Succeeded' : payment?.status ?? '—'} />
            <Field label="Transaction status" value={badge.label} />
            <Field label="Buyer pays" value={centsToEur(tx.totalBuyerPaysCents)} mono />
            <Field label="Creator receives" value={centsToEur(tx.totalCreatorReceivesCents)} mono />
            <Field label="Platform earns" value={centsToEur(tx.totalPlatformEarnsCents)} mono />
            <Field label="Created" value={new Date(tx.createdAt).toLocaleString()} />
          </div>
        </Panel>

        {/* ═══ LINE ITEMS ═══ */}
        <Panel title="Licence grants" headerStyle="black" borderStyle="emphasis">
          <div className="flex flex-col divide-y divide-slate-200">
            {tx.lineItems.map(li => (
              <div key={li.id} className="py-5 first:pt-1 last:pb-1 flex flex-col gap-4">
                <ArticlePreview variant="standard" {...articlePreviewFromTransactionLineItem(li)} />
                <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-600 px-1.5 py-0.5">
                        {LICENCE_MEDIUM_LABELS[li.selectedMedium]}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Std Editorial · 1yr · non-excl
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Grant: {li.licenceGrantId ?? '—'}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-black font-mono shrink-0">
                    {centsToEur(li.buyerPaysCents)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ═══ READINESS DASHBOARD ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ReadinessTile
            label="Document readiness"
            status={wpReady?.documentReadiness.overallStatus ?? 'not_started'}
          />
          <ReadinessTile
            label="Signature readiness"
            status={wpReady?.signatureReadiness.overallStatus ?? 'not_started'}
            detail={wpReady?.signatureReadiness
              ? `${wpReady.signatureReadiness.totalSigned}/${wpReady.signatureReadiness.totalRequired} signed`
              : undefined}
          />
          <ReadinessTile
            label="White pack"
            status={wpReady?.overallStatus ?? 'not_started'}
          />
        </div>

        {/* ═══ DOCUMENT STATUS ═══ */}
        {wpReady?.documentReadiness && (
          <Panel title="Canonical documents" borderStyle="standard">
            <div className="flex flex-col divide-y divide-slate-100">
              {wpReady.documentReadiness.documents.map(doc => (
                <div key={doc.documentTypeId} className="flex items-center justify-between py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-black">{doc.shortLabel}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {doc.signable ? 'Signable' : 'Non-signable'}
                      {doc.signatureStatus && ` · Signatures: ${doc.signatureStatus}`}
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* ═══ WHITE PACK ARTIFACTS ═══ */}
        {wpReady && wpReady.artifacts.length > 0 && (
          <Panel title="Buyer white pack" headerStyle="blue" borderStyle="blue">
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-slate-400 mb-2">
                Governed delivery artifacts — download available when status is Available.
              </div>
              {wpReady.artifacts.map(artifact => (
                <ArtifactRow key={artifact.id} artifact={artifact} />
              ))}
              <div className="border-t border-blue-600/20 pt-3 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusDot ready={wpReady.originalAssetReady} label="Original asset" />
                  <StatusDot ready={wpReady.provenanceRecordReady} label="Provenance record" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 ${
                  READINESS_BADGE[wpReady.overallStatus]?.className ?? ''
                }`}>
                  {READINESS_BADGE[wpReady.overallStatus]?.label ?? wpReady.overallStatus}
                </span>
              </div>
            </div>
          </Panel>
        )}

        {/* ═══ FINALIZATION NOT YET COMPLETE ═══ */}
        {tx.status !== 'completed' && tx.status !== 'white_pack_ready' && (
          <div className="border-2 border-dashed border-amber-500 px-6 py-4 text-center">
            <span className="text-sm text-amber-600 font-bold">
              {tx.status === 'finalization_failed'
                ? `Finalization failed: ${tx.failureReason ?? 'Unknown error'}`
                : 'Transaction is still being finalized. Delivery artifacts will appear when ready.'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/search"
            className="h-10 px-5 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors flex items-center"
          >
            Back to catalogue
          </Link>
          <Link
            href="/vault/transactions"
            className="h-10 px-5 border border-black text-black text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors flex items-center"
          >
            View all transactions
          </Link>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-sm text-black ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function ReadinessTile({ label, status, detail }: { label: string; status: string; detail?: string }) {
  const badge = READINESS_BADGE[status] ?? { label: status, className: 'border-slate-300 text-slate-400' }
  return (
    <div className="border border-slate-200 px-4 py-3 flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 self-start ${badge.className}`}>
        {badge.label}
      </span>
      {detail && <span className="text-[10px] text-slate-400">{detail}</span>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    finalized: 'border-black text-black',
    preview_ready: 'border-blue-600 text-blue-600',
    pending: 'border-slate-300 text-slate-400',
    failed: 'border-red-600 text-red-600',
  }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  )
}

function ArtifactRow({ artifact }: { artifact: WhitePackArtifact }) {
  const badge = ARTIFACT_BADGE[artifact.status]
  // Download gated by both artifact readiness and downloadable flag
  const canDownload = artifact.downloadable && artifact.status === 'available'
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-black">{artifact.label}</div>
        <div className="text-[10px] text-slate-400 font-mono">{artifact.artifactType}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 ${badge.className}`}>
          {badge.label}
        </span>
        {canDownload ? (
          <button className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:underline">
            Download
          </button>
        ) : artifact.status !== 'available' && artifact.status !== 'pending' ? (
          <span className="text-[10px] text-slate-300">Unavailable</span>
        ) : null}
      </div>
    </div>
  )
}

function StatusDot({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${ready ? 'bg-black' : 'bg-slate-300'}`} />
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  )
}
