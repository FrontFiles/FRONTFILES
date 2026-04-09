/**
 * Assignment Engine — Authorization Guards
 *
 * Pure functions that throw AssignmentError on violation.
 * Used by both domain services and API routes.
 *
 * System boundary: Assignment Engine checks Assignment-domain authority.
 * It does not check Vault or FCS authority.
 */

import type {
  Assignment,
  AssignmentState,
  AssignmentSubState,
  Milestone,
  MilestoneState,
  BuyerCompanyRole,
  ReviewDetermination,
  FulfilmentSubmission,
  EvidenceItemKind,
} from '@/lib/types'
import { VALID_SUB_STATES } from './types'
import { AssignmentError, forbidden, badTransition, notFound } from './errors'

// ══════════════════════════════════════════════
// STATE MACHINE GUARDS
// ══════════════════════════════════════════════

/** Validate that a (state, subState) pair is architecturally legal. */
export function assertValidSubState(state: AssignmentState, subState: AssignmentSubState): void {
  const allowed = VALID_SUB_STATES[state]
  if (!allowed.includes(subState)) {
    throw new AssignmentError(
      'INVALID_SUB_STATE',
      `Sub-state '${subState}' is not valid under parent state '${state}'. Allowed: [${allowed.join(', ')}]`,
    )
  }
}

/** Assert assignment is in one of the expected states. */
export function assertAssignmentState(
  assignment: Assignment,
  expected: AssignmentState[],
  action: string,
): void {
  if (!expected.includes(assignment.state)) {
    throw badTransition(
      `${assignment.state}/${assignment.subState}`,
      action,
    )
  }
}

/** Assert milestone is in one of the expected states. */
export function assertMilestoneState(
  milestone: Milestone,
  expected: MilestoneState[],
  action: string,
): void {
  if (!expected.includes(milestone.state)) {
    throw badTransition(
      `milestone ${milestone.id}: ${milestone.state}`,
      action,
    )
  }
}

// ══════════════════════════════════════════════
// ROLE GUARDS
// ══════════════════════════════════════════════

/** Assert the actor is either the buyer or creator on this assignment. */
export function assertIsAssignmentParty(
  assignment: Assignment,
  actorId: string,
): 'buyer' | 'creator' {
  if (actorId === assignment.buyerId) return 'buyer'
  if (actorId === assignment.creatorId) return 'creator'
  throw forbidden('NOT_ASSIGNMENT_PARTY', `Actor ${actorId} is not a party to assignment ${assignment.id}`)
}

/** Assert the actor is the buyer. */
export function assertIsBuyer(assignment: Assignment, actorId: string): void {
  if (actorId !== assignment.buyerId) {
    throw forbidden('FORBIDDEN_ROLE', `Only the buyer can perform this action on assignment ${assignment.id}`)
  }
}

/** Assert the actor is the creator. */
export function assertIsCreator(assignment: Assignment, actorId: string): void {
  if (actorId !== assignment.creatorId) {
    throw forbidden('FORBIDDEN_ROLE', `Only the creator can perform this action on assignment ${assignment.id}`)
  }
}

/**
 * Architecture §12: Editor cannot independently authorise final spend release.
 * Content Commit Holder can. Individual buyers (null role) can.
 */
export function assertCanAuthoriseRelease(
  role: BuyerCompanyRole | null,
  determination: ReviewDetermination,
): void {
  const releaseActions: ReviewDetermination[] = ['accepted', 'accepted_partial']
  if (!releaseActions.includes(determination)) return // non-release actions are fine for all roles

  if (role === 'editor') {
    throw new AssignmentError(
      'EDITOR_CANNOT_AUTHORISE_RELEASE',
      'Editor cannot independently authorise final spend release. Content Commit Holder approval required.',
      403,
    )
  }
  if (role === 'admin') {
    throw new AssignmentError(
      'FORBIDDEN_ROLE',
      'Account Administrator is not the default fulfilment approver unless account configuration defines it.',
      403,
    )
  }
}

/** Assert the role can review fulfilment (inspect, request changes). */
export function assertCanReview(role: BuyerCompanyRole | null): void {
  if (role === null) return // individual buyer
  const reviewable: (BuyerCompanyRole | null)[] = ['editor', 'content_commit_holder']
  if (!reviewable.includes(role)) {
    throw new AssignmentError(
      'REVIEWER_CANNOT_REVIEW',
      `Role '${role}' cannot review fulfilment`,
      403,
    )
  }
}

// ══════════════════════════════════════════════
// FULFILMENT GUARDS
// ══════════════════════════════════════════════

