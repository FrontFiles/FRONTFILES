'use client'

/**
 * Review Console — Buyer's review determination panel
 *
 * Buyer-side review of a milestone's fulfilment submissions.
 * Supports accepted, accepted_partial, changes_requested, rejected, and dispute.
 * Role-restricted: Editor cannot authorise final spend release.
 */

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import { centsToEur, canAuthoriseRelease } from '@/lib/assignment/selectors'
import type {
  ReviewDetermination,
  BuyerCompanyRole,
} from '@/lib/types'
import {
  SectionLabel,
  FieldLabel,
  MilestoneStateBadge,
  MilestoneTypeBadge,
  EvidenceGrouped,
  MetaChip,
  ActionBar,
  EmptyState,
  PermissionNotice,
  ReviewBadge,
  ShortDate,
  RelativeDeadline,
} from './shared'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Scale, Shield, AlertTriangle } from 'lucide-react'

// ══════════════════════════════════════════════
// DETERMINATION OPTIONS
// ══════════════════════════════════════════════

interface DeterminationOption {
  value: ReviewDetermination
  label: string
  description: string
  requiresAmount: boolean
  requiresPartialPermission: boolean
  isRelease: boolean
}

const DETERMINATION_OPTIONS: DeterminationOption[] = [
  {
    value: 'accepted',
    label: 'Accepted',
    description: 'Full release of milestone escrow to creator',
    requiresAmount: false,
    requiresPartialPermission: false,
    isRelease: true,
  },
  {
    value: 'accepted_partial',
    label: 'Accepted Partial',
    description: 'Partial release — specify accepted amount',
    requiresAmount: true,
    requiresPartialPermission: true,
    isRelease: true,
  },
  {
    value: 'changes_requested',
    label: 'Changes Requested',
    description: 'Returns milestone to creator for revision',
    requiresAmount: false,
    requiresPartialPermission: false,
    isRelease: false,
  },
  {
    value: 'rejected',
    label: 'Rejected',
    description: 'Fulfilment does not meet acceptance criteria',
    requiresAmount: false,
    requiresPartialPermission: false,
    isRelease: false,
  },
  {
    value: 'dispute_opened',
    label: 'Dispute',
    description: 'Escalate to dispute resolution process',
    requiresAmount: false,
    requiresPartialPermission: false,
    isRelease: false,
  },
]

type DemoRole = 'content_commit_holder' | 'editor' | 'admin' | 'individual'

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════

