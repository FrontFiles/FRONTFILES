'use client'

import { use, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getAssignment } from '@/lib/assignment/store'
import { centsToEur } from '@/lib/assignment/selectors'
import { runAssignmentClosing } from '@/lib/assignment/closing'
import {
  closingReducer,
  createInitialClosingState,
  isClosingReviewComplete,
  computeEscrowAmountCents,
} from '@/lib/assignment/closing-reducer'
import {
  ASSIGNMENT_DOCUMENT_REGISTRY,
  type ClosingPipelineStatus,
} from '@/lib/assignment/closing-types'
import {
  ASSIGNMENT_CLASS_LABELS,
  ASSIGNMENT_STATE_LABELS,
} from '@/lib/types'

// ══════════════════════════════════════════════
// CLOSING PIPELINE LABELS
// ══════════════════════════════════════════════

const CLOSING_STATUS_LABELS: Record<ClosingPipelineStatus, string> = {
  not_started: 'Not started',
  closing: 'Initializing closing pipeline...',
  documents_generating: 'Generating canonical documents...',
  awaiting_signatures: 'Capturing counterparty signatures...',
  work_authorization_pending: 'Issuing work authorization...',
  activated: 'Assignment activated',
  closing_failed: 'Closing failed',
}

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════

export default function AssignmentFundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const assignment = getAssignment(id)
  const [state, dispatch] = useReducer(
    closingReducer,
    assignment!,
    createInitialClosingState,
  )

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

  if (assignment.subState !== 'accepted_pending_escrow') {
    return (
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="border-2 border-dashed border-black/15 py-12 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/25">
              Assignment not eligible for funding
            </p>
            <p className="text-[9px] text-black/30 mt-1">
              Current state: {ASSIGNMENT_STATE_LABELS[assignment.state]} — must be accepted and pending escrow.
            </p>
          </div>
          <Link href={`/assignment/${id}`} className="mt-4 inline-block text-[9px] font-bold uppercase tracking-widest text-black/40 hover:text-black">
            View assignment
          </Link>
        </div>
      </div>
    )
  }

  // If closing completed, redirect to activation page
  if (state.phase === 'activation') {
    router.push(`/assignment/${id}/activate`)
    return null
  }

  const a = state.assignment ?? assignment
  const escrowAmountCents = computeEscrowAmountCents(a)
  const milestoneTotalCents = a.milestones.reduce((sum, m) => sum + m.releasableAmountCents, 0)
  const markupCents = escrowAmountCents - milestoneTotalCents
  const allReviewed = isClosingReviewComplete(state)
  const isFundingPhase = state.phase === 'funding'
  const isClosingPhase = state.phase === 'closing'

  async function handleFundAssignment() {
    // Read the latest assignment from store at call time to avoid stale closure
    const currentAssignment = getAssignment(id) ?? a
    const fundingId = `fund-${Date.now()}`
    const stripePaymentIntentId = `pi_mock_${currentAssignment.id}_${Date.now()}`
    const capturedAt = new Date().toISOString()

    dispatch({ type: 'INITIATE_ESCROW', payload: { fundingId } })
    dispatch({ type: 'ESCROW_PROCESSING' })

    // Simulate escrow processing
    await new Promise(r => setTimeout(r, 800))

    dispatch({ type: 'ESCROW_CAPTURED', payload: { stripePaymentIntentId, capturedAt } })

    // Wait briefly then start closing pipeline
    await new Promise(r => setTimeout(r, 400))

    await runAssignmentClosing(currentAssignment, stripePaymentIntentId, capturedAt, dispatch)

    // Navigate to activation page
    router.push(`/assignment/${id}/activate`)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">
          <Link href={`/assignment/${id}`} className="hover:text-black transition-colors">Assignment</Link>
          <span>/</span>
          <span className="text-black">Fund</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-black tracking-tight">Fund Assignment</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] font-mono text-black/25">{a.id}</span>
              <span className={cn(
                'text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 border',
                a.assignmentClass === 'material' ? 'border-black text-black' :
                a.assignmentClass === 'service' ? 'border-[#0000ff] text-[#0000ff]' :
                'border-black text-black bg-black/5'
              )}>
                {ASSIGNMENT_CLASS_LABELS[a.assignmentClass]}
              </span>
            </div>
          </div>
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-0">
          {(['review', 'funding', 'closing', 'activation'] as const).map((phase, i) => {
            const labels = { review: 'Review', funding: 'Funding', closing: 'Closing', activation: 'Activation' }
            const phases = ['review', 'funding', 'closing', 'activation'] as const
            const currentIdx = phases.indexOf(state.phase)
            return (
              <div key={phase} className="flex items-center">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em]',
                  i === currentIdx ? 'bg-black text-white' :
                  i < currentIdx ? 'bg-black/80 text-white' :
                  'bg-black/5 text-black/25'
                )}>
                  <span>{i + 1}</span>
                  <span className="hidden sm:inline">{labels[phase]}</span>
                </div>
                {i < 3 && <div className={cn('w-4 h-px', i < currentIdx ? 'bg-black' : 'bg-black/10')} />}
              </div>
            )
          })}
        </div>

        {/* ═══ CLOSING IN PROGRESS ═══ */}
        {isClosingPhase && (
          <div className="border-2 border-black">
            <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
              Closing pipeline
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold text-black">
                  {CLOSING_STATUS_LABELS[state.closingStatus]}
                </span>
              </div>
              <div className="text-[9px] text-black/40">
                Escrow captured. Creating canonical assignment documents, capturing counterparty signatures, and issuing work authorization.
              </div>
              <div className="text-[8px] text-black/25 font-mono">
                Assignment: {a.id}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ASSIGNMENT SCOPE ═══ */}
        {!isClosingPhase && (
          <div className="border-2 border-black">
            <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
              Assignment scope
            </div>
            <div className="p-4 flex flex-col gap-3">
              <p className="text-sm text-black leading-relaxed">{a.plan.scope}</p>
              <div className="grid grid-cols-2 gap-3">
                <FieldItem label="Class" value={ASSIGNMENT_CLASS_LABELS[a.assignmentClass]} />
                <FieldItem label="Deadline" value={new Date(a.plan.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
                <FieldItem label="Review window" value={`${a.plan.reviewWindowDays} days`} />
                <FieldItem label="Evidence" value={a.plan.requiredEvidenceTypes.join(', ')} />
              </div>
              {a.plan.notes && (
                <p className="text-[9px] text-black/40 italic">{a.plan.notes}</p>
              )}
            </div>
          </div>
        )}

        {/* ═══ MILESTONES ═══ */}
        {!isClosingPhase && (
          <div className="border-2 border-black">
            <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
              Milestone schedule
            </div>
            <div className="divide-y divide-black/10">
              {a.milestones.map(m => (
                <div key={m.id} className="p-4 flex items-start gap-3">
                  <span className="text-[9px] font-mono text-black/25 w-4 pt-0.5">{m.ordinal}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-black">{m.title}</div>
                    <p className="text-[9px] text-black/40 mt-0.5">{m.scopeSummary}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={cn(
                        'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
                        m.milestoneType === 'service' ? 'border-[#0000ff] text-[#0000ff]' : 'border-black/20 text-black/40',
                      )}>
                        {m.milestoneType}
                      </span>
                      <span className="text-[8px] text-black/30">
                        Due: {new Date(m.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      {m.partialAcceptancePermitted && (
                        <span className="text-[7px] text-black/25 uppercase tracking-wider">Partial OK</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-black shrink-0">
                    {centsToEur(m.releasableAmountCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ RIGHTS & TERMS ═══ */}
        {!isClosingPhase && (
          <div className="border-2 border-black">
            <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
              Rights & terms
            </div>
            <div className="p-4 flex flex-col gap-2">
              {a.rightsRecord.assetRights && (
                <>
                  <SectionLabel>Asset rights</SectionLabel>
                  <FieldItem label="Usage" value={a.rightsRecord.assetRights.usageRights} />
                  <FieldItem label="Exclusivity" value={a.rightsRecord.assetRights.exclusivityTerms} />
                  <FieldItem label="Modifications" value={a.rightsRecord.assetRights.permittedModifications} />
                  <FieldItem label="Duration" value={a.rightsRecord.assetRights.duration} />
                  <FieldItem label="Territory" value={a.rightsRecord.assetRights.territory} />
                  <FieldItem label="Publication" value={a.rightsRecord.assetRights.publicationScope} />
                </>
              )}
              {a.rightsRecord.serviceTerms && (
                <>
                  <SectionLabel>Service terms</SectionLabel>
                  <FieldItem label="Scope" value={a.rightsRecord.serviceTerms.scopeOfWork} />
                  <FieldItem label="Confidentiality" value={a.rightsRecord.serviceTerms.confidentiality} />
                  <FieldItem label="Attendance" value={a.rightsRecord.serviceTerms.attendanceObligations} />
                  <FieldItem label="Restrictions" value={a.rightsRecord.serviceTerms.operationalRestrictions} />
                  <FieldItem label="Reimbursement" value={a.rightsRecord.serviceTerms.reimbursementTerms} />
                  <FieldItem label="Liability" value={a.rightsRecord.serviceTerms.liabilityFraming} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ REVIEW CONFIRMATIONS ═══ */}
        {!isFundingPhase && !isClosingPhase && (
          <div className="border-2 border-black">
            <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
              Confirm before funding
            </div>
            <div className="p-4 flex flex-col gap-3">
              <ConfirmCheckbox
                checked={state.review.scopeReviewed}
                onToggle={() => dispatch({ type: 'CONFIRM_SCOPE' })}
                label="I have reviewed the assignment scope, deliverables, and acceptance criteria"
              />
              <ConfirmCheckbox
                checked={state.review.milestonesReviewed}
                onToggle={() => dispatch({ type: 'CONFIRM_MILESTONES' })}
                label="I have reviewed the milestone schedule, amounts, and deadlines"
              />
              <ConfirmCheckbox
                checked={state.review.rightsReviewed}
                onToggle={() => dispatch({ type: 'CONFIRM_RIGHTS' })}
                label={`I have reviewed the ${a.rightsRecord.assetRights ? 'asset rights' : ''}${a.rightsRecord.assetRights && a.rightsRecord.serviceTerms ? ' and ' : ''}${a.rightsRecord.serviceTerms ? 'service terms' : ''} for this assignment`}
              />
              <ConfirmCheckbox
                checked={state.review.escrowAmountConfirmed}
                onToggle={() => dispatch({ type: 'CONFIRM_ESCROW_AMOUNT' })}
                label={`I confirm the escrow amount of ${centsToEur(escrowAmountCents)} (milestone total ${centsToEur(milestoneTotalCents)} + ${centsToEur(markupCents)} platform fee)`}
              />
              <ConfirmCheckbox
                checked={state.review.termsConfirmed}
                onToggle={() => dispatch({ type: 'CONFIRM_TERMS' })}
                label="I agree to the Frontfiles Assignment Agreement terms and escrow conditions"
              />
            </div>
          </div>
        )}

        {/* ═══ ESCROW SUMMARY ═══ */}
        {!isClosingPhase && (
          <div className="border-2 border-black">
            <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
              Escrow
            </div>
            <div className="p-4 flex flex-col gap-2">
              {a.milestones.map(m => (
                <div key={m.id} className="flex justify-between text-sm text-black/60">
                  <span className="truncate max-w-[300px]">{m.title}</span>
                  <span className="font-mono">{centsToEur(m.releasableAmountCents)}</span>
                </div>
              ))}
              <div className="border-t border-black/10 pt-2 flex justify-between text-sm text-black/60">
                <span>Platform fee (10%)</span>
                <span className="font-mono">{centsToEur(markupCents)}</span>
              </div>
              <div className="border-t border-black pt-2 flex justify-between text-sm font-bold text-black">
                <span>Total escrow</span>
                <span className="font-mono">{centsToEur(escrowAmountCents)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CONTRACT DOCUMENTS ═══ */}
        {!isClosingPhase && (
          <div className="border-2 border-black/20">
            <div className="px-4 py-2 border-b border-black/10 text-[9px] font-bold uppercase tracking-[0.12em] text-black/40">
              Documents to be generated
            </div>
            <div className="divide-y divide-black/5">
              {ASSIGNMENT_DOCUMENT_REGISTRY.map(doc => (
                <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-black">{doc.label}</div>
                    <div className="text-[8px] text-black/30 mt-0.5">
                      {doc.signable ? 'Signable' : 'Non-signable'}
                      {doc.inBuyerPack && doc.inCreatorPack ? ' · Buyer & Creator pack' :
                       doc.inBuyerPack ? ' · Buyer pack' : ''}
                    </div>
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-black/20 border border-black/10 px-1.5 py-0.5">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ACTIONS ═══ */}
        {!isFundingPhase && !isClosingPhase && (
          <div className="flex gap-3">
            <Link
              href={`/assignment/${id}`}
              className="h-10 px-5 border-2 border-black/15 text-black/30 text-[9px] font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors flex items-center"
            >
              Back
            </Link>
            <button
              disabled={!allReviewed}
              onClick={() => {
                dispatch({ type: 'READY_FOR_FUNDING' })
              }}
              className={cn(
                'h-10 px-5 text-[9px] font-bold uppercase tracking-wide transition-colors flex-1',
                allReviewed
                  ? 'bg-black text-white hover:bg-black/90'
                  : 'bg-black/5 text-black/20 cursor-not-allowed',
              )}
            >
              Proceed to funding
            </button>
          </div>
        )}

        {isFundingPhase && !isClosingPhase && (
          <div className="border-2 border-black">
            <div className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-[0.12em]">
              Escrow capture
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="border-2 border-black/10 px-4 py-6 text-center">
                <div className="text-2xl font-bold text-black font-mono mb-2">
                  {centsToEur(escrowAmountCents)}
                </div>
                <p className="text-[9px] text-black/30">Stripe escrow capture placeholder</p>
              </div>

              {state.funding && (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[8px] font-bold uppercase tracking-widest border px-2 py-0.5',
                    state.funding.status === 'escrow_captured' ? 'border-black text-black' :
                    state.funding.status === 'escrow_failed' ? 'border-red-600 text-red-600' :
                    state.funding.status === 'escrow_processing' ? 'border-black/40 text-black/40' :
                    'border-black/20 text-black/20'
                  )}>
                    {state.funding.status === 'awaiting_funding' ? 'Awaiting' :
                     state.funding.status === 'escrow_processing' ? 'Processing' :
                     state.funding.status === 'escrow_captured' ? 'Captured' :
                     'Failed'}
                  </span>
                  {state.funding.failureReason && (
                    <span className="text-[9px] text-red-600">{state.funding.failureReason}</span>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => dispatch({ type: 'LOAD_CLOSING_ASSIGNMENT', payload: { assignment } })}
                  className="h-9 px-4 border-2 border-black/15 text-black/30 text-[9px] font-bold uppercase tracking-wide hover:border-black hover:text-black transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleFundAssignment}
                  disabled={state.funding?.status === 'escrow_processing'}
                  className="h-9 px-4 bg-black text-white text-[9px] font-bold uppercase tracking-wide hover:bg-black/90 transition-colors flex-1"
                >
                  {state.funding?.status === 'escrow_processing' ? 'Processing...' : 'Capture escrow'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════

function FieldItem({ label, value }: { label: string; value: string | null }) {
  // Rights & terms fields are nullable in the canonical RightsRecord type:
  // a null value means "not specified for this assignment". Render an
  // em-dash placeholder so the row stays visually consistent.
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">{label}</span>
      <span className="text-[9px] text-black/60">{value ?? '—'}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-2 first:mt-0">
      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">{children}</span>
      <div className="flex-1 border-b border-black/5" />
    </div>
  )
}

function ConfirmCheckbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      disabled={checked}
      className="flex items-start gap-3 text-left group"
    >
      <div className={cn(
        'w-4 h-4 border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors',
        checked ? 'bg-black border-black' : 'border-black/20 group-hover:border-black',
      )}>
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white">
            <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className={cn('text-sm', checked ? 'text-black' : 'text-black/40')}>{label}</span>
    </button>
  )
}
