import { describe, it, expect } from 'vitest'
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
} from '../guards'
import { AssignmentError } from '../errors'
import { materialAssignment, serviceAssignment, hybridAssignment } from '../mock-data'
import type { Assignment, Milestone, FulfilmentSubmission, EvidenceItemKind } from '@/lib/types'

// ══════════════════════════════════════════════
// STATE MACHINE GUARDS
// ══════════════════════════════════════════════

describe('assertValidSubState', () => {
  it('accepts valid (brief_issued, draft) pair', () => {
    expect(() => assertValidSubState('brief_issued', 'draft')).not.toThrow()
  })

  it('accepts valid (brief_issued, clarification_open) pair', () => {
    expect(() => assertValidSubState('brief_issued', 'clarification_open')).not.toThrow()
  })

  it('accepts valid (brief_issued, accepted_pending_escrow) pair', () => {
    expect(() => assertValidSubState('brief_issued', 'accepted_pending_escrow')).not.toThrow()
  })

  it('accepts valid (in_progress, active) pair', () => {
    expect(() => assertValidSubState('in_progress', 'active')).not.toThrow()
  })

  it('accepts valid (in_progress, milestone_due) pair', () => {
    expect(() => assertValidSubState('in_progress', 'milestone_due')).not.toThrow()
  })

  it('accepts valid (in_progress, ccr_pending) pair', () => {
    expect(() => assertValidSubState('in_progress', 'ccr_pending')).not.toThrow()
  })

  it('accepts valid (delivered, review_open) pair', () => {
    expect(() => assertValidSubState('delivered', 'review_open')).not.toThrow()
  })

  it('accepts valid (delivered, changes_requested) pair', () => {
    expect(() => assertValidSubState('delivered', 'changes_requested')).not.toThrow()
  })

  it('accepts valid (confirmed, settlement_queued) pair', () => {
    expect(() => assertValidSubState('confirmed', 'settlement_queued')).not.toThrow()
  })

  it('accepts valid (confirmed, closed) pair', () => {
    expect(() => assertValidSubState('confirmed', 'closed')).not.toThrow()
  })

  it('accepts valid (cancelled, closed) pair', () => {
    expect(() => assertValidSubState('cancelled', 'closed')).not.toThrow()
  })

  it('accepts valid (disputed, fulfilment_submitted) pair', () => {
    expect(() => assertValidSubState('disputed', 'fulfilment_submitted')).not.toThrow()
  })

  it('throws INVALID_SUB_STATE for (brief_issued, active)', () => {
    expect(() => assertValidSubState('brief_issued', 'active')).toThrow(AssignmentError)
    try {
      assertValidSubState('brief_issued', 'active')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_SUB_STATE')
    }
  })

  it('throws INVALID_SUB_STATE for (in_progress, closed)', () => {
    expect(() => assertValidSubState('in_progress', 'closed')).toThrow(AssignmentError)
    try {
      assertValidSubState('in_progress', 'closed')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_SUB_STATE')
    }
  })

  it('throws INVALID_SUB_STATE for (cancelled, active)', () => {
    expect(() => assertValidSubState('cancelled', 'active')).toThrow(AssignmentError)
    try {
      assertValidSubState('cancelled', 'active')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_SUB_STATE')
    }
  })

  it('throws INVALID_SUB_STATE for (confirmed, active)', () => {
    expect(() => assertValidSubState('confirmed', 'active')).toThrow(AssignmentError)
    try {
      assertValidSubState('confirmed', 'active')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_SUB_STATE')
    }
  })

  it('throws INVALID_SUB_STATE for (delivered, closed)', () => {
    expect(() => assertValidSubState('delivered', 'closed')).toThrow(AssignmentError)
    try {
      assertValidSubState('delivered', 'closed')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_SUB_STATE')
    }
  })
})

