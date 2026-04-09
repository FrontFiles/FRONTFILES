/**
 * Assignment Engine — Pure Selector Functions
 *
 * All derived state is computed here, never stored.
 * Exception computation follows the same pattern as upload v2.
 */

import type { AssignmentEngineState } from './types'
import type {
  Assignment,
  Milestone,
  MilestoneState,
  AssignmentState,
  AssignmentClass,
  BuyerCompanyRole,
  FulfilmentSubmission,
  EvidenceItem,
} from '@/lib/types'

// ══════════════════════════════════════════════
// WAITING PARTY
// ══════════════════════════════════════════════

export type WaitingParty = 'buyer' | 'creator' | 'platform' | 'stripe' | 'none'

export function getWaitingParty(assignment: Assignment): WaitingParty {
  switch (assignment.subState) {
    case 'draft': return 'buyer'
    case 'clarification_open': return 'buyer'
    case 'accepted_pending_escrow': return 'stripe'
    case 'active': return 'creator'
    case 'milestone_due': return 'creator'
    case 'fulfilment_submitted': return 'buyer'
    case 'fulfilment_processing': return 'platform'
    case 'review_open': return 'buyer'
    case 'changes_requested': return 'creator'
    case 'ccr_pending': return 'buyer'
    case 'provisional_release_eligible': return 'platform'
    case 'provisional_release_executed': return 'platform'
    case 'settlement_queued': return 'platform'
    case 'closed': return 'none'
  }
}

// ══════════════════════════════════════════════
// NEXT VALID ACTIONS
// ══════════════════════════════════════════════

export type AssignmentActionLabel =
  | 'accept_brief'
  | 'request_clarification'
  | 'submit_fulfilment'
  | 'review_fulfilment'
  | 'submit_ccr'
  | 'respond_ccr'
  | 'open_dispute'
  | 'cancel'
  | 'execute_provisional_release'

export function getNextActions(
  assignment: Assignment,
  viewerRole: 'buyer' | 'creator' | 'staff',
  buyerCompanyRole?: BuyerCompanyRole,
): AssignmentActionLabel[] {
  const actions: AssignmentActionLabel[] = []
  const { state, subState } = assignment

  if (viewerRole === 'creator') {
    if (state === 'brief_issued' && subState === 'draft') {
      actions.push('accept_brief', 'request_clarification')
    }
    if (state === 'in_progress' && (subState === 'active' || subState === 'milestone_due')) {
      actions.push('submit_fulfilment', 'submit_ccr')
    }
    if (subState === 'changes_requested') {
      actions.push('submit_fulfilment', 'submit_ccr', 'open_dispute')
    }
    if (state === 'in_progress') {
      actions.push('cancel')
    }
  }

  if (viewerRole === 'buyer') {
    if (subState === 'fulfilment_submitted' || subState === 'review_open') {
      // Editor can review but not finalize release
      actions.push('review_fulfilment')
    }
    if (subState === 'ccr_pending') {
      actions.push('respond_ccr')
    }
    if (state === 'brief_issued' && subState === 'draft') {
      actions.push('cancel')
    }
    if (state === 'in_progress') {
      actions.push('submit_ccr')
    }
    if (state === 'delivered') {
      actions.push('open_dispute')
    }
  }

  if (viewerRole === 'staff') {
    if (subState === 'provisional_release_eligible') {
      actions.push('execute_provisional_release')
    }
  }

  return actions
}

// ══════════════════════════════════════════════
// ROLE AUTHORITY CHECK (Architecture §12)
// ══════════════════════════════════════════════

/**
 * Editor cannot independently authorise final spend release.
 * Content Commit Holder can.
 */
export function canAuthoriseRelease(role: BuyerCompanyRole | null): boolean {
  if (!role) return true // individual buyer
  return role === 'content_commit_holder'
}

export function canReviewFulfilment(role: BuyerCompanyRole | null): boolean {
  if (!role) return true // individual buyer
  return role === 'editor' || role === 'content_commit_holder' || role === 'admin'
}

// ══════════════════════════════════════════════
// MILESTONE SELECTORS
// ══════════════════════════════════════════════

export function getActiveMilestones(assignment: Assignment): Milestone[] {
  return assignment.milestones.filter(m =>
    m.state !== 'pending' && m.state !== 'cancelled'
  )
}

export function getDueMilestones(assignment: Assignment): Milestone[] {
  const now = new Date()
  return assignment.milestones.filter(m =>
    m.state === 'active' && new Date(m.dueDate) <= now
  )
}

