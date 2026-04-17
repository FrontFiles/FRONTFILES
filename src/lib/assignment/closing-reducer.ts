/**
 * Assignment Closing Flow — Reducer
 *
 * Deterministic state machine for the assignment closing pipeline:
 *   review → funding → closing (docs/sigs/auth) → activation
 *
 * System boundary: Closing reducer owns the funding + contract pipeline.
 * Assignment lifecycle state is updated via the closing engine, not this reducer.
 */

import type { Assignment } from '@/lib/types'
import { PLATFORM_FEES } from '@/lib/types'
import type {
  AssignmentClosingFlowState,
  ClosingFlowPhase,
  ClosingReview,
  FundingRecord,
  ClosingPipelineStatus,
  AssignmentDocumentReadiness,
  AssignmentSignatureReadiness,
  WorkAuthorization,
} from './closing-types'

// ══════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════

export type AssignmentClosingAction =
  // Load
  | { type: 'LOAD_CLOSING_ASSIGNMENT'; payload: { assignment: Assignment } }

  // Review confirmations
  | { type: 'CONFIRM_SCOPE' }
  | { type: 'CONFIRM_MILESTONES' }
  | { type: 'CONFIRM_RIGHTS' }
  | { type: 'CONFIRM_ESCROW_AMOUNT' }
  | { type: 'CONFIRM_TERMS' }
  | { type: 'READY_FOR_FUNDING' }

  // Funding (escrow capture)
  | { type: 'INITIATE_ESCROW'; payload: { fundingId: string } }
  | { type: 'ESCROW_PROCESSING' }
  | { type: 'ESCROW_CAPTURED'; payload: { stripePaymentIntentId: string; capturedAt: string } }
  | { type: 'ESCROW_FAILED'; payload: { reason: string } }

  // Closing pipeline
  | { type: 'START_CLOSING'; payload: { updatedAssignment: Assignment } }
  | { type: 'CLOSING_DOCUMENTS_GENERATING' }
  | { type: 'CLOSING_AWAITING_SIGNATURES' }
  | { type: 'CLOSING_WORK_AUTHORIZATION_PENDING' }
  | { type: 'CLOSING_ACTIVATED'; payload: {
      documentReadiness: AssignmentDocumentReadiness
      signatureReadiness: AssignmentSignatureReadiness
      workAuthorization: WorkAuthorization
      activatedAssignment: Assignment
    }}
  | { type: 'CLOSING_FAILED'; payload: { reason: string } }

// ══════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════

const initialReview: ClosingReview = {
  scopeReviewed: false,
  milestonesReviewed: false,
  rightsReviewed: false,
  escrowAmountConfirmed: false,
  termsConfirmed: false,
}

export const initialClosingFlowState: AssignmentClosingFlowState = {
  phase: 'review',
  assignment: null,
  review: initialReview,
  funding: null,
  closingStatus: 'not_started',
  documentReadiness: null,
  signatureReadiness: null,
  workAuthorization: null,
}

export function createInitialClosingState(assignment: Assignment): AssignmentClosingFlowState {
  return {
    ...initialClosingFlowState,
    assignment,
  }
}

// ══════════════════════════════════════════════
// SELECTORS
// ══════════════════════════════════════════════

export function isClosingReviewComplete(state: AssignmentClosingFlowState): boolean {
  const { review } = state
  return (
    review.scopeReviewed &&
    review.milestonesReviewed &&
    review.rightsReviewed &&
    review.escrowAmountConfirmed &&
    review.termsConfirmed
  )
}

export function computeEscrowAmountCents(assignment: Assignment): number {
  const milestoneTotalCents = assignment.milestones.reduce(
    (sum, m) => sum + m.releasableAmountCents, 0,
  )
  const buyerMarkup = PLATFORM_FEES.commissioned.buyerMarkup
  return milestoneTotalCents + Math.round(milestoneTotalCents * buyerMarkup)
}

// ══════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════