describe('assertAssignmentState', () => {
  it('passes when assignment is in one of the expected states', () => {
    // materialAssignment is in 'delivered' state
    expect(() =>
      assertAssignmentState(materialAssignment, ['delivered', 'in_progress'], 'submit_fulfilment'),
    ).not.toThrow()
  })

  it('passes for exact single-state match', () => {
    // serviceAssignment is in 'in_progress'
    expect(() =>
      assertAssignmentState(serviceAssignment, ['in_progress'], 'activate_milestone'),
    ).not.toThrow()
  })

  it('throws INVALID_STATE_TRANSITION when assignment is not in expected state', () => {
    // materialAssignment is 'delivered', not 'brief_issued'
    expect(() =>
      assertAssignmentState(materialAssignment, ['brief_issued'], 'accept_assignment'),
    ).toThrow(AssignmentError)
    try {
      assertAssignmentState(materialAssignment, ['brief_issued'], 'accept_assignment')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_STATE_TRANSITION')
    }
  })

  it('throws when state is not in any of the expected states', () => {
    expect(() =>
      assertAssignmentState(serviceAssignment, ['delivered', 'confirmed', 'cancelled'], 'some_action'),
    ).toThrow(AssignmentError)
  })
})

describe('assertMilestoneState', () => {
  it('passes when milestone is in one of the expected states', () => {
    const activeMilestone = serviceAssignment.milestones[1] // state: 'active'
    expect(() =>
      assertMilestoneState(activeMilestone, ['active', 'pending'], 'submit_fulfilment'),
    ).not.toThrow()
  })

  it('passes for exact single-state match', () => {
    const acceptedMilestone = materialAssignment.milestones[0] // state: 'accepted'
    expect(() =>
      assertMilestoneState(acceptedMilestone, ['accepted'], 'release'),
    ).not.toThrow()
  })

  it('throws INVALID_STATE_TRANSITION when milestone is not in expected state', () => {
    const pendingMilestone = serviceAssignment.milestones[2] // state: 'pending'
    expect(() =>
      assertMilestoneState(pendingMilestone, ['active', 'fulfilment_submitted'], 'submit_fulfilment'),
    ).toThrow(AssignmentError)
    try {
      assertMilestoneState(pendingMilestone, ['active', 'fulfilment_submitted'], 'submit_fulfilment')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_STATE_TRANSITION')
    }
  })

  it('includes milestone id and state in error message', () => {
    const pendingMilestone = serviceAssignment.milestones[2]
    try {
      assertMilestoneState(pendingMilestone, ['active'], 'submit')
    } catch (e) {
      expect((e as AssignmentError).message).toContain(pendingMilestone.id)
      expect((e as AssignmentError).message).toContain('pending')
    }
  })
})

// ══════════════════════════════════════════════
// ROLE GUARDS
// ══════════════════════════════════════════════

describe('assertIsAssignmentParty', () => {
  it('returns "buyer" for the buyerId', () => {
    const result = assertIsAssignmentParty(materialAssignment, 'buyer-reuters-01')
    expect(result).toBe('buyer')
  })

  it('returns "creator" for the creatorId', () => {
    const result = assertIsAssignmentParty(materialAssignment, 'creator-marco-01')
    expect(result).toBe('creator')
  })

  it('throws NOT_ASSIGNMENT_PARTY for a stranger', () => {
    expect(() =>
      assertIsAssignmentParty(materialAssignment, 'stranger-999'),
    ).toThrow(AssignmentError)
    try {
      assertIsAssignmentParty(materialAssignment, 'stranger-999')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('NOT_ASSIGNMENT_PARTY')
      expect((e as AssignmentError).httpStatus).toBe(403)
    }
  })

  it('works with different assignments', () => {
    expect(assertIsAssignmentParty(serviceAssignment, 'buyer-guardian-01')).toBe('buyer')
    expect(assertIsAssignmentParty(serviceAssignment, 'creator-dimitris-01')).toBe('creator')
    expect(assertIsAssignmentParty(hybridAssignment, 'buyer-dw-01')).toBe('buyer')
    expect(assertIsAssignmentParty(hybridAssignment, 'creator-ana-01')).toBe('creator')
  })
})

describe('assertIsBuyer', () => {
  it('passes for the buyer', () => {
    expect(() =>
      assertIsBuyer(materialAssignment, 'buyer-reuters-01'),
    ).not.toThrow()
  })

  it('throws FORBIDDEN_ROLE for the creator', () => {
    expect(() =>
      assertIsBuyer(materialAssignment, 'creator-marco-01'),
    ).toThrow(AssignmentError)
    try {
      assertIsBuyer(materialAssignment, 'creator-marco-01')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('FORBIDDEN_ROLE')
      expect((e as AssignmentError).httpStatus).toBe(403)
    }
  })

  it('throws FORBIDDEN_ROLE for a stranger', () => {
    expect(() =>
      assertIsBuyer(materialAssignment, 'stranger-999'),
    ).toThrow(AssignmentError)
    try {
      assertIsBuyer(materialAssignment, 'stranger-999')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('FORBIDDEN_ROLE')
    }
  })
})

