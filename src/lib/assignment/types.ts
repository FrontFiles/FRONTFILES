/**
 * Assignment Engine — Internal State Types
 *
 * These types define the client-side state shape for the Assignment workflow.
 * Domain objects (Assignment, Milestone, etc.) are in lib/types.ts.
 * This file defines the reducer state, actions, and UI state.
 */

import type {
  Assignment,
  AssignmentClass,
  AssignmentState,
  AssignmentSubState,
  Milestone,
  MilestoneState,
  FulfilmentSubmission,
  EvidenceItem,
  EvidenceItemKind,
  CommissionChangeRequest,
  ReviewDetermination,
  BuyerCompanyRole,
} from '@/lib/types'

// ══════════════════════════════════════════════
// ASSIGNMENT ENGINE STATE
// ══════════════════════════════════════════════

export interface AssignmentEngineState {
  assignment: Assignment | null
  ui: AssignmentUIState
}

export interface AssignmentUIState {
  activeTab: AssignmentTab
  selectedMilestoneId: string | null
  expandedMilestoneIds: Set<string>
  showCCRForm: boolean
  showFulfilmentForm: boolean
  fulfilmentDraftMilestoneId: string | null
  reviewingMilestoneId: string | null
}

export type AssignmentTab =
  | 'overview'
  | 'milestones'
  | 'fulfilment'
  | 'rights'
  | 'documents'
  | 'history'

// ══════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════

export type AssignmentAction =
  // Lifecycle
  | { type: 'LOAD_ASSIGNMENT'; assignment: Assignment }
  | { type: 'ACCEPT_ASSIGNMENT' }
  | { type: 'ESCROW_CAPTURED'; stripePaymentIntentId: string; capturedAt: string }
  | { type: 'CANCEL_ASSIGNMENT'; reason: string }

  // Milestone management
  | { type: 'ACTIVATE_MILESTONE'; milestoneId: string }

  // Fulfilment
  | { type: 'SUBMIT_FULFILMENT'; milestoneId: string; submission: FulfilmentSubmission }

  // Review (buyer-side)
  | { type: 'RECORD_REVIEW'; milestoneId: string; determination: ReviewDetermination; reviewerId: string; reviewerRole: BuyerCompanyRole | 'staff'; notes: string; acceptedAmountCents?: number }

  // CCR
  | { type: 'SUBMIT_CCR'; ccr: CommissionChangeRequest }
  | { type: 'RESPOND_CCR'; ccrId: string; approved: boolean; responseNote: string }
  | { type: 'AUTO_DENY_CCR'; ccrId: string }

  // Provisional Release
  | { type: 'MARK_PROVISIONAL_RELEASE_ELIGIBLE'; milestoneId: string }
  | { type: 'EXECUTE_PROVISIONAL_RELEASE'; milestoneId: string }

  // Settlement
  | { type: 'SETTLEMENT_QUEUED' }
  | { type: 'SETTLEMENT_COMPLETE' }

  // UI
  | { type: 'SET_TAB'; tab: AssignmentTab }
  | { type: 'SELECT_MILESTONE'; milestoneId: string | null }
  | { type: 'TOGGLE_MILESTONE_EXPANDED'; milestoneId: string }
  | { type: 'SHOW_CCR_FORM'; show: boolean }
  | { type: 'SHOW_FULFILMENT_FORM'; milestoneId: string | null }
  | { type: 'SET_REVIEWING_MILESTONE'; milestoneId: string | null }

// ══════════════════════════════════════════════
// VALID STATE TRANSITIONS
// ══════════════════════════════════════════════

/** Parent state → sub-state mapping (Architecture §8.2) */
export const VALID_SUB_STATES: Record<AssignmentState, AssignmentSubState[]> = {
  brief_issued: ['draft', 'clarification_open', 'accepted_pending_escrow'],
  escrow_captured: ['accepted_pending_escrow'],
  in_progress: ['active', 'milestone_due', 'ccr_pending'],
  delivered: ['fulfilment_submitted', 'fulfilment_processing', 'review_open', 'changes_requested', 'provisional_release_eligible'],
  confirmed: ['provisional_release_executed', 'settlement_queued', 'closed'],
  disputed: ['fulfilment_submitted'], // dispute can happen from any delivered sub-state
  cancelled: ['closed'],
}