export function ReviewConsole() {
  const { state, dispatch } = useAssignment()
  const a = state.assignment
  const milestoneId = state.ui.reviewingMilestoneId

  // Form state
  const [determination, setDetermination] = useState<ReviewDetermination | null>(null)
  const [partialAmountEur, setPartialAmountEur] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Demo: viewer role toggle
  const [viewerRole, setViewerRole] = useState<DemoRole>('content_commit_holder')

  // Derive buyer company role
  const buyerCompanyRole: BuyerCompanyRole | null = useMemo(() => {
    if (viewerRole === 'individual') return null
    return viewerRole as BuyerCompanyRole
  }, [viewerRole])

  const canRelease = useMemo(() => canAuthoriseRelease(buyerCompanyRole), [buyerCompanyRole])

  // Resolve milestone
  const milestone = useMemo(
    () => a?.milestones.find(m => m.id === milestoneId) ?? null,
    [a, milestoneId],
  )

  // Latest fulfilment submission
  const latestSubmission = useMemo(
    () => milestone?.fulfilmentSubmissions[milestone.fulfilmentSubmissions.length - 1] ?? null,
    [milestone],
  )

  // All evidence from all submissions
  const allEvidence = useMemo(
    () => milestone?.fulfilmentSubmissions.flatMap(s => s.evidenceItems) ?? [],
    [milestone],
  )

  // Selected determination option
  const selectedOption = useMemo(
    () => DETERMINATION_OPTIONS.find(o => o.value === determination) ?? null,
    [determination],
  )

  // Validation
  const canSubmit = useMemo(() => {
    if (!determination) return false
    if (notes.trim().length === 0) return false
    if (selectedOption?.requiresAmount) {
      const eurVal = parseFloat(partialAmountEur)
      if (isNaN(eurVal) || eurVal <= 0) return false
    }
    if (selectedOption?.isRelease && !canRelease) return false
    return true
  }, [determination, notes, partialAmountEur, selectedOption, canRelease])

  // Cancel
  const handleCancel = useCallback(() => {
    dispatch({ type: 'SET_REVIEWING_MILESTONE', milestoneId: null })
  }, [dispatch])

  // Submit
  const handleSubmit = useCallback(() => {
    if (!milestone || !a || !determination || !canSubmit) return

    setSubmitting(true)

    const acceptedAmountCents = selectedOption?.requiresAmount
      ? Math.round(parseFloat(partialAmountEur) * 100)
      : undefined

    dispatch({
      type: 'RECORD_REVIEW',
      milestoneId: milestone.id,
      determination,
      reviewerId: 'current-user',
      reviewerRole: buyerCompanyRole ?? 'staff',
      notes: notes.trim(),
      acceptedAmountCents,
    })

    dispatch({ type: 'SET_REVIEWING_MILESTONE', milestoneId: null })
    setSubmitting(false)
  }, [a, milestone, determination, canSubmit, partialAmountEur, notes, buyerCompanyRole, selectedOption, dispatch])

  // ── Guard ──
  if (!a || !milestone) {
    return (
      <div className="border-2 border-black p-4">
        <EmptyState message="No milestone under review" detail="Select a milestone to begin review" />
      </div>
    )
  }

  return (
    <div className="border-2 border-black">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-black flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale size={12} className="text-black/40" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">
            Review Determination
          </span>
          <MilestoneTypeBadge type={milestone.milestoneType} />
          <MilestoneStateBadge state={milestone.state} />
        </div>
        <span className="text-xs font-mono text-black/40">
          {centsToEur(milestone.releasableAmountCents)}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-5">
        {/* ── Demo role switcher ── */}
        <div className="border border-dashed border-black/15 p-3">
          <FieldLabel label="Demo: viewer role" />
          <div className="flex items-center gap-2">
            {(['content_commit_holder', 'editor', 'admin', 'individual'] as DemoRole[]).map(role => (
              <button
                key={role}
                onClick={() => setViewerRole(role)}
                className={cn(
                  'text-[8px] font-bold uppercase tracking-wider px-2 py-1 border-2 transition-colors',
                  viewerRole === role
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black/30 border-black/10 hover:border-black/30',
                )}
              >
                {role === 'content_commit_holder' ? 'CCH' : role === 'editor' ? 'Editor' : role === 'admin' ? 'Admin' : 'Individual'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Role restriction notice ── */}
        {viewerRole === 'editor' && (
          <div className="flex items-start gap-2 border-2 border-black p-3">
            <Shield size={12} className="text-black/40 mt-0.5 shrink-0" />
            <p className="text-[9px] text-black leading-relaxed">
              Editor cannot authorize final spend release. Review will be recorded but Content Commit Holder must authorize release.
            </p>
          </div>
        )}

        {/* ── Milestone context ── */}
        <div>
          <SectionLabel label={`Milestone ${milestone.ordinal} — ${milestone.title}`} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Acceptance criteria" />
              <p className="text-[10px] text-black leading-relaxed">{milestone.acceptanceCriteria}</p>
            </div>
            <div>
              <FieldLabel label="Scope summary" />
              <p className="text-[10px] text-black leading-relaxed">{milestone.scopeSummary}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <MetaChip label="Review window" value={`${milestone.reviewWindowDays} days`} />
            <MetaChip label="Partial acceptance" value={milestone.partialAcceptancePermitted ? 'Permitted' : 'Not permitted'} />
            <MetaChip label="Due" value={new Date(milestone.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
          </div>
        </div>

        {/* ── Submitted evidence (acceptance criteria vs proof comparison) ── */}
        <div>
          <SectionLabel label="Acceptance criteria vs submitted proof" />
          <div className="grid grid-cols-2 gap-4">
            {/* Left: criteria */}
            <div className="border border-black/15 p-3">
              <FieldLabel label="Required evidence types" />
              <div className="flex flex-col gap-1">
                {milestone.requiredEvidenceTypes.map(t => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border border-blue-600/30 text-blue-600/60">
                      {t.replace(/_/g, ' ')}
                    </span>
                    {allEvidence.some(e => e.kind === t) ? (
                      <span className="text-[7px] font-bold uppercase tracking-wider text-black">Provided</span>
                    ) : (
                      <span className="text-[7px] font-bold uppercase tracking-wider text-black/20">Missing</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-black/5">
                <FieldLabel label="Acceptance criteria" />
                <p className="text-[9px] text-black/50 leading-relaxed">{milestone.acceptanceCriteria}</p>
              </div>
            </div>

            {/* Right: submitted evidence */}
            <div className="border border-black/15 p-3">
              <FieldLabel label={`Submitted evidence (${allEvidence.length} items)`} />
              {allEvidence.length > 0 ? (
                <EvidenceGrouped items={allEvidence} />
              ) : (
                <p className="text-[9px] text-black/25">No evidence submitted</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Service log details ── */}
        {allEvidence.some(e => e.serviceLog) && (
          <div>
            <SectionLabel label="Service log details" />
            <div className="flex flex-col gap-2">
              {allEvidence
                .filter(e => e.serviceLog)
                .map(e => (
                  <div key={e.id} className="border border-black/15 p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[9px] font-bold text-black">{e.label}</span>
                      <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border border-blue-600/30 text-blue-600/60">
                        Service log
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <MetaChip label="Date" value={e.serviceLog!.date} />
                      <MetaChip
                        label="Time"
                        value={
                          e.serviceLog!.startTime && e.serviceLog!.endTime
                            ? `${e.serviceLog!.startTime} — ${e.serviceLog!.endTime}`
                            : e.serviceLog!.startTime ?? 'Not recorded'
                        }
                      />
                      <MetaChip label="Location" value={e.serviceLog!.location ?? 'Not recorded'} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <MetaChip label="Role" value={e.serviceLog!.role} />
                      <MetaChip label="Completed duties" value={e.serviceLog!.completedDuties} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Fulfilment submissions timeline ── */}
        <div>
          <SectionLabel label={`Fulfilment submissions (${milestone.fulfilmentSubmissions.length})`} />
          {milestone.fulfilmentSubmissions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {milestone.fulfilmentSubmissions.map(sub => (
                <div key={sub.id} className="border border-black/15 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-black/40">
                      {sub.fulfilmentType} fulfilment
                    </span>
                    <ShortDate iso={sub.submittedAt} />
                  </div>
                  <p className="text-[9px] text-black/30">
                    {sub.evidenceItems.length} evidence item{sub.evidenceItems.length !== 1 ? 's' : ''}
                  </p>
                  {sub.creatorNotes && (
                    <p className="text-[9px] text-black/40 mt-1 italic">{sub.creatorNotes}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No submissions" />
          )}
        </div>

        {/* ── Determination controls ── */}
        <div>
          <SectionLabel label="Determination" />
          <div className="flex flex-col gap-1.5">
            {DETERMINATION_OPTIONS.map(opt => {
              const isDisabledByRole = opt.isRelease && !canRelease
              const isDisabledByPartial = opt.requiresPartialPermission && !milestone.partialAcceptancePermitted
              const isDisabled = isDisabledByRole || isDisabledByPartial
              const disabledReason = isDisabledByRole
                ? 'Editor cannot authorise release'
                : isDisabledByPartial
                  ? 'Partial acceptance not permitted for this milestone'
                  : undefined

              return (
                <div key={opt.value} className="relative group">
                  <button
                    onClick={() => !isDisabled && setDetermination(opt.value)}
                    disabled={isDisabled}
                    className={cn(
                      'w-full text-left px-3 py-2 border-2 transition-colors flex items-center gap-3',
                      determination === opt.value
                        ? 'border-black bg-black/[0.03]'
                        : isDisabled
                          ? 'border-black/5 bg-black/[0.01] cursor-not-allowed'
                          : 'border-black/15 hover:border-black/30',
                    )}
                  >
                    <div
                      className={cn(
                        'w-3 h-3 border-2 shrink-0 flex items-center justify-center',
                        determination === opt.value ? 'border-black bg-black' : 'border-black/20',
                      )}
                    >
                      {determination === opt.value && (
                        <div className="w-1.5 h-1.5 bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={cn(
                        'text-[9px] font-bold uppercase tracking-wider',
                        isDisabled ? 'text-black/20' : 'text-black',
                      )}>
                        {opt.label}
                      </span>
                      <p className={cn(
                        'text-[8px]',
                        isDisabled ? 'text-black/10' : 'text-black/30',
                      )}>
                        {opt.description}
                      </p>
                    </div>
                    {isDisabled && disabledReason && (
                      <span className="text-[7px] font-bold uppercase tracking-wider text-black/15 shrink-0">
                        {disabledReason}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Partial amount input */}
          {determination === 'accepted_partial' && (
            <div className="mt-3 border border-black/15 p-3">
              <FieldLabel label="Accepted amount (EUR)" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-black/30">EUR</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={partialAmountEur}
                  onChange={e => setPartialAmountEur(e.target.value)}
                  placeholder="0.00"
                  className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black font-mono !w-32"
                />
                <span className="text-[8px] text-black/20">
                  of {centsToEur(milestone.releasableAmountCents)} releasable
                </span>
              </div>
              {partialAmountEur && parseFloat(partialAmountEur) > 0 && (
                <p className="text-[8px] font-mono text-black/30 mt-1">
                  = {Math.round(parseFloat(partialAmountEur) * 100)} cents
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Notes ── */}
        <div>
          <SectionLabel label="Review notes (required)" />
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Explain your determination..."
            className="!min-h-[64px] !text-[10px] !border-2 !border-black/15 focus:!border-black"
          />
          {notes.trim().length === 0 && determination && (
            <p className="text-[8px] text-black/25 mt-1">Notes are required for all determinations.</p>
          )}
        </div>

        {/* ── Actions ── */}
        <ActionBar
          actions={[
            {
              label: determination
                ? `Record: ${DETERMINATION_OPTIONS.find(o => o.value === determination)?.label ?? determination}`
                : 'Select determination',
              variant: 'primary',
              onClick: handleSubmit,
              disabled: !canSubmit || submitting,
              disabledReason: !determination
                ? 'Select a determination'
                : notes.trim().length === 0
                  ? 'Notes are required'
                  : undefined,
            },
            {
              label: 'Cancel',
              variant: 'secondary',
              onClick: handleCancel,
              disabled: submitting,
            },
          ]}
        />
      </div>
    </div>
  )
}