describe('assertIsCreator', () => {
  it('passes for the creator', () => {
    expect(() =>
      assertIsCreator(materialAssignment, 'creator-marco-01'),
    ).not.toThrow()
  })

  it('throws FORBIDDEN_ROLE for the buyer', () => {
    expect(() =>
      assertIsCreator(materialAssignment, 'buyer-reuters-01'),
    ).toThrow(AssignmentError)
    try {
      assertIsCreator(materialAssignment, 'buyer-reuters-01')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('FORBIDDEN_ROLE')
      expect((e as AssignmentError).httpStatus).toBe(403)
    }
  })

  it('throws FORBIDDEN_ROLE for a stranger', () => {
    expect(() =>
      assertIsCreator(serviceAssignment, 'stranger-999'),
    ).toThrow(AssignmentError)
    try {
      assertIsCreator(serviceAssignment, 'stranger-999')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('FORBIDDEN_ROLE')
    }
  })
})

describe('assertCanAuthoriseRelease', () => {
  describe('accepted determination', () => {
    it('passes for content_commit_holder', () => {
      expect(() => assertCanAuthoriseRelease('content_commit_holder', 'accepted')).not.toThrow()
    })

    it('passes for null (individual buyer)', () => {
      expect(() => assertCanAuthoriseRelease(null, 'accepted')).not.toThrow()
    })

    it('throws EDITOR_CANNOT_AUTHORISE_RELEASE for editor', () => {
      expect(() => assertCanAuthoriseRelease('editor', 'accepted')).toThrow(AssignmentError)
      try {
        assertCanAuthoriseRelease('editor', 'accepted')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('EDITOR_CANNOT_AUTHORISE_RELEASE')
        expect((e as AssignmentError).httpStatus).toBe(403)
      }
    })

    it('throws FORBIDDEN_ROLE for admin', () => {
      expect(() => assertCanAuthoriseRelease('admin', 'accepted')).toThrow(AssignmentError)
      try {
        assertCanAuthoriseRelease('admin', 'accepted')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('FORBIDDEN_ROLE')
        expect((e as AssignmentError).httpStatus).toBe(403)
      }
    })
  })

  describe('accepted_partial determination', () => {
    it('passes for content_commit_holder', () => {
      expect(() => assertCanAuthoriseRelease('content_commit_holder', 'accepted_partial')).not.toThrow()
    })

    it('passes for null (individual buyer)', () => {
      expect(() => assertCanAuthoriseRelease(null, 'accepted_partial')).not.toThrow()
    })

    it('throws EDITOR_CANNOT_AUTHORISE_RELEASE for editor', () => {
      expect(() => assertCanAuthoriseRelease('editor', 'accepted_partial')).toThrow(AssignmentError)
      try {
        assertCanAuthoriseRelease('editor', 'accepted_partial')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('EDITOR_CANNOT_AUTHORISE_RELEASE')
      }
    })

    it('throws FORBIDDEN_ROLE for admin', () => {
      expect(() => assertCanAuthoriseRelease('admin', 'accepted_partial')).toThrow(AssignmentError)
      try {
        assertCanAuthoriseRelease('admin', 'accepted_partial')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('FORBIDDEN_ROLE')
      }
    })
  })

  describe('non-release determinations (changes_requested, rejected, dispute_opened)', () => {
    const nonRelease: Array<'changes_requested' | 'rejected' | 'dispute_opened'> = [
      'changes_requested',
      'rejected',
      'dispute_opened',
    ]

    for (const determination of nonRelease) {
      it(`passes for editor on ${determination}`, () => {
        expect(() => assertCanAuthoriseRelease('editor', determination)).not.toThrow()
      })

      it(`passes for admin on ${determination}`, () => {
        expect(() => assertCanAuthoriseRelease('admin', determination)).not.toThrow()
      })

      it(`passes for content_commit_holder on ${determination}`, () => {
        expect(() => assertCanAuthoriseRelease('content_commit_holder', determination)).not.toThrow()
      })

      it(`passes for null (individual) on ${determination}`, () => {
        expect(() => assertCanAuthoriseRelease(null, determination)).not.toThrow()
      })
    }
  })
})

