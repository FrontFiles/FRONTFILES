/**
 * Assignment Engine — Domain Services (Use Cases)
 *
 * Pure application logic. Each function:
 *  1. Validates preconditions via guards
 *  2. Computes the new state
 *  3. Emits CEL events
 *  4. Returns the mutated Assignment
 *
 * System boundaries:
 *  - Assignment Engine owns assignment state, milestones, CCR, review.
 *  - Vault owns asset records (referenced, not written).
 *  - FCS owns provenance state (read, not written).
 *  - Stripe Connect is authoritative for escrow (mirrored here).
 *
 * All amounts are EUR cents (integer). No floating point in money paths.
 */

import type {
  Assignment,
  AssignmentClass,
  AssignmentState,
  AssignmentSubState,
  AssignmentPlan,
  Milestone,
  MilestoneState,
  MilestoneType,
  FulfilmentSubmission,
  FulfilmentType,
  EvidenceItem,
  EvidenceItemKind,
  AssignmentRightsRecord,
  EscrowRecord,
  CommissionChangeRequest,
  CCRAmendedField,
  CCRState,
  ReviewRecord,
  ReviewDetermination,
  BuyerCompanyRole,
  AssignmentDisputeCase,
  AssignmentDisputeTrigger,
  DisputeState,
} from '@/lib/types'
import {
  assertValidSubState,
  assertAssignmentState,
  assertMilestoneState,
  assertIsAssignmentParty,
  assertIsBuyer,
  assertIsCreator,
  assertCanAuthoriseRelease,
  assertCanReview,
  assertFulfilmentNotEmpty,
  assertEvidenceMatchesMilestone,
  assertPartialAmountValid,
  assertNoPendingCCR,
  assertCCRAllowed,
  assertNoOpenDispute,
  assertNoDisputeFreeze,
} from './guards'
import { AssignmentError } from './errors'
import { emitAssignmentEvent } from './events'

// ══════════════════════════════════════════════
// ID GENERATION (mock — replace with DB-generated IDs)
// ══════════════════════════════════════════════

let seq = Date.now()
function id(prefix: string): string { return `${prefix}-${++seq}` }
function now(): string { return new Date().toISOString() }

/** Add N business days to a date (skips Sat/Sun). */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

// ══════════════════════════════════════════════
// 1. issueAssignmentBrief
// ══════════════════════════════════════════════

export interface IssueBriefInput {
  buyerId: string
  creatorId: string
  assignmentClass: AssignmentClass
  plan: AssignmentPlan
  rightsRecord: AssignmentRightsRecord
  milestones: Array<{
    title: string
    scopeSummary: string
    milestoneType: MilestoneType
    dueDate: string
    acceptanceCriteria: string
    requiredEvidenceTypes: EvidenceItemKind[]
    releasableAmountCents: number
    partialAcceptancePermitted: boolean
    reviewWindowDays: number
  }>
}

export function issueAssignmentBrief(input: IssueBriefInput): Assignment {
  const assignmentId = id('asgn')
  const milestones: Milestone[] = input.milestones.map((m, i) => ({
    id: id('ms'),
    assignmentId,
    ordinal: i + 1,
    title: m.title,
    scopeSummary: m.scopeSummary,
    milestoneType: m.milestoneType,
    state: 'pending',
    dueDate: m.dueDate,
    acceptanceCriteria: m.acceptanceCriteria,
    requiredEvidenceTypes: m.requiredEvidenceTypes,
    releasableAmountCents: m.releasableAmountCents,
    partialAcceptancePermitted: m.partialAcceptancePermitted,
    reviewWindowDays: m.reviewWindowDays,
    fulfilmentSubmissions: [],
    reviewDetermination: null,
    createdAt: now(),
    completedAt: null,
  }))

  const totalBudgetCents = milestones.reduce((s, m) => s + m.releasableAmountCents, 0)

  const assignment: Assignment = {
    id: assignmentId,
    buyerId: input.buyerId,
    creatorId: input.creatorId,
    assignmentClass: input.assignmentClass,
    state: 'brief_issued',
    subState: 'draft',
    plan: input.plan,
    milestones,
    rightsRecord: input.rightsRecord,
    escrow: {
      stripePaymentIntentId: null,
      totalCapturedCents: 0,
      totalReleasedCents: 0,
      totalRefundedCents: 0,
      totalFrozenCents: 0,
      capturedAt: null,
    },
    ccrHistory: [],
    createdAt: now(),
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
  }

  assertValidSubState(assignment.state, assignment.subState)

  emitAssignmentEvent('assignment_created', `Assignment brief issued for ${input.assignmentClass} work`, {
    assignmentId,
    actorId: input.buyerId,
    actorRole: 'buyer',
    metadata: { assignmentClass: input.assignmentClass, totalBudgetCents, milestoneCount: milestones.length },
  })

  return assignment
}

