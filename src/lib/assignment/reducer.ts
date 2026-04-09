/**
 * Assignment Engine — Reducer
 *
 * Deterministic state machine for Assignment lifecycle.
 * All mutations through dispatched actions.
 * System boundary: Assignment Engine owns assignment state.
 * Stripe is authoritative for escrow; this mirrors.
 */

import type { AssignmentEngineState, AssignmentAction } from './types'
import type {
  Milestone,
  MilestoneState,
  AssignmentState,
  AssignmentSubState,
  ReviewRecord,
} from '@/lib/types'

// ══════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════

export const initialAssignmentUIState: AssignmentEngineState['ui'] = {
  activeTab: 'overview',
  selectedMilestoneId: null,
  expandedMilestoneIds: new Set(),
  showCCRForm: false,
  showFulfilmentForm: false,
  fulfilmentDraftMilestoneId: null,
  reviewingMilestoneId: null,
}

export const initialAssignmentEngineState: AssignmentEngineState = {
  assignment: null,
  ui: initialAssignmentUIState,
}

// ══════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════

export function assignmentReducer(
  state: AssignmentEngineState,
  action: AssignmentAction,
): AssignmentEngineState {
  switch (action.type) {
    // ── Lifecycle ──

    case 'LOAD_ASSIGNMENT':
      return {
        ...state,
        assignment: action.assignment,
        ui: {
          ...initialAssignmentUIState,
          expandedMilestoneIds: new Set(
            action.assignment.milestones
              .filter(m => m.state === 'active' || m.state === 'fulfilment_submitted' || m.state === 'review_open')
              .map(m => m.id)
          ),
        },
      }

    case 'ACCEPT_ASSIGNMENT': {
      if (!state.assignment || state.assignment.state !== 'brief_issued') return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          state: 'brief_issued',
          subState: 'accepted_pending_escrow',
          acceptedAt: new Date().toISOString(),
        },
      }
    }

    case 'ESCROW_CAPTURED': {
      if (!state.assignment) return state
      if (state.assignment.subState !== 'accepted_pending_escrow') return state
      const firstMilestone = state.assignment.milestones[0]
      return {
        ...state,
        assignment: {
          ...state.assignment,
          state: 'in_progress',
          subState: 'active',
          escrow: {
            ...state.assignment.escrow,
            stripePaymentIntentId: action.stripePaymentIntentId,
            capturedAt: action.capturedAt,
          },
          milestones: state.assignment.milestones.map((m, i) =>
            i === 0 ? { ...m, state: 'active' as MilestoneState } : m
          ),
        },
      }
    }

    case 'CANCEL_ASSIGNMENT': {
      if (!state.assignment) return state
      const nonCancellable: AssignmentState[] = ['confirmed', 'cancelled']
      if (nonCancellable.includes(state.assignment.state)) return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          state: 'cancelled',
          subState: 'closed',
          cancelledAt: new Date().toISOString(),
          milestones: state.assignment.milestones.map(m =>
            m.state === 'accepted' || m.state === 'cancelled'
              ? m
              : { ...m, state: 'cancelled' as MilestoneState }
          ),
        },
      }
    }

    // ── Milestone ──

    case 'ACTIVATE_MILESTONE': {
      if (!state.assignment) return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          milestones: state.assignment.milestones.map(m =>
            m.id === action.milestoneId && m.state === 'pending'
              ? { ...m, state: 'active' as MilestoneState }
              : m
          ),
        },
      }
    }

    // ── Fulfilment ──

    case 'SUBMIT_FULFILMENT': {
      if (!state.assignment) return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          state: 'delivered',
          subState: 'fulfilment_submitted',
          milestones: state.assignment.milestones.map(m =>
            m.id === action.milestoneId
              ? {
                  ...m,
                  state: 'fulfilment_submitted' as MilestoneState,
                  fulfilmentSubmissions: [...m.fulfilmentSubmissions, action.submission],
                }
              : m
          ),
        },
        ui: {
          ...state.ui,
          showFulfilmentForm: false,
          fulfilmentDraftMilestoneId: null,
        },
      }
    }

    // ── Review ──

    case 'RECORD_REVIEW': {
      if (!state.assignment) return state
      const review: ReviewRecord = {
        id: `rev-${Date.now()}`,
        milestoneId: action.milestoneId,
        reviewerId: action.reviewerId,
        reviewerRole: action.reviewerRole,
        determination: action.determination,
        acceptedAmountCents: action.acceptedAmountCents ?? null,
        notes: action.notes,
        evidenceBasis: 'Fulfilment submission evidence reviewed against milestone acceptance criteria.',
        createdAt: new Date().toISOString(),
      }

      const milestoneStateFromDetermination: Record<string, MilestoneState> = {
        accepted: 'accepted',
        accepted_partial: 'accepted_partial',
        changes_requested: 'changes_requested',
        rejected: 'rejected',
        dispute_opened: 'disputed',
      }

      const updatedMilestones = state.assignment.milestones.map(m =>
        m.id === action.milestoneId
          ? {
              ...m,
              state: milestoneStateFromDetermination[action.determination] ?? m.state,
              reviewDetermination: review,
              completedAt: action.determination === 'accepted' ? new Date().toISOString() : m.completedAt,
            }
          : m
      )

      // Derive parent state from milestone states
      const allAccepted = updatedMilestones.every(m => m.state === 'accepted' || m.state === 'accepted_partial' || m.state === 'cancelled')
      const anyDisputed = updatedMilestones.some(m => m.state === 'disputed')
      const anyChangesRequested = updatedMilestones.some(m => m.state === 'changes_requested')

      let newState: AssignmentState = state.assignment.state
      let newSubState: AssignmentSubState = state.assignment.subState

      if (anyDisputed) {
        newState = 'disputed'
        newSubState = 'fulfilment_submitted'
      } else if (allAccepted) {
        newState = 'confirmed'
        newSubState = 'settlement_queued'
      } else if (anyChangesRequested) {
        newState = 'delivered'
        newSubState = 'changes_requested'
      } else {
        newState = 'delivered'
        newSubState = 'review_open'
      }

      // Update escrow mirror on release
      let escrow = { ...state.assignment.escrow }
      if (action.determination === 'accepted') {
        const milestone = state.assignment.milestones.find(m => m.id === action.milestoneId)
        if (milestone) {
          escrow.totalReleasedCents += milestone.releasableAmountCents
        }
      } else if (action.determination === 'accepted_partial' && action.acceptedAmountCents) {
        escrow.totalReleasedCents += action.acceptedAmountCents
      } else if (action.determination === 'dispute_opened') {
        const milestone = state.assignment.milestones.find(m => m.id === action.milestoneId)
        if (milestone) {
          escrow.totalFrozenCents += milestone.releasableAmountCents
        }
      }

      return {
        ...state,
        assignment: {
          ...state.assignment,
          state: newState,
          subState: newSubState,
          milestones: updatedMilestones,
          escrow,
          completedAt: allAccepted ? new Date().toISOString() : state.assignment.completedAt,
        },
        ui: { ...state.ui, reviewingMilestoneId: null },
      }
    }

    // ── CCR ──

    case 'SUBMIT_CCR': {
      if (!state.assignment) return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          subState: 'ccr_pending',
          ccrHistory: [...state.assignment.ccrHistory, action.ccr],
        },
        ui: { ...state.ui, showCCRForm: false },
      }
    }

    case 'RESPOND_CCR': {
      if (!state.assignment) return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          subState: state.assignment.state === 'in_progress' ? 'active' : state.assignment.subState,
          ccrHistory: state.assignment.ccrHistory.map(ccr =>
            ccr.id === action.ccrId
              ? {
                  ...ccr,
                  state: action.approved ? 'approved' as const : 'denied' as const,
                  respondedAt: new Date().toISOString(),
                  responseNote: action.responseNote,
                }
              : ccr
          ),
        },
      }
    }

    case 'AUTO_DENY_CCR': {
      if (!state.assignment) return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          subState: state.assignment.state === 'in_progress' ? 'active' : state.assignment.subState,
          ccrHistory: state.assignment.ccrHistory.map(ccr =>
            ccr.id === action.ccrId
              ? { ...ccr, state: 'auto_denied' as const, respondedAt: new Date().toISOString() }
              : ccr
          ),
        },
      }
    }

    // ── Provisional Release ──

    case 'MARK_PROVISIONAL_RELEASE_ELIGIBLE': {
      if (!state.assignment || state.assignment.state !== 'delivered') return state
      return {
        ...state,
        assignment: {
          ...state.assignment,
          subState: 'provisional_release_eligible',
        },
      }
    }

    case 'EXECUTE_PROVISIONAL_RELEASE': {
      if (!state.assignment || state.assignment.subState !== 'provisional_release_eligible') return state
      const milestone = state.assignment.milestones.find(m => m.id === action.milestoneId)
      return {
        ...state,
        assignment: {
          ...state.assignment,
          state: 'confirmed',
          subState: 'provisional_release_executed',
          escrow: {
            ...state.assignment.escrow,
            totalReleasedCents: state.assignment.escrow.totalReleasedCents + (milestone?.releasableAmountCents ?? 0),
          },
          milestones: state.assignment.milestones.map(m =>
            m.id === action.milestoneId
              ? { ...m, state: 'accepted' as MilestoneState, completedAt: new Date().toISOString() }
              : m
          ),
        },
      }
    }

    // ── Settlement ──

    case 'SETTLEMENT_QUEUED': {
      if (!state.assignment) return state
      return {
        ...state,
        assignment: { ...state.assignment, subState: 'settlement_queued' },
      }
    }

    case 'SETTLEMENT_COMPLETE': {
      if (!state.assignment) return state
      return {
        ...state,
        assignment: { ...state.assignment, subState: 'closed' },
      }
    }

    // ── UI ──

    case 'SET_TAB':
      return { ...state, ui: { ...state.ui, activeTab: action.tab } }

    case 'SELECT_MILESTONE':
      return { ...state, ui: { ...state.ui, selectedMilestoneId: action.milestoneId } }

    case 'TOGGLE_MILESTONE_EXPANDED': {
      const expanded = new Set(state.ui.expandedMilestoneIds)
      if (expanded.has(action.milestoneId)) expanded.delete(action.milestoneId)
      else expanded.add(action.milestoneId)
      return { ...state, ui: { ...state.ui, expandedMilestoneIds: expanded } }
    }

    case 'SHOW_CCR_FORM':
      return { ...state, ui: { ...state.ui, showCCRForm: action.show } }

    case 'SHOW_FULFILMENT_FORM':
      return {
        ...state,
        ui: {
          ...state.ui,
          showFulfilmentForm: action.milestoneId !== null,
          fulfilmentDraftMilestoneId: action.milestoneId,
        },
      }

    case 'SET_REVIEWING_MILESTONE':
      return { ...state, ui: { ...state.ui, reviewingMilestoneId: action.milestoneId } }

    default:
      return state
  }
}