export function closingReducer(
  state: AssignmentClosingFlowState,
  action: AssignmentClosingAction,
): AssignmentClosingFlowState {
  switch (action.type) {
    // ── Load ──

    case 'LOAD_CLOSING_ASSIGNMENT':
      return {
        ...initialClosingFlowState,
        assignment: action.payload.assignment,
      }

    // ── Review confirmations ──

    case 'CONFIRM_SCOPE':
      return { ...state, review: { ...state.review, scopeReviewed: true } }

    case 'CONFIRM_MILESTONES':
      return { ...state, review: { ...state.review, milestonesReviewed: true } }

    case 'CONFIRM_RIGHTS':
      return { ...state, review: { ...state.review, rightsReviewed: true } }

    case 'CONFIRM_ESCROW_AMOUNT':
      return { ...state, review: { ...state.review, escrowAmountConfirmed: true } }

    case 'CONFIRM_TERMS':
      return { ...state, review: { ...state.review, termsConfirmed: true } }

    case 'READY_FOR_FUNDING': {
      if (!isClosingReviewComplete(state)) return state
      return { ...state, phase: 'funding' }
    }

    // ── Funding (escrow capture) ──

    case 'INITIATE_ESCROW': {
      if (state.phase !== 'funding' || !state.assignment) return state
      const escrowAmountCents = computeEscrowAmountCents(state.assignment)
      return {
        ...state,
        funding: {
          id: action.payload.fundingId,
          assignmentId: state.assignment.id,
          status: 'awaiting_funding',
          escrowAmountCents,
          currency: 'EUR',
          stripePaymentIntentId: null,
          failureReason: null,
          initiatedAt: new Date().toISOString(),
          capturedAt: null,
        },
      }
    }

    case 'ESCROW_PROCESSING': {
      if (!state.funding || state.funding.status !== 'awaiting_funding') return state
      return {
        ...state,
        funding: { ...state.funding, status: 'escrow_processing' },
      }
    }

    case 'ESCROW_CAPTURED': {
      if (!state.funding || state.funding.status !== 'escrow_processing') return state
      return {
        ...state,
        funding: {
          ...state.funding,
          status: 'escrow_captured',
          stripePaymentIntentId: action.payload.stripePaymentIntentId,
          capturedAt: action.payload.capturedAt,
        },
      }
    }

    case 'ESCROW_FAILED': {
      if (!state.funding || state.funding.status !== 'escrow_processing') return state
      return {
        ...state,
        funding: {
          ...state.funding,
          status: 'escrow_failed',
          failureReason: action.payload.reason,
        },
      }
    }

    // ── Closing pipeline ──

    case 'START_CLOSING': {
      if (!state.funding || state.funding.status !== 'escrow_captured') return state
      return {
        ...state,
        phase: 'closing',
        closingStatus: 'closing',
        assignment: action.payload.updatedAssignment,
      }
    }

    case 'CLOSING_DOCUMENTS_GENERATING': {
      if (state.closingStatus !== 'closing') return state
      return { ...state, closingStatus: 'documents_generating' }
    }

    case 'CLOSING_AWAITING_SIGNATURES': {
      if (state.closingStatus !== 'documents_generating') return state
      return { ...state, closingStatus: 'awaiting_signatures' }
    }

    case 'CLOSING_WORK_AUTHORIZATION_PENDING': {
      if (state.closingStatus !== 'awaiting_signatures') return state
      return { ...state, closingStatus: 'work_authorization_pending' }
    }

    case 'CLOSING_ACTIVATED': {
      if (state.closingStatus !== 'work_authorization_pending') return state
      return {
        ...state,
        phase: 'activation',
        closingStatus: 'activated',
        assignment: action.payload.activatedAssignment,
        documentReadiness: action.payload.documentReadiness,
        signatureReadiness: action.payload.signatureReadiness,
        workAuthorization: action.payload.workAuthorization,
      }
    }

    case 'CLOSING_FAILED': {
      const failableStatuses: ClosingPipelineStatus[] = [
        'closing', 'documents_generating', 'awaiting_signatures', 'work_authorization_pending',
      ]
      if (!failableStatuses.includes(state.closingStatus)) return state
      return {
        ...state,
        closingStatus: 'closing_failed',
      }
    }

    default:
      return state
  }
}