// ══════════════════════════════════════════════
// 2. acceptAssignment
// ══════════════════════════════════════════════

export function acceptAssignment(assignment: Assignment, creatorId: string): Assignment {
  assertIsCreator(assignment, creatorId)
  assertAssignmentState(assignment, ['brief_issued'], 'accept')

  if (assignment.subState !== 'draft' && assignment.subState !== 'clarification_open') {
    throw new AssignmentError('ASSIGNMENT_ALREADY_ACCEPTED', 'Assignment already accepted')
  }

  const updated = {
    ...assignment,
    state: 'brief_issued' as AssignmentState,
    subState: 'accepted_pending_escrow' as AssignmentSubState,
    acceptedAt: now(),
  }
  assertValidSubState(updated.state, updated.subState)

  emitAssignmentEvent('assignment_accepted', 'Creator accepted assignment brief', {
    assignmentId: assignment.id,
    actorId: creatorId,
    actorRole: 'creator',
  })

  return updated
}

// ══════════════════════════════════════════════
// 3. syncEscrowCaptureFromStripe
// Idempotent: if already captured, returns unchanged.
// ══════════════════════════════════════════════

export function syncEscrowCaptureFromStripe(
  assignment: Assignment,
  stripePaymentIntentId: string,
  capturedAmountCents: number,
  capturedAt: string,
): Assignment {
  if (assignment.escrow.stripePaymentIntentId === stripePaymentIntentId) {
    return assignment // idempotent
  }

  if (assignment.subState !== 'accepted_pending_escrow') {
    throw new AssignmentError('ESCROW_ALREADY_CAPTURED', 'Escrow already captured or assignment not in accepted state')
  }

  const updated: Assignment = {
    ...assignment,
    state: 'in_progress',
    subState: 'active',
    escrow: {
      stripePaymentIntentId,
      totalCapturedCents: capturedAmountCents,
      totalReleasedCents: 0,
      totalRefundedCents: 0,
      totalFrozenCents: 0,
      capturedAt,
    },
    milestones: assignment.milestones.map((m, i) =>
      i === 0 ? { ...m, state: 'active' as MilestoneState } : m,
    ),
  }
  assertValidSubState(updated.state, updated.subState)

  emitAssignmentEvent('escrow_captured', `Escrow captured: ${capturedAmountCents} cents via Stripe`, {
    assignmentId: assignment.id,
    actorId: 'stripe',
    actorRole: 'system',
    metadata: { stripePaymentIntentId, capturedAmountCents },
  }, `escrow-${stripePaymentIntentId}`) // idempotency key

  return updated
}

// ══════════════════════════════════════════════
// 4. activateAssignment (already active after escrow — this activates next milestone)
// ══════════════════════════════════════════════

export function activateNextMilestone(assignment: Assignment): Assignment {
  assertAssignmentState(assignment, ['in_progress'], 'activate_next_milestone')

  const nextPending = assignment.milestones.find(m => m.state === 'pending')
  if (!nextPending) return assignment

  const updated = {
    ...assignment,
    milestones: assignment.milestones.map(m =>
      m.id === nextPending.id ? { ...m, state: 'active' as MilestoneState } : m,
    ),
  }

  emitAssignmentEvent('milestone_activated', `Milestone '${nextPending.title}' activated`, {
    assignmentId: assignment.id,
    milestoneId: nextPending.id,
    actorId: 'system',
    actorRole: 'system',
  })

  return updated
}

