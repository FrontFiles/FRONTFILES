'use client'

/**
 * Staff Dispute Console — Detail view and resolution controls for a single disputed assignment.
 *
 * Layout: 8-col main + 4-col right rail (mirrors AssignmentOverview grid).
 * Design canon: black + #0000ff + white. No radius. Hard borders. Dense typography.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type {
  Assignment,
  Milestone,
  CertificationEvent,
  CertificationEventType,
} from '@/lib/types'
import { centsToEur } from '@/lib/assignment/selectors'
import { getAssignmentEvents } from '@/lib/assignment/events'
import {
  SectionLabel,
  FieldLabel,
  ClassBadge,
  MilestoneStateBadge,
  MilestoneTypeBadge,
  EscrowPanel,
  EvidenceGrouped,
  ReviewBadge,
  CCRStateBadge,
  ShortDate,
  RelativeDeadline,
} from './shared'

// ══════════════════════════════════════════════
// RESOLUTION TYPES
// ══════════════════════════════════════════════

type ResolutionDetermination =
  | 'resolve_full_buyer'
  | 'resolve_full_creator'
  | 'resolve_split'
  | 'escalate_external'

const RESOLUTION_LABELS: Record<ResolutionDetermination, string> = {
  resolve_full_buyer: 'Full refund to buyer',
  resolve_full_creator: 'Full release to creator',
  resolve_split: 'Split resolution',
  escalate_external: 'Escalate to external adjudication',
}

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════

export function StaffDisputeConsole({ assignment }: { assignment: Assignment }) {
  const a = assignment
  const disputedMilestones = a.milestones.filter(m => m.state === 'disputed')
  const events = getAssignmentEvents(a.id)

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ═══ MAIN COLUMN (8-col) ═══ */}
      <div className="col-span-8">
        {/* Section 1: Assignment Plan */}
        <AssignmentPlanSection assignment={a} />

        {/* Section 2: Milestone Map */}
        <MilestoneMapSection assignment={a} disputedMilestones={disputedMilestones} />

        {/* Section 3: Fulfilment History */}
        <FulfilmentHistorySection assignment={a} disputedMilestones={disputedMilestones} />

        {/* Section 4: CCR History */}
        <CCRHistorySection assignment={a} />

        {/* Section 5: Timeline / Event Log */}
        <EventLogSection assignmentId={a.id} events={events} />
      </div>

      {/* ═══ RIGHT RAIL (4-col) ═══ */}
      <div className="col-span-4">
        {/* Section 1: Dispute Summary */}
        <DisputeSummarySection assignment={a} disputedMilestones={disputedMilestones} />

        {/* Section 2: Escrow Map */}
        <EscrowMapSection assignment={a} />

        {/* Section 3: Resolution Controls */}
        <ResolutionControlsSection assignment={a} disputedMilestones={disputedMilestones} />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// SECTION 1 — ASSIGNMENT PLAN
// ══════════════════════════════════════════════