describe('assertCanReview', () => {
  it('passes for editor', () => {
    expect(() => assertCanReview('editor')).not.toThrow()
  })

  it('passes for content_commit_holder', () => {
    expect(() => assertCanReview('content_commit_holder')).not.toThrow()
  })

  it('passes for null (individual buyer)', () => {
    expect(() => assertCanReview(null)).not.toThrow()
  })

  it('throws REVIEWER_CANNOT_REVIEW for admin', () => {
    expect(() => assertCanReview('admin')).toThrow(AssignmentError)
    try {
      assertCanReview('admin')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('REVIEWER_CANNOT_REVIEW')
      expect((e as AssignmentError).httpStatus).toBe(403)
    }
  })
})

// ══════════════════════════════════════════════
// FULFILMENT GUARDS
// ══════════════════════════════════════════════

describe('assertFulfilmentNotEmpty', () => {
  it('throws FULFILMENT_EMPTY when evidenceItems is empty', () => {
    const emptySubmission: FulfilmentSubmission = {
      id: 'fs-empty',
      milestoneId: 'ms-test',
      fulfilmentType: 'asset',
      evidenceItems: [],
      creatorNotes: null,
      submittedAt: '2026-04-08T00:00:00Z',
    }
    expect(() => assertFulfilmentNotEmpty(emptySubmission)).toThrow(AssignmentError)
    try {
      assertFulfilmentNotEmpty(emptySubmission)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('FULFILMENT_EMPTY')
    }
  })

  it('passes when evidenceItems has at least one item', () => {
    // materialAssignment milestone 1 has 12 evidence items
    const submission = materialAssignment.milestones[0].fulfilmentSubmissions[0]
    expect(() => assertFulfilmentNotEmpty(submission)).not.toThrow()
  })

  it('passes with a single evidence item', () => {
    const submission: FulfilmentSubmission = {
      id: 'fs-one',
      milestoneId: 'ms-test',
      fulfilmentType: 'service',
      evidenceItems: [
        {
          id: 'ev-single',
          kind: 'service_log',
          label: 'Test log',
          description: null,
          vaultAssetId: null,
          fileRef: null,
          fileName: null,
          fileSizeBytes: null,
          serviceLog: { date: '2026-04-08', startTime: '09:00', endTime: '17:00', location: 'Test', role: 'Fixer', completedDuties: 'Test' },
          createdAt: '2026-04-08T00:00:00Z',
        },
      ],
      creatorNotes: null,
      submittedAt: '2026-04-08T00:00:00Z',
    }
    expect(() => assertFulfilmentNotEmpty(submission)).not.toThrow()
  })
})