// ══════════════════════════════════════════════
// 5. createAssignmentPlan (amend plan via CCR only after creation)
// ══════════════════════════════════════════════

export function createAssignmentPlan(assignment: Assignment, plan: AssignmentPlan): Assignment {
  assertAssignmentState(assignment, ['brief_issued'], 'create_plan')
  return { ...assignment, plan }
}

// ══════════════════════════════════════════════
// 6. addMilestone (only before escrow capture)
// ══════════════════════════════════════════════

export function addMilestone(
  assignment: Assignment,
  input: Omit<Milestone, 'id' | 'assignmentId' | 'ordinal' | 'fulfilmentSubmissions' | 'reviewDetermination' | 'createdAt' | 'completedAt' | 'state'>,
): Assignment {
  assertAssignmentState(assignment, ['brief_issued'], 'add_milestone')

  const milestone: Milestone = {
    ...input,
    id: id('ms'),
    assignmentId: assignment.id,
    ordinal: assignment.milestones.length + 1,
    state: 'pending',
    fulfilmentSubmissions: [],
    reviewDetermination: null,
    createdAt: now(),
    completedAt: null,
  }

  return {
    ...assignment,
    milestones: [...assignment.milestones, milestone],
  }
}

// ══════════════════════════════════════════════
// 7. amendMilestone (only via CCR after escrow — here: pre-escrow direct)
// ══════════════════════════════════════════════

export function amendMilestone(
  assignment: Assignment,
  milestoneId: string,
  changes: Partial<Pick<Milestone, 'title' | 'scopeSummary' | 'dueDate' | 'acceptanceCriteria' | 'releasableAmountCents' | 'partialAcceptancePermitted' | 'reviewWindowDays'>>,
): Assignment {
  assertAssignmentState(assignment, ['brief_issued'], 'amend_milestone')

  const milestone = assignment.milestones.find(m => m.id === milestoneId)
  if (!milestone) throw new AssignmentError('MILESTONE_NOT_FOUND', `Milestone ${milestoneId} not found`, 404)

  return {
    ...assignment,
    milestones: assignment.milestones.map(m =>
      m.id === milestoneId ? { ...m, ...changes } : m,
    ),
  }
}

// ══════════════════════════════════════════════
// 8. submitFulfilment
// ══════════════════════════════════════════════

export function submitFulfilment(
  assignment: Assignment,
  milestoneId: string,
  submission: FulfilmentSubmission,
  creatorId: string,
): Assignment {
  assertIsCreator(assignment, creatorId)
  assertAssignmentState(assignment, ['in_progress', 'delivered'], 'submit_fulfilment')

  const milestone = assignment.milestones.find(m => m.id === milestoneId)
  if (!milestone) throw new AssignmentError('MILESTONE_NOT_FOUND', `Milestone ${milestoneId} not found`, 404)

  assertMilestoneState(milestone, ['active', 'changes_requested'], 'submit_fulfilment')
  assertFulfilmentNotEmpty(submission)

  const submittedKinds = submission.evidenceItems.map(e => e.kind)
  assertEvidenceMatchesMilestone(milestone, submittedKinds)

  const updated: Assignment = {
    ...assignment,
    state: 'delivered',
    subState: 'fulfilment_submitted',
    milestones: assignment.milestones.map(m =>
      m.id === milestoneId
        ? { ...m, state: 'fulfilment_submitted' as MilestoneState, fulfilmentSubmissions: [...m.fulfilmentSubmissions, submission] }
        : m,
    ),
  }
  assertValidSubState(updated.state, updated.subState)

  emitAssignmentEvent('fulfilment_submitted', `Fulfilment submitted for milestone '${milestone.title}'`, {
    assignmentId: assignment.id,
    milestoneId,
    actorId: creatorId,
    actorRole: 'creator',
    metadata: { evidenceCount: submission.evidenceItems.length, fulfilmentType: submission.fulfilmentType },
  })

  return updated
}

// ══════════════════════════════════════════════
// 9. validateFulfilmentSubmission
// ══════════════════════════════════════════════

export interface FulfilmentValidationResult {
  valid: boolean
  errors: string[]
}

