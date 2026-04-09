import { describe, it, expect, beforeEach } from 'vitest'
import {
  issueAssignmentBrief,
  acceptAssignment,
  syncEscrowCaptureFromStripe,
  activateNextMilestone,
  createAssignmentPlan,
  addMilestone,
  amendMilestone,
  submitFulfilment,
  validateFulfilmentSubmission,
  openReviewWindow,
  determineReviewOutcome,
  requestCommissionChange,
  approveCommissionChange,
  rejectCommissionChange,
  autoDenyExpiredCCR,
  openAssignmentDispute,
  evaluateProvisionalReleaseEligibility,
  executeProvisionalRelease,
  queueCreatorSettlement,
  syncStripeReleaseState,
  cancelAssignment,
} from '../services'
import type { IssueBriefInput } from '../services'
import { _clearEventBuffer, getAssignmentEvents } from '../events'
import { AssignmentError } from '../errors'
import { materialAssignment, serviceAssignment, hybridAssignment } from '../mock-data'
import type { Assignment, FulfilmentSubmission, AssignmentPlan } from '@/lib/types'

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

const BUYER_ID = 'buyer-test-01'
const CREATOR_ID = 'creator-test-01'
const OUTSIDER_ID = 'outsider-test-01'

function makeBriefInput(overrides?: Partial<IssueBriefInput>): IssueBriefInput {
  return {
    buyerId: BUYER_ID,
    creatorId: CREATOR_ID,
    assignmentClass: 'material',
    plan: {
      scope: 'Test assignment scope',
      deadline: '2026-06-01T23:59:00Z',
      acceptanceCriteria: 'Test criteria',
      requiredEvidenceTypes: ['vault_asset'],
      reviewWindowDays: 5,
      notes: null,
    },
    rightsRecord: {
      assetRights: {
        usageRights: 'Non-exclusive editorial licence.',
        exclusivityTerms: '48h exclusivity.',
        permittedModifications: 'Cropping only.',
        duration: '1 year.',
        territory: 'Worldwide.',
        publicationScope: 'Editorial.',
      },
      serviceTerms: null,
    },
    milestones: [
      {
        title: 'Milestone 1',
        scopeSummary: 'First deliverable',
        milestoneType: 'material',
        dueDate: '2026-05-15T23:59:00Z',
        acceptanceCriteria: 'At least 5 photos.',
        requiredEvidenceTypes: ['vault_asset'],
        releasableAmountCents: 100000, // EUR 1,000
        partialAcceptancePermitted: false,
        reviewWindowDays: 5,
      },
      {
        title: 'Milestone 2',
        scopeSummary: 'Second deliverable',
        milestoneType: 'material',
        dueDate: '2026-06-01T23:59:00Z',
        acceptanceCriteria: 'At least 10 photos.',
        requiredEvidenceTypes: ['vault_asset'],
        releasableAmountCents: 150000, // EUR 1,500
        partialAcceptancePermitted: true,
        reviewWindowDays: 5,
      },
    ],
    ...overrides,
  }
}

/** Issue a brief and return the draft assignment. */
function issueBrief(overrides?: Partial<IssueBriefInput>): Assignment {
  return issueAssignmentBrief(makeBriefInput(overrides))
}

/** Issue + accept + capture escrow, returning an in_progress/active assignment. */
function buildInProgressAssignment(overrides?: Partial<IssueBriefInput>): Assignment {
  let a = issueBrief(overrides)
  a = acceptAssignment(a, CREATOR_ID)
  a = syncEscrowCaptureFromStripe(a, 'pi_test_001', 275000, '2026-04-02T08:00:00Z')
  return a
}