export function getMilestonesAwaitingReview(assignment: Assignment): Milestone[] {
  return assignment.milestones.filter(m =>
    m.state === 'fulfilment_submitted' || m.state === 'review_open'
  )
}

export function getCompletedMilestones(assignment: Assignment): Milestone[] {
  return assignment.milestones.filter(m =>
    m.state === 'accepted' || m.state === 'accepted_partial'
  )
}

// ══════════════════════════════════════════════
// FINANCIAL SELECTORS
// ══════════════════════════════════════════════

export function getTotalBudgetCents(assignment: Assignment): number {
  return assignment.milestones.reduce((sum, m) => sum + m.releasableAmountCents, 0)
}

export function getTotalReleasedCents(assignment: Assignment): number {
  return assignment.escrow.totalReleasedCents
}

export function getTotalPendingCents(assignment: Assignment): number {
  return getTotalBudgetCents(assignment) - assignment.escrow.totalReleasedCents - assignment.escrow.totalRefundedCents - assignment.escrow.totalFrozenCents
}

export function getTotalFrozenCents(assignment: Assignment): number {
  return assignment.escrow.totalFrozenCents
}

export function getMilestoneFinancialSummary(milestone: Milestone) {
  return {
    releasable: milestone.releasableAmountCents,
    isReleased: milestone.state === 'accepted' || milestone.state === 'accepted_partial',
    isFrozen: milestone.state === 'disputed',
    isPending: milestone.state !== 'accepted' && milestone.state !== 'accepted_partial' && milestone.state !== 'disputed' && milestone.state !== 'cancelled',
  }
}

// ══════════════════════════════════════════════
// EVIDENCE SELECTORS
// ══════════════════════════════════════════════

export function getAllEvidenceItems(assignment: Assignment): EvidenceItem[] {
  return assignment.milestones.flatMap(m =>
    m.fulfilmentSubmissions.flatMap(s => s.evidenceItems)
  )
}

export function getEvidenceByMilestone(assignment: Assignment, milestoneId: string): EvidenceItem[] {
  const milestone = assignment.milestones.find(m => m.id === milestoneId)
  if (!milestone) return []
  return milestone.fulfilmentSubmissions.flatMap(s => s.evidenceItems)
}

export function getVaultAssetIds(assignment: Assignment): string[] {
  return getAllEvidenceItems(assignment)
    .filter(e => e.kind === 'vault_asset' && e.vaultAssetId)
    .map(e => e.vaultAssetId!)
}

// ══════════════════════════════════════════════
// CCR SELECTORS
// ══════════════════════════════════════════════

export function getPendingCCR(assignment: Assignment) {
  return assignment.ccrHistory.find(ccr => ccr.state === 'pending') ?? null
}

export function hasPendingCCR(assignment: Assignment): boolean {
  return getPendingCCR(assignment) !== null
}

// ══════════════════════════════════════════════
// PROVISIONAL RELEASE ELIGIBILITY (Architecture §14)
// ══════════════════════════════════════════════

const PROVISIONAL_RELEASE_DAYS = 14

export function isProvisionalReleaseEligible(assignment: Assignment): boolean {
  if (assignment.state !== 'delivered') return false
  if (assignment.subState === 'changes_requested') return false

  // Check if any milestone has been in fulfilment_submitted for >= 14 days
  return assignment.milestones.some(m => {
    if (m.state !== 'fulfilment_submitted') return false
    const lastSubmission = m.fulfilmentSubmissions[m.fulfilmentSubmissions.length - 1]
    if (!lastSubmission) return false
    const submittedDate = new Date(lastSubmission.submittedAt)
    const now = new Date()
    const daysSince = (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince >= PROVISIONAL_RELEASE_DAYS
  })
}

// ══════════════════════════════════════════════
// PROGRESS
// ══════════════════════════════════════════════

export function getAssignmentProgress(assignment: Assignment) {
  const total = assignment.milestones.length
  const completed = getCompletedMilestones(assignment).length
  const disputed = assignment.milestones.filter(m => m.state === 'disputed').length
  const cancelled = assignment.milestones.filter(m => m.state === 'cancelled').length

  return {
    total,
    completed,
    disputed,
    cancelled,
    active: total - completed - disputed - cancelled,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

// ══════════════════════════════════════════════
// DISPLAY HELPERS
// ══════════════════════════════════════════════

export function centsToEur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export function getAssignmentClassDescription(cls: AssignmentClass): string {
  switch (cls) {
    case 'material': return 'File-based journalism content'
    case 'service': return 'Labour, operational support, access, or field assistance'
    case 'hybrid': return 'Service obligations and material outputs'
  }
}
