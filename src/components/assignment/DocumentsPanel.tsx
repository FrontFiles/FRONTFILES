'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import { centsToEur, isAssignmentOperational } from '@/lib/assignment/selectors'
import { getClosingResult } from '@/lib/assignment/store'
import { mockDocumentSetByAssignment } from '@/lib/documents/mock-data'
import { ASSIGNMENT_DOCUMENT_REGISTRY } from '@/lib/assignment/closing-types'
import {
  DOCUMENT_REGISTRY_MAP,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_ISSUER_LABELS,
  LICENCE_MEDIUM_LABELS,
} from '@/lib/documents/types'
import type {
  TransactionDocument,
  TransactionDocumentSet,
  DocumentStatus,
  DocumentCategory,
} from '@/lib/documents/types'
import type { DocumentPartySnapshot } from '@/lib/documents/identity'
import { SIGNER_ROLE_LABELS } from '@/lib/documents/identity'
import type { DocumentSignerRequirement, SignatureStatus } from '@/lib/documents/signature'
import type { RenderVisibilityMode } from '@/lib/documents/redaction'
import { RENDER_MODE_LABELS, getRedactionPolicy, applyRedaction } from '@/lib/documents/redaction'

// ══════════════════════════════════════════════
// STATUS STYLING
// ══════════════════════════════════════════════

const STATUS_STYLES: Record<DocumentStatus, { label: string; className: string }> = {
  finalized: { label: 'Finalized', className: 'border-black text-black' },
  preview_ready: { label: 'Preview ready', className: 'border-[#0000ff] text-[#0000ff]' },
  pending: { label: 'Pending', className: 'border-black/20 text-black/30' },
  failed: { label: 'Failed', className: 'border-red-600 text-red-600' },
}

const CATEGORY_STYLES: Record<DocumentCategory, string> = {
  licence: 'border-black text-black bg-black/[0.03]',
  contract: 'border-black/40 text-black/60',
  invoice: 'border-[#0000ff]/40 text-[#0000ff]/60',
  receipt: 'border-[#0000ff]/40 text-[#0000ff]/60',
}

const SIGNATURE_STATUS_STYLES: Record<SignatureStatus, { label: string; className: string }> = {
  required: { label: 'Required', className: 'border-black/20 text-black/30' },
  pending: { label: 'Pending', className: 'border-amber-500 text-amber-600' },
  signed: { label: 'Signed', className: 'border-black text-black' },
  declined: { label: 'Declined', className: 'border-red-600 text-red-600' },
  expired: { label: 'Expired', className: 'border-black/20 text-black/30' },
}

// ══════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════