export function validateFulfilmentSubmission(
  milestone: Milestone,
  submission: FulfilmentSubmission,
): FulfilmentValidationResult {
  const errors: string[] = []

  if (submission.evidenceItems.length === 0) {
    errors.push('Submission contains no evidence items')
  }

  const submittedKinds = new Set(submission.evidenceItems.map(e => e.kind))

  for (const required of milestone.requiredEvidenceTypes) {
    if (!submittedKinds.has(required)) {
      errors.push(`Missing required evidence type: ${required}`)
    }
  }

  if (milestone.milestoneType === 'material' && !submittedKinds.has('vault_asset')) {
    errors.push('Material milestone requires at least one Vault-linked asset')
  }
  if (milestone.milestoneType === 'service' && !submittedKinds.has('service_log')) {
    errors.push('Service milestone requires at least one service log')
  }

  return { valid: errors.length === 0, errors }
}

// ══════════════════════════════════════════════
// 10. openReviewWindow
// ══════════════════════════════════════════════

export function openReviewWindow(
  assignment: Assignment,
  milestoneId: string,
): Assignment {
  assertAssignmentState(assignment, ['delivered'], 'open_review')

  const milestone = assignment.milestones.find(m => m.id === milestoneId)
  if (!milestone) throw new AssignmentError('MILESTONE_NOT_FOUND', `Milestone ${milestoneId} not found`, 404)
  assertMilestoneState(milestone, ['fulfilment_submitted'], 'open_review')

  const updated = {
    ...assignment,
    subState: 'review_open' as AssignmentSubState,
    milestones: assignment.milestones.map(m =>
      m.id === milestoneId ? { ...m, state: 'review_open' as MilestoneState } : m,
    ),
  }

  emitAssignmentEvent('review_window_opened', `Review window opened for milestone '${milestone.title}'`, {
    assignmentId: assignment.id,
    milestoneId,
    actorId: 'system',
    actorRole: 'system',
  })

  return updated
}

// ══════════════════════════════════════════════
// 11. determineReviewOutcome
// ══════════════════════════════════════════════

