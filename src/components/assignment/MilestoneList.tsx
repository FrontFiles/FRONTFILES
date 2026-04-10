'use client'

import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import {
  MILESTONE_STATE_LABELS,
  REVIEW_DETERMINATION_LABELS,
} from '@/lib/types'
import type { Milestone, FulfilmentSubmission, EvidenceItem } from '@/lib/types'
import { centsToEur, getMilestoneFinancialSummary } from '@/lib/assignment/selectors'
import { ChevronDown, ChevronRight, FileText, Clock, MapPin, User, Upload } from 'lucide-react'

export function MilestoneList() {
  const { state, dispatch } = useAssignment()
  const a = state.assignment
  if (!a) return null

  return (
    <div className="flex flex-col gap-0">
      {a.milestones.map((milestone) => {
        const isExpanded = state.ui.expandedMilestoneIds.has(milestone.id)
        const financial = getMilestoneFinancialSummary(milestone)

        return (
          <div key={milestone.id} className="border-2 border-black -mt-[2px] first:mt-0">
            {/* Milestone header — always visible */}
            <button
              onClick={() => dispatch({ type: 'TOGGLE_MILESTONE_EXPANDED', milestoneId: milestone.id })}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-black/[0.02] transition-colors"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[9px] font-mono text-black/25 w-4">{milestone.ordinal}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-black">{milestone.title}</span>
                  <span className={cn(
                    'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border shrink-0',
                    milestone.milestoneType === 'service' ? 'border-[#0000ff] text-[#0000ff]' : 'border-black/20 text-black/40'
                  )}>
                    {milestone.milestoneType}
                  </span>
                </div>
                <span className="text-[9px] text-black/30 mt-0.5 block">
                  Due {new Date(milestone.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <span className="text-xs font-mono text-black/50 shrink-0">{centsToEur(milestone.releasableAmountCents)}</span>
              <MilestoneStatePill state={milestone.state} />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t-2 border-black px-4 py-4">
                {/* Scope and criteria */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <FieldLabel label="Scope" />
                    <p className="text-[10px] text-black leading-relaxed">{milestone.scopeSummary}</p>
                  </div>
                  <div>
                    <FieldLabel label="Acceptance criteria" />
                    <p className="text-[10px] text-black leading-relaxed">{milestone.acceptanceCriteria}</p>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-black/10">
                  <MetaChip label="Review window" value={`${milestone.reviewWindowDays} days`} />
                  <MetaChip label="Partial acceptance" value={milestone.partialAcceptancePermitted ? 'Permitted' : 'Not permitted'} />
                  <MetaChip label="Evidence types" value={milestone.requiredEvidenceTypes.map(t => t.replace(/_/g, ' ')).join(', ')} />
                  <div className="flex-1" />
                  <div className="text-right">
                    <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Releasable</span>
                    <span className="text-sm font-mono font-bold text-black">{centsToEur(milestone.releasableAmountCents)}</span>
                  </div>
                </div>

                {/* Fulfilment submissions */}
                {milestone.fulfilmentSubmissions.length > 0 ? (
                  <div className="mb-4">
                    <FieldLabel label={`Fulfilment submissions (${milestone.fulfilmentSubmissions.length})`} />
                    <div className="flex flex-col gap-3">
                      {milestone.fulfilmentSubmissions.map(sub => (
                        <SubmissionCard key={sub.id} submission={sub} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-black/15 py-6 text-center mb-4">
                    <p className="text-[10px] text-black/25 uppercase tracking-widest">No fulfilment submitted yet</p>
                  </div>
                )}

                {/* Review determination */}
                {milestone.reviewDetermination && (
                  <div>
                    <FieldLabel label="Review determination" />
                    <div className="border-2 border-black p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
                          milestone.reviewDetermination.determination === 'accepted' ? 'bg-black text-white border-black' :
                          milestone.reviewDetermination.determination === 'rejected' ? 'border-black text-black' :
                          'border-black/30 text-black/60'
                        )}>
                          {REVIEW_DETERMINATION_LABELS[milestone.reviewDetermination.determination]}
                        </span>
                        <span className="text-[8px] text-black/30">
                          by {milestone.reviewDetermination.reviewerRole} · {new Date(milestone.reviewDetermination.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <p className="text-[10px] text-black leading-relaxed">{milestone.reviewDetermination.notes}</p>
                      <p className="text-[8px] text-black/25 mt-2">{milestone.reviewDetermination.evidenceBasis}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SubmissionCard({ submission }: { submission: FulfilmentSubmission }) {
  return (
    <div className="border border-black/15 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Upload size={10} className="text-black/30" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-black/40">{submission.fulfilmentType} fulfilment</span>
        </div>
        <span className="text-[8px] font-mono text-black/25">
          {new Date(submission.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Evidence items */}
      <div className="flex flex-col gap-1">
        {submission.evidenceItems.map(item => (
          <EvidenceItemRow key={item.id} item={item} />
        ))}
      </div>

      {submission.creatorNotes && (
        <p className="text-[9px] text-black/40 mt-2 pt-2 border-t border-black/5 italic">
          {submission.creatorNotes}
        </p>
      )}
    </div>
  )
}

function EvidenceItemRow({ item }: { item: EvidenceItem }) {
  const icons: Record<string, typeof FileText> = {
    vault_asset: Upload,
    service_log: Clock,
    support_document: FileText,
    handoff_note: FileText,
    attendance_confirmation: User,
    time_location_record: MapPin,
  }
  const Icon = icons[item.kind] ?? FileText

  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={10} className="text-black/20 shrink-0" />
      <span className={cn(
        'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border shrink-0',
        item.kind === 'vault_asset' ? 'border-black/20 text-black/40' : 'border-[#0000ff]/30 text-[#0000ff]/60'
      )}>
        {item.kind.replace(/_/g, ' ')}
      </span>
      <span className="text-[9px] text-black truncate">{item.label}</span>
      {item.fileName && (
        <span className="text-[8px] font-mono text-black/20 shrink-0">{item.fileName}</span>
      )}
      {item.serviceLog && (
        <span className="text-[8px] font-mono text-black/20 shrink-0">{item.serviceLog.location ?? item.serviceLog.date}</span>
      )}
    </div>
  )
}

function MilestoneStatePill({ state }: { state: string }) {
  const label = MILESTONE_STATE_LABELS[state as keyof typeof MILESTONE_STATE_LABELS] ?? state
  const isComplete = state === 'accepted' || state === 'accepted_partial'
  return (
    <span className={cn(
      'text-[8px] font-bold uppercase tracking-wider px-2 py-1 border shrink-0',
      isComplete ? 'bg-black text-white border-black' :
      state === 'disputed' ? 'border-black text-black' :
      state === 'active' || state === 'fulfilment_submitted' ? 'border-[#0000ff] text-[#0000ff]' :
      'border-black/15 text-black/30'
    )}>
      {label}
    </span>
  )
}

function FieldLabel({ label }: { label: string }) {
  return <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1.5">{label}</span>
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">{label}</span>
      <span className="text-[9px] text-black/50">{value}</span>
    </div>
  )
}
