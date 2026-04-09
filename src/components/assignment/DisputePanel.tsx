'use client'

/**
 * Dispute Panel — Shared dispute interface for buyer, creator, and staff
 *
 * Two modes:
 * 1. Filing form (no active dispute): create a new dispute case
 * 2. Active dispute display (assignment.state === 'disputed'): show details, timeline, resolution controls
 */

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import { centsToEur, getTotalFrozenCents } from '@/lib/assignment/selectors'
import type {
  AssignmentDisputeTrigger,
  AssignmentDisputeScope,
  AssignmentDisputeCase,
  AssignmentDisputeResolution,
} from '@/lib/types'
import {
  SectionLabel,
  FieldLabel,
  MilestoneStateBadge,
  EscrowPanel,
  ActionBar,
  EmptyState,
  PermissionNotice,
  MetaChip,
  ShortDate,
  RelativeDeadline,
} from './shared'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Shield, Clock, Scale, FileText } from 'lucide-react'

// ══════════════════════════════════════════════
// DISPUTE TRIGGER OPTIONS
// ══════════════════════════════════════════════

interface TriggerOption {
  value: AssignmentDisputeTrigger
  label: string
}

const DISPUTE_TRIGGERS: TriggerOption[] = [
  { value: 'creator_non_performance', label: 'Non-performance' },
  { value: 'deadline_miss', label: 'Deadline breach' },
  { value: 'asset_failure_against_brief', label: 'Asset failure against brief' },
  { value: 'buyer_refusal_without_grounds', label: 'Buyer refusal without grounds' },
  { value: 'service_non_compliance', label: 'Service non-compliance' },
  { value: 'hybrid_partial_compliance', label: 'Hybrid partial compliance' },
  { value: 'rights_scope_disagreement', label: 'Rights / scope disagreement' },
  { value: 'non_response_after_fulfilment', label: 'Non-response after fulfilment' },
]

// Simplified trigger labels for the filing form dropdown
const FILING_TRIGGERS: { value: string; label: string }[] = [
  { value: 'fulfilment_quality', label: 'Fulfilment quality' },
  { value: 'scope_disagreement', label: 'Scope disagreement' },
  { value: 'deadline_breach', label: 'Deadline breach' },
  { value: 'non_delivery', label: 'Non-delivery' },
  { value: 'rights_violation', label: 'Rights violation' },
  { value: 'payment_dispute', label: 'Payment dispute' },
]

// Map filing triggers to canonical dispute triggers
const FILING_TO_CANONICAL: Record<string, AssignmentDisputeTrigger> = {
  fulfilment_quality: 'asset_failure_against_brief',
  scope_disagreement: 'rights_scope_disagreement',
  deadline_breach: 'deadline_miss',
  non_delivery: 'creator_non_performance',
  rights_violation: 'rights_scope_disagreement',
  payment_dispute: 'buyer_refusal_without_grounds',
}

type DisputeResolutionType =
  | 'resolve_full_buyer'
  | 'resolve_full_creator'
  | 'resolve_split'
  | 'resolve_external'

const RESOLUTION_OPTIONS: { value: DisputeResolutionType; label: string; description: string }[] = [
  { value: 'resolve_full_buyer', label: 'Full refund to buyer', description: 'Entire contested amount returned to buyer' },
  { value: 'resolve_full_creator', label: 'Full release to creator', description: 'Entire contested amount released to creator' },
  { value: 'resolve_split', label: 'Split resolution', description: 'Divide contested amount between parties' },
  { value: 'resolve_external', label: 'Escalate externally', description: 'Refer to external adjudication' },
]

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════

