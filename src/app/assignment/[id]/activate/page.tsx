'use client'

import { use } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getAssignment, getClosingResult } from '@/lib/assignment/store'
import { centsToEur, getTotalBudgetCents, isAssignmentOperational } from '@/lib/assignment/selectors'
import {
  ASSIGNMENT_CLASS_LABELS,
  ASSIGNMENT_STATE_LABELS,
  ASSIGNMENT_SUB_STATE_LABELS,
} from '@/lib/types'
import {
  ASSIGNMENT_DOCUMENT_REGISTRY,
} from '@/lib/assignment/closing-types'

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════

export default function AssignmentActivatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const assignment = getAssignment(id)

  if (!assignment) {
    return (
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="border-2 border-dashed border-black/15 py-12 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/25">Assignment not found</p>
            <p className="text-[9px] text-black/30 mt-1">No assignment with ID {id}</p>
          </div>
        </div>
      </div>
    )
  }

  const isOperational = isAssignmentOperational(assignment)
  const closingResult = getClosingResult(id)
  const firstMilestone = assignment.milestones.find(m => m.state === 'active')
  const budget = getTotalBudgetCents(assignment)
  const escrowCaptured = assignment.escrow.totalCapturedCents

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">
          <Link href={`/assignment/${id}`} className="hover:text-black transition-colors">Assignment</Link>
          <span>/</span>
          <span className="text-black">Activation</span>
        </div>

        {/* Status header */}
        {isOperational ? (
          <div className="border-2 border-black">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-black rounded-full" />
                <h1 className="text-lg font-bold text-black tracking-tight">Assignment Operational</h1>
              </div>
              <p className="text-sm text-black/50 leading-relaxed">
                Escrow captured, canonical documents generated and signed, work authorization issued. This assignment is now active.
              </p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-black/30">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-black/20 rounded-full" />
                <h1 className="text-lg font-bold text-black/50 tracking-tight">Assignment Not Yet Operational</h1>
              </div>
              <p className="text-sm text-black/30">
                Current state: {ASSIGNMENT_STATE_LABELS[assignment.state]} / {ASSIGNMENT_SUB_STATE_LABELS[assignment.subState]}
              </p>
            </div>
          </div>
        )}

        {/* ═══ ASSIGNMENT RECORD ═══ */}
        <div className="border-2 border-black">
          <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
            Assignment record
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <FieldItem label="Assignment ID" value={assignment.id} mono />
            <FieldItem label="Class" value={ASSIGNMENT_CLASS_LABELS[assignment.assignmentClass]} />
            <FieldItem label="State" value={ASSIGNMENT_STATE_LABELS[assignment.state]} />
            <FieldItem label="Sub-state" value={ASSIGNMENT_SUB_STATE_LABELS[assignment.subState]} />
            <FieldItem label="Milestones" value={`${assignment.milestones.length} total`} />
            <FieldItem label="Deadline" value={new Date(assignment.plan.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
          </div>
        </div>

        {/* ═══ ESCROW STATUS ═══ */}
        <div className="border-2 border-black">
          <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
            Escrow
          </div>
          <div className="p-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-black/50">Captured</span>
              <span className="font-bold font-mono text-black">{centsToEur(escrowCaptured)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-black/50">Milestone budget</span>
              <span className="font-mono text-black/60">{centsToEur(budget)}</span>
            </div>
            {assignment.escrow.stripePaymentIntentId && (
              <div className="border-t border-black/10 pt-2 mt-1">
                <span className="text-[8px] font-mono text-black/20">{assignment.escrow.stripePaymentIntentId}</span>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CONTRACT DOCUMENTS ═══ */}
        <div className="border-2 border-black">
          <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
            Contract documents
          </div>
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
                    <div className="text-sm text-black">{doc.label}</div>
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

        {/* ═══ WORK AUTHORIZATION ═══ */}
        <div className="border-2 border-black">
          <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
            Work authorization
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-black/50">Status</span>
              <span className={cn(
                'text-[8px] font-bold uppercase tracking-wider border px-1.5 py-0.5',
                (closingResult?.workAuthorization.status === 'authorized' || isOperational)
                  ? 'border-black text-black' : 'border-black/15 text-black/20',
              )}>
                {closingResult?.workAuthorization.status === 'authorized' ? 'Authorized' :
                 closingResult?.workAuthorization.status ? closingResult.workAuthorization.status :
                 isOperational ? 'Authorized' : 'Pending'}
              </span>
            </div>
            {firstMilestone && (
              <div className="border-t border-black/10 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">Active milestone</span>
                  <div className="flex-1 border-b border-black/5" />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[9px] font-mono text-black/25">{firstMilestone.ordinal}</span>
                  <span className="text-sm font-bold text-black">{firstMilestone.title}</span>
                  <span className="text-sm font-mono font-bold text-black ml-auto">
                    {centsToEur(firstMilestone.releasableAmountCents)}
                  </span>
                </div>
                <p className="text-[9px] text-black/40 mt-1 ml-7">{firstMilestone.scopeSummary}</p>
                <div className="text-[8px] text-black/30 mt-1 ml-7">
                  Due: {new Date(firstMilestone.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ ACTIONS ═══ */}
        <div className="flex gap-3">
          <Link
            href={`/assignment/${id}`}
            className="h-10 px-5 bg-black text-white text-[9px] font-bold uppercase tracking-wide hover:bg-black/90 transition-colors flex items-center flex-1 justify-center"
          >
            View assignment
          </Link>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════

function FieldItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">{label}</span>
      <span className={cn('text-sm text-black', mono ? 'font-mono' : '')}>{value}</span>
    </div>
  )
}