export function determineReviewOutcome(
  assignment: Assignment,
  milestoneId: string,
  reviewerId: string,
  reviewerRole: BuyerCompanyRole | null,
  determination: ReviewDetermination,
  notes: string,
  acceptedAmountCents?: number,
): Assignment {
  assertIsBuyer(assignment, reviewerId)
  assertCanReview(reviewerRole)
  assertCanAuthoriseRelease(reviewerRole, determination)

  const milestone = assignment.milestones.find(m => m.id === milestoneId)
  if (!milestone) throw new AssignmentError('MILESTONE_NOT_FOUND', `Milestone ${milestoneId} not found`, 404)

  assertMilestoneState(milestone, ['fulfilment_submitted', 'review_open'], 'determine_review')
  assertPartialAmountValid(milestone, acceptedAmountCents, determination)

  const review: ReviewRecord = {
    id: id('rev'),
    milestoneId,
    reviewerId,
    reviewerRole: reviewerRole ?? 'content_commit_holder', // individual buyer defaults
    determination,
    acceptedAmountCents: acceptedAmountCents ?? null,
    notes,
    evidenceBasis: 'Fulfilment submission evidence reviewed against milestone acceptance criteria.',
    createdAt: now(),
  }

  const milestoneStateMap: Record<ReviewDetermination, MilestoneState> = {
    accepted: 'accepted',
    accepted_partial: 'accepted_partial',
    changes_requested: 'changes_requested',
    rejected: 'rejected',
    dispute_opened: 'disputed',
  }

  const updatedMilestones = assignment.milestones.map(m =>
    m.id === milestoneId
      ? {
          ...m,
          state: milestoneStateMap[determination],
          reviewDetermination: review,
          completedAt: determination === 'accepted' ? now() : m.completedAt,
        }
      : m,
  )

  // Derive parent state from milestone states
  const allDone = updatedMilestones.every(m =>
    m.state === 'accepted' || m.state === 'accepted_partial' || m.state === 'cancelled',
  )
  const anyDisputed = updatedMilestones.some(m => m.state === 'disputed')
  const anyChanges = updatedMilestones.some(m => m.state === 'changes_requested')

  let newState: AssignmentState = assignment.state
  let newSubState: AssignmentSubState = assignment.subState

  if (anyDisputed) {
    newState = 'disputed'
    newSubState = 'fulfilment_submitted'
  } else if (allDone) {
    newState = 'confirmed'
    newSubState = 'settlement_queued'
  } else if (anyChanges) {
    newState = 'delivered'
    newSubState = 'changes_requested'
  } else {
    newState = 'delivered'
    newSubState = 'review_open'
  }

  // Escrow mirror updates
  let escrow = { ...assignment.escrow }
  if (determination === 'accepted') {
    escrow = { ...escrow, totalReleasedCents: escrow.totalReleasedCents + milestone.releasableAmountCents }
  } else if (determination === 'accepted_partial' && acceptedAmountCents) {
    escrow = { ...escrow, totalReleasedCents: escrow.totalReleasedCents + acceptedAmountCents }
  } else if (determination === 'dispute_opened') {
    escrow = { ...escrow, totalFrozenCents: escrow.totalFrozenCents + milestone.releasableAmountCents }
  }

  const updated: Assignment = {
    ...assignment,
    state: newState,
    subState: newSubState,
    milestones: updatedMilestones,
    escrow,
    completedAt: allDone ? now() : assignment.completedAt,
  }

  emitAssignmentEvent('review_recorded', `Review determination: ${determination} for milestone '${milestone.title}'`, {
    assignmentId: assignment.id,
    milestoneId,
    actorId: reviewerId,
    actorRole: reviewerRole ?? 'buyer_individual',
    metadata: { determination, acceptedAmountCents },
  })

  if (determination === 'accepted' || determination === 'accepted_partial') {
    emitAssignmentEvent('escrow_released', `Escrow released for milestone '${milestone.title}'`, {
      assignmentId: assignment.id,
      milestoneId,
      actorId: 'system',
      actorRole: 'system',
      metadata: {
        releasedCents: determination === 'accepted' ? milestone.releasableAmountCents : acceptedAmountCents,
      },
    })
  }

  return updated
}

// ══════════════════════════════════════════════
// 12. requestCommissionChange
// ══════════════════════════════════════════════

export function requestCommissionChange(
  assignment: Assignment,
  requesterId: string,
  amendedFields: CCRAmendedField[],
  rationale: string,
): Assignment {
  assertIsAssignmentParty(assignment, requesterId)
  assertCCRAllowed(assignment)
  assertNoPendingCCR(assignment)

  const ccr: CommissionChangeRequest = {
    id: id('ccr'),
    assignmentId: assignment.id,
    requesterId,
    state: 'pending',
    amendedFields,
    rationale,
    responseDeadline: addBusinessDays(new Date(), 5).toISOString(),
    respondedAt: null,
    responseNote: null,
    createdAt: now(),
  }

  const updated: Assignment = {
    ...assignment,
    subState: 'ccr_pending',
    ccrHistory: [...assignment.ccrHistory, ccr],
  }

  emitAssignmentEvent('ccr_submitted', `CCR submitted: ${amendedFields.map(f => f.field).join(', ')}`, {
    assignmentId: assignment.id,
    actorId: requesterId,
    actorRole: requesterId === assignment.buyerId ? 'buyer' : 'creator',
    metadata: { ccrId: ccr.id, fields: amendedFields.map(f => f.field) },
  })

  return updated
}

// ══════════════════════════════════════════════
// 13. approveCommissionChange
// ══════════════════════════════════════════════