describe('assertEvidenceMatchesMilestone', () => {
  describe('material milestones', () => {
    it('passes when vault_asset is present', () => {
      const milestone = materialAssignment.milestones[0] // milestoneType: 'material'
      const kinds: EvidenceItemKind[] = ['vault_asset']
      expect(() => assertEvidenceMatchesMilestone(milestone, kinds)).not.toThrow()
    })

    it('passes when vault_asset is present among other kinds', () => {
      const milestone = materialAssignment.milestones[0]
      const kinds: EvidenceItemKind[] = ['vault_asset', 'support_document']
      expect(() => assertEvidenceMatchesMilestone(milestone, kinds)).not.toThrow()
    })

    it('throws MATERIAL_MILESTONE_REQUIRES_ASSETS when no vault_asset', () => {
      const milestone = materialAssignment.milestones[0]
      const kinds: EvidenceItemKind[] = ['service_log', 'support_document']
      expect(() => assertEvidenceMatchesMilestone(milestone, kinds)).toThrow(AssignmentError)
      try {
        assertEvidenceMatchesMilestone(milestone, kinds)
      } catch (e) {
        expect((e as AssignmentError).code).toBe('MATERIAL_MILESTONE_REQUIRES_ASSETS')
      }
    })

    it('throws MATERIAL_MILESTONE_REQUIRES_ASSETS when kinds array is empty', () => {
      const milestone = materialAssignment.milestones[0]
      expect(() => assertEvidenceMatchesMilestone(milestone, [])).toThrow(AssignmentError)
      try {
        assertEvidenceMatchesMilestone(milestone, [])
      } catch (e) {
        expect((e as AssignmentError).code).toBe('MATERIAL_MILESTONE_REQUIRES_ASSETS')
      }
    })
  })

  describe('service milestones', () => {
    it('passes when service_log is present', () => {
      const milestone = hybridAssignment.milestones[0] // milestoneType: 'service'
      const kinds: EvidenceItemKind[] = ['service_log']
      expect(() => assertEvidenceMatchesMilestone(milestone, kinds)).not.toThrow()
    })

    it('passes when service_log is present among other kinds', () => {
      const milestone = hybridAssignment.milestones[0]
      const kinds: EvidenceItemKind[] = ['service_log', 'handoff_note', 'support_document']
      expect(() => assertEvidenceMatchesMilestone(milestone, kinds)).not.toThrow()
    })

    it('throws SERVICE_MILESTONE_REQUIRES_LOGS when no service_log', () => {
      const milestone = hybridAssignment.milestones[0]
      const kinds: EvidenceItemKind[] = ['vault_asset', 'support_document']
      expect(() => assertEvidenceMatchesMilestone(milestone, kinds)).toThrow(AssignmentError)
      try {
        assertEvidenceMatchesMilestone(milestone, kinds)
      } catch (e) {
        expect((e as AssignmentError).code).toBe('SERVICE_MILESTONE_REQUIRES_LOGS')
      }
    })

    it('throws SERVICE_MILESTONE_REQUIRES_LOGS when kinds array is empty', () => {
      const milestone = hybridAssignment.milestones[0]
      expect(() => assertEvidenceMatchesMilestone(milestone, [])).toThrow(AssignmentError)
      try {
        assertEvidenceMatchesMilestone(milestone, [])
      } catch (e) {
        expect((e as AssignmentError).code).toBe('SERVICE_MILESTONE_REQUIRES_LOGS')
      }
    })
  })

  describe('hybrid milestones', () => {
    const hybridMilestone = {
      ...hybridAssignment.milestones[0],
      milestoneType: 'hybrid' as const,
    }

    it('passes when both vault_asset and service_log are present', () => {
      const kinds: EvidenceItemKind[] = ['vault_asset', 'service_log']
      expect(() => assertEvidenceMatchesMilestone(hybridMilestone, kinds)).not.toThrow()
    })

    it('throws when only vault_asset is present (hybrid requires both)', () => {
      const kinds: EvidenceItemKind[] = ['vault_asset']
      expect(() => assertEvidenceMatchesMilestone(hybridMilestone, kinds)).toThrow('Hybrid milestone requires both')
    })

    it('throws when only service_log is present (hybrid requires both)', () => {
      const kinds: EvidenceItemKind[] = ['service_log']
      expect(() => assertEvidenceMatchesMilestone(hybridMilestone, kinds)).toThrow('Hybrid milestone requires both')
    })

    it('throws EVIDENCE_TYPE_MISMATCH when neither vault_asset nor service_log', () => {
      const kinds: EvidenceItemKind[] = ['support_document', 'handoff_note']
      expect(() => assertEvidenceMatchesMilestone(hybridMilestone, kinds)).toThrow(AssignmentError)
      try {
        assertEvidenceMatchesMilestone(hybridMilestone, kinds)
      } catch (e) {
        expect((e as AssignmentError).code).toBe('EVIDENCE_TYPE_MISMATCH')
      }
    })

    it('throws EVIDENCE_TYPE_MISMATCH when kinds array is empty', () => {
      expect(() => assertEvidenceMatchesMilestone(hybridMilestone, [])).toThrow(AssignmentError)
      try {
        assertEvidenceMatchesMilestone(hybridMilestone, [])
      } catch (e) {
        expect((e as AssignmentError).code).toBe('EVIDENCE_TYPE_MISMATCH')
      }
    })
  })
})

// ══════════════════════════════════════════════
// REVIEW GUARDS
// ══════════════════════════════════════════════