export function DisputePanel() {
  const { state } = useAssignment()
  const a = state.assignment

  if (!a) {
    return (
      <div className="border-2 border-black p-4">
        <EmptyState message="No assignment loaded" />
      </div>
    )
  }

  // Check if assignment is in disputed state (may also have a dispute case on milestones)
  const isDisputed = a.state === 'disputed'

  return (
    <div className="border-2 border-black">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-black flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={12} className="text-black/40" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">
            {isDisputed ? 'Active Dispute' : 'File Dispute'}
          </span>
        </div>
        {isDisputed && (
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border-2 border-black text-black">
            Disputed
          </span>
        )}
      </div>

      {isDisputed ? (
        <ActiveDisputeDisplay />
      ) : (
        <DisputeFilingForm />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// FILING FORM
// ══════════════════════════════════════════════

function DisputeFilingForm() {
  const { state } = useAssignment()
  const a = state.assignment!

  const [filingTrigger, setFilingTrigger] = useState('')
  const [scope, setScope] = useState<AssignmentDisputeScope>('assignment')
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Contested amount calculation
  const contestedAmountCents = useMemo(() => {
    if (scope === 'assignment') {
      return a.milestones.reduce((sum, m) => {
        if (m.state !== 'accepted' && m.state !== 'cancelled') {
          return sum + m.releasableAmountCents
        }
        return sum
      }, 0)
    }
    if (selectedMilestoneId) {
      const m = a.milestones.find(ms => ms.id === selectedMilestoneId)
      return m?.releasableAmountCents ?? 0
    }
    return 0
  }, [a, scope, selectedMilestoneId])

  // Escrow freeze implications
  const frozenCents = getTotalFrozenCents(a)
  const additionalFreeze = contestedAmountCents

  const canSubmit = useMemo(() => {
    if (!filingTrigger) return false
    if (reason.trim().length === 0) return false
    if (scope === 'milestone' && !selectedMilestoneId) return false
    return true
  }, [filingTrigger, reason, scope, selectedMilestoneId])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)

    const canonicalTrigger = FILING_TO_CANONICAL[filingTrigger] ?? 'rights_scope_disagreement'

    try {
      const res = await fetch(`/api/assignment/${a.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: canonicalTrigger,
          scope,
          milestoneId: scope === 'milestone' ? selectedMilestoneId : null,
          reason: reason.trim(),
          contestedAmountCents,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server returned ${res.status}`)
      }

      // Success — the server response will update assignment state via reload
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to file dispute')
    } finally {
      setSubmitting(false)
    }
  }, [a.id, canSubmit, filingTrigger, scope, selectedMilestoneId, reason, contestedAmountCents])

  return (
    <div className="p-4 flex flex-col gap-5">
      {/* ── Trigger ── */}
      <div>
        <SectionLabel label="Dispute trigger" />
        <select
          value={filingTrigger}
          onChange={e => setFilingTrigger(e.target.value)}
          className="w-full h-8 border-2 border-black/15 bg-white text-[10px] px-2 outline-none focus:border-black"
        >
          <option value="">Select trigger...</option>
          {FILING_TRIGGERS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* ── Scope ── */}
      <div>
        <SectionLabel label="Dispute scope" />
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => { setScope('assignment'); setSelectedMilestoneId(null) }}
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 border-2 transition-colors',
              scope === 'assignment'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black/40 border-black/15 hover:border-black/40',
            )}
          >
            Assignment-level
          </button>
          <button
            onClick={() => setScope('milestone')}
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 border-2 transition-colors',
              scope === 'milestone'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black/40 border-black/15 hover:border-black/40',
            )}
          >
            Milestone-level
          </button>
        </div>

        {scope === 'milestone' && (
          <div>
            <FieldLabel label="Select milestone" />
            <select
              value={selectedMilestoneId ?? ''}
              onChange={e => setSelectedMilestoneId(e.target.value || null)}
              className="w-full h-8 border-2 border-black/15 bg-white text-[10px] px-2 outline-none focus:border-black"
            >
              <option value="">Choose milestone...</option>
              {a.milestones
                .filter(m => m.state !== 'cancelled' && m.state !== 'accepted')
                .map(m => (
                  <option key={m.id} value={m.id}>
                    #{m.ordinal} — {m.title} ({centsToEur(m.releasableAmountCents)})
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Reason ── */}
      <div>
        <SectionLabel label="Reason" />
        <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe the grounds for this dispute..."
          className="!min-h-[72px] !text-[10px] !border-2 !border-black/15 focus:!border-black"
        />
      </div>

      {/* ── Contested amount ── */}
      <div>
        <SectionLabel label="Financial impact" />
        <div className="border border-black/15 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-bold uppercase tracking-wider text-black/25">Contested amount</span>
            <span className="text-sm font-mono font-bold text-black">{centsToEur(contestedAmountCents)}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-bold uppercase tracking-wider text-black/25">Currently frozen</span>
            <span className="text-[10px] font-mono text-black/40">{centsToEur(frozenCents)}</span>
          </div>
          <div className="border-t border-black/10 pt-2 mt-2">
            <span className="text-[8px] font-bold uppercase tracking-wider text-black/25">Escrow freeze implications</span>
            <p className="text-[9px] text-black/40 mt-1 leading-relaxed">
              Filing this dispute will freeze {centsToEur(additionalFreeze)} in escrow.
              No releases or refunds can occur on the contested scope until the dispute is resolved.
              {scope === 'assignment'
                ? ' All non-completed milestones will be affected.'
                : selectedMilestoneId
                  ? ` Milestone #${a.milestones.find(m => m.id === selectedMilestoneId)?.ordinal ?? '?'} will be frozen.`
                  : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Submit error ── */}
      {submitError && (
        <div className="border-2 border-black p-3">
          <p className="text-[9px] text-black font-bold">{submitError}</p>
        </div>
      )}

      {/* ── Actions ── */}
      <ActionBar
        actions={[
          {
            label: 'File dispute',
            variant: 'danger',
            onClick: handleSubmit,
            disabled: !canSubmit || submitting,
            disabledReason: !filingTrigger
              ? 'Select a trigger'
              : reason.trim().length === 0
                ? 'Reason is required'
                : scope === 'milestone' && !selectedMilestoneId
                  ? 'Select a milestone'
                  : undefined,
          },
        ]}
      />
    </div>
  )
}

// ══════════════════════════════════════════════
// ACTIVE DISPUTE DISPLAY
// ══════════════════════════════════════════════

function ActiveDisputeDisplay() {
  const { state } = useAssignment()
  const a = state.assignment!

  // Mock dispute case for display (derived from assignment state)
  // In production, this would come from the assignment object or a separate fetch
  const mockDispute: AssignmentDisputeCase = useMemo(() => ({
    id: `dispute-${a.id}`,
    assignmentId: a.id,
    milestoneId: null,
    scope: 'assignment' as AssignmentDisputeScope,
    trigger: 'rights_scope_disagreement' as AssignmentDisputeTrigger,
    state: 'under_review',
    filerId: a.buyerId,
    filerRole: 'buyer',
    contestedAmountCents: a.escrow.totalFrozenCents || a.milestones.reduce((s, m) => s + m.releasableAmountCents, 0),
    reason: 'Dispute details would be loaded from server.',
    counterEvidence: null,
    resolution: null,
    resolvedAmountCents: null,
    staffReviewerId: null,
    staffNotes: null,
    filedAt: new Date().toISOString(),
    counterEvidenceDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: null,
    externalEscalationDeadline: null,
  }), [a])

  const dispute = mockDispute

  // Demo: staff controls toggle
  const [isStaff, setIsStaff] = useState(false)

  return (
    <div className="p-4 flex flex-col gap-5">
      {/* ── Dispute details ── */}
      <div>
        <SectionLabel label="Dispute details" />
        <div className="border border-black/15 p-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <MetaChip
                label="Scope"
                value={dispute.scope === 'assignment' ? 'Assignment-level' : `Milestone #${a.milestones.find(m => m.id === dispute.milestoneId)?.ordinal ?? '?'}`}
              />
              <MetaChip
                label="Trigger"
                value={DISPUTE_TRIGGERS.find(t => t.value === dispute.trigger)?.label ?? dispute.trigger.replace(/_/g, ' ')}
              />
              <MetaChip label="Filed by" value={dispute.filerRole} />
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Contested amount</span>
                <span className="text-sm font-mono font-bold text-black">{centsToEur(dispute.contestedAmountCents)}</span>
              </div>
              <div>
                <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">State</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border-2 border-black text-black inline-block">
                  {dispute.state.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Filed</span>
                <ShortDate iso={dispute.filedAt} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Counter-evidence deadline ── */}
      {dispute.counterEvidenceDeadline && !dispute.resolvedAt && (
        <div>
          <SectionLabel label="Counter-evidence deadline" />
          <div className="border border-black/15 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={10} className="text-black/25" />
              <ShortDate iso={dispute.counterEvidenceDeadline} />
            </div>
            <RelativeDeadline iso={dispute.counterEvidenceDeadline} />
          </div>
        </div>
      )}

      {/* ── Reason ── */}
      <div>
        <SectionLabel label="Dispute reason" />
        <div className="border border-black/15 p-3">
          <p className="text-[10px] text-black leading-relaxed">{dispute.reason}</p>
        </div>
      </div>

      {/* ── Counter-evidence (placeholder) ── */}
      <div>
        <SectionLabel label="Counter-evidence" />
        {dispute.counterEvidence ? (
          <div className="border border-black/15 p-3">
            <p className="text-[10px] text-black leading-relaxed">{dispute.counterEvidence}</p>
          </div>
        ) : (
          <EmptyState
            message="No counter-evidence submitted"
            detail={dispute.counterEvidenceDeadline ? 'Opposing party may submit counter-evidence before the deadline' : undefined}
          />
        )}
      </div>

      {/* ── Escrow state ── */}
      <div>
        <SectionLabel label="Escrow state" />
        <EscrowPanel escrow={a.escrow} />
      </div>

      {/* ── Staff resolution controls ── */}
      <div>
        <div className="border border-dashed border-black/15 p-3 mb-3">
          <FieldLabel label="Demo: staff view" />
          <button
            onClick={() => setIsStaff(!isStaff)}
            className={cn(
              'text-[8px] font-bold uppercase tracking-wider px-2 py-1 border-2 transition-colors',
              isStaff
                ? 'bg-black text-white border-black'
                : 'bg-white text-black/30 border-black/10 hover:border-black/30',
            )}
          >
            {isStaff ? 'Staff view on' : 'Staff view off'}
          </button>
        </div>

        {isStaff && (
          <div>
            <SectionLabel label="Resolution controls (Staff)" />
            <PermissionNotice>
              Resolution controls are reserved for platform staff. Determinations are final and trigger escrow movements.
            </PermissionNotice>
            <div className="flex flex-col gap-1.5 mt-3">
              {RESOLUTION_OPTIONS.map(opt => (
                <div
                  key={opt.value}
                  className="border border-black/15 p-3 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <Shield size={10} className="text-black/20" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-black/40">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[8px] text-black/20 mt-0.5">{opt.description}</p>
                </div>
              ))}
              <p className="text-[8px] text-black/15 mt-1 italic">
                Resolution actions will be enabled in a future release.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Dispute timeline ── */}
      <div>
        <SectionLabel label="Dispute timeline" />
        <div className="border-l-2 border-black/15 pl-4 flex flex-col gap-3">
          <TimelineEntry
            icon={<AlertTriangle size={10} />}
            label="Dispute filed"
            detail={`${dispute.filerRole} filed ${dispute.trigger.replace(/_/g, ' ')} dispute`}
            iso={dispute.filedAt}
          />
          {dispute.counterEvidenceDeadline && (
            <TimelineEntry
              icon={<Clock size={10} />}
              label="Counter-evidence deadline"
              detail="Opposing party deadline for counter-evidence submission"
              iso={dispute.counterEvidenceDeadline}
              isFuture
            />
          )}
          {dispute.state === 'under_review' && (
            <TimelineEntry
              icon={<Scale size={10} />}
              label="Under platform review"
              detail="Dispute is being reviewed by platform staff"
              iso={new Date().toISOString()}
              isActive
            />
          )}
          {dispute.resolvedAt && (
            <TimelineEntry
              icon={<FileText size={10} />}
              label="Dispute resolved"
              detail={`Resolution: ${dispute.resolution?.replace(/_/g, ' ') ?? 'pending'}`}
              iso={dispute.resolvedAt}
            />
          )}
          {dispute.externalEscalationDeadline && (
            <TimelineEntry
              icon={<Shield size={10} />}
              label="External escalation deadline"
              detail="Deadline for external adjudication referral"
              iso={dispute.externalEscalationDeadline}
              isFuture
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// TIMELINE ENTRY
// ══════════════════════════════════════════════

function TimelineEntry({
  icon,
  label,
  detail,
  iso,
  isFuture,
  isActive,
}: {
  icon: React.ReactNode
  label: string
  detail: string
  iso: string
  isFuture?: boolean
  isActive?: boolean
}) {
  return (
    <div className="flex items-start gap-2 relative">
      <div
        className={cn(
          'shrink-0 mt-0.5',
          isActive ? 'text-blue-600' : isFuture ? 'text-black/15' : 'text-black/30',
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <span
          className={cn(
            'text-[9px] font-bold uppercase tracking-wider block',
            isActive ? 'text-blue-600' : isFuture ? 'text-black/20' : 'text-black/50',
          )}
        >
          {label}
        </span>
        <p
          className={cn(
            'text-[8px] leading-relaxed',
            isFuture ? 'text-black/10' : 'text-black/25',
          )}
        >
          {detail}
        </p>
        <ShortDate iso={iso} />
      </div>
    </div>
  )
}