export function approveCommissionChange(
  assignment: Assignment,
  ccrId: string,
  responderId: string,
  responseNote: string,
): Assignment {
  const ccr = assignment.ccrHistory.find(c => c.id === ccrId)
  if (!ccr) throw new AssignmentError('CCR_NOT_FOUND', `CCR ${ccrId} not found`, 404)
  if (ccr.state !== 'pending') throw new AssignmentError('CCR_NOT_PENDING', 'CCR is not pending')

  // Responder must not be the requester
  if (ccr.requesterId === responderId) {
    throw new AssignmentError('FORBIDDEN_ROLE', 'Cannot respond to own CCR')
  }
  assertIsAssignmentParty(assignment, responderId)

  const restoreSubState: AssignmentSubState =
    assignment.state === 'in_progress' ? 'active' : assignment.subState === 'ccr_pending' ? 'active' : assignment.subState

  const updated: Assignment = {
    ...assignment,
    subState: restoreSubState,
    ccrHistory: assignment.ccrHistory.map(c =>
      c.id === ccrId
        ? { ...c, state: 'approved' as CCRState, respondedAt: now(), responseNote }
        : c,
    ),
  }

  emitAssignmentEvent('ccr_resolved', `CCR approved: ${ccr.amendedFields.map(f => f.field).join(', ')}`, {
    assignmentId: assignment.id,
    actorId: responderId,
    actorRole: responderId === assignment.buyerId ? 'buyer' : 'creator',
    metadata: { ccrId, resolution: 'approved' },
  })

  return updated
}

// ══════════════════════════════════════════════
// 14. rejectCommissionChange
// ══════════════════════════════════════════════

export function rejectCommissionChange(
  assignment: Assignment,
  ccrId: string,
  responderId: string,
  responseNote: string,
): Assignment {
  const ccr = assignment.ccrHistory.find(c => c.id === ccrId)
  if (!ccr) throw new AssignmentError('CCR_NOT_FOUND', `CCR ${ccrId} not found`, 404)
  if (ccr.state !== 'pending') throw new AssignmentError('CCR_NOT_PENDING', 'CCR is not pending')

  if (ccr.requesterId === responderId) {
    throw new AssignmentError('FORBIDDEN_ROLE', 'Cannot respond to own CCR')
  }
  assertIsAssignmentParty(assignment, responderId)

  const restoreSubState: AssignmentSubState =
    assignment.state === 'in_progress' ? 'active' : assignment.subState === 'ccr_pending' ? 'active' : assignment.subState

  const updated: Assignment = {
    ...assignment,
    subState: restoreSubState,
    ccrHistory: assignment.ccrHistory.map(c =>
      c.id === ccrId
        ? { ...c, state: 'denied' as CCRState, respondedAt: now(), responseNote }
        : c,
    ),
  }

  emitAssignmentEvent('ccr_resolved', `CCR denied`, {
    assignmentId: assignment.id,
    actorId: responderId,
    actorRole: responderId === assignment.buyerId ? 'buyer' : 'creator',
    metadata: { ccrId, resolution: 'denied' },
  })

  return updated
}

// ══════════════════════════════════════════════
// 15. autoDenyExpiredCCR
// Called by background job scanner.
// ══════════════════════════════════════════════

export function autoDenyExpiredCCR(assignment: Assignment): Assignment {
  const pendingCCR = assignment.ccrHistory.find(c => c.state === 'pending')
  if (!pendingCCR) return assignment

  const deadline = new Date(pendingCCR.responseDeadline)
  if (new Date() < deadline) return assignment // not expired yet

  const restoreSubState: AssignmentSubState =
    assignment.state === 'in_progress' ? 'active' : assignment.subState === 'ccr_pending' ? 'active' : assignment.subState

  const updated: Assignment = {
    ...assignment,
    subState: restoreSubState,
    ccrHistory: assignment.ccrHistory.map(c =>
      c.id === pendingCCR.id
        ? { ...c, state: 'auto_denied' as CCRState, respondedAt: now() }
        : c,
    ),
  }

  emitAssignmentEvent('ccr_resolved', `CCR auto-denied: 5 business day window expired`, {
    assignmentId: assignment.id,
    actorId: 'system',
    actorRole: 'system',
    metadata: { ccrId: pendingCCR.id, resolution: 'auto_denied' },
  })

  return updated
}

// ══════════════════════════════════════════════
// 16. openAssignmentDispute
// ══════════════════════════════════════════════