describe('assertPartialAmountValid', () => {
  const partialMilestone: Milestone = {
    ...materialAssignment.milestones[1], // partialAcceptancePermitted: true, releasableAmountCents: 130000
  }

  const noPartialMilestone: Milestone = {
    ...materialAssignment.milestones[0], // partialAcceptancePermitted: false
  }

  describe('non-partial determinations', () => {
    it('passes for accepted determination regardless of amount', () => {
      expect(() => assertPartialAmountValid(partialMilestone, undefined, 'accepted')).not.toThrow()
    })

    it('passes for changes_requested determination', () => {
      expect(() => assertPartialAmountValid(partialMilestone, undefined, 'changes_requested')).not.toThrow()
    })

    it('passes for rejected determination', () => {
      expect(() => assertPartialAmountValid(partialMilestone, undefined, 'rejected')).not.toThrow()
    })

    it('passes for dispute_opened determination', () => {
      expect(() => assertPartialAmountValid(partialMilestone, undefined, 'dispute_opened')).not.toThrow()
    })
  })

  describe('accepted_partial determination', () => {
    it('throws PARTIAL_RELEASE_NOT_PERMITTED when milestone forbids partial', () => {
      expect(() =>
        assertPartialAmountValid(noPartialMilestone, 50000, 'accepted_partial'),
      ).toThrow(AssignmentError)
      try {
        assertPartialAmountValid(noPartialMilestone, 50000, 'accepted_partial')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('PARTIAL_RELEASE_NOT_PERMITTED')
      }
    })

    it('throws PARTIAL_AMOUNT_EXCEEDS_RELEASABLE when amount is undefined', () => {
      expect(() =>
        assertPartialAmountValid(partialMilestone, undefined, 'accepted_partial'),
      ).toThrow(AssignmentError)
      try {
        assertPartialAmountValid(partialMilestone, undefined, 'accepted_partial')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('PARTIAL_AMOUNT_EXCEEDS_RELEASABLE')
      }
    })

    it('throws PARTIAL_AMOUNT_EXCEEDS_RELEASABLE when amount is 0', () => {
      expect(() =>
        assertPartialAmountValid(partialMilestone, 0, 'accepted_partial'),
      ).toThrow(AssignmentError)
      try {
        assertPartialAmountValid(partialMilestone, 0, 'accepted_partial')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('PARTIAL_AMOUNT_EXCEEDS_RELEASABLE')
      }
    })

    it('throws PARTIAL_AMOUNT_EXCEEDS_RELEASABLE when amount is negative', () => {
      expect(() =>
        assertPartialAmountValid(partialMilestone, -1000, 'accepted_partial'),
      ).toThrow(AssignmentError)
      try {
        assertPartialAmountValid(partialMilestone, -1000, 'accepted_partial')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('PARTIAL_AMOUNT_EXCEEDS_RELEASABLE')
      }
    })

    it('throws PARTIAL_AMOUNT_EXCEEDS_RELEASABLE when amount exceeds releasable', () => {
      expect(() =>
        assertPartialAmountValid(partialMilestone, 200000, 'accepted_partial'), // releasable is 130000
      ).toThrow(AssignmentError)
      try {
        assertPartialAmountValid(partialMilestone, 200000, 'accepted_partial')
      } catch (e) {
        expect((e as AssignmentError).code).toBe('PARTIAL_AMOUNT_EXCEEDS_RELEASABLE')
        expect((e as AssignmentError).message).toContain('200000')
        expect((e as AssignmentError).message).toContain('130000')
      }
    })

    it('passes when amount is valid and within releasable', () => {
      expect(() =>
        assertPartialAmountValid(partialMilestone, 50000, 'accepted_partial'),
      ).not.toThrow()
    })

    it('passes when amount equals releasable exactly', () => {
      expect(() =>
        assertPartialAmountValid(partialMilestone, 130000, 'accepted_partial'),
      ).not.toThrow()
    })

    it('passes with a small positive amount', () => {
      expect(() =>
        assertPartialAmountValid(partialMilestone, 1, 'accepted_partial'),
      ).not.toThrow()
    })
  })
})

// ══════════════════════════════════════════════
// CCR GUARDS
// ══════════════════════════════════════════════

