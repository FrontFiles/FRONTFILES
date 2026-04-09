import { describe, it, expect } from 'vitest'
import { assignmentReducer, initialAssignmentEngineState } from '../reducer'
import { materialAssignment, serviceAssignment, hybridAssignment } from '../mock-data'
import type { AssignmentEngineState } from '../types'
import type { FulfilmentSubmission, ReviewDetermination } from '@/lib/types'

function loadAssignment(assignment: typeof materialAssignment): AssignmentEngineState {
  return assignmentReducer(initialAssignmentEngineState, {
    type: 'LOAD_ASSIGNMENT',
    assignment,
  })
}

describe('Assignment Reducer', () => {
  describe('LOAD_ASSIGNMENT', () => {
    it('loads assignment into state', () => {
      const state = loadAssignment(materialAssignment)
      expect(state.assignment).not.toBeNull()
      expect(state.assignment!.id).toBe('asgn-mat-001')
      expect(state.assignment!.assignmentClass).toBe('material')
    })

    it('auto-expands active and submitted milestones', () => {
      const state = loadAssignment(materialAssignment)
      // milestone 2 is fulfilment_submitted, should be expanded
      expect(state.ui.expandedMilestoneIds.has('ms-mat-001-2')).toBe(true)
    })
  })

  describe('ACCEPT_ASSIGNMENT', () => {
    it('transitions from brief_issued to accepted_pending_escrow', () => {
      const draft = {
        ...materialAssignment,
        state: 'brief_issued' as const,
        subState: 'draft' as const,
      }
      let state = loadAssignment(draft)
      state = assignmentReducer(state, { type: 'ACCEPT_ASSIGNMENT' })
      expect(state.assignment!.subState).toBe('accepted_pending_escrow')
      expect(state.assignment!.acceptedAt).not.toBeNull()
    })

    it('does not accept if already in_progress', () => {
      const state = loadAssignment(serviceAssignment) // in_progress
      const next = assignmentReducer(state, { type: 'ACCEPT_ASSIGNMENT' })
      expect(next).toBe(state) // no change
    })
  })

  describe('ESCROW_CAPTURED', () => {
    it('transitions to in_progress and activates first milestone', () => {
      const pending = {
        ...materialAssignment,
        state: 'brief_issued' as const,
        subState: 'accepted_pending_escrow' as const,
        milestones: materialAssignment.milestones.map(m => ({ ...m, state: 'pending' as const })),
      }
      let state = loadAssignment(pending)
      state = assignmentReducer(state, {
        type: 'ESCROW_CAPTURED',
        stripePaymentIntentId: 'pi_test_123',
        capturedAt: '2026-04-02T08:00:00Z',
      })
      expect(state.assignment!.state).toBe('in_progress')
      expect(state.assignment!.subState).toBe('active')
      expect(state.assignment!.escrow.stripePaymentIntentId).toBe('pi_test_123')
      expect(state.assignment!.milestones[0].state).toBe('active')
      expect(state.assignment!.milestones[1].state).toBe('pending')
    })
  })

  describe('SUBMIT_FULFILMENT', () => {
    it('transitions milestone to fulfilment_submitted', () => {
      let state = loadAssignment(serviceAssignment)
      const submission: FulfilmentSubmission = {
        id: 'fs-test-1',
        milestoneId: 'ms-svc-001-2',
        fulfilmentType: 'service',
        evidenceItems: [],
        creatorNotes: 'Test submission',
        submittedAt: new Date().toISOString(),
      }
      state = assignmentReducer(state, {
        type: 'SUBMIT_FULFILMENT',
        milestoneId: 'ms-svc-001-2',
        submission,
      })
      const ms = state.assignment!.milestones.find(m => m.id === 'ms-svc-001-2')
      expect(ms!.state).toBe('fulfilment_submitted')
      expect(ms!.fulfilmentSubmissions).toHaveLength(1)
      expect(state.assignment!.state).toBe('delivered')
    })
  })

  describe('RECORD_REVIEW', () => {
    it('accepted determination releases milestone and updates escrow', () => {
      let state = loadAssignment(materialAssignment)
      state = assignmentReducer(state, {
        type: 'RECORD_REVIEW',
        milestoneId: 'ms-mat-001-2',
        determination: 'accepted',
        reviewerId: 'buyer-reuters-01',
        reviewerRole: 'content_commit_holder',
        notes: 'Meets criteria.',
      })
      const ms = state.assignment!.milestones.find(m => m.id === 'ms-mat-001-2')
      expect(ms!.state).toBe('accepted')
      expect(ms!.reviewDetermination).not.toBeNull()
      // Both milestones accepted → confirmed
      expect(state.assignment!.state).toBe('confirmed')
      expect(state.assignment!.subState).toBe('settlement_queued')
      // Escrow updated: previously 120000 released, now + 130000
      expect(state.assignment!.escrow.totalReleasedCents).toBe(120000 + 130000)
    })

    it('changes_requested keeps delivered state', () => {
      let state = loadAssignment(materialAssignment)
      state = assignmentReducer(state, {
        type: 'RECORD_REVIEW',
        milestoneId: 'ms-mat-001-2',
        determination: 'changes_requested',
        reviewerId: 'buyer-reuters-01',
        reviewerRole: 'editor',
        notes: 'Need more recovery narrative images.',
      })
      expect(state.assignment!.state).toBe('delivered')
      expect(state.assignment!.subState).toBe('changes_requested')
    })

    it('dispute_opened freezes contested amount', () => {
      let state = loadAssignment(materialAssignment)
      state = assignmentReducer(state, {
        type: 'RECORD_REVIEW',
        milestoneId: 'ms-mat-001-2',
        determination: 'dispute_opened',
        reviewerId: 'buyer-reuters-01',
        reviewerRole: 'content_commit_holder',
        notes: 'Images do not match brief scope.',
      })
      expect(state.assignment!.state).toBe('disputed')
      expect(state.assignment!.escrow.totalFrozenCents).toBe(130000)
    })

    it('accepted_partial releases partial amount', () => {
      let state = loadAssignment(materialAssignment)
      state = assignmentReducer(state, {
        type: 'RECORD_REVIEW',
        milestoneId: 'ms-mat-001-2',
        determination: 'accepted_partial',
        reviewerId: 'buyer-reuters-01',
        reviewerRole: 'content_commit_holder',
        notes: '3 of 13 images accepted.',
        acceptedAmountCents: 30000,
      })
      const ms = state.assignment!.milestones.find(m => m.id === 'ms-mat-001-2')
      expect(ms!.state).toBe('accepted_partial')
      expect(state.assignment!.escrow.totalReleasedCents).toBe(120000 + 30000)
    })
  })

  describe('CCR', () => {
    it('submitting CCR sets sub-state to ccr_pending', () => {
      let state = loadAssignment(serviceAssignment)
      state = assignmentReducer(state, {
        type: 'SUBMIT_CCR',
        ccr: {
          id: 'ccr-test-1',
          assignmentId: 'asgn-svc-001',
          requesterId: 'creator-dimitris-01',
          state: 'pending',
          amendedFields: [{ field: 'deadline', currentValue: '2026-04-25', proposedValue: '2026-04-30' }],
          rationale: 'Need extra time for field day 5.',
          responseDeadline: '2026-04-20T23:59:00Z',
          respondedAt: null,
          responseNote: null,
          createdAt: new Date().toISOString(),
        },
      })
      expect(state.assignment!.subState).toBe('ccr_pending')
      expect(state.assignment!.ccrHistory).toHaveLength(1)
    })

    it('approving CCR clears ccr_pending', () => {
      let state = loadAssignment(hybridAssignment) // has pending CCR
      state = assignmentReducer(state, {
        type: 'RESPOND_CCR',
        ccrId: 'ccr-hyb-001-1',
        approved: true,
        responseNote: 'Approved. Extended deadline accepted.',
      })
      const ccr = state.assignment!.ccrHistory.find(c => c.id === 'ccr-hyb-001-1')
      expect(ccr!.state).toBe('approved')
      expect(ccr!.respondedAt).not.toBeNull()
      expect(state.assignment!.subState).toBe('active')
    })

    it('auto-denying CCR sets auto_denied state', () => {
      let state = loadAssignment(hybridAssignment)
      state = assignmentReducer(state, {
        type: 'AUTO_DENY_CCR',
        ccrId: 'ccr-hyb-001-1',
      })
      const ccr = state.assignment!.ccrHistory.find(c => c.id === 'ccr-hyb-001-1')
      expect(ccr!.state).toBe('auto_denied')
    })
  })

  describe('CANCEL_ASSIGNMENT', () => {
    it('cancels active assignment and non-completed milestones', () => {
      let state = loadAssignment(serviceAssignment)
      state = assignmentReducer(state, { type: 'CANCEL_ASSIGNMENT', reason: 'Trip cancelled.' })
      expect(state.assignment!.state).toBe('cancelled')
      expect(state.assignment!.subState).toBe('closed')
      expect(state.assignment!.milestones.filter(m => m.state === 'cancelled')).toHaveLength(2) // active + pending
      // accepted milestone stays accepted
      expect(state.assignment!.milestones[0].state).toBe('accepted')
    })

    it('does not cancel already confirmed assignment', () => {
      const confirmed = { ...materialAssignment, state: 'confirmed' as const, subState: 'closed' as const }
      const state = loadAssignment(confirmed)
      const next = assignmentReducer(state, { type: 'CANCEL_ASSIGNMENT', reason: 'Test' })
      expect(next.assignment!.state).toBe('confirmed') // unchanged
    })
  })

  describe('PROVISIONAL_RELEASE', () => {
    it('marks eligible and executes release', () => {
      let state = loadAssignment(materialAssignment)
      state = assignmentReducer(state, {
        type: 'MARK_PROVISIONAL_RELEASE_ELIGIBLE',
        milestoneId: 'ms-mat-001-2',
      })
      expect(state.assignment!.subState).toBe('provisional_release_eligible')

      state = assignmentReducer(state, {
        type: 'EXECUTE_PROVISIONAL_RELEASE',
        milestoneId: 'ms-mat-001-2',
      })
      expect(state.assignment!.state).toBe('confirmed')
      expect(state.assignment!.subState).toBe('provisional_release_executed')
      const ms = state.assignment!.milestones.find(m => m.id === 'ms-mat-001-2')
      expect(ms!.state).toBe('accepted')
    })
  })
})