export function openAssignmentDispute(
  assignment: Assignment,
  filerId: string,
  trigger: AssignmentDisputeTrigger,
  milestoneId: string | null,
  reason: string,
): { assignment: Assignment; dispute: AssignmentDisputeCase } {
  const filerRole = assertIsAssignmentParty(assignment, filerId)

  const disputableStates: AssignmentState[] = ['in_progress', 'delivered']
  assertAssignmentState(assignment, disputableStates, 'open_dispute')
  assertNoOpenDispute(assignment, milestoneId)

  // Determine contested amount
  let contestedAmountCents = 0
  if (milestoneId) {
    const milestone = assignment.milestones.find(m => m.id === milestoneId)
    if (!milestone) throw new AssignmentError('MILESTONE_NOT_FOUND', `Milestone ${milestoneId} not found`, 404)
    contestedAmountCents = milestone.releasableAmountCents
  } else {
    // Assignment-level: freeze all unreleased
    contestedAmountCents = assignment.milestones
      .filter(m => m.state !== 'accepted' && m.state !== 'accepted_partial' && m.state !== 'cancelled')
      .reduce((s, m) => s + m.releasableAmountCents, 0)
  }

  const dispute: AssignmentDisputeCase = {
    id: id('disp'),
    assignmentId: assignment.id,
    milestoneId,
    scope: milestoneId ? 'milestone' : 'assignment',
    trigger,
    state: 'filed',
    filerId,
    filerRole,
    contestedAmountCents,
    reason,
    counterEvidence: null,
    resolution: null,
    resolvedAmountCents: null,
    staffReviewerId: null,
    staffNotes: null,
    filedAt: now(),
    counterEvidenceDeadline: addBusinessDays(new Date(), 5).toISOString(),
    resolvedAt: null,
    externalEscalationDeadline: null,
  }

  // Freeze contested amount, update milestone/assignment state
  const updatedMilestones = milestoneId
    ? assignment.milestones.map(m =>
        m.id === milestoneId ? { ...m, state: 'disputed' as MilestoneState } : m,
      )
    : assignment.milestones.map(m =>
        m.state !== 'accepted' && m.state !== 'accepted_partial' && m.state !== 'cancelled'
          ? { ...m, state: 'disputed' as MilestoneState }
          : m,
      )

  const updated: Assignment = {
    ...assignment,
    state: 'disputed',
    subState: 'fulfilment_submitted',
    milestones: updatedMilestones,
    escrow: {
      ...assignment.escrow,
      totalFrozenCents: assignment.escrow.totalFrozenCents + contestedAmountCents,
    },
  }

  emitAssignmentEvent('assignment_disputed', `Dispute filed: ${trigger}`, {
    assignmentId: assignment.id,
    milestoneId: milestoneId ?? undefined,
    actorId: filerId,
    actorRole: filerRole,
    metadata: { disputeId: dispute.id, trigger, contestedAmountCents, scope: dispute.scope },
  })

  return { assignment: updated, dispute }
}

// ══════════════════════════════════════════════
// 17. evaluateProvisionalReleaseEligibility
// Called by background job scanner.
// ══════════════════════════════════════════════

const PROVISIONAL_RELEASE_DAYS = 14