describe('assertNoPendingCCR', () => {
  it('passes when ccrHistory is empty', () => {
    // materialAssignment has empty ccrHistory
    expect(() => assertNoPendingCCR(materialAssignment)).not.toThrow()
  })

  it('throws CCR_ALREADY_PENDING when a pending CCR exists', () => {
    // hybridAssignment has a pending CCR
    expect(() => assertNoPendingCCR(hybridAssignment)).toThrow(AssignmentError)
    try {
      assertNoPendingCCR(hybridAssignment)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('CCR_ALREADY_PENDING')
    }
  })

  it('passes when ccrHistory has only non-pending CCRs', () => {
    const withApprovedCCR = {
      ...materialAssignment,
      ccrHistory: [
        {
          id: 'ccr-test-1',
          assignmentId: materialAssignment.id,
          requesterId: materialAssignment.creatorId,
          state: 'approved' as const,
          amendedFields: [{ field: 'deadline', currentValue: '2026-05-01', proposedValue: '2026-05-10' }],
          rationale: 'Need more time',
          responseDeadline: '2026-04-20T23:59:00Z',
          respondedAt: '2026-04-18T10:00:00Z',
          responseNote: 'Approved',
          createdAt: '2026-04-15T10:00:00Z',
        },
      ],
    } as Assignment
    expect(() => assertNoPendingCCR(withApprovedCCR)).not.toThrow()
  })

  it('passes when ccrHistory has denied CCR', () => {
    const withDeniedCCR = {
      ...materialAssignment,
      ccrHistory: [
        {
          id: 'ccr-test-2',
          assignmentId: materialAssignment.id,
          requesterId: materialAssignment.creatorId,
          state: 'denied' as const,
          amendedFields: [{ field: 'scope', currentValue: 'Original', proposedValue: 'Expanded' }],
          rationale: 'Want expanded scope',
          responseDeadline: '2026-04-20T23:59:00Z',
          respondedAt: '2026-04-18T10:00:00Z',
          responseNote: 'Denied',
          createdAt: '2026-04-15T10:00:00Z',
        },
      ],
    } as Assignment
    expect(() => assertNoPendingCCR(withDeniedCCR)).not.toThrow()
  })
})

describe('assertCCRAllowed', () => {
  it('passes when assignment is in_progress', () => {
    // serviceAssignment is 'in_progress'
    expect(() => assertCCRAllowed(serviceAssignment)).not.toThrow()
  })

  it('passes when assignment is delivered', () => {
    // materialAssignment is 'delivered'
    expect(() => assertCCRAllowed(materialAssignment)).not.toThrow()
  })

  it('throws CCR_NOT_AMENDABLE_IN_STATE when assignment is brief_issued', () => {
    const briefIssued = {
      ...materialAssignment,
      state: 'brief_issued' as const,
      subState: 'draft' as const,
    } as Assignment
    expect(() => assertCCRAllowed(briefIssued)).toThrow(AssignmentError)
    try {
      assertCCRAllowed(briefIssued)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('CCR_NOT_AMENDABLE_IN_STATE')
    }
  })

  it('throws CCR_NOT_AMENDABLE_IN_STATE when assignment is confirmed', () => {
    const confirmed = {
      ...materialAssignment,
      state: 'confirmed' as const,
      subState: 'closed' as const,
    } as Assignment
    expect(() => assertCCRAllowed(confirmed)).toThrow(AssignmentError)
    try {
      assertCCRAllowed(confirmed)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('CCR_NOT_AMENDABLE_IN_STATE')
    }
  })

  it('throws CCR_NOT_AMENDABLE_IN_STATE when assignment is cancelled', () => {
    const cancelled = {
      ...materialAssignment,
      state: 'cancelled' as const,
      subState: 'closed' as const,
    } as Assignment
    expect(() => assertCCRAllowed(cancelled)).toThrow(AssignmentError)
    try {
      assertCCRAllowed(cancelled)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('CCR_NOT_AMENDABLE_IN_STATE')
    }
  })

  it('throws CCR_NOT_AMENDABLE_IN_STATE when assignment is disputed', () => {
    const disputed = {
      ...materialAssignment,
      state: 'disputed' as const,
      subState: 'fulfilment_submitted' as const,
    } as Assignment
    expect(() => assertCCRAllowed(disputed)).toThrow(AssignmentError)
    try {
      assertCCRAllowed(disputed)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('CCR_NOT_AMENDABLE_IN_STATE')
    }
  })
})