export function DocumentsPanel() {
  const { state } = useAssignment()
  const a = state.assignment
  if (!a) return null

  const docSet = mockDocumentSetByAssignment[a.id] ?? null
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [renderMode, setRenderMode] = useState<RenderVisibilityMode>('buyer_pack')

  // Show assignment contract documents (from closing flow)
  const hasEscrow = a.escrow.totalCapturedCents > 0
  const isOperational = isAssignmentOperational(a)
  const closingResult = getClosingResult(a.id)

  if (!docSet) {
    return (
      <div className="flex flex-col gap-6">
        {/* Assignment contract documents */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">Assignment contract documents</span>
            <div className="flex-1 border-b border-black/5" />
          </div>
          {hasEscrow ? (
            <div className="border-2 border-black">
              <div className="divide-y divide-black/5">
                {ASSIGNMENT_DOCUMENT_REGISTRY.map(doc => {
                  const docStatus = closingResult?.documentReadiness.documents.find(d => d.documentTypeId === doc.id)
                  const isFinalized = docStatus ? docStatus.status === 'finalized' : isOperational
                  const sigLabel = docStatus?.signable
                    ? (docStatus.signatureStatus === 'ready' ? 'Signed by all parties' : `Signatures: ${docStatus.signatureStatus}`)
                    : (doc.signable ? 'Signed by all parties' : 'System-generated')
                  return (
                    <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-black">{doc.label}</div>
                        <div className="text-[8px] text-black/30 mt-0.5">{sigLabel}</div>
                      </div>
                      <span className={cn(
                        'text-[8px] font-bold uppercase tracking-wider border px-1.5 py-0.5',
                        isFinalized ? 'border-black text-black' : 'border-black/15 text-black/20',
                      )}>
                        {isFinalized ? 'Finalized' : 'Pending'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-black/15 py-6 text-center">
              <p className="text-[10px] text-black/25 uppercase tracking-widest">
                Contract documents will be generated when assignment is funded
              </p>
            </div>
          )}
        </div>

        {/* Transaction documents placeholder */}
        <div className="border-2 border-dashed border-black/15 py-10 text-center">
          <p className="text-[10px] text-black/25 uppercase tracking-widest">No transaction document set generated for this assignment</p>
        </div>
      </div>
    )
  }

  const selectedDoc = selectedDocId
    ? docSet.documents.find(d => d.id === selectedDocId) ?? null
    : null

  const finalized = docSet.documents.filter(d => d.status === 'finalized').length
  const total = docSet.documents.length

  return (
    <div className="flex flex-col gap-6">
      {/* Context header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">Transaction documents</span>
            <span className="text-[8px] font-mono text-black/20">{docSet.transactionId}</span>
          </div>
          <p className="text-xs text-black/50">{docSet.assetRef}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Render mode selector */}
          <RenderModeSelector mode={renderMode} onChange={setRenderMode} />
          <div className="flex flex-col items-end gap-1">
            <span className={cn(
              'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
              docSet.allFinalized ? 'border-black text-black' : 'border-black/20 text-black/30',
            )}>
              {docSet.allFinalized ? 'All finalized' : `${finalized}/${total} finalized`}
            </span>
            <span className={cn(
              'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
              docSet.allSigned ? 'border-black text-black' : 'border-amber-500/40 text-amber-600/60',
            )}>
              {docSet.allSigned ? 'All signed' : 'Signatures pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Two-column: list + preview */}
      <div className="flex gap-6">
        {/* Document list — left column */}
        <div className="w-[420px] shrink-0 flex flex-col gap-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Documents</span>
            <div className="flex-1 border-b border-black/5" />
            <span className="text-[8px] font-mono text-black/15">{total} items</span>
          </div>

          {docSet.documents
            .sort((a, b) => {
              const ra = DOCUMENT_REGISTRY_MAP[a.typeId]
              const rb = DOCUMENT_REGISTRY_MAP[b.typeId]
              return (ra?.displayOrder ?? 99) - (rb?.displayOrder ?? 99)
            })
            .map(doc => {
              const reg = DOCUMENT_REGISTRY_MAP[doc.typeId]
              if (!reg) return null
              const isSelected = selectedDocId === doc.id
              const inBuyer = docSet.buyerPackDocumentIds.includes(doc.id)
              const inCreator = docSet.creatorPackDocumentIds.includes(doc.id)
              const statusStyle = STATUS_STYLES[doc.status]
              const hasSignatures = doc.signerRequirements && doc.signerRequirements.length > 0
              const allSigned = hasSignatures && doc.signerRequirements!.every(r => r.status === 'signed')

              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(isSelected ? null : doc.id)}
                  className={cn(
                    'w-full text-left border-2 p-3 transition-colors -mt-[2px] first:mt-0',
                    isSelected ? 'border-black bg-black/[0.02]' : 'border-black/10 hover:border-black/30',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Category badge */}
                    <span className={cn(
                      'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border shrink-0 mt-0.5',
                      CATEGORY_STYLES[reg.category],
                    )}>
                      {DOCUMENT_CATEGORY_LABELS[reg.category]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-black leading-tight truncate">{reg.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[7px] text-black/25">{DOCUMENT_ISSUER_LABELS[reg.issuer]}</span>
                        {doc.documentRef && (
                          <span className="text-[7px] font-mono text-black/20">{doc.documentRef}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
                        statusStyle.className,
                      )}>
                        {statusStyle.label}
                      </span>
                      <div className="flex items-center gap-1">
                        {hasSignatures && (
                          <span className={cn(
                            'text-[6px] font-bold uppercase tracking-wider px-1 py-0.5 border',
                            allSigned ? 'border-black text-black' : 'border-amber-500/40 text-amber-600/60',
                          )}>
                            {allSigned ? 'Signed' : 'Sig.'}
                          </span>
                        )}
                        {inBuyer && (
                          <span className="text-[6px] font-bold uppercase tracking-wider text-black/20 border border-black/10 px-1 py-0.5">B</span>
                        )}
                        {inCreator && (
                          <span className="text-[6px] font-bold uppercase tracking-wider text-black/20 border border-black/10 px-1 py-0.5">C</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}

          {/* Pack summary */}
          <div className="mt-4 flex gap-3">
            <PackSummary
              label="Buyer pack"
              docIds={docSet.buyerPackDocumentIds}
              documents={docSet.documents}
            />
            <PackSummary
              label="Creator pack"
              docIds={docSet.creatorPackDocumentIds}
              documents={docSet.documents}
            />
          </div>
        </div>

        {/* Preview — right column */}
        <div className="flex-1 min-w-0">
          {selectedDoc ? (
            <DocumentPreview doc={selectedDoc} docSet={docSet} renderMode={renderMode} />
          ) : (
            <div className="border-2 border-dashed border-black/10 h-full min-h-[400px] flex items-center justify-center">
              <p className="text-[10px] text-black/20 uppercase tracking-widest">Select a document to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// RENDER MODE SELECTOR
// ══════════════════════════════════════════════

function RenderModeSelector({
  mode,
  onChange,
}: {
  mode: RenderVisibilityMode
  onChange: (mode: RenderVisibilityMode) => void
}) {
  const modes: RenderVisibilityMode[] = ['canonical', 'buyer_pack', 'creator_pack', 'evidence']
  return (
    <div className="flex items-center gap-0">
      {modes.map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            'text-[7px] font-bold uppercase tracking-wider px-2 py-1 border-2 -ml-[2px] first:ml-0 transition-colors',
            m === mode
              ? 'border-[#0000ff] bg-[#0000ff] text-white z-10'
              : 'border-black/15 text-black/30 hover:border-black/30',
          )}
        >
          {RENDER_MODE_LABELS[m]}
        </button>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════
// PACK SUMMARY
// ══════════════════════════════════════════════

function PackSummary({
  label,
  docIds,
  documents,
}: {
  label: string
  docIds: string[]
  documents: TransactionDocument[]
}) {
  const included = documents.filter(d => docIds.includes(d.id))
  const allFinalized = included.every(d => d.status === 'finalized')
  const pendingCount = included.filter(d => d.status === 'pending').length

  return (
    <div className="flex-1 border-2 border-black/10 p-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/30">{label}</span>
        <span className={cn(
          'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
          allFinalized ? 'border-black text-black' : 'border-black/15 text-black/25',
        )}>
          {allFinalized ? 'Complete' : `${pendingCount} pending`}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {included.map(d => {
          const reg = DOCUMENT_REGISTRY_MAP[d.typeId]
          return (
            <div key={d.id} className="flex items-center gap-1">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                d.status === 'finalized' ? 'bg-black' :
                d.status === 'preview_ready' ? 'bg-[#0000ff]' :
                d.status === 'failed' ? 'bg-red-600' :
                'bg-black/15',
              )} />
              <span className="text-[8px] text-black/40 truncate">{reg?.shortLabel ?? d.typeId}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// DOCUMENT PREVIEW
// ══════════════════════════════════════════════

function DocumentPreview({
  doc,
  docSet,
  renderMode,
}: {
  doc: TransactionDocument
  docSet: TransactionDocumentSet
  renderMode: RenderVisibilityMode
}) {
  const reg = DOCUMENT_REGISTRY_MAP[doc.typeId]
  if (!reg) return null

  return (
    <div className="border-2 border-black">
      {/* Preview header */}
      <div className="px-4 py-3 border-b-2 border-black flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-black">{reg.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
              CATEGORY_STYLES[reg.category],
            )}>
              {DOCUMENT_CATEGORY_LABELS[reg.category]}
            </span>
            <span className="text-[7px] text-black/25">Issued by {DOCUMENT_ISSUER_LABELS[reg.issuer]}</span>
            <span className={cn(
              'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
              renderMode === 'canonical' ? 'border-black text-black' :
              renderMode === 'evidence' ? 'border-red-600 text-red-600' :
              'border-[#0000ff] text-[#0000ff]',
            )}>
              {RENDER_MODE_LABELS[renderMode]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doc.status === 'finalized' && (
            <button className="text-[8px] font-bold uppercase tracking-wider border-2 border-black px-2.5 py-1 hover:bg-black hover:text-white transition-colors">
              Download
            </button>
          )}
          <span className={cn(
            'text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
            STATUS_STYLES[doc.status].className,
          )}>
            {STATUS_STYLES[doc.status].label}
          </span>
        </div>
      </div>

      {/* Preview body */}
      <div className="p-5">
        {doc.typeId === 'standard_editorial_licence' ? (
          <LicencePreview doc={doc} renderMode={renderMode} />
        ) : reg.category === 'contract' ? (
          <ContractPreview doc={doc} renderMode={renderMode} />
        ) : reg.category === 'invoice' ? (
          <InvoicePreview doc={doc} />
        ) : reg.category === 'receipt' ? (
          <ReceiptPreview doc={doc} />
        ) : null}
      </div>

      {/* Preview footer */}
      <div className="px-4 py-2 border-t border-black/10 bg-black/[0.01] flex items-center gap-3">
        {doc.documentRef && (
          <span className="text-[7px] font-mono text-black/20">Ref: {doc.documentRef}</span>
        )}
        {doc.issuedAt && (
          <span className="text-[7px] font-mono text-black/20">
            Issued: {new Date(doc.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
        {doc.contentHash && (renderMode === 'canonical' || renderMode === 'evidence') && (
          <span className="text-[7px] font-mono text-black/15">Hash: {doc.contentHash.slice(0, 32)}...</span>
        )}
        <div className="flex-1" />
        <span className="text-[7px] text-black/15">{docSet.transactionId}</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// PARTY IDENTITY BLOCK — with redaction
// ══════════════════════════════════════════════

function PartyIdentityBlock({
  snapshot,
  label,
  renderMode,
  isSelfParty,
}: {
  snapshot: DocumentPartySnapshot
  label: string
  renderMode: RenderVisibilityMode
  isSelfParty: boolean
}) {
  const id = snapshot.identity
  const policy = getRedactionPolicy(renderMode, isSelfParty)

  return (
    <div className="flex-1">
      <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-2">{label}</span>
      <div className="flex flex-col gap-1.5">
        <div>
          <span className="text-[7px] text-black/25 block">Legal name</span>
          <p className="text-[10px] font-bold text-black">{applyRedaction(id.fullLegalName, policy.fullLegalName, 'fullLegalName')}</p>
        </div>
        <div>
          <span className="text-[7px] text-black/25 block">Date of birth</span>
          <p className="text-[10px] text-black/60">{applyRedaction(id.dateOfBirth, policy.dateOfBirth, 'dateOfBirth')}</p>
        </div>
        <div>
          <span className="text-[7px] text-black/25 block">Nationality</span>
          <p className="text-[10px] text-black/60">{applyRedaction(id.nationality, policy.nationality, 'nationality')}</p>
        </div>
        <div>
          <span className="text-[7px] text-black/25 block">Address</span>
          <p className="text-[10px] text-black/60">{applyRedaction(id.legalAddress, policy.legalAddress, 'legalAddress')}</p>
        </div>
        <div>
          <span className="text-[7px] text-black/25 block">Government ID</span>
          <p className="text-[10px] text-black/60">
            {applyRedaction(id.governmentIdType, policy.governmentIdType, 'governmentIdType')} — {applyRedaction(id.governmentIdNumber, policy.governmentIdNumber, 'governmentIdNumber')}
            {' '}({applyRedaction(id.issuingCountry, policy.issuingCountry, 'issuingCountry')})
          </p>
        </div>
        <div>
          <span className="text-[7px] text-black/25 block">Email</span>
          <p className="text-[10px] text-black/60">{applyRedaction(id.email, policy.email, 'email')}</p>
        </div>
        {id.representedEntity && (
          <div>
            <span className="text-[7px] text-black/25 block">Entity</span>
            <p className="text-[10px] text-black/60">{id.representedEntity.name}</p>
            {id.authorityCapacity && (
              <p className="text-[8px] text-black/40">as {id.authorityCapacity}</p>
            )}
          </div>
        )}
        <div>
          <span className="text-[7px] text-black/25 block">Role</span>
          <p className="text-[10px] text-black/60">{SIGNER_ROLE_LABELS[id.signerRole]}</p>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// SIGNATURE STATUS BLOCK
// ══════════════════════════════════════════════

function SignatureStatusBlock({
  requirements,
  renderMode,
}: {
  requirements: DocumentSignerRequirement[]
  renderMode: RenderVisibilityMode
}) {
  if (renderMode !== 'canonical' && renderMode !== 'evidence') return null

  return (
    <div className="border-2 border-black/15 p-3">
      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/30 block mb-2">Signature status</span>
      <div className="flex flex-col gap-2">
        {requirements.map(req => {
          const style = SIGNATURE_STATUS_STYLES[req.status]
          return (
            <div key={req.id} className="flex items-center gap-2">
              <span className={cn(
                'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
                style.className,
              )}>
                {style.label}
              </span>
              <span className="text-[9px] text-black/50">{req.label}</span>
              <span className="text-[7px] text-black/20">{SIGNER_ROLE_LABELS[req.signerRole]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// EVIDENCE BLOCK
// ══════════════════════════════════════════════

function EvidenceBlock({
  doc,
  renderMode,
}: {
  doc: TransactionDocument
  renderMode: RenderVisibilityMode
}) {
  if (renderMode !== 'evidence' || !doc.evidenceBundle) return null
  const ev = doc.evidenceBundle

  return (
    <div className="border-2 border-red-600/20 p-3 bg-red-600/[0.02]">
      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-red-600/50 block mb-2">Evidence bundle</span>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[7px] text-red-600/40">Integrity</span>
          <span className={cn(
            'text-[8px] font-bold',
            ev.integrityVerified ? 'text-black' : 'text-red-600',
          )}>
            {ev.integrityVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] text-red-600/40">Signatures</span>
          <span className="text-[8px] font-bold text-black">
            {ev.signatureRecords.length}/{ev.signerRequirements.length} captured
          </span>
        </div>
        <div>
          <span className="text-[7px] text-red-600/40 block">Document hash</span>
          <span className="text-[8px] font-mono text-black/40">{ev.finalDocumentHash}</span>
        </div>
        {ev.signatureRecords.map(rec => (
          <div key={rec.id} className="border-t border-red-600/10 pt-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-bold text-black/50">{SIGNER_ROLE_LABELS[rec.signerRole]}</span>
              <span className="text-[7px] font-mono text-black/30">
                {new Date(rec.signedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[7px] text-black/25">Auth: {rec.authMethod}</span>
              <span className="text-[7px] text-black/25">Intent: {rec.intentConfirmed ? 'confirmed' : 'unconfirmed'}</span>
            </div>
            <span className="text-[7px] font-mono text-black/15 block mt-0.5">Req: {rec.requestId}</span>
          </div>
        ))}
        <span className="text-[7px] font-mono text-red-600/25 block mt-1">
          Assembled: {new Date(ev.assembledAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ASSET SCHEDULE BLOCK
// ══════════════════════════════════════════════

function AssetScheduleBlock({ doc }: { doc: TransactionDocument }) {
  if (!doc.assetSchedule || doc.assetSchedule.length === 0) return null

  return (
    <div className="border-2 border-black/10 p-3">
      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/30 block mb-2">Asset schedule</span>
      {doc.assetSchedule.map(entry => (
        <div key={entry.assetId} className="flex flex-col gap-1">
          <p className="text-[10px] font-bold text-black">{entry.assetTitle}</p>
          <div className="flex items-center gap-3">
            <span className="text-[8px] text-black/40">By {entry.creatorAttribution}</span>
            {entry.selectedMedium && (
              <span className="text-[8px] text-black/40">Medium: {LICENCE_MEDIUM_LABELS[entry.selectedMedium]}</span>
            )}
            <span className="text-[8px] text-black/40">Term: {entry.licenceTerm}</span>
          </div>
          {entry.certificationRecordId && (
            <span className="text-[7px] font-mono text-black/20">Cert: {entry.certificationRecordId}</span>
          )}
          {entry.certificationHashAtIssue && (
            <span className="text-[7px] font-mono text-black/15">Hash: {entry.certificationHashAtIssue}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════
// LICENCE PREVIEW — Frontfiles Standard Editorial Licence
// ══════════════════════════════════════════════

function LicencePreview({
  doc,
  renderMode,
}: {
  doc: TransactionDocument
  renderMode: RenderVisibilityMode
}) {
  const medium = doc.licenceMedium
  const snapshots = doc.partySnapshots ?? []
  const creatorSnap = snapshots.find(s => s.identity.signerRole === 'creator')
  const buyerSnap = snapshots.find(s => s.identity.signerRole === 'buyer' || s.identity.signerRole === 'buyer_representative')

  return (
    <div className="flex flex-col gap-5">
      {/* Title block */}
      <div className="border-b-2 border-black pb-4">
        <h2 className="text-sm font-bold text-black tracking-tight">Frontfiles Standard Editorial Licence</h2>
        <p className="text-[9px] text-black/40 mt-1">Fixed-term, non-exclusive editorial content licence</p>
      </div>

      {/* Parties — identity-aware with redaction */}
      {creatorSnap || buyerSnap ? (
        <div className="flex gap-6">
          {creatorSnap && (
            <PartyIdentityBlock
              snapshot={creatorSnap}
              label="Licensor (creator)"
              renderMode={renderMode}
              isSelfParty={renderMode === 'creator_pack'}
            />
          )}
          {buyerSnap && (
            <PartyIdentityBlock
              snapshot={buyerSnap}
              label="Licensee (buyer)"
              renderMode={renderMode}
              isSelfParty={renderMode === 'buyer_pack'}
            />
          )}
        </div>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1">
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Licensor (creator)</span>
            <p className="text-[10px] font-bold text-black">{doc.counterparties.party1}</p>
          </div>
          <div className="flex-1">
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Licensee (buyer)</span>
            <p className="text-[10px] font-bold text-black">{doc.counterparties.party2}</p>
          </div>
        </div>
      )}

      {/* Rights block — the canonical fixed constraints */}
      <div className="border-2 border-black p-4">
        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/40 block mb-3">Licence terms</span>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <LicenceField label="Usage class" value={doc.licenceDetails?.usageClass ?? 'Editorial'} />
          <LicenceField label="Medium scope" value={doc.licenceDetails?.mediumScope ?? 'Single medium'} />
          <LicenceField
            label="Selected medium"
            value={medium ? LICENCE_MEDIUM_LABELS[medium] : 'Not specified'}
            highlight={!!medium}
          />
          <LicenceField label="Term" value={doc.licenceDetails?.term ?? '1 year'} />
          <LicenceField label="Exclusivity" value={doc.licenceDetails?.exclusivity ?? 'Non-exclusive'} />
          <LicenceField label="Territory" value={doc.licenceDetails?.territory ?? 'As specified in assignment'} />
        </div>
      </div>

      {/* Asset schedule */}
      <AssetScheduleBlock doc={doc} />

      {/* Signature status */}
      {doc.signerRequirements && (
        <SignatureStatusBlock requirements={doc.signerRequirements} renderMode={renderMode} />
      )}

      {/* Evidence */}
      <EvidenceBlock doc={doc} renderMode={renderMode} />

      {/* Restrictions notice */}
      <div className="bg-black/[0.02] border border-black/10 px-4 py-3">
        <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Restrictions</span>
        <ul className="flex flex-col gap-1">
          <li className="text-[9px] text-black/50">Editorial use only. No commercial, advertising, or promotional use.</li>
          <li className="text-[9px] text-black/50">Single medium only. Multi-medium rights require separate licence.</li>
          <li className="text-[9px] text-black/50">1-year term from date of issue. Renewal requires new licence.</li>
          <li className="text-[9px] text-black/50">Non-exclusive. Creator retains all rights not explicitly granted.</li>
        </ul>
      </div>

      {/* Reference */}
      {doc.documentRef && (
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono text-black/20">Document: {doc.documentRef}</span>
        </div>
      )}
    </div>
  )
}

function LicenceField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">{label}</span>
      <p className={cn(
        'text-[10px] font-bold mt-0.5',
        highlight ? 'text-black' : 'text-black/70',
      )}>
        {value}
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONTRACT PREVIEW
// ══════════════════════════════════════════════

function ContractPreview({
  doc,
  renderMode,
}: {
  doc: TransactionDocument
  renderMode: RenderVisibilityMode
}) {
  const reg = DOCUMENT_REGISTRY_MAP[doc.typeId]
  const isCreatorContract = doc.typeId === 'contract_creator_frontfiles'
  const snapshots = doc.partySnapshots ?? []
  const partySnap = snapshots.find(s => s.identity.signerRole !== 'platform')
  const platformSnap = snapshots.find(s => s.identity.signerRole === 'platform')

  return (
    <div className="flex flex-col gap-5">
      <div className="border-b-2 border-black pb-4">
        <h2 className="text-sm font-bold text-black tracking-tight">{reg?.label}</h2>
        <p className="text-[9px] text-black/40 mt-1">Frontfiles platform agreement</p>
      </div>

      {/* Parties — identity-aware */}
      {partySnap || platformSnap ? (
        <div className="flex gap-6">
          {partySnap && (
            <PartyIdentityBlock
              snapshot={partySnap}
              label="Party A"
              renderMode={renderMode}
              isSelfParty={
                (isCreatorContract && renderMode === 'creator_pack') ||
                (!isCreatorContract && renderMode === 'buyer_pack')
              }
            />
          )}
          {platformSnap && (
            <PartyIdentityBlock
              snapshot={platformSnap}
              label="Party B (Platform)"
              renderMode={renderMode}
              isSelfParty={false}
            />
          )}
        </div>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1">
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Party A</span>
            <p className="text-[10px] font-bold text-black">{doc.counterparties.party1}</p>
          </div>
          <div className="flex-1">
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Party B</span>
            <p className="text-[10px] font-bold text-black">{doc.counterparties.party2}</p>
          </div>
        </div>
      )}

      {/* Contract scope */}
      <div className="border-2 border-black/20 p-4">
        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/40 block mb-3">Contract scope</span>
        <div className="flex flex-col gap-2">
          <div>
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Document type</span>
            <p className="text-[10px] text-black/70 mt-0.5">Platform services agreement</p>
          </div>
          <div>
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Relationship</span>
            <p className="text-[10px] text-black/70 mt-0.5">
              {isCreatorContract
                ? 'Creator engagement terms for commissioned work via Frontfiles'
                : 'Buyer commissioning terms for content acquisition via Frontfiles'}
            </p>
          </div>
          <div>
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Linked transaction</span>
            <p className="text-[10px] font-mono text-black/50 mt-0.5">{doc.transactionId}</p>
          </div>
        </div>
      </div>

      {/* Asset schedule */}
      <AssetScheduleBlock doc={doc} />

      {/* Signature status */}
      {doc.signerRequirements && (
        <SignatureStatusBlock requirements={doc.signerRequirements} renderMode={renderMode} />
      )}

      {/* Evidence */}
      <EvidenceBlock doc={doc} renderMode={renderMode} />

      <div className="bg-black/[0.02] border border-black/10 px-4 py-3">
        <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Governing terms</span>
        <p className="text-[9px] text-black/50">
          {isCreatorContract
            ? 'Covers fulfilment obligations, evidence submission requirements, escrow release conditions, dispute resolution, and platform fee deductions.'
            : 'Covers commissioning authority, review and acceptance procedures, escrow obligations, dispute initiation, and platform fee structure.'}
        </p>
      </div>

      {doc.documentRef && (
        <span className="text-[7px] font-mono text-black/20">Document: {doc.documentRef}</span>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// INVOICE PREVIEW
// ══════════════════════════════════════════════

function InvoicePreview({ doc }: { doc: TransactionDocument }) {
  const reg = DOCUMENT_REGISTRY_MAP[doc.typeId]
  const fin = doc.finance

  return (
    <div className="flex flex-col gap-5">
      <div className="border-b border-[#0000ff]/20 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-black tracking-tight">{reg?.label}</h2>
          <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border border-[#0000ff]/30 text-[#0000ff]/60">
            Payment processor
          </span>
        </div>
        <p className="text-[9px] text-black/40 mt-1">Normalized from payment processor records</p>
      </div>

      {/* Parties */}
      <div className="flex gap-6">
        <div className="flex-1">
          <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">From</span>
          <p className="text-[10px] font-bold text-black">{doc.counterparties.party1}</p>
        </div>
        <div className="flex-1">
          <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">To</span>
          <p className="text-[10px] font-bold text-black">{doc.counterparties.party2}</p>
        </div>
      </div>

      {fin && (
        <>
          {/* Invoice details */}
          <div className="border-2 border-[#0000ff]/15 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#0000ff]/40">Invoice details</span>
              {fin.invoiceId && (
                <span className="text-[8px] font-mono text-black/30">{fin.invoiceId}</span>
              )}
            </div>
            <div className="flex gap-6 mb-3">
              <div>
                <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Issue date</span>
                <p className="text-[10px] text-black/70 mt-0.5">{fin.issueDate ?? 'Pending'}</p>
              </div>
              <div>
                <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Payment date</span>
                <p className="text-[10px] text-black/70 mt-0.5">{fin.paymentDate ?? 'Pending'}</p>
              </div>
              <div>
                <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Currency</span>
                <p className="text-[10px] text-black/70 mt-0.5">{fin.currency}</p>
              </div>
            </div>
            {/* Line items */}
            <div className="border-t border-black/10 pt-2">
              {fin.lineItems.map((li, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-[9px] text-black/50">{li.description}</span>
                  <span className="text-[9px] font-mono text-black/60">{centsToEur(li.amountCents)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-black/10">
                <span className="text-[9px] font-bold text-black">Total</span>
                <span className="text-[10px] font-bold font-mono text-black">{centsToEur(fin.amountCents)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-[#0000ff]/[0.02] border border-[#0000ff]/10 px-4 py-2">
        <p className="text-[8px] text-[#0000ff]/40">
          This invoice is sourced from the payment processor and normalized into Frontfiles records. It is not a Frontfiles-authored legal document.
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// RECEIPT PREVIEW
// ══════════════════════════════════════════════

function ReceiptPreview({ doc }: { doc: TransactionDocument }) {
  const reg = DOCUMENT_REGISTRY_MAP[doc.typeId]
  const fin = doc.finance

  return (
    <div className="flex flex-col gap-5">
      <div className="border-b border-[#0000ff]/20 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-black tracking-tight">{reg?.label}</h2>
          <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border border-[#0000ff]/30 text-[#0000ff]/60">
            Payment processor
          </span>
        </div>
        <p className="text-[9px] text-black/40 mt-1">Payment confirmation normalized from processor</p>
      </div>

      {/* Parties */}
      <div className="flex gap-6">
        <div className="flex-1">
          <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Issued in name of</span>
          <p className="text-[10px] font-bold text-black">{doc.counterparties.party1}</p>
        </div>
        <div className="flex-1">
          <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Received by</span>
          <p className="text-[10px] font-bold text-black">{doc.counterparties.party2}</p>
        </div>
      </div>

      {fin && (
        <div className="border-2 border-[#0000ff]/15 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#0000ff]/40">Receipt details</span>
            {fin.receiptId && (
              <span className="text-[8px] font-mono text-black/30">{fin.receiptId}</span>
            )}
          </div>
          <div className="flex gap-6 mb-3">
            <div>
              <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Issue date</span>
              <p className="text-[10px] text-black/70 mt-0.5">{fin.issueDate ?? 'Pending'}</p>
            </div>
            <div>
              <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Payment date</span>
              <p className="text-[10px] text-black/70 mt-0.5">{fin.paymentDate ?? 'Pending'}</p>
            </div>
            <div>
              <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block">Currency</span>
              <p className="text-[10px] text-black/70 mt-0.5">{fin.currency}</p>
            </div>
          </div>
          {/* Line items */}
          <div className="border-t border-black/10 pt-2">
            {fin.lineItems.map((li, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-[9px] text-black/50">{li.description}</span>
                <span className="text-[9px] font-mono text-black/60">{centsToEur(li.amountCents)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-black/10">
              <span className="text-[9px] font-bold text-black">Total paid</span>
              <span className="text-[10px] font-bold font-mono text-black">{centsToEur(fin.amountCents)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#0000ff]/[0.02] border border-[#0000ff]/10 px-4 py-2">
        <p className="text-[8px] text-[#0000ff]/40">
          This receipt is sourced from the payment processor and issued in the name of the creator via Frontfiles. It is not a Frontfiles-authored legal document.
        </p>
      </div>
    </div>
  )
}
