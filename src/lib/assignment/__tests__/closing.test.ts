/**
 * Assignment Closing Flow — Tests
 *
 * Covers: closing reducer, closing engine, types, and selectors.
 * Follows the same pattern as reducer.test.ts for the transaction flow.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  closingReducer,
  createInitialClosingState,
  isClosingReviewComplete,
  computeEscrowAmountCents,
  type AssignmentClosingAction,
} from '../closing-reducer'
import type { AssignmentClosingFlowState } from '../closing-types'
import {
  ASSIGNMENT_DOCUMENT_REGISTRY,
  type AssignmentDocumentTypeId,
} from '../closing-types'
import {
  buildAssignmentDocumentReadiness,
  buildAssignmentSignatureReadiness,
  buildWorkAuthorization,
} from '../closing'
import {
  makeAssignment,
  makeMilestone,
  makeAcceptedPendingEscrowAssignment,
} from './helpers'
import { PLATFORM_FEES } from '@/lib/types'

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function makeClosingState(overrides?: Partial<AssignmentClosingFlowState>): AssignmentClosingFlowState {
  const assignment = makeAcceptedPendingEscrowAssignment()
  return { ...createInitialClosingState(assignment), ...overrides }
}

function dispatch(state: AssignmentClosingFlowState, action: AssignmentClosingAction): AssignmentClosingFlowState {
  return closingReducer(state, action)
}

function confirmAll(state: AssignmentClosingFlowState): AssignmentClosingFlowState {
  let s = state
  s = dispatch(s, { type: 'CONFIRM_SCOPE' })
  s = dispatch(s, { type: 'CONFIRM_MILESTONES' })
  s = dispatch(s, { type: 'CONFIRM_RIGHTS' })
  s = dispatch(s, { type: 'CONFIRM_ESCROW_AMOUNT' })
  s = dispatch(s, { type: 'CONFIRM_TERMS' })
  return s
}

function fundAssignment(state: AssignmentClosingFlowState): AssignmentClosingFlowState {
  let s = confirmAll(state)
  s = dispatch(s, { type: 'READY_FOR_FUNDING' })
  s = dispatch(s, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-test-01' } })
  s = dispatch(s, { type: 'ESCROW_PROCESSING' })
  s = dispatch(s, { type: 'ESCROW_CAPTURED', payload: { stripePaymentIntentId: 'pi-test-01', capturedAt: '2026-04-13T10:00:00Z' } })
  return s
}

// ══════════════════════════════════════════════
// CLOSING REDUCER — REVIEW
// ══════════════════════════════════════════════

describe('Closing Reducer — Review Phase', () => {
  it('starts in review phase with all confirmations false', () => {
    const state = makeClosingState()
    expect(state.phase).toBe('review')
    expect(state.review.scopeReviewed).toBe(false)
    expect(state.review.milestonesReviewed).toBe(false)
    expect(state.review.rightsReviewed).toBe(false)
    expect(state.review.escrowAmountConfirmed).toBe(false)
    expect(state.review.termsConfirmed).toBe(false)
    expect(isClosingReviewComplete(state)).toBe(false)
  })

  it('CONFIRM_SCOPE sets scopeReviewed', () => {
    const state = dispatch(makeClosingState(), { type: 'CONFIRM_SCOPE' })
    expect(state.review.scopeReviewed).toBe(true)
    expect(isClosingReviewComplete(state)).toBe(false)
  })

  it('CONFIRM_MILESTONES sets milestonesReviewed', () => {
    const state = dispatch(makeClosingState(), { type: 'CONFIRM_MILESTONES' })
    expect(state.review.milestonesReviewed).toBe(true)
  })

  it('CONFIRM_RIGHTS sets rightsReviewed', () => {
    const state = dispatch(makeClosingState(), { type: 'CONFIRM_RIGHTS' })
    expect(state.review.rightsReviewed).toBe(true)
  })

  it('CONFIRM_ESCROW_AMOUNT sets escrowAmountConfirmed', () => {
    const state = dispatch(makeClosingState(), { type: 'CONFIRM_ESCROW_AMOUNT' })
    expect(state.review.escrowAmountConfirmed).toBe(true)
  })

  it('CONFIRM_TERMS sets termsConfirmed', () => {
    const state = dispatch(makeClosingState(), { type: 'CONFIRM_TERMS' })
    expect(state.review.termsConfirmed).toBe(true)
  })

  it('isClosingReviewComplete returns true only when all five confirmed', () => {
    const state = confirmAll(makeClosingState())
    expect(isClosingReviewComplete(state)).toBe(true)
  })

  it('READY_FOR_FUNDING transitions to funding phase when review is complete', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    expect(state.phase).toBe('funding')
  })

  it('READY_FOR_FUNDING is a no-op when review is incomplete', () => {
    let state = makeClosingState()
    state = dispatch(state, { type: 'CONFIRM_SCOPE' })
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    expect(state.phase).toBe('review')
  })
})

// ══════════════════════════════════════════════
// CLOSING REDUCER — FUNDING
// ══════════════════════════════════════════════

describe('Closing Reducer — Funding Phase', () => {
  it('INITIATE_ESCROW creates a funding record with correct amount', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    expect(state.funding).not.toBeNull()
    expect(state.funding!.id).toBe('fund-01')
    expect(state.funding!.status).toBe('awaiting_funding')
    expect(state.funding!.currency).toBe('EUR')
    // Escrow = milestone total + 10% markup
    const expected = computeEscrowAmountCents(state.assignment!)
    expect(state.funding!.escrowAmountCents).toBe(expected)
  })

  it('INITIATE_ESCROW is a no-op before funding phase', () => {
    const state = dispatch(makeClosingState(), { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    expect(state.funding).toBeNull()
  })

  it('ESCROW_PROCESSING transitions funding status', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    state = dispatch(state, { type: 'ESCROW_PROCESSING' })
    expect(state.funding!.status).toBe('escrow_processing')
  })

  it('ESCROW_CAPTURED records Stripe intent and capture time', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    state = dispatch(state, { type: 'ESCROW_PROCESSING' })
    state = dispatch(state, { type: 'ESCROW_CAPTURED', payload: { stripePaymentIntentId: 'pi_123', capturedAt: '2026-04-13T12:00:00Z' } })
    expect(state.funding!.status).toBe('escrow_captured')
    expect(state.funding!.stripePaymentIntentId).toBe('pi_123')
    expect(state.funding!.capturedAt).toBe('2026-04-13T12:00:00Z')
  })

  it('ESCROW_CAPTURED is a no-op if not in processing', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    // Skip ESCROW_PROCESSING
    state = dispatch(state, { type: 'ESCROW_CAPTURED', payload: { stripePaymentIntentId: 'pi_123', capturedAt: '2026-04-13T12:00:00Z' } })
    expect(state.funding!.status).toBe('awaiting_funding')
  })

  it('ESCROW_FAILED records failure reason', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    state = dispatch(state, { type: 'ESCROW_PROCESSING' })
    state = dispatch(state, { type: 'ESCROW_FAILED', payload: { reason: 'Card declined' } })
    expect(state.funding!.status).toBe('escrow_failed')
    expect(state.funding!.failureReason).toBe('Card declined')
  })
})

// ══════════════════════════════════════════════
// CLOSING REDUCER — PIPELINE
// ══════════════════════════════════════════════

describe('Closing Reducer — Closing Pipeline', () => {
  it('START_CLOSING transitions to closing phase when escrow is captured', () => {
    let state = fundAssignment(makeClosingState())
    const updatedAssignment = { ...state.assignment!, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const }
    state = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment } })
    expect(state.phase).toBe('closing')
    expect(state.closingStatus).toBe('closing')
    expect(state.assignment!.state).toBe('escrow_captured')
  })

  it('START_CLOSING is a no-op without captured escrow', () => {
    const state = makeClosingState()
    const updatedAssignment = state.assignment!
    const result = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment } })
    expect(result.phase).toBe('review')
  })

  it('pipeline transitions follow correct order', () => {
    let state = fundAssignment(makeClosingState())
    const a = state.assignment!
    const updatedAssignment = { ...a, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const }

    state = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment } })
    expect(state.closingStatus).toBe('closing')

    state = dispatch(state, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    expect(state.closingStatus).toBe('documents_generating')

    state = dispatch(state, { type: 'CLOSING_AWAITING_SIGNATURES' })
    expect(state.closingStatus).toBe('awaiting_signatures')

    state = dispatch(state, { type: 'CLOSING_WORK_AUTHORIZATION_PENDING' })
    expect(state.closingStatus).toBe('work_authorization_pending')
  })

  it('CLOSING_DOCUMENTS_GENERATING is a no-op if not in closing status', () => {
    const state = makeClosingState()
    const result = dispatch(state, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    expect(result.closingStatus).toBe('not_started')
  })

  it('CLOSING_AWAITING_SIGNATURES is a no-op if not in documents_generating', () => {
    let state = fundAssignment(makeClosingState())
    const a = state.assignment!
    state = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: { ...a, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const } } })
    // Skip CLOSING_DOCUMENTS_GENERATING
    state = dispatch(state, { type: 'CLOSING_AWAITING_SIGNATURES' })
    expect(state.closingStatus).toBe('closing')
  })

  it('CLOSING_ACTIVATED sets phase to activation with readiness data', () => {
    let state = fundAssignment(makeClosingState())
    const a = state.assignment!
    let updated = { ...a, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const }
    state = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    state = dispatch(state, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    state = dispatch(state, { type: 'CLOSING_AWAITING_SIGNATURES' })
    state = dispatch(state, { type: 'CLOSING_WORK_AUTHORIZATION_PENDING' })

    const docReadiness = buildAssignmentDocumentReadiness(a.id)
    const sigReadiness = buildAssignmentSignatureReadiness(a.id)
    const workAuth = buildWorkAuthorization(a)
    const activatedAssignment = { ...updated, state: 'in_progress' as const, subState: 'active' as const }

    state = dispatch(state, {
      type: 'CLOSING_ACTIVATED',
      payload: { documentReadiness: docReadiness, signatureReadiness: sigReadiness, workAuthorization: workAuth, activatedAssignment },
    })

    expect(state.phase).toBe('activation')
    expect(state.closingStatus).toBe('activated')
    expect(state.assignment!.state).toBe('in_progress')
    expect(state.assignment!.subState).toBe('active')
    expect(state.documentReadiness).not.toBeNull()
    expect(state.signatureReadiness).not.toBeNull()
    expect(state.workAuthorization).not.toBeNull()
  })

  it('CLOSING_FAILED sets closing_failed status from active pipeline state', () => {
    let state = fundAssignment(makeClosingState())
    const a = state.assignment!
    const updated = { ...a, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const }
    state = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    state = dispatch(state, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    state = dispatch(state, { type: 'CLOSING_FAILED', payload: { reason: 'Signature timeout' } })
    expect(state.closingStatus).toBe('closing_failed')
  })
})

// ══════════════════════════════════════════════
// CLOSING REDUCER — GUARDS
// ══════════════════════════════════════════════

describe('Closing Reducer — Guard Enforcement', () => {
  it('cannot skip from review to closing without funding', () => {
    const state = makeClosingState()
    const result = dispatch(state, {
      type: 'START_CLOSING',
      payload: { updatedAssignment: state.assignment! },
    })
    expect(result.phase).toBe('review')
  })

  it('cannot fund without completing review', () => {
    let state = makeClosingState()
    state = dispatch(state, { type: 'CONFIRM_SCOPE' })
    state = dispatch(state, { type: 'CONFIRM_MILESTONES' })
    // Missing rights, escrow, terms
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    expect(state.phase).toBe('review')
  })

  it('cannot initiate escrow in review phase', () => {
    const state = makeClosingState()
    const result = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    expect(result.funding).toBeNull()
  })
})

// ══════════════════════════════════════════════
// ESCROW AMOUNT COMPUTATION
// ══════════════════════════════════════════════

describe('computeEscrowAmountCents', () => {
  it('computes milestone total + PLATFORM_FEES markup', () => {
    const assignment = makeAssignment({
      milestones: [
        makeMilestone({ releasableAmountCents: 80000 }),
        makeMilestone({ id: 'ms-test-02', releasableAmountCents: 70000 }),
      ],
    })
    const result = computeEscrowAmountCents(assignment)
    const milestoneTotalCents = 80000 + 70000
    const markup = PLATFORM_FEES.commissioned.buyerMarkup
    const expected = milestoneTotalCents + Math.round(milestoneTotalCents * markup)
    expect(result).toBe(expected)
    expect(result).toBe(165000)
  })

  it('returns 0 for assignment with no milestones', () => {
    const assignment = makeAssignment({ milestones: [] })
    expect(computeEscrowAmountCents(assignment)).toBe(0)
  })
})

// ══════════════════════════════════════════════
// CLOSING ENGINE — DOCUMENT READINESS
// ══════════════════════════════════════════════

describe('buildAssignmentDocumentReadiness', () => {
  it('produces documents matching ASSIGNMENT_DOCUMENT_REGISTRY', () => {
    const result = buildAssignmentDocumentReadiness('asgn-test-01')
    expect(result.documents).toHaveLength(ASSIGNMENT_DOCUMENT_REGISTRY.length)
    expect(result.documents).toHaveLength(4)
  })

  it('marks all documents as finalized', () => {
    const result = buildAssignmentDocumentReadiness('asgn-test-01')
    for (const doc of result.documents) {
      expect(doc.status).toBe('finalized')
    }
  })

  it('overall status is ready when all finalized', () => {
    const result = buildAssignmentDocumentReadiness('asgn-test-01')
    expect(result.overallStatus).toBe('ready')
  })

  it('signable documents have ready signature status', () => {
    const result = buildAssignmentDocumentReadiness('asgn-test-01')
    const signableDocs = result.documents.filter(d => d.signable)
    expect(signableDocs.length).toBe(2) // assignment_agreement + rights_schedule
    for (const doc of signableDocs) {
      expect(doc.signatureStatus).toBe('ready')
    }
  })

  it('non-signable documents have null signature status', () => {
    const result = buildAssignmentDocumentReadiness('asgn-test-01')
    const nonSignableDocs = result.documents.filter(d => !d.signable)
    expect(nonSignableDocs.length).toBe(2) // escrow_confirmation + milestone_schedule
    for (const doc of nonSignableDocs) {
      expect(doc.signatureStatus).toBeNull()
    }
  })

  it('document type IDs are canonical', () => {
    const result = buildAssignmentDocumentReadiness('asgn-test-01')
    const expectedIds: AssignmentDocumentTypeId[] = [
      'assignment_agreement',
      'rights_schedule',
      'escrow_confirmation',
      'milestone_schedule',
    ]
    const actualIds = result.documents.map(d => d.documentTypeId)
    expect(actualIds).toEqual(expectedIds)
  })
})

// ══════════════════════════════════════════════
// CLOSING ENGINE — SIGNATURE READINESS
// ══════════════════════════════════════════════

describe('buildAssignmentSignatureReadiness', () => {
  it('requires 6 signatures (2 signable docs × 3 parties)', () => {
    const result = buildAssignmentSignatureReadiness('asgn-test-01')
    expect(result.totalRequired).toBe(6)
    expect(result.totalSigned).toBe(6)
    expect(result.totalPending).toBe(0)
  })

  it('overall status is ready', () => {
    const result = buildAssignmentSignatureReadiness('asgn-test-01')
    expect(result.overallStatus).toBe('ready')
  })
})

// ══════════════════════════════════════════════
// CLOSING ENGINE — WORK AUTHORIZATION
// ══════════════════════════════════════════════

describe('buildWorkAuthorization', () => {
  it('activates the first pending milestone', () => {
    const assignment = makeAssignment({
      milestones: [
        makeMilestone({ id: 'ms-01', state: 'pending' }),
        makeMilestone({ id: 'ms-02', state: 'pending' }),
      ],
    })
    const result = buildWorkAuthorization(assignment)
    expect(result.activatedMilestoneIds).toEqual(['ms-01'])
  })

  it('returns empty array if no pending milestones', () => {
    const assignment = makeAssignment({
      milestones: [
        makeMilestone({ id: 'ms-01', state: 'active' }),
      ],
    })
    const result = buildWorkAuthorization(assignment)
    expect(result.activatedMilestoneIds).toEqual([])
  })

  it('status is authorized', () => {
    const assignment = makeAssignment()
    const result = buildWorkAuthorization(assignment)
    expect(result.status).toBe('authorized')
    expect(result.authorizedAt).not.toBeNull()
  })

  it('references signable contract documents', () => {
    const assignment = makeAssignment()
    const result = buildWorkAuthorization(assignment)
    expect(result.contractDocumentIds).toContain('assignment_agreement')
    expect(result.contractDocumentIds).toContain('rights_schedule')
    expect(result.contractDocumentIds).not.toContain('escrow_confirmation')
    expect(result.contractDocumentIds).not.toContain('milestone_schedule')
  })
})

// ══════════════════════════════════════════════
// DOCUMENT REGISTRY
// ══════════════════════════════════════════════

describe('ASSIGNMENT_DOCUMENT_REGISTRY', () => {
  it('contains exactly 4 document types', () => {
    expect(ASSIGNMENT_DOCUMENT_REGISTRY).toHaveLength(4)
  })

  it('has unique IDs', () => {
    const ids = ASSIGNMENT_DOCUMENT_REGISTRY.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has sequential display order', () => {
    const orders = ASSIGNMENT_DOCUMENT_REGISTRY.map(d => d.displayOrder)
    expect(orders).toEqual([1, 2, 3, 4])
  })

  it('assignment_agreement and rights_schedule are signable', () => {
    const signable = ASSIGNMENT_DOCUMENT_REGISTRY.filter(d => d.signable)
    expect(signable.map(d => d.id)).toEqual(['assignment_agreement', 'rights_schedule'])
  })

  it('all documents are in buyer pack', () => {
    for (const doc of ASSIGNMENT_DOCUMENT_REGISTRY) {
      expect(doc.inBuyerPack).toBe(true)
    }
  })

  it('escrow_confirmation is not in creator pack', () => {
    const escrow = ASSIGNMENT_DOCUMENT_REGISTRY.find(d => d.id === 'escrow_confirmation')!
    expect(escrow.inCreatorPack).toBe(false)
  })
})

// ══════════════════════════════════════════════
// LOAD_CLOSING_ASSIGNMENT
// ══════════════════════════════════════════════

describe('LOAD_CLOSING_ASSIGNMENT', () => {
  it('resets all state and sets new assignment', () => {
    let state = fundAssignment(makeClosingState())
    const newAssignment = makeAcceptedPendingEscrowAssignment()
    state = dispatch(state, { type: 'LOAD_CLOSING_ASSIGNMENT', payload: { assignment: newAssignment } })
    expect(state.phase).toBe('review')
    expect(state.funding).toBeNull()
    expect(state.closingStatus).toBe('not_started')
    expect(state.review.scopeReviewed).toBe(false)
    expect(state.assignment!.id).toBe(newAssignment.id)
  })
})

// ══════════════════════════════════════════════
// REGRESSION GUARDS — Terminal State Protection
// ══════════════════════════════════════════════

describe('Funding Terminal State Protection', () => {
  it('ESCROW_FAILED is a no-op when escrow is already captured', () => {
    const state = fundAssignment(makeClosingState())
    expect(state.funding!.status).toBe('escrow_captured')
    const result = dispatch(state, { type: 'ESCROW_FAILED', payload: { reason: 'Late failure event' } })
    expect(result.funding!.status).toBe('escrow_captured')
    expect(result.funding!.failureReason).toBeNull()
  })

  it('ESCROW_PROCESSING is a no-op when escrow is already captured', () => {
    const state = fundAssignment(makeClosingState())
    expect(state.funding!.status).toBe('escrow_captured')
    const result = dispatch(state, { type: 'ESCROW_PROCESSING' })
    expect(result.funding!.status).toBe('escrow_captured')
  })

  it('ESCROW_FAILED is a no-op when escrow is in awaiting_funding', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    expect(state.funding!.status).toBe('awaiting_funding')
    const result = dispatch(state, { type: 'ESCROW_FAILED', payload: { reason: 'Premature failure' } })
    expect(result.funding!.status).toBe('awaiting_funding')
  })

  it('ESCROW_PROCESSING is a no-op when escrow has already failed', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    state = dispatch(state, { type: 'ESCROW_PROCESSING' })
    state = dispatch(state, { type: 'ESCROW_FAILED', payload: { reason: 'Card declined' } })
    expect(state.funding!.status).toBe('escrow_failed')
    const result = dispatch(state, { type: 'ESCROW_PROCESSING' })
    expect(result.funding!.status).toBe('escrow_failed')
  })

  it('double INITIATE_ESCROW overwrites funding record only in funding phase', () => {
    let state = confirmAll(makeClosingState())
    state = dispatch(state, { type: 'READY_FOR_FUNDING' })
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-01' } })
    expect(state.funding!.id).toBe('fund-01')
    state = dispatch(state, { type: 'INITIATE_ESCROW', payload: { fundingId: 'fund-02' } })
    expect(state.funding!.id).toBe('fund-02')
  })
})

describe('Closing Pipeline Terminal State Protection', () => {
  function makeActivatedState(): AssignmentClosingFlowState {
    let state = fundAssignment(makeClosingState())
    const a = state.assignment!
    const updated = { ...a, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const }
    state = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    state = dispatch(state, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    state = dispatch(state, { type: 'CLOSING_AWAITING_SIGNATURES' })
    state = dispatch(state, { type: 'CLOSING_WORK_AUTHORIZATION_PENDING' })

    const docReadiness = buildAssignmentDocumentReadiness(a.id)
    const sigReadiness = buildAssignmentSignatureReadiness(a.id)
    const workAuth = buildWorkAuthorization(a)
    const activatedAssignment = { ...updated, state: 'in_progress' as const, subState: 'active' as const }

    state = dispatch(state, {
      type: 'CLOSING_ACTIVATED',
      payload: { documentReadiness: docReadiness, signatureReadiness: sigReadiness, workAuthorization: workAuth, activatedAssignment },
    })
    return state
  }

  it('CLOSING_FAILED is a no-op when pipeline is activated', () => {
    const state = makeActivatedState()
    expect(state.closingStatus).toBe('activated')
    const result = dispatch(state, { type: 'CLOSING_FAILED', payload: { reason: 'Late failure' } })
    expect(result.closingStatus).toBe('activated')
  })

  it('CLOSING_FAILED is a no-op when pipeline has not started', () => {
    const state = makeClosingState()
    expect(state.closingStatus).toBe('not_started')
    const result = dispatch(state, { type: 'CLOSING_FAILED', payload: { reason: 'No pipeline to fail' } })
    expect(result.closingStatus).toBe('not_started')
  })

  it('CLOSING_FAILED is a no-op when pipeline already failed', () => {
    let state = fundAssignment(makeClosingState())
    const a = state.assignment!
    const updated = { ...a, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const }
    state = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    state = dispatch(state, { type: 'CLOSING_FAILED', payload: { reason: 'First failure' } })
    expect(state.closingStatus).toBe('closing_failed')
    const result = dispatch(state, { type: 'CLOSING_FAILED', payload: { reason: 'Second failure' } })
    expect(result.closingStatus).toBe('closing_failed')
  })

  it('CLOSING_FAILED works from each active pipeline status', () => {
    let state = fundAssignment(makeClosingState())
    const a = state.assignment!
    const updated = { ...a, state: 'escrow_captured' as const, subState: 'accepted_pending_escrow' as const }

    // From 'closing'
    let s = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    expect(dispatch(s, { type: 'CLOSING_FAILED', payload: { reason: 'fail' } }).closingStatus).toBe('closing_failed')

    // From 'documents_generating'
    s = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    s = dispatch(s, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    expect(dispatch(s, { type: 'CLOSING_FAILED', payload: { reason: 'fail' } }).closingStatus).toBe('closing_failed')

    // From 'awaiting_signatures'
    s = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    s = dispatch(s, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    s = dispatch(s, { type: 'CLOSING_AWAITING_SIGNATURES' })
    expect(dispatch(s, { type: 'CLOSING_FAILED', payload: { reason: 'fail' } }).closingStatus).toBe('closing_failed')

    // From 'work_authorization_pending'
    s = dispatch(state, { type: 'START_CLOSING', payload: { updatedAssignment: updated } })
    s = dispatch(s, { type: 'CLOSING_DOCUMENTS_GENERATING' })
    s = dispatch(s, { type: 'CLOSING_AWAITING_SIGNATURES' })
    s = dispatch(s, { type: 'CLOSING_WORK_AUTHORIZATION_PENDING' })
    expect(dispatch(s, { type: 'CLOSING_FAILED', payload: { reason: 'fail' } }).closingStatus).toBe('closing_failed')
  })

  it('activated state rejects all regressive pipeline transitions', () => {
    const state = makeActivatedState()
    expect(state.phase).toBe('activation')
    expect(state.closingStatus).toBe('activated')

    // None of these should change the state
    expect(dispatch(state, { type: 'CLOSING_DOCUMENTS_GENERATING' }).closingStatus).toBe('activated')
    expect(dispatch(state, { type: 'CLOSING_AWAITING_SIGNATURES' }).closingStatus).toBe('activated')
    expect(dispatch(state, { type: 'CLOSING_WORK_AUTHORIZATION_PENDING' }).closingStatus).toBe('activated')
    expect(dispatch(state, { type: 'CLOSING_FAILED', payload: { reason: 'nope' } }).closingStatus).toBe('activated')
  })
})

// ══════════════════════════════════════════════
// ESCROW AMOUNT — PLATFORM_FEES INTEGRATION
// ══════════════════════════════════════════════

describe('computeEscrowAmountCents — PLATFORM_FEES integration', () => {
  it('uses PLATFORM_FEES.commissioned.buyerMarkup rate', () => {
    const assignment = makeAssignment({
      milestones: [makeMilestone({ releasableAmountCents: 100000 })],
    })
    const result = computeEscrowAmountCents(assignment)
    const expected = 100000 + Math.round(100000 * PLATFORM_FEES.commissioned.buyerMarkup)
    expect(result).toBe(expected)
  })
})