function AssignmentPlanSection({ assignment }: { assignment: Assignment }) {
  const a = assignment
  return (
    <section className="mb-8">
      <SectionLabel label="Assignment plan" />
      <div className="border-2 border-black p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClassBadge cls={a.assignmentClass} size="md" />
        </div>
        <p className="text-xs text-black leading-relaxed">{a.plan.scope}</p>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-black/10">
          <div>
            <FieldLabel label="Deadline" />
            <span className="text-xs font-mono text-black">
              {new Date(a.plan.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div>
            <FieldLabel label="Review window" />
            <span className="text-xs font-mono text-black">{a.plan.reviewWindowDays} days</span>
          </div>
          <div>
            <FieldLabel label="Required evidence" />
            <div className="flex flex-wrap gap-1 mt-0.5">
              {a.plan.requiredEvidenceTypes.map(t => (
                <span key={t} className="text-[7px] font-bold uppercase tracking-wider text-black/40 border border-black/10 px-1 py-0.5">
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Acceptance criteria inline */}
        <div className="mt-4 pt-4 border-t border-black/10">
          <FieldLabel label="Acceptance criteria" />
          <p className="text-[10px] text-black/60 leading-relaxed">{a.plan.acceptanceCriteria}</p>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════
// SECTION 2 — MILESTONE MAP
// ══════════════════════════════════════════════

function MilestoneMapSection({
  assignment,
  disputedMilestones,
}: {
  assignment: Assignment
  disputedMilestones: Milestone[]
}) {
  const disputedIds = new Set(disputedMilestones.map(m => m.id))

  return (
    <section className="mb-8">
      <SectionLabel label="Milestone map" />
      <div className="border-2 border-black">
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_70px_90px_90px] gap-3 px-4 py-2 bg-black text-white">
          <span className="text-[8px] font-bold uppercase tracking-[0.12em]">#</span>
          <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Title</span>
          <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Type</span>
          <span className="text-[8px] font-bold uppercase tracking-[0.12em]">State</span>
          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-right">Releasable</span>
        </div>

        {assignment.milestones.map((m, i) => {
          const isDisputed = disputedIds.has(m.id)
          return (
            <div
              key={m.id}
              className={cn(
                'grid grid-cols-[40px_1fr_70px_90px_90px] gap-3 px-4 py-3 items-center',
                i > 0 && 'border-t border-black/10',
                isDisputed && 'border-l-[3px] border-l-black',
              )}
            >
              <span className="text-[9px] font-mono text-black/25">{m.ordinal}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-black truncate">{m.title}</p>
                <p className="text-[8px] text-black/30 truncate">{m.scopeSummary}</p>
              </div>
              <MilestoneTypeBadge type={m.milestoneType} />
              <MilestoneStateBadge state={m.state} />
              <span className="text-[9px] font-mono text-black text-right">{centsToEur(m.releasableAmountCents)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════
// SECTION 3 — FULFILMENT HISTORY
// ══════════════════════════════════════════════

function FulfilmentHistorySection({
  assignment,
  disputedMilestones,
}: {
  assignment: Assignment
  disputedMilestones: Milestone[]
}) {
  const disputedIds = new Set(disputedMilestones.map(m => m.id))

  return (
    <section className="mb-8">
      <SectionLabel label="Fulfilment history" />
      <div className="flex flex-col gap-4">
        {assignment.milestones.map(m => {
          const isDisputed = disputedIds.has(m.id)
          if (m.fulfilmentSubmissions.length === 0 && !isDisputed) return null

          return (
            <div
              key={m.id}
              className={cn(
                'border-2 p-4',
                isDisputed ? 'border-black' : 'border-black/15',
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] font-mono text-black/25">#{m.ordinal}</span>
                <span className="text-xs font-bold text-black">{m.title}</span>
                <MilestoneStateBadge state={m.state} />
                {isDisputed && (
                  <span className="text-[7px] font-bold uppercase tracking-wider text-black border-2 border-black px-1 py-0.5 ml-auto">
                    Disputed
                  </span>
                )}
              </div>

              {/* Acceptance criteria for disputed milestones */}
              {isDisputed && (
                <div className="mb-3 p-2 border border-black/10">
                  <FieldLabel label="Acceptance criteria" />
                  <p className="text-[9px] text-black/50 leading-relaxed">{m.acceptanceCriteria}</p>
                </div>
              )}

              {/* Fulfilment submissions */}
              {m.fulfilmentSubmissions.map((sub, si) => (
                <div key={sub.id} className={cn(si > 0 && 'mt-3 pt-3 border-t border-black/10')}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-black/25">
                      Submission {si + 1}
                    </span>
                    <ShortDate iso={sub.submittedAt} />
                    <span className="text-[7px] font-bold uppercase tracking-wider text-black/20 border border-black/10 px-1 py-0.5">
                      {sub.fulfilmentType}
                    </span>
                  </div>
                  {sub.creatorNotes && (
                    <p className="text-[9px] text-black/40 mb-2 italic">{sub.creatorNotes}</p>
                  )}
                  <EvidenceGrouped items={sub.evidenceItems} />
                </div>
              ))}

              {m.fulfilmentSubmissions.length === 0 && (
                <p className="text-[9px] text-black/20 uppercase tracking-wider">No submissions</p>
              )}

              {/* Review determination if present */}
              {m.reviewDetermination && (
                <div className="mt-3 pt-3 border-t border-black/10">
                  <div className="flex items-center gap-2 mb-1">
                    <FieldLabel label="Review determination" />
                    <ReviewBadge determination={m.reviewDetermination.determination} />
                  </div>
                  <p className="text-[9px] text-black/50">{m.reviewDetermination.notes}</p>
                  <p className="text-[8px] text-black/25 mt-1">
                    Evidence basis: {m.reviewDetermination.evidenceBasis}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════
// SECTION 4 — CCR HISTORY
// ══════════════════════════════════════════════

function CCRHistorySection({ assignment }: { assignment: Assignment }) {
  if (assignment.ccrHistory.length === 0) {
    return (
      <section className="mb-8">
        <SectionLabel label="CCR history" />
        <p className="text-[9px] text-black/20 uppercase tracking-wider">No commission change requests</p>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <SectionLabel label="CCR history" />
      <div className="flex flex-col gap-3">
        {assignment.ccrHistory.map(ccr => (
          <div key={ccr.id} className="border-2 border-black/15 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CCRStateBadge state={ccr.state} />
              <span className="text-[8px] font-mono text-black/25">{ccr.id}</span>
              <ShortDate iso={ccr.createdAt} />
            </div>

            {/* Amended fields */}
            <div className="flex flex-col gap-1.5 mb-3">
              {ccr.amendedFields.map((field, fi) => (
                <div key={fi} className="flex items-start gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-black/30 shrink-0 w-20">
                    {field.field}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] text-black/30 line-through block truncate">{field.currentValue}</span>
                    <span className="text-[9px] text-black block truncate">{field.proposedValue}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Rationale */}
            <FieldLabel label="Rationale" />
            <p className="text-[9px] text-black/50 leading-relaxed">{ccr.rationale}</p>

            {/* Response */}
            {ccr.respondedAt && ccr.responseNote && (
              <div className="mt-2 pt-2 border-t border-black/10">
                <FieldLabel label="Response" />
                <p className="text-[9px] text-black/50">{ccr.responseNote}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════
// SECTION 5 — TIMELINE / EVENT LOG
// ══════════════════════════════════════════════

function EventTypeBadge({ type }: { type: CertificationEventType }) {
  const isDispute = type === 'dispute_filed' || type === 'dispute_determination' || type === 'assignment_disputed'
  const isEscrow = type === 'escrow_captured' || type === 'escrow_released' || type === 'provisional_release'
  return (
    <span className={cn(
      'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border shrink-0',
      isDispute ? 'border-black text-black' :
      isEscrow ? 'border-[#0000ff] text-[#0000ff]' :
      'border-black/15 text-black/30',
    )}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

function EventLogSection({
  assignmentId,
  events,
}: {
  assignmentId: string
  events: CertificationEvent[]
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  return (
    <section className="mb-8">
      <SectionLabel label="Timeline / Event log" />
      {sorted.length === 0 ? (
        <p className="text-[9px] text-black/20 uppercase tracking-wider">No events recorded</p>
      ) : (
        <div className="border-2 border-black/15">
          {sorted.map((event, i) => {
            const meta = event.metadata as Record<string, unknown> | null
            const actor = meta?.actorId as string | undefined
            return (
              <div
                key={event.id}
                className={cn(
                  'px-4 py-2.5 flex items-start gap-3',
                  i > 0 && 'border-t border-black/10',
                )}
              >
                <EventTypeBadge type={event.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-black leading-relaxed">{event.description}</p>
                  {actor && (
                    <span className="text-[8px] font-mono text-black/20">{actor}</span>
                  )}
                </div>
                <ShortDate iso={event.timestamp} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ══════════════════════════════════════════════
// RIGHT RAIL — DISPUTE SUMMARY
// ══════════════════════════════════════════════

function DisputeSummarySection({
  assignment,
  disputedMilestones,
}: {
  assignment: Assignment
  disputedMilestones: Milestone[]
}) {
  const scope = disputedMilestones.length > 0 ? 'Milestone-level' : 'Assignment-level'
  const contestedTotal = disputedMilestones.reduce((sum, m) => sum + m.releasableAmountCents, 0)

  return (
    <section className="mb-6">
      <SectionLabel label="Dispute summary" />
      <div className="border-2 border-black p-3">
        <div className="flex flex-col gap-2">
          <div>
            <FieldLabel label="Scope" />
            <span className="text-[9px] text-black">{scope}</span>
            {disputedMilestones.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-1">
                {disputedMilestones.map(m => (
                  <span key={m.id} className="text-[8px] font-mono text-black/40">
                    #{m.ordinal} {m.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <FieldLabel label="Trigger" />
            <span className="text-[9px] text-black/50">
              Derived from review determination
            </span>
          </div>

          <div>
            <FieldLabel label="Filer" />
            <span className="text-[9px] text-black">Buyer</span>
            <span className="text-[8px] font-mono text-black/25 ml-2">{assignment.buyerId}</span>
          </div>

          <div>
            <FieldLabel label="Filer role" />
            <span className={cn(
              'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
              'border-black text-black',
            )}>
              Buyer
            </span>
          </div>

          <div>
            <FieldLabel label="Contested amount" />
            <span className="text-sm font-bold font-mono text-black">{centsToEur(contestedTotal)}</span>
          </div>

          <div>
            <FieldLabel label="Counter-evidence deadline" />
            <span className="text-[9px] text-black/50">Not set</span>
          </div>

          <div>
            <FieldLabel label="Current state" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-black border-2 border-black px-1.5 py-0.5">
              Disputed
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════
// RIGHT RAIL — ESCROW MAP
// ══════════════════════════════════════════════

function EscrowMapSection({ assignment }: { assignment: Assignment }) {
  return (
    <section className="mb-6">
      <SectionLabel label="Escrow" />
      <EscrowPanel escrow={assignment.escrow} />

      {/* Per-milestone breakdown */}
      <div className="mt-3 border border-black/10 p-3">
        <FieldLabel label="Per-milestone breakdown" />
        <div className="flex flex-col gap-1.5 mt-1">
          {assignment.milestones.map(m => {
            const isReleased = m.state === 'accepted' || m.state === 'accepted_partial'
            const isFrozen = m.state === 'disputed'
            return (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-[8px] text-black/40 truncate max-w-[120px]">
                  #{m.ordinal} {m.title}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-black">{centsToEur(m.releasableAmountCents)}</span>
                  {isReleased && (
                    <span className="text-[7px] font-bold uppercase tracking-wider text-black/30">Released</span>
                  )}
                  {isFrozen && (
                    <span className="text-[7px] font-bold uppercase tracking-wider text-black">Frozen</span>
                  )}
                  {!isReleased && !isFrozen && m.state !== 'cancelled' && (
                    <span className="text-[7px] font-bold uppercase tracking-wider text-black/20">Pending</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════
// RIGHT RAIL — RESOLUTION CONTROLS
// ══════════════════════════════════════════════

function ResolutionControlsSection({
  assignment,
  disputedMilestones,
}: {
  assignment: Assignment
  disputedMilestones: Milestone[]
}) {
  const contestedTotal = disputedMilestones.reduce((sum, m) => sum + m.releasableAmountCents, 0)

  const [determination, setDetermination] = useState<ResolutionDetermination | ''>('')
  const [splitBuyerCents, setSplitBuyerCents] = useState<number>(0)
  const [staffNotes, setStaffNotes] = useState('')
  const [escalationDeadline, setEscalationDeadline] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const splitCreatorCents = contestedTotal - splitBuyerCents

  function handleSubmit() {
    // Mock endpoint — in production this would POST to /api/assignment/[id]/dispute/resolve
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="mb-6">
        <SectionLabel label="Resolution controls" />
        <div className="border-2 border-black p-4">
          <span className="text-[9px] font-bold uppercase tracking-wider text-black block mb-1">
            Resolution recorded
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-black/30">
            {determination ? RESOLUTION_LABELS[determination as ResolutionDetermination] : 'Unknown'}
          </span>
          {determination === 'resolve_split' && (
            <div className="mt-2 text-[9px] font-mono text-black/50">
              Buyer: {centsToEur(splitBuyerCents)} / Creator: {centsToEur(splitCreatorCents)}
            </div>
          )}
          {staffNotes && (
            <p className="text-[9px] text-black/40 mt-2">{staffNotes}</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="mb-6">
      <SectionLabel label="Resolution controls" />
      <div className="border-2 border-black p-4">
        {/* Determination dropdown */}
        <div className="mb-4">
          <FieldLabel label="Resolution determination" />
          <select
            value={determination}
            onChange={e => setDetermination(e.target.value as ResolutionDetermination | '')}
            className="w-full border-2 border-black px-2 py-1.5 text-[10px] font-bold text-black bg-white appearance-none cursor-pointer"
          >
            <option value="">Select determination...</option>
            <option value="resolve_full_buyer">Full refund to buyer</option>
            <option value="resolve_full_creator">Full release to creator</option>
            <option value="resolve_split">Split resolution</option>
            <option value="escalate_external">Escalate to external adjudication</option>
          </select>
        </div>

        {/* Split amounts — shown only for resolve_split */}
        {determination === 'resolve_split' && (
          <div className="mb-4 p-3 border border-black/10">
            <FieldLabel label="Split allocation" />
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-black/50">Contested total</span>
                <span className="text-[9px] font-mono font-bold text-black">{centsToEur(contestedTotal)}</span>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase tracking-wider text-black/30 block mb-1">Buyer receives</span>
                <input
                  type="number"
                  min={0}
                  max={contestedTotal}
                  step={100}
                  value={splitBuyerCents}
                  onChange={e => setSplitBuyerCents(Math.min(contestedTotal, Math.max(0, Number(e.target.value))))}
                  className="w-full border-2 border-black px-2 py-1 text-[10px] font-mono text-black bg-white"
                />
                <span className="text-[8px] font-mono text-black/25 mt-0.5 block">
                  {centsToEur(splitBuyerCents)}
                </span>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase tracking-wider text-black/30 block mb-1">Creator receives</span>
                <span className="text-[10px] font-mono font-bold text-black">{centsToEur(splitCreatorCents)}</span>
              </div>
            </div>
          </div>
        )}

        {/* External escalation deadline — shown only for escalate_external */}
        {determination === 'escalate_external' && (
          <div className="mb-4">
            <FieldLabel label="External escalation deadline" />
            <input
              type="date"
              value={escalationDeadline}
              onChange={e => setEscalationDeadline(e.target.value)}
              className="w-full border-2 border-black px-2 py-1 text-[10px] font-mono text-black bg-white"
            />
          </div>
        )}

        {/* Staff notes */}
        <div className="mb-4">
          <FieldLabel label="Staff notes" />
          <textarea
            value={staffNotes}
            onChange={e => setStaffNotes(e.target.value)}
            rows={4}
            placeholder="Internal notes on this resolution..."
            className="w-full border-2 border-black px-2 py-1.5 text-[10px] text-black bg-white resize-none placeholder:text-black/20"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!determination}
          className={cn(
            'w-full text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 border-2 transition-colors',
            determination
              ? 'bg-black text-white border-black hover:bg-black/90'
              : 'bg-black/10 text-black/30 border-black/15 cursor-not-allowed',
          )}
        >
          Record resolution
        </button>

        {/* Warning notice */}
        <div className="mt-3 p-2 border border-black/10">
          <p className="text-[8px] text-black/30 leading-relaxed">
            This resolution is binding. External escalation opens a 30-day window.
          </p>
        </div>
      </div>
    </section>
  )
}
