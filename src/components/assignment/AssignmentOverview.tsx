'use client'

import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import {
  ASSIGNMENT_CLASS_LABELS,
  MILESTONE_STATE_LABELS,
} from '@/lib/types'
import {
  getAssignmentProgress,
  getWaitingParty,
  centsToEur,
  getAssignmentClassDescription,
  getActiveMilestones,
  getDueMilestones,
  getMilestonesAwaitingReview,
  getNextActions,
} from '@/lib/assignment/selectors'

export function AssignmentOverview() {
  const { state } = useAssignment()
  const a = state.assignment
  if (!a) return null

  const progress = getAssignmentProgress(a)
  const dueMilestones = getDueMilestones(a)
  const awaitingReview = getMilestonesAwaitingReview(a)
  const creatorActions = getNextActions(a, 'creator')
  const buyerActions = getNextActions(a, 'buyer')

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main content */}
      <div className="col-span-8">
        {/* Assignment plan */}
        <section className="mb-8">
          <SectionLabel label="Assignment plan" />
          <div className="border-2 border-black p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={cn(
                'text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 border',
                a.assignmentClass === 'service' ? 'border-[#0000ff] text-[#0000ff]' : 'border-black text-black'
              )}>
                {ASSIGNMENT_CLASS_LABELS[a.assignmentClass]}
              </span>
              <span className="text-[8px] text-black/30">{getAssignmentClassDescription(a.assignmentClass)}</span>
            </div>
            <p className="text-xs text-black leading-relaxed">{a.plan.scope}</p>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-black/10">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-black/25 block">Deadline</span>
                <span className="text-xs font-mono text-black">{new Date(a.plan.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-black/25 block">Review window</span>
                <span className="text-xs font-mono text-black">{a.plan.reviewWindowDays} days</span>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-black/25 block">Required evidence</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {a.plan.requiredEvidenceTypes.map(t => (
                    <span key={t} className="text-[7px] font-bold uppercase tracking-wider text-black/40 border border-black/10 px-1 py-0.5">{t.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>
            </div>
            {a.plan.notes && (
              <p className="text-[10px] text-black/40 mt-3 pt-3 border-t border-black/10">{a.plan.notes}</p>
            )}
          </div>
        </section>

        {/* Acceptance criteria */}
        <section className="mb-8">
          <SectionLabel label="Acceptance criteria" />
          <div className="border-2 border-black/15 p-4">
            <p className="text-xs text-black leading-relaxed">{a.plan.acceptanceCriteria}</p>
          </div>
        </section>

        {/* Milestone summary */}
        <section className="mb-8">
          <SectionLabel label="Milestone summary" />
          <div className="border-2 border-black">
            {a.milestones.map((m, i) => (
              <div
                key={m.id}
                className={cn(
                  'px-4 py-3 flex items-center gap-4',
                  i > 0 && 'border-t border-black/10'
                )}
              >
                <span className="text-[9px] font-mono text-black/25 w-5 shrink-0">{m.ordinal}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-black">{m.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] uppercase tracking-wider text-black/30">{m.milestoneType}</span>
                    <span className="text-[8px] text-black/15">·</span>
                    <span className="text-[8px] font-mono text-black/30">Due {new Date(m.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-black/50 shrink-0">{centsToEur(m.releasableAmountCents)}</span>
                <MilestoneStateBadge state={m.state} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right rail */}
      <div className="col-span-4">
        {/* Alerts */}
        {(dueMilestones.length > 0 || awaitingReview.length > 0) && (
          <section className="mb-6">
            <SectionLabel label="Attention" />
            <div className="flex flex-col gap-2">
              {dueMilestones.map(m => (
                <div key={m.id} className="border-2 border-black p-3">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-black block">Milestone due</span>
                  <p className="text-[10px] text-black mt-1">{m.title}</p>
                  <p className="text-[8px] font-mono text-black/40 mt-0.5">Due {new Date(m.dueDate).toLocaleDateString('en-GB')}</p>
                </div>
              ))}
              {awaitingReview.map(m => (
                <div key={m.id} className="border-2 border-[#0000ff] p-3">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#0000ff] block">Awaiting review</span>
                  <p className="text-[10px] text-black mt-1">{m.title}</p>
                  <p className="text-[8px] font-mono text-black/40 mt-0.5">{m.fulfilmentSubmissions.length} submission(s)</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Financial summary */}
        <section className="mb-6">
          <SectionLabel label="Financial" />
          <div className="border-2 border-black p-3">
            <div className="flex flex-col gap-2">
              {a.milestones.map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <span className="text-[9px] text-black/50 truncate max-w-[140px]">{m.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-black">{centsToEur(m.releasableAmountCents)}</span>
                    {(m.state === 'accepted' || m.state === 'accepted_partial') && (
                      <span className="w-1.5 h-1.5 bg-black" />
                    )}
                    {m.state === 'disputed' && (
                      <span className="w-1.5 h-1.5 border border-black" />
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t border-black/10 pt-2 mt-1 flex items-center justify-between">
                <span className="text-[9px] font-bold text-black">Total</span>
                <span className="text-[9px] font-bold font-mono text-black">{centsToEur(a.escrow.totalCapturedCents)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Next actions */}
        <section className="mb-6">
          <SectionLabel label="Next actions" />
          <div className="flex flex-col gap-1.5">
            {creatorActions.length > 0 && (
              <div>
                <span className="text-[7px] font-bold uppercase tracking-widest text-black/25 block mb-1">Creator</span>
                {creatorActions.map(a => (
                  <span key={a} className="block text-[9px] text-black/50 py-0.5">{a.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
            {buyerActions.length > 0 && (
              <div>
                <span className="text-[7px] font-bold uppercase tracking-widest text-black/25 block mb-1">Buyer</span>
                {buyerActions.map(a => (
                  <span key={a} className="block text-[9px] text-black/50 py-0.5">{a.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Escrow */}
        <section className="mb-6">
          <SectionLabel label="Escrow" />
          <div className="border border-black/10 p-3 text-[9px] font-mono text-black/40 flex flex-col gap-1">
            <div className="flex justify-between"><span>Captured</span><span>{centsToEur(a.escrow.totalCapturedCents)}</span></div>
            <div className="flex justify-between"><span>Released</span><span>{centsToEur(a.escrow.totalReleasedCents)}</span></div>
            <div className="flex justify-between"><span>Refunded</span><span>{centsToEur(a.escrow.totalRefundedCents)}</span></div>
            <div className="flex justify-between"><span>Frozen</span><span>{centsToEur(a.escrow.totalFrozenCents)}</span></div>
            {a.escrow.stripePaymentIntentId && (
              <div className="border-t border-black/5 pt-1 mt-1">
                <span className="text-[7px] text-black/20">Stripe PI: {a.escrow.stripePaymentIntentId}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">{label}</span>
      <div className="flex-1 border-b border-black/5" />
    </div>
  )
}

function MilestoneStateBadge({ state }: { state: string }) {
  const label = MILESTONE_STATE_LABELS[state as keyof typeof MILESTONE_STATE_LABELS] ?? state
  const isComplete = state === 'accepted' || state === 'accepted_partial'
  const isDisputed = state === 'disputed'
  return (
    <span className={cn(
      'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border shrink-0',
      isComplete ? 'border-black bg-black text-white' :
      isDisputed ? 'border-black text-black' :
      'border-black/15 text-black/40'
    )}>
      {label}
    </span>
  )
}