// ══════════════════════════════════════════════
// DISPUTE GUARDS
// ══════════════════════════════════════════════

describe('assertNoOpenDispute', () => {
  it('passes when no milestone is disputed and assignment is not disputed', () => {
    expect(() => assertNoOpenDispute(materialAssignment, 'ms-mat-001-2')).not.toThrow()
  })

  it('passes with null milestoneId when assignment is not disputed', () => {
    expect(() => assertNoOpenDispute(materialAssignment, null)).not.toThrow()
  })

  it('throws DISPUTE_ALREADY_OPEN when the target milestone is disputed', () => {
    const withDisputedMilestone = {
      ...materialAssignment,
      milestones: [
        materialAssignment.milestones[0],
        { ...materialAssignment.milestones[1], state: 'disputed' as const },
      ],
    } as Assignment
    expect(() => assertNoOpenDispute(withDisputedMilestone, 'ms-mat-001-2')).toThrow(AssignmentError)
    try {
      assertNoOpenDispute(withDisputedMilestone, 'ms-mat-001-2')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('DISPUTE_ALREADY_OPEN')
      expect((e as AssignmentError).message).toContain('ms-mat-001-2')
    }
  })

  it('throws DISPUTE_ALREADY_OPEN when assignment state is disputed', () => {
    const disputedAssignment = {
      ...materialAssignment,
      state: 'disputed' as const,
      subState: 'fulfilment_submitted' as const,
    } as Assignment
    expect(() => assertNoOpenDispute(disputedAssignment, null)).toThrow(AssignmentError)
    try {
      assertNoOpenDispute(disputedAssignment, null)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('DISPUTE_ALREADY_OPEN')
    }
  })

  it('throws DISPUTE_ALREADY_OPEN when assignment is disputed even if milestoneId is provided for a non-disputed milestone', () => {
    const disputedAssignment = {
      ...materialAssignment,
      state: 'disputed' as const,
      subState: 'fulfilment_submitted' as const,
    } as Assignment
    // milestone itself is not disputed, but assignment is
    expect(() => assertNoOpenDispute(disputedAssignment, 'ms-mat-001-1')).toThrow(AssignmentError)
    try {
      assertNoOpenDispute(disputedAssignment, 'ms-mat-001-1')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('DISPUTE_ALREADY_OPEN')
    }
  })

  it('does not throw for a milestoneId that does not exist in the assignment', () => {
    // milestone not found, so milestone?.state check is undefined, not 'disputed'
    // and assignment state is 'delivered', not 'disputed'
    expect(() => assertNoOpenDispute(materialAssignment, 'ms-nonexistent')).not.toThrow()
  })
})

describe('assertNoDisputeFreeze', () => {
  it('passes when totalFrozenCents is 0', () => {
    // materialAssignment has totalFrozenCents: 0
    expect(() => assertNoDisputeFreeze(materialAssignment)).not.toThrow()
  })

  it('passes when totalFrozenCents is 0 (service assignment)', () => {
    expect(() => assertNoDisputeFreeze(serviceAssignment)).not.toThrow()
  })

  it('throws DISPUTE_FREEZE_OVERRIDES_RELEASE when totalFrozenCents > 0', () => {
    const frozenAssignment = {
      ...materialAssignment,
      escrow: {
        ...materialAssignment.escrow,
        totalFrozenCents: 130000,
      },
    } as Assignment
    expect(() => assertNoDisputeFreeze(frozenAssignment)).toThrow(AssignmentError)
    try {
      assertNoDisputeFreeze(frozenAssignment)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('DISPUTE_FREEZE_OVERRIDES_RELEASE')
    }
  })

  it('throws for any positive frozen amount', () => {
    const frozenAssignment = {
      ...materialAssignment,
      escrow: {
        ...materialAssignment.escrow,
        totalFrozenCents: 1,
      },
    } as Assignment
    expect(() => assertNoDisputeFreeze(frozenAssignment)).toThrow(AssignmentError)
    try {
      assertNoDisputeFreeze(frozenAssignment)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('DISPUTE_FREEZE_OVERRIDES_RELEASE')
    }
  })
})