/** Build a confirmed/settlement_queued assignment by accepting all milestones. */
function buildConfirmedAssignment(): Assignment {
  let a = buildInProgressAssignment()
  // Activate ms 1 while still in_progress
  a = activateNextMilestone(a)
  const ms0Id = a.milestones[0].id
  const ms1Id = a.milestones[1].id

  a = submitFulfilment(a, ms0Id, makeSubmission(ms0Id), CREATOR_ID)
  a = openReviewWindow(a, ms0Id)
  a = determineReviewOutcome(a, ms0Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')

  a = submitFulfilment(a, ms1Id, makeSubmission(ms1Id), CREATOR_ID)
  a = openReviewWindow(a, ms1Id)
  a = determineReviewOutcome(a, ms1Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')
  return a
}

function makeSubmission(milestoneId: string, opts?: { empty?: boolean }): FulfilmentSubmission {
  return {
    id: `fs-test-${Date.now()}`,
    milestoneId,
    fulfilmentType: 'asset',
    evidenceItems: opts?.empty
      ? []
      : [
          {
            id: `ev-test-${Date.now()}`,
            kind: 'vault_asset',
            label: 'Test photo',
            description: null,
            vaultAssetId: 'asset-test-001',
            fileRef: null,
            fileName: null,
            fileSizeBytes: null,
            serviceLog: null,
            createdAt: new Date().toISOString(),
          },
        ],
    creatorNotes: 'Test submission',
    submittedAt: new Date().toISOString(),
  }
}

function makeServiceSubmission(milestoneId: string): FulfilmentSubmission {
  return {
    id: `fs-svc-test-${Date.now()}`,
    milestoneId,
    fulfilmentType: 'service',
    evidenceItems: [
      {
        id: `ev-svc-test-${Date.now()}`,
        kind: 'service_log',
        label: 'Service log',
        description: null,
        vaultAssetId: null,
        fileRef: null,
        fileName: null,
        fileSizeBytes: null,
        serviceLog: {
          date: '2026-04-20',
          startTime: '09:00',
          endTime: '17:00',
          location: 'Athens',
          role: 'Fixer',
          completedDuties: 'Translation and logistics.',
        },
        createdAt: new Date().toISOString(),
      },
    ],
    creatorNotes: 'Service fulfilment submission',
    submittedAt: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════

describe('Assignment Domain Services', () => {
  beforeEach(() => {
    _clearEventBuffer()
  })

  // ────────────────────────────────────────────
  // 1. issueAssignmentBrief
  // ────────────────────────────────────────────

  describe('issueAssignmentBrief', () => {
    it('creates a brief_issued/draft assignment with correct structure', () => {
      const a = issueBrief()
      expect(a.state).toBe('brief_issued')
      expect(a.subState).toBe('draft')
      expect(a.buyerId).toBe(BUYER_ID)
      expect(a.creatorId).toBe(CREATOR_ID)
      expect(a.assignmentClass).toBe('material')
      expect(a.milestones).toHaveLength(2)
      expect(a.milestones[0].state).toBe('pending')
      expect(a.milestones[1].state).toBe('pending')
      expect(a.milestones[0].ordinal).toBe(1)
      expect(a.milestones[1].ordinal).toBe(2)
      expect(a.escrow.stripePaymentIntentId).toBeNull()
      expect(a.escrow.totalCapturedCents).toBe(0)
      expect(a.ccrHistory).toHaveLength(0)
      expect(a.acceptedAt).toBeNull()
      expect(a.completedAt).toBeNull()
      expect(a.cancelledAt).toBeNull()
    })

    it('emits assignment_created CEL event', () => {
      const a = issueBrief()
      const events = getAssignmentEvents(a.id)
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('assignment_created')
    })

    it('assigns unique IDs to assignment and milestones', () => {
      const a = issueBrief()
      expect(a.id).toBeTruthy()
      expect(a.milestones[0].id).toBeTruthy()
      expect(a.milestones[1].id).toBeTruthy()
      expect(a.milestones[0].id).not.toBe(a.milestones[1].id)
    })

    it('links milestones back to the assignment', () => {
      const a = issueBrief()
      for (const m of a.milestones) {
        expect(m.assignmentId).toBe(a.id)
      }
    })
  })

  // ────────────────────────────────────────────
  // 2. acceptAssignment
  // ────────────────────────────────────────────

  describe('acceptAssignment', () => {
    it('transitions from brief_issued/draft to accepted_pending_escrow', () => {
      const draft = issueBrief()
      const accepted = acceptAssignment(draft, CREATOR_ID)
      expect(accepted.state).toBe('brief_issued')
      expect(accepted.subState).toBe('accepted_pending_escrow')
      expect(accepted.acceptedAt).not.toBeNull()
    })

    it('emits assignment_accepted CEL event', () => {
      const draft = issueBrief()
      const accepted = acceptAssignment(draft, CREATOR_ID)
      const events = getAssignmentEvents(accepted.id)
      // assignment_created + assignment_accepted
      expect(events).toHaveLength(2)
      expect(events[1].type).toBe('assignment_accepted')
    })

    it('rejects non-creator', () => {
      const draft = issueBrief()
      expect(() => acceptAssignment(draft, BUYER_ID)).toThrow(AssignmentError)
      expect(() => acceptAssignment(draft, OUTSIDER_ID)).toThrow(AssignmentError)
    })

    it('rejects if not brief_issued', () => {
      const inProgress = buildInProgressAssignment()
      expect(() => acceptAssignment(inProgress, CREATOR_ID)).toThrow(AssignmentError)
    })

    it('rejects if already accepted_pending_escrow', () => {
      const draft = issueBrief()
      const accepted = acceptAssignment(draft, CREATOR_ID)
      expect(() => acceptAssignment(accepted, CREATOR_ID)).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 3. syncEscrowCaptureFromStripe
  // ────────────────────────────────────────────

  describe('syncEscrowCaptureFromStripe', () => {
    it('transitions to in_progress/active and activates first milestone', () => {
      let a = issueBrief()
      a = acceptAssignment(a, CREATOR_ID)
      a = syncEscrowCaptureFromStripe(a, 'pi_test_001', 275000, '2026-04-02T08:00:00Z')

      expect(a.state).toBe('in_progress')
      expect(a.subState).toBe('active')
      expect(a.escrow.stripePaymentIntentId).toBe('pi_test_001')
      expect(a.escrow.totalCapturedCents).toBe(275000)
      expect(a.escrow.capturedAt).toBe('2026-04-02T08:00:00Z')
      expect(a.milestones[0].state).toBe('active')
      expect(a.milestones[1].state).toBe('pending')
    })

    it('is idempotent when called with the same stripePaymentIntentId', () => {
      let a = issueBrief()
      a = acceptAssignment(a, CREATOR_ID)
      a = syncEscrowCaptureFromStripe(a, 'pi_test_001', 275000, '2026-04-02T08:00:00Z')
      const again = syncEscrowCaptureFromStripe(a, 'pi_test_001', 275000, '2026-04-02T08:00:00Z')
      expect(again).toBe(a) // reference equality — no mutation
    })

    it('rejects if not accepted_pending_escrow', () => {
      const draft = issueBrief()
      expect(() =>
        syncEscrowCaptureFromStripe(draft, 'pi_test_001', 275000, '2026-04-02T08:00:00Z'),
      ).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 4. activateNextMilestone
  // ────────────────────────────────────────────

  describe('activateNextMilestone', () => {
    it('activates the next pending milestone', () => {
      const a = buildInProgressAssignment()
      // milestone 0 is already active, milestone 1 is pending
      const updated = activateNextMilestone(a)
      expect(updated.milestones[1].state).toBe('active')
    })

    it('returns unchanged if no pending milestones remain', () => {
      let a = buildInProgressAssignment()
      a = activateNextMilestone(a) // activate ms 1
      const again = activateNextMilestone(a) // nothing pending
      expect(again).toBe(a)
    })

    it('rejects if not in_progress', () => {
      const draft = issueBrief()
      expect(() => activateNextMilestone(draft)).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 5. createAssignmentPlan
  // ────────────────────────────────────────────

  describe('createAssignmentPlan', () => {
    it('sets plan on brief_issued assignment', () => {
      const a = issueBrief()
      const newPlan: AssignmentPlan = {
        scope: 'Updated scope',
        deadline: '2026-07-01T23:59:00Z',
        acceptanceCriteria: 'Updated criteria',
        requiredEvidenceTypes: ['vault_asset', 'service_log'],
        reviewWindowDays: 7,
        notes: 'Updated notes',
      }
      const updated = createAssignmentPlan(a, newPlan)
      expect(updated.plan.scope).toBe('Updated scope')
      expect(updated.plan.deadline).toBe('2026-07-01T23:59:00Z')
      expect(updated.plan.reviewWindowDays).toBe(7)
    })

    it('rejects if not brief_issued', () => {
      const a = buildInProgressAssignment()
      const plan: AssignmentPlan = {
        scope: 'x',
        deadline: '2026-07-01T23:59:00Z',
        acceptanceCriteria: 'x',
        requiredEvidenceTypes: [],
        reviewWindowDays: 5,
        notes: null,
      }
      expect(() => createAssignmentPlan(a, plan)).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 6. addMilestone
  // ────────────────────────────────────────────

  describe('addMilestone', () => {
    it('adds a milestone before escrow capture', () => {
      const a = issueBrief()
      expect(a.milestones).toHaveLength(2)

      const updated = addMilestone(a, {
        title: 'Milestone 3',
        scopeSummary: 'Third deliverable',
        milestoneType: 'material',
        dueDate: '2026-06-15T23:59:00Z',
        acceptanceCriteria: 'At least 5 images.',
        requiredEvidenceTypes: ['vault_asset'],
        releasableAmountCents: 50000,
        partialAcceptancePermitted: false,
        reviewWindowDays: 5,
      })

      expect(updated.milestones).toHaveLength(3)
      expect(updated.milestones[2].ordinal).toBe(3)
      expect(updated.milestones[2].state).toBe('pending')
      expect(updated.milestones[2].title).toBe('Milestone 3')
      expect(updated.milestones[2].assignmentId).toBe(a.id)
    })

    it('rejects if not brief_issued', () => {
      const a = buildInProgressAssignment()
      expect(() =>
        addMilestone(a, {
          title: 'Late addition',
          scopeSummary: 'x',
          milestoneType: 'material',
          dueDate: '2026-07-01T23:59:00Z',
          acceptanceCriteria: 'x',
          requiredEvidenceTypes: ['vault_asset'],
          releasableAmountCents: 10000,
          partialAcceptancePermitted: false,
          reviewWindowDays: 5,
        }),
      ).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 7. amendMilestone
  // ────────────────────────────────────────────

  describe('amendMilestone', () => {
    it('amends milestone fields before escrow capture', () => {
      const a = issueBrief()
      const msId = a.milestones[0].id
      const updated = amendMilestone(a, msId, {
        title: 'Amended title',
        releasableAmountCents: 120000,
        reviewWindowDays: 7,
      })
      const ms = updated.milestones.find(m => m.id === msId)!
      expect(ms.title).toBe('Amended title')
      expect(ms.releasableAmountCents).toBe(120000)
      expect(ms.reviewWindowDays).toBe(7)
    })

    it('rejects if not brief_issued', () => {
      const a = buildInProgressAssignment()
      expect(() =>
        amendMilestone(a, a.milestones[0].id, { title: 'Nope' }),
      ).toThrow(AssignmentError)
    })

    it('rejects unknown milestone ID', () => {
      const a = issueBrief()
      expect(() =>
        amendMilestone(a, 'ms-nonexistent', { title: 'Nope' }),
      ).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 8. submitFulfilment
  // ────────────────────────────────────────────

  describe('submitFulfilment', () => {
    it('transitions milestone to fulfilment_submitted and assignment to delivered', () => {
      const a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      const submission = makeSubmission(msId)
      const updated = submitFulfilment(a, msId, submission, CREATOR_ID)

      const ms = updated.milestones.find(m => m.id === msId)!
      expect(ms.state).toBe('fulfilment_submitted')
      expect(ms.fulfilmentSubmissions).toHaveLength(1)
      expect(updated.state).toBe('delivered')
      expect(updated.subState).toBe('fulfilment_submitted')
    })

    it('emits fulfilment_submitted CEL event', () => {
      const a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      const updated = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      const events = getAssignmentEvents(updated.id)
      const fulfilmentEvents = events.filter(e => e.type === 'fulfilment_submitted')
      expect(fulfilmentEvents).toHaveLength(1)
    })

    it('rejects non-creator', () => {
      const a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      expect(() =>
        submitFulfilment(a, msId, makeSubmission(msId), BUYER_ID),
      ).toThrow(AssignmentError)
    })

    it('rejects empty evidence', () => {
      const a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      expect(() =>
        submitFulfilment(a, msId, makeSubmission(msId, { empty: true }), CREATOR_ID),
      ).toThrow(AssignmentError)
    })

    it('rejects if milestone is not active or changes_requested', () => {
      const a = buildInProgressAssignment()
      // milestone 1 is pending, not active
      const msId = a.milestones[1].id
      expect(() =>
        submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID),
      ).toThrow(AssignmentError)
    })

    it('allows resubmission on changes_requested milestone', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id

      // Submit fulfilment
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)

      // Open review and request changes
      a = openReviewWindow(a, msId)
      a = determineReviewOutcome(a, msId, BUYER_ID, 'content_commit_holder', 'changes_requested', 'Needs more detail')

      // Resubmit
      const ms = a.milestones.find(m => m.id === msId)!
      expect(ms.state).toBe('changes_requested')
      const resubmitted = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      const msAfter = resubmitted.milestones.find(m => m.id === msId)!
      expect(msAfter.state).toBe('fulfilment_submitted')
      expect(msAfter.fulfilmentSubmissions).toHaveLength(2)
    })
  })

  // ────────────────────────────────────────────
  // 9. validateFulfilmentSubmission
  // ────────────────────────────────────────────

  describe('validateFulfilmentSubmission', () => {
    it('returns valid for correct material submission', () => {
      const a = buildInProgressAssignment()
      const ms = a.milestones[0]
      const submission = makeSubmission(ms.id)
      const result = validateFulfilmentSubmission(ms, submission)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns errors for empty evidence', () => {
      const a = buildInProgressAssignment()
      const ms = a.milestones[0]
      const submission = makeSubmission(ms.id, { empty: true })
      const result = validateFulfilmentSubmission(ms, submission)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Submission contains no evidence items')
    })

    it('returns errors for missing required evidence type on material milestone', () => {
      const a = buildInProgressAssignment()
      const ms = a.milestones[0] // material milestone requiring vault_asset
      const submission: FulfilmentSubmission = {
        id: 'fs-bad',
        milestoneId: ms.id,
        fulfilmentType: 'service',
        evidenceItems: [
          {
            id: 'ev-bad',
            kind: 'service_log',
            label: 'Wrong kind',
            description: null,
            vaultAssetId: null,
            fileRef: null,
            fileName: null,
            fileSizeBytes: null,
            serviceLog: { date: '2026-04-20', startTime: '09:00', endTime: '17:00', location: 'Test', role: 'Test', completedDuties: 'Test' },
            createdAt: new Date().toISOString(),
          },
        ],
        creatorNotes: 'Wrong evidence type',
        submittedAt: new Date().toISOString(),
      }
      const result = validateFulfilmentSubmission(ms, submission)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('vault_asset'))).toBe(true)
    })

    it('returns errors for missing service_log on service milestone', () => {
      const a = buildInProgressAssignment({
        assignmentClass: 'service',
        milestones: [
          {
            title: 'Service MS',
            scopeSummary: 'Fixering',
            milestoneType: 'service',
            dueDate: '2026-05-15T23:59:00Z',
            acceptanceCriteria: 'Service logs',
            requiredEvidenceTypes: ['service_log'],
            releasableAmountCents: 50000,
            partialAcceptancePermitted: false,
            reviewWindowDays: 5,
          },
        ],
      })
      const ms = a.milestones[0]
      // Submit vault_asset evidence to a service milestone
      const submission = makeSubmission(ms.id)
      const result = validateFulfilmentSubmission(ms, submission)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('service log'))).toBe(true)
    })
  })

  // ────────────────────────────────────────────
  // 10. openReviewWindow
  // ────────────────────────────────────────────

  describe('openReviewWindow', () => {
    it('transitions milestone to review_open and assignment subState to review_open', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)

      const updated = openReviewWindow(a, msId)
      expect(updated.subState).toBe('review_open')
      const ms = updated.milestones.find(m => m.id === msId)!
      expect(ms.state).toBe('review_open')
    })

    it('rejects if assignment is not delivered', () => {
      const a = buildInProgressAssignment()
      expect(() => openReviewWindow(a, a.milestones[0].id)).toThrow(AssignmentError)
    })

    it('rejects if milestone is not fulfilment_submitted', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      a = openReviewWindow(a, msId)
      // milestone is now review_open, opening again should fail
      expect(() => openReviewWindow(a, msId)).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 11. determineReviewOutcome
  // ────────────────────────────────────────────

  describe('determineReviewOutcome', () => {
    function setupForReview(): { assignment: Assignment; milestoneId: string } {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      a = openReviewWindow(a, msId)
      return { assignment: a, milestoneId: msId }
    }

    it('accepted determination releases full milestone amount', () => {
      const { assignment, milestoneId } = setupForReview()
      const updated = determineReviewOutcome(
        assignment, milestoneId, BUYER_ID, 'content_commit_holder', 'accepted', 'Good work.',
      )
      const ms = updated.milestones.find(m => m.id === milestoneId)!
      expect(ms.state).toBe('accepted')
      expect(ms.reviewDetermination).not.toBeNull()
      expect(ms.reviewDetermination!.determination).toBe('accepted')
      expect(updated.escrow.totalReleasedCents).toBe(100000)
    })

    it('accepted on all milestones transitions to confirmed/settlement_queued', () => {
      let a = buildInProgressAssignment()
      // Activate ms 1 while still in_progress, before submitting ms 0
      a = activateNextMilestone(a)
      const ms0Id = a.milestones[0].id
      const ms1Id = a.milestones[1].id

      // Submit and accept milestone 0
      a = submitFulfilment(a, ms0Id, makeSubmission(ms0Id), CREATOR_ID)
      a = openReviewWindow(a, ms0Id)
      a = determineReviewOutcome(a, ms0Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')

      // Submit and accept milestone 1 (already active)
      a = submitFulfilment(a, ms1Id, makeSubmission(ms1Id), CREATOR_ID)
      a = openReviewWindow(a, ms1Id)
      a = determineReviewOutcome(a, ms1Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')

      expect(a.state).toBe('confirmed')
      expect(a.subState).toBe('settlement_queued')
      expect(a.escrow.totalReleasedCents).toBe(250000)
      expect(a.completedAt).not.toBeNull()
    })

    it('changes_requested keeps delivered state', () => {
      const { assignment, milestoneId } = setupForReview()
      const updated = determineReviewOutcome(
        assignment, milestoneId, BUYER_ID, 'content_commit_holder', 'changes_requested', 'More detail needed.',
      )
      expect(updated.state).toBe('delivered')
      expect(updated.subState).toBe('changes_requested')
      const ms = updated.milestones.find(m => m.id === milestoneId)!
      expect(ms.state).toBe('changes_requested')
    })

    it('dispute_opened freezes contested amount', () => {
      const { assignment, milestoneId } = setupForReview()
      const updated = determineReviewOutcome(
        assignment, milestoneId, BUYER_ID, 'content_commit_holder', 'dispute_opened', 'Scope mismatch.',
      )
      expect(updated.state).toBe('disputed')
      expect(updated.escrow.totalFrozenCents).toBe(100000)
      const ms = updated.milestones.find(m => m.id === milestoneId)!
      expect(ms.state).toBe('disputed')
    })

    it('accepted_partial releases specified amount', () => {
      // Use milestone 1 which has partialAcceptancePermitted: true
      let a = buildInProgressAssignment()
      // Activate ms 1 while still in_progress
      a = activateNextMilestone(a)
      const ms0Id = a.milestones[0].id
      const ms1Id = a.milestones[1].id

      // Accept ms 0 first
      a = submitFulfilment(a, ms0Id, makeSubmission(ms0Id), CREATOR_ID)
      a = openReviewWindow(a, ms0Id)
      a = determineReviewOutcome(a, ms0Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')

      // Partial accept ms 1
      a = submitFulfilment(a, ms1Id, makeSubmission(ms1Id), CREATOR_ID)
      a = openReviewWindow(a, ms1Id)
      a = determineReviewOutcome(a, ms1Id, BUYER_ID, 'content_commit_holder', 'accepted_partial', '3 of 10 accepted.', 45000)

      const ms1 = a.milestones.find(m => m.id === ms1Id)!
      expect(ms1.state).toBe('accepted_partial')
      expect(a.escrow.totalReleasedCents).toBe(100000 + 45000)
    })

    it('rejects editor authorizing release (accepted)', () => {
      const { assignment, milestoneId } = setupForReview()
      expect(() =>
        determineReviewOutcome(
          assignment, milestoneId, BUYER_ID, 'editor', 'accepted', 'Looks good.',
        ),
      ).toThrow(AssignmentError)
    })

    it('rejects editor authorizing release (accepted_partial)', () => {
      // Use a milestone with partialAcceptancePermitted
      let a = buildInProgressAssignment()
      // Activate ms 1 while still in_progress
      a = activateNextMilestone(a)
      const ms0Id = a.milestones[0].id
      const ms1Id = a.milestones[1].id

      a = submitFulfilment(a, ms0Id, makeSubmission(ms0Id), CREATOR_ID)
      a = openReviewWindow(a, ms0Id)
      a = determineReviewOutcome(a, ms0Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')

      a = submitFulfilment(a, ms1Id, makeSubmission(ms1Id), CREATOR_ID)
      a = openReviewWindow(a, ms1Id)

      expect(() =>
        determineReviewOutcome(a, ms1Id, BUYER_ID, 'editor', 'accepted_partial', 'Partial.', 50000),
      ).toThrow(AssignmentError)
    })

    it('rejects partial amount exceeding releasable', () => {
      let a = buildInProgressAssignment()
      // Activate ms 1 while still in_progress
      a = activateNextMilestone(a)
      const ms0Id = a.milestones[0].id
      const ms1Id = a.milestones[1].id

      a = submitFulfilment(a, ms0Id, makeSubmission(ms0Id), CREATOR_ID)
      a = openReviewWindow(a, ms0Id)
      a = determineReviewOutcome(a, ms0Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')

      a = submitFulfilment(a, ms1Id, makeSubmission(ms1Id), CREATOR_ID)
      a = openReviewWindow(a, ms1Id)

      expect(() =>
        determineReviewOutcome(a, ms1Id, BUYER_ID, 'content_commit_holder', 'accepted_partial', 'Too much.', 200000),
      ).toThrow(AssignmentError)
    })

    it('allows editor to request changes (non-release action)', () => {
      const { assignment, milestoneId } = setupForReview()
      const updated = determineReviewOutcome(
        assignment, milestoneId, BUYER_ID, 'editor', 'changes_requested', 'Needs work.',
      )
      expect(updated.subState).toBe('changes_requested')
    })

    it('allows null role (individual buyer) to accept', () => {
      const { assignment, milestoneId } = setupForReview()
      const updated = determineReviewOutcome(
        assignment, milestoneId, BUYER_ID, null, 'accepted', 'LGTM.',
      )
      const ms = updated.milestones.find(m => m.id === milestoneId)!
      expect(ms.state).toBe('accepted')
    })
  })

  // ────────────────────────────────────────────
  // 12. requestCommissionChange
  // ────────────────────────────────────────────

  describe('requestCommissionChange', () => {
    it('submits CCR and sets sub-state to ccr_pending', () => {
      const a = buildInProgressAssignment()
      const updated = requestCommissionChange(a, CREATOR_ID, [
        { field: 'deadline', currentValue: '2026-06-01', proposedValue: '2026-06-15' },
      ], 'Need more time.')

      expect(updated.subState).toBe('ccr_pending')
      expect(updated.ccrHistory).toHaveLength(1)
      expect(updated.ccrHistory[0].state).toBe('pending')
      expect(updated.ccrHistory[0].requesterId).toBe(CREATOR_ID)
      expect(updated.ccrHistory[0].amendedFields).toHaveLength(1)
      expect(updated.ccrHistory[0].responseDeadline).toBeTruthy()
    })

    it('buyer can also submit CCR', () => {
      const a = buildInProgressAssignment()
      const updated = requestCommissionChange(a, BUYER_ID, [
        { field: 'scope', currentValue: 'original', proposedValue: 'expanded' },
      ], 'Expanding scope.')
      expect(updated.ccrHistory[0].requesterId).toBe(BUYER_ID)
    })

    it('rejects non-party', () => {
      const a = buildInProgressAssignment()
      expect(() =>
        requestCommissionChange(a, OUTSIDER_ID, [
          { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
        ], 'Intruder.'),
      ).toThrow(AssignmentError)
    })

    it('rejects if CCR already pending', () => {
      let a = buildInProgressAssignment()
      a = requestCommissionChange(a, CREATOR_ID, [
        { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
      ], 'First CCR.')

      expect(() =>
        requestCommissionChange(a, BUYER_ID, [
          { field: 'scope', currentValue: 'a', proposedValue: 'b' },
        ], 'Second CCR.'),
      ).toThrow(AssignmentError)
    })

    it('rejects CCR on brief_issued assignment', () => {
      const draft = issueBrief()
      expect(() =>
        requestCommissionChange(draft, CREATOR_ID, [
          { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
        ], 'Too early.'),
      ).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 13. approveCommissionChange
  // ────────────────────────────────────────────

  describe('approveCommissionChange', () => {
    it('approves pending CCR and restores active sub-state', () => {
      let a = buildInProgressAssignment()
      a = requestCommissionChange(a, CREATOR_ID, [
        { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
      ], 'Extend please.')
      const ccrId = a.ccrHistory[0].id

      const updated = approveCommissionChange(a, ccrId, BUYER_ID, 'Approved.')
      const ccr = updated.ccrHistory.find(c => c.id === ccrId)!
      expect(ccr.state).toBe('approved')
      expect(ccr.respondedAt).not.toBeNull()
      expect(ccr.responseNote).toBe('Approved.')
      expect(updated.subState).toBe('active')
    })

    it('rejects self-response', () => {
      let a = buildInProgressAssignment()
      a = requestCommissionChange(a, CREATOR_ID, [
        { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
      ], 'Self-approve attempt.')
      const ccrId = a.ccrHistory[0].id

      expect(() => approveCommissionChange(a, ccrId, CREATOR_ID, 'Self-approve.')).toThrow(AssignmentError)
    })

    it('rejects unknown CCR ID', () => {
      const a = buildInProgressAssignment()
      expect(() => approveCommissionChange(a, 'ccr-nonexistent', BUYER_ID, 'Nope.')).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 14. rejectCommissionChange
  // ────────────────────────────────────────────

  describe('rejectCommissionChange', () => {
    it('rejects pending CCR and restores active sub-state', () => {
      let a = buildInProgressAssignment()
      a = requestCommissionChange(a, CREATOR_ID, [
        { field: 'price', currentValue: '1000', proposedValue: '1500' },
      ], 'Price increase.')
      const ccrId = a.ccrHistory[0].id

      const updated = rejectCommissionChange(a, ccrId, BUYER_ID, 'No budget.')
      const ccr = updated.ccrHistory.find(c => c.id === ccrId)!
      expect(ccr.state).toBe('denied')
      expect(ccr.respondedAt).not.toBeNull()
      expect(ccr.responseNote).toBe('No budget.')
      expect(updated.subState).toBe('active')
    })

    it('rejects self-response', () => {
      let a = buildInProgressAssignment()
      a = requestCommissionChange(a, BUYER_ID, [
        { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
      ], 'Buyer CCR.')
      const ccrId = a.ccrHistory[0].id

      expect(() => rejectCommissionChange(a, ccrId, BUYER_ID, 'Self-deny.')).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 15. autoDenyExpiredCCR
  // ────────────────────────────────────────────

  describe('autoDenyExpiredCCR', () => {
    it('auto-denies CCR past its response deadline', () => {
      let a = buildInProgressAssignment()
      a = requestCommissionChange(a, CREATOR_ID, [
        { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
      ], 'Will expire.')
      const ccrId = a.ccrHistory[0].id

      // Force the deadline to the past
      a = {
        ...a,
        ccrHistory: a.ccrHistory.map(c =>
          c.id === ccrId ? { ...c, responseDeadline: '2020-01-01T00:00:00Z' } : c,
        ),
      }

      const updated = autoDenyExpiredCCR(a)
      const ccr = updated.ccrHistory.find(c => c.id === ccrId)!
      expect(ccr.state).toBe('auto_denied')
      expect(ccr.respondedAt).not.toBeNull()
      expect(updated.subState).toBe('active')
    })

    it('returns unchanged if no pending CCR', () => {
      const a = buildInProgressAssignment()
      const result = autoDenyExpiredCCR(a)
      expect(result).toBe(a)
    })

    it('returns unchanged if deadline not yet reached', () => {
      let a = buildInProgressAssignment()
      a = requestCommissionChange(a, CREATOR_ID, [
        { field: 'deadline', currentValue: 'x', proposedValue: 'y' },
      ], 'Not expired yet.')

      // Default deadline is 5 business days in the future, so should not auto-deny
      const result = autoDenyExpiredCCR(a)
      const ccr = result.ccrHistory[0]
      expect(ccr.state).toBe('pending')
    })
  })

  // ────────────────────────────────────────────
  // 16. openAssignmentDispute
  // ────────────────────────────────────────────

  describe('openAssignmentDispute', () => {
    it('files milestone-level dispute and freezes escrow', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)

      const { assignment: updated, dispute } = openAssignmentDispute(
        a, BUYER_ID, 'asset_failure_against_brief', msId, 'Images do not match scope.',
      )

      expect(updated.state).toBe('disputed')
      expect(updated.escrow.totalFrozenCents).toBe(100000)
      expect(dispute.scope).toBe('milestone')
      expect(dispute.trigger).toBe('asset_failure_against_brief')
      expect(dispute.filerId).toBe(BUYER_ID)
      expect(dispute.filerRole).toBe('buyer')
      expect(dispute.contestedAmountCents).toBe(100000)
      expect(dispute.state).toBe('filed')
      const ms = updated.milestones.find(m => m.id === msId)!
      expect(ms.state).toBe('disputed')
    })

    it('files assignment-level dispute and freezes all unreleased', () => {
      const a = buildInProgressAssignment()
      // Both milestones are pending/active, neither released
      const { assignment: updated, dispute } = openAssignmentDispute(
        a, BUYER_ID, 'creator_non_performance', null, 'Creator unresponsive.',
      )

      expect(updated.state).toBe('disputed')
      expect(dispute.scope).toBe('assignment')
      expect(dispute.contestedAmountCents).toBe(250000) // 100000 + 150000
      expect(updated.escrow.totalFrozenCents).toBe(250000)
    })

    it('rejects if already disputed', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      const { assignment: disputed } = openAssignmentDispute(
        a, BUYER_ID, 'asset_failure_against_brief', msId, 'Bad scope.',
      )

      expect(() =>
        openAssignmentDispute(disputed, BUYER_ID, 'creator_non_performance', null, 'Again.'),
      ).toThrow(AssignmentError)
    })

    it('rejects if assignment in brief_issued state', () => {
      const draft = issueBrief()
      expect(() =>
        openAssignmentDispute(draft, BUYER_ID, 'creator_non_performance', null, 'Too early.'),
      ).toThrow(AssignmentError)
    })

    it('rejects non-party from filing dispute', () => {
      const a = buildInProgressAssignment()
      expect(() =>
        openAssignmentDispute(a, OUTSIDER_ID, 'creator_non_performance', null, 'Intruder.'),
      ).toThrow(AssignmentError)
    })

    it('creator can also file a dispute', () => {
      const a = buildInProgressAssignment()
      const { dispute } = openAssignmentDispute(
        a, CREATOR_ID, 'buyer_refusal_without_grounds', null, 'Buyer is unresponsive.',
      )
      expect(dispute.filerRole).toBe('creator')
    })
  })

  // ────────────────────────────────────────────
  // 17. evaluateProvisionalReleaseEligibility
  // ────────────────────────────────────────────

  describe('evaluateProvisionalReleaseEligibility', () => {
    it('marks eligible when fulfilment_submitted milestone is 14+ days old', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      const oldSubmission: FulfilmentSubmission = {
        ...makeSubmission(msId),
        submittedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      }
      a = submitFulfilment(a, msId, oldSubmission, CREATOR_ID)

      const updated = evaluateProvisionalReleaseEligibility(a)
      expect(updated.subState).toBe('provisional_release_eligible')
    })

    it('returns unchanged if not delivered', () => {
      const a = buildInProgressAssignment()
      const result = evaluateProvisionalReleaseEligibility(a)
      expect(result).toBe(a)
    })

    it('returns unchanged if subState is changes_requested', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      a = openReviewWindow(a, msId)
      a = determineReviewOutcome(a, msId, BUYER_ID, 'content_commit_holder', 'changes_requested', 'Needs work.')
      // Now state = delivered, subState = changes_requested
      const result = evaluateProvisionalReleaseEligibility(a)
      expect(result.subState).toBe('changes_requested')
    })

    it('returns unchanged if escrow has frozen funds', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      // Manually set frozen escrow
      a = { ...a, escrow: { ...a.escrow, totalFrozenCents: 10000 } }
      const result = evaluateProvisionalReleaseEligibility(a)
      expect(result).toBe(a)
    })

    it('returns unchanged if submission is less than 14 days old', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      // Fresh submission (now)
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      const result = evaluateProvisionalReleaseEligibility(a)
      expect(result.subState).toBe('fulfilment_submitted')
    })
  })

  // ────────────────────────────────────────────
  // 18. executeProvisionalRelease
  // ────────────────────────────────────────────

  describe('executeProvisionalRelease', () => {
    it('releases fulfilment_submitted milestones and transitions to confirmed', () => {
      let a = buildInProgressAssignment()
      // Activate ms 1 while still in_progress
      a = activateNextMilestone(a)
      const msId = a.milestones[0].id
      const ms1Id = a.milestones[1].id

      const oldSubmission: FulfilmentSubmission = {
        ...makeSubmission(msId),
        submittedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      }
      a = submitFulfilment(a, msId, oldSubmission, CREATOR_ID)

      const oldSubmission2: FulfilmentSubmission = {
        ...makeSubmission(ms1Id),
        submittedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      }
      a = submitFulfilment(a, ms1Id, oldSubmission2, CREATOR_ID)

      a = evaluateProvisionalReleaseEligibility(a)
      expect(a.subState).toBe('provisional_release_eligible')

      const updated = executeProvisionalRelease(a, 'staff-001')
      expect(updated.state).toBe('confirmed')
      expect(updated.subState).toBe('provisional_release_executed')
      expect(updated.milestones[0].state).toBe('accepted')
      expect(updated.milestones[1].state).toBe('accepted')
      expect(updated.escrow.totalReleasedCents).toBe(250000)
      expect(updated.completedAt).not.toBeNull()
    })

    it('rejects if not provisional_release_eligible', () => {
      const a = buildInProgressAssignment()
      expect(() => executeProvisionalRelease(a, 'staff-001')).toThrow(AssignmentError)
    })

    it('rejects if escrow has frozen funds', () => {
      let a = buildInProgressAssignment()
      const msId = a.milestones[0].id
      const oldSubmission: FulfilmentSubmission = {
        ...makeSubmission(msId),
        submittedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      }
      a = submitFulfilment(a, msId, oldSubmission, CREATOR_ID)
      a = evaluateProvisionalReleaseEligibility(a)
      // Manually freeze escrow
      a = { ...a, escrow: { ...a.escrow, totalFrozenCents: 50000 } }

      expect(() => executeProvisionalRelease(a, 'staff-001')).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 19. queueCreatorSettlement
  // ────────────────────────────────────────────

  describe('queueCreatorSettlement', () => {
    it('queues settlement on confirmed assignment', () => {
      const a = buildConfirmedAssignment()
      expect(a.state).toBe('confirmed')

      const updated = queueCreatorSettlement(a)
      expect(updated.subState).toBe('settlement_queued')
    })

    it('emits settlement_queued CEL event', () => {
      const a = buildConfirmedAssignment()
      queueCreatorSettlement(a)
      const events = getAssignmentEvents(a.id)
      const settlementEvents = events.filter(e => e.type === 'settlement_queued')
      expect(settlementEvents).toHaveLength(1)
    })

    it('rejects if not confirmed', () => {
      const a = buildInProgressAssignment()
      expect(() => queueCreatorSettlement(a)).toThrow(AssignmentError)
    })
  })

  // ────────────────────────────────────────────
  // 20. syncStripeReleaseState
  // ────────────────────────────────────────────

  describe('syncStripeReleaseState', () => {
    function buildSettlementQueuedAssignment(): Assignment {
      return buildConfirmedAssignment() // already settlement_queued from determineReviewOutcome
    }

    it('transitions settlement_queued to closed', () => {
      const a = buildSettlementQueuedAssignment()
      expect(a.subState).toBe('settlement_queued')

      const updated = syncStripeReleaseState(a, 'tr_stripe_001', 250000)
      expect(updated.subState).toBe('closed')
    })

    it('is idempotent when not settlement_queued', () => {
      const a = buildInProgressAssignment()
      const result = syncStripeReleaseState(a, 'tr_stripe_001', 100000)
      expect(result).toBe(a) // reference equality
    })

    it('emits escrow_released CEL event', () => {
      const a = buildSettlementQueuedAssignment()
      syncStripeReleaseState(a, 'tr_stripe_001', 250000)
      const events = getAssignmentEvents(a.id)
      const releaseEvents = events.filter(e => e.type === 'escrow_released')
      expect(releaseEvents.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ────────────────────────────────────────────
  // 21. cancelAssignment
  // ────────────────────────────────────────────

  describe('cancelAssignment', () => {
    it('cancels in_progress assignment and non-completed milestones', () => {
      const a = buildInProgressAssignment()
      const updated = cancelAssignment(a, BUYER_ID, 'Project cancelled.')
      expect(updated.state).toBe('cancelled')
      expect(updated.subState).toBe('closed')
      expect(updated.cancelledAt).not.toBeNull()
      // First milestone was active, should now be cancelled
      expect(updated.milestones[0].state).toBe('cancelled')
      // Second milestone was pending, should now be cancelled
      expect(updated.milestones[1].state).toBe('cancelled')
    })

    it('preserves accepted milestones on cancellation', () => {
      let a = buildInProgressAssignment()
      const ms0Id = a.milestones[0].id

      // Submit and accept ms 0 — assignment transitions to delivered with ms 1 still pending
      a = submitFulfilment(a, ms0Id, makeSubmission(ms0Id), CREATOR_ID)
      a = openReviewWindow(a, ms0Id)
      a = determineReviewOutcome(a, ms0Id, BUYER_ID, 'content_commit_holder', 'accepted', 'OK')

      // Assignment is now delivered (ms 0 accepted, ms 1 pending)
      const cancelled = cancelAssignment(a, BUYER_ID, 'Budget cut.')
      expect(cancelled.milestones[0].state).toBe('accepted') // preserved
      expect(cancelled.milestones[1].state).toBe('cancelled')
    })

    it('creator can cancel', () => {
      const a = buildInProgressAssignment()
      const updated = cancelAssignment(a, CREATOR_ID, 'Cannot continue.')
      expect(updated.state).toBe('cancelled')
    })

    it('rejects if already confirmed', () => {
      const a = buildConfirmedAssignment()
      expect(a.state).toBe('confirmed')
      expect(() => cancelAssignment(a, BUYER_ID, 'Too late.')).toThrow(AssignmentError)
    })

    it('rejects if already cancelled', () => {
      let a = buildInProgressAssignment()
      a = cancelAssignment(a, BUYER_ID, 'First cancel.')
      expect(() => cancelAssignment(a, BUYER_ID, 'Double cancel.')).toThrow(AssignmentError)
    })

    it('rejects non-party', () => {
      const a = buildInProgressAssignment()
      expect(() => cancelAssignment(a, OUTSIDER_ID, 'Intruder.')).toThrow(AssignmentError)
    })

    it('can cancel brief_issued assignment', () => {
      const draft = issueBrief()
      const updated = cancelAssignment(draft, BUYER_ID, 'Changed mind.')
      expect(updated.state).toBe('cancelled')
      expect(updated.subState).toBe('closed')
    })

    it('emits assignment_cancelled CEL event', () => {
      const a = buildInProgressAssignment()
      const updated = cancelAssignment(a, BUYER_ID, 'Done.')
      const events = getAssignmentEvents(updated.id)
      const cancelEvents = events.filter(e => e.type === 'assignment_cancelled')
      expect(cancelEvents).toHaveLength(1)
    })
  })

  // ────────────────────────────────────────────
  // INTEGRATION: Full lifecycle
  // ────────────────────────────────────────────

  describe('Full lifecycle integration', () => {
    it('brief -> accept -> escrow -> submit -> review -> accept -> settle -> close', () => {
      // 1. Issue brief
      let a = issueAssignmentBrief(makeBriefInput({
        milestones: [
          {
            title: 'Single milestone',
            scopeSummary: 'Complete deliverable',
            milestoneType: 'material',
            dueDate: '2026-06-01T23:59:00Z',
            acceptanceCriteria: '5 photos',
            requiredEvidenceTypes: ['vault_asset'],
            releasableAmountCents: 200000,
            partialAcceptancePermitted: false,
            reviewWindowDays: 5,
          },
        ],
      }))
      expect(a.state).toBe('brief_issued')

      // 2. Accept
      a = acceptAssignment(a, CREATOR_ID)
      expect(a.subState).toBe('accepted_pending_escrow')

      // 3. Escrow capture
      a = syncEscrowCaptureFromStripe(a, 'pi_lifecycle_001', 220000, '2026-04-02T08:00:00Z')
      expect(a.state).toBe('in_progress')
      expect(a.milestones[0].state).toBe('active')

      // 4. Submit fulfilment
      const msId = a.milestones[0].id
      a = submitFulfilment(a, msId, makeSubmission(msId), CREATOR_ID)
      expect(a.state).toBe('delivered')

      // 5. Open review
      a = openReviewWindow(a, msId)
      expect(a.subState).toBe('review_open')

      // 6. Accept review
      a = determineReviewOutcome(a, msId, BUYER_ID, 'content_commit_holder', 'accepted', 'Perfect.')
      expect(a.state).toBe('confirmed')
      expect(a.subState).toBe('settlement_queued')
      expect(a.escrow.totalReleasedCents).toBe(200000)

      // 7. Queue settlement (already queued by determineReviewOutcome, but idempotent call)
      a = queueCreatorSettlement(a)
      expect(a.subState).toBe('settlement_queued')

      // 8. Sync Stripe release
      a = syncStripeReleaseState(a, 'tr_lifecycle_001', 200000)
      expect(a.subState).toBe('closed')
      expect(a.completedAt).not.toBeNull()

      // Verify CEL trail
      const events = getAssignmentEvents(a.id)
      expect(events.length).toBeGreaterThanOrEqual(5)
      const eventTypes = events.map(e => e.type)
      expect(eventTypes).toContain('assignment_created')
      expect(eventTypes).toContain('assignment_accepted')
      expect(eventTypes).toContain('escrow_captured')
      expect(eventTypes).toContain('fulfilment_submitted')
      expect(eventTypes).toContain('review_recorded')
      expect(eventTypes).toContain('escrow_released')
      expect(eventTypes).toContain('settlement_queued')
    })
  })

  // ────────────────────────────────────────────
  // MOCK DATA SCENARIO TESTS
  // ────────────────────────────────────────────

  describe('Operations on mock data scenarios', () => {
    it('materialAssignment: can submit review on fulfilment_submitted milestone', () => {
      const a = materialAssignment
      const ms2 = a.milestones.find(m => m.id === 'ms-mat-001-2')!
      expect(ms2.state).toBe('fulfilment_submitted')

      const updated = determineReviewOutcome(
        a, 'ms-mat-001-2', 'buyer-reuters-01', 'content_commit_holder', 'accepted', 'All good.',
      )
      expect(updated.state).toBe('confirmed')
      expect(updated.escrow.totalReleasedCents).toBe(120000 + 130000)
    })

    it('serviceAssignment: can submit fulfilment on active milestone', () => {
      const a = serviceAssignment
      const ms2 = a.milestones.find(m => m.id === 'ms-svc-001-2')!
      expect(ms2.state).toBe('active')

      const updated = submitFulfilment(a, 'ms-svc-001-2', makeServiceSubmission('ms-svc-001-2'), 'creator-dimitris-01')
      expect(updated.state).toBe('delivered')
      const updatedMs = updated.milestones.find(m => m.id === 'ms-svc-001-2')!
      expect(updatedMs.state).toBe('fulfilment_submitted')
    })

    it('hybridAssignment: can approve pending CCR', () => {
      const a = hybridAssignment
      expect(a.subState).toBe('ccr_pending')
      expect(a.ccrHistory[0].state).toBe('pending')

      const updated = approveCommissionChange(a, 'ccr-hyb-001-1', 'buyer-dw-01', 'Scope expansion approved.')
      const ccr = updated.ccrHistory.find(c => c.id === 'ccr-hyb-001-1')!
      expect(ccr.state).toBe('approved')
      expect(updated.subState).toBe('active')
    })

    it('hybridAssignment: can reject pending CCR', () => {
      const a = hybridAssignment
      const updated = rejectCommissionChange(a, 'ccr-hyb-001-1', 'buyer-dw-01', 'Budget does not allow.')
      const ccr = updated.ccrHistory.find(c => c.id === 'ccr-hyb-001-1')!
      expect(ccr.state).toBe('denied')
    })
  })
})