export function evaluateProvisionalReleaseEligibility(assignment: Assignment): Assignment {
  if (assignment.state !== 'delivered') return assignment
  if (assignment.subState === 'changes_requested') return assignment
  if (assignment.escrow.totalFrozenCents > 0) return assignment

  const eligible = assignment.milestones.some(m => {
    if (m.state !== 'fulfilment_submitted') return false
    const lastSub = m.fulfilmentSubmissions[m.fulfilmentSubmissions.length - 1]
    if (!lastSub) return false
    const days = (Date.now() - new Date(lastSub.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
    return days >= PROVISIONAL_RELEASE_DAYS
  })

  if (!eligible) return assignment

  return {
    ...assignment,
    subState: 'provisional_release_eligible',
  }
}

// ══════════════════════════════════════════════
// 18. executeProvisionalRelease
// Staff action. 30-day external escalation window opens.
// ══════════════════════════════════════════════

export function executeProvisionalRelease(
  assignment: Assignment,
  staffId: string,
): Assignment {
  if (assignment.subState !== 'provisional_release_eligible') {
    throw new AssignmentError('NOT_PROVISIONAL_RELEASE_ELIGIBLE', 'Assignment is not eligible for provisional release')
  }
  assertNoDisputeFreeze(assignment)

  // Release all fulfilment_submitted milestones
  let releasedCents = 0
  const updatedMilestones = assignment.milestones.map(m => {
    if (m.state === 'fulfilment_submitted') {
      releasedCents += m.releasableAmountCents
      return { ...m, state: 'accepted' as MilestoneState, completedAt: now() }
    }
    return m
  })

  const allDone = updatedMilestones.every(m =>
    m.state === 'accepted' || m.state === 'accepted_partial' || m.state === 'cancelled',
  )

  const updated: Assignment = {
    ...assignment,
    state: allDone ? 'confirmed' : 'in_progress',
    subState: allDone ? 'provisional_release_executed' : 'active',
    milestones: updatedMilestones,
    escrow: {
      ...assignment.escrow,
      totalReleasedCents: assignment.escrow.totalReleasedCents + releasedCents,
    },
    completedAt: allDone ? now() : assignment.completedAt,
  }

  emitAssignmentEvent('provisional_release', `Provisional release executed: ${releasedCents} cents released`, {
    assignmentId: assignment.id,
    actorId: staffId,
    actorRole: 'staff',
    metadata: { releasedCents, externalEscalationWindowDays: 30 },
  })

  return updated
}

// ══════════════════════════════════════════════
// 19. queueCreatorSettlement
// Marks the assignment for 7-day SLA settlement.
// ══════════════════════════════════════════════

export function queueCreatorSettlement(assignment: Assignment): Assignment {
  if (assignment.state !== 'confirmed') {
    throw new AssignmentError('INVALID_STATE_TRANSITION', 'Can only queue settlement on confirmed assignments')
  }

  const updated: Assignment = {
    ...assignment,
    subState: 'settlement_queued',
  }

  emitAssignmentEvent('settlement_queued', 'Creator settlement queued under 7-day SLA', {
    assignmentId: assignment.id,
    actorId: 'system',
    actorRole: 'system',
    metadata: { totalReleasedCents: assignment.escrow.totalReleasedCents },
  })

  return updated
}

// ══════════════════════════════════════════════
// 20. syncStripeReleaseState
// Idempotent webhook handler for Stripe transfer confirmation.
// ══════════════════════════════════════════════

export function syncStripeReleaseState(
  assignment: Assignment,
  stripeTransferId: string,
  settledAmountCents: number,
): Assignment {
  if (assignment.subState !== 'settlement_queued') return assignment // idempotent no-op

  const updated: Assignment = {
    ...assignment,
    subState: 'closed',
  }

  emitAssignmentEvent('escrow_released', `Stripe settlement confirmed: ${settledAmountCents} cents via transfer ${stripeTransferId}`, {
    assignmentId: assignment.id,
    actorId: 'stripe',
    actorRole: 'system',
    metadata: { stripeTransferId, settledAmountCents },
  }, `settle-${stripeTransferId}`) // idempotency key

  return updated
}

// ══════════════════════════════════════════════
// CANCEL ASSIGNMENT
// ══════════════════════════════════════════════

export function cancelAssignment(assignment: Assignment, actorId: string, reason: string): Assignment {
  assertIsAssignmentParty(assignment, actorId)

  const nonCancellable: AssignmentState[] = ['confirmed', 'cancelled']
  if (nonCancellable.includes(assignment.state)) {
    throw new AssignmentError('ASSIGNMENT_NOT_CANCELLABLE', `Cannot cancel assignment in state '${assignment.state}'`)
  }

  const updated: Assignment = {
    ...assignment,
    state: 'cancelled',
    subState: 'closed',
    cancelledAt: now(),
    milestones: assignment.milestones.map(m =>
      m.state === 'accepted' || m.state === 'accepted_partial' || m.state === 'cancelled'
        ? m
        : { ...m, state: 'cancelled' as MilestoneState },
    ),
  }

  emitAssignmentEvent('assignment_cancelled', `Assignment cancelled: ${reason}`, {
    assignmentId: assignment.id,
    actorId,
    actorRole: actorId === assignment.buyerId ? 'buyer' : 'creator',
    metadata: { reason },
  })

  return updated
}