/** Assert fulfilment submission has at least one evidence item. */
export function assertFulfilmentNotEmpty(submission: FulfilmentSubmission): void {
  if (submission.evidenceItems.length === 0) {
    throw new AssignmentError('FULFILMENT_EMPTY', 'Fulfilment submission must include at least one evidence item')
  }
}

/**
 * Assert evidence types match the milestone's required types.
 * Material milestones require at least one vault_asset.
 * Service milestones require at least one service_log.
 */
export function assertEvidenceMatchesMilestone(
  milestone: Milestone,
  submittedKinds: EvidenceItemKind[],
): void {
  if (milestone.milestoneType === 'material') {
    if (!submittedKinds.includes('vault_asset')) {
      throw new AssignmentError(
        'MATERIAL_MILESTONE_REQUIRES_ASSETS',
        'Material milestone requires at least one Vault-linked asset in the fulfilment submission',
      )
    }
  }
  if (milestone.milestoneType === 'service') {
    if (!submittedKinds.includes('service_log')) {
      throw new AssignmentError(
        'SERVICE_MILESTONE_REQUIRES_LOGS',
        'Service milestone requires at least one service log in the fulfilment submission',
      )
    }
  }
  if (milestone.milestoneType === 'hybrid') {
    if (!submittedKinds.includes('vault_asset') || !submittedKinds.includes('service_log')) {
      throw new AssignmentError(
        'EVIDENCE_TYPE_MISMATCH',
        'Hybrid milestone requires both asset and service evidence',
      )
    }
  }
}

// ══════════════════════════════════════════════
// REVIEW GUARDS
// ══════════════════════════════════════════════

/** Assert partial acceptance amount does not exceed milestone releasable. */
export function assertPartialAmountValid(
  milestone: Milestone,
  acceptedAmountCents: number | undefined,
  determination: ReviewDetermination,
): void {
  if (determination === 'accepted_partial') {
    if (!milestone.partialAcceptancePermitted) {
      throw new AssignmentError(
        'PARTIAL_RELEASE_NOT_PERMITTED',
        `Milestone '${milestone.id}' does not permit partial acceptance`,
      )
    }
    if (acceptedAmountCents === undefined || acceptedAmountCents <= 0) {
      throw new AssignmentError(
        'PARTIAL_AMOUNT_EXCEEDS_RELEASABLE',
        'Partial acceptance requires a positive accepted amount',
      )
    }
    if (acceptedAmountCents > milestone.releasableAmountCents) {
      throw new AssignmentError(
        'PARTIAL_AMOUNT_EXCEEDS_RELEASABLE',
        `Accepted amount ${acceptedAmountCents} exceeds milestone releasable ${milestone.releasableAmountCents}`,
      )
    }
  }
}

// ══════════════════════════════════════════════
// CCR GUARDS
// ══════════════════════════════════════════════

/** Assert no CCR is already pending on this assignment. */
export function assertNoPendingCCR(assignment: Assignment): void {
  if (assignment.ccrHistory.some(ccr => ccr.state === 'pending')) {
    throw new AssignmentError('CCR_ALREADY_PENDING', 'A CCR is already pending on this assignment')
  }
}

/** Assert assignment is in a state where CCR is allowed. */
export function assertCCRAllowed(assignment: Assignment): void {
  const allowed: AssignmentState[] = ['in_progress', 'delivered']
  if (!allowed.includes(assignment.state)) {
    throw new AssignmentError(
      'CCR_NOT_AMENDABLE_IN_STATE',
      `CCR cannot be submitted when assignment is in state '${assignment.state}'`,
    )
  }
}

// ══════════════════════════════════════════════
// DISPUTE GUARDS
// ══════════════════════════════════════════════

/** Assert no open dispute on the target milestone/assignment. */
export function assertNoOpenDispute(
  assignment: Assignment,
  milestoneId: string | null,
): void {
  if (milestoneId) {
    const milestone = assignment.milestones.find(m => m.id === milestoneId)
    if (milestone?.state === 'disputed') {
      throw new AssignmentError('DISPUTE_ALREADY_OPEN', `Milestone ${milestoneId} already has an open dispute`)
    }
  }
  if (assignment.state === 'disputed') {
    throw new AssignmentError('DISPUTE_ALREADY_OPEN', 'Assignment already has an open dispute')
  }
}

// ══════════════════════════════════════════════
// PROVISIONAL RELEASE GUARDS
// ══════════════════════════════════════════════

/** Assert no dispute freeze overrides the provisional release. */
export function assertNoDisputeFreeze(assignment: Assignment): void {
  if (assignment.escrow.totalFrozenCents > 0) {
    throw new AssignmentError(
      'DISPUTE_FREEZE_OVERRIDES_RELEASE',
      'Cannot execute provisional release while escrow freeze is active',
    )
  }
}
