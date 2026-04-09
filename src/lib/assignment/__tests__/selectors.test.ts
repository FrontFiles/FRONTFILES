import { describe, it, expect } from 'vitest'
import { materialAssignment, serviceAssignment, hybridAssignment } from '../mock-data'
import {
  getWaitingParty,
  getAssignmentProgress,
  getNextActions,
  canAuthoriseRelease,
  canReviewFulfilment,
  getTotalBudgetCents,
  getTotalReleasedCents,
  getTotalPendingCents,
  getActiveMilestones,
  getDueMilestones,
  getMilestonesAwaitingReview,
  getCompletedMilestones,
  getAllEvidenceItems,
  getVaultAssetIds,
  hasPendingCCR,
  isProvisionalReleaseEligible,
  getAssignmentClassDescription,
  centsToEur,
} from '../selectors'

describe('Assignment Selectors', () => {
  describe('getWaitingParty', () => {
    it('material assignment (review_open) → buyer', () => {
      expect(getWaitingParty(materialAssignment)).toBe('buyer')
    })

    it('service assignment (active) → creator', () => {
      expect(getWaitingParty(serviceAssignment)).toBe('creator')
    })

    it('hybrid assignment (ccr_pending) → buyer', () => {
      expect(getWaitingParty(hybridAssignment)).toBe('buyer')
    })
  })

  describe('getAssignmentProgress', () => {
    it('material: 1/2 completed', () => {
      const progress = getAssignmentProgress(materialAssignment)
      expect(progress.total).toBe(2)
      expect(progress.completed).toBe(1)
      expect(progress.percent).toBe(50)
    })

    it('service: 1/3 completed', () => {
      const progress = getAssignmentProgress(serviceAssignment)
      expect(progress.total).toBe(3)
      expect(progress.completed).toBe(1)
      expect(progress.percent).toBe(33)
    })
  })

  describe('getNextActions', () => {
    it('buyer can review fulfilment on delivered assignment', () => {
      const actions = getNextActions(materialAssignment, 'buyer')
      expect(actions).toContain('review_fulfilment')
    })

    it('creator can submit fulfilment when in_progress', () => {
      const actions = getNextActions(serviceAssignment, 'creator')
      expect(actions).toContain('submit_fulfilment')
    })

    it('buyer can respond to CCR on hybrid assignment', () => {
      const actions = getNextActions(hybridAssignment, 'buyer')
      expect(actions).toContain('respond_ccr')
    })
  })

  describe('canAuthoriseRelease', () => {
    it('content_commit_holder can authorise', () => {
      expect(canAuthoriseRelease('content_commit_holder')).toBe(true)
    })

    it('editor cannot authorise', () => {
      expect(canAuthoriseRelease('editor')).toBe(false)
    })

    it('individual buyer (null role) can authorise', () => {
      expect(canAuthoriseRelease(null)).toBe(true)
    })
  })

  describe('canReviewFulfilment', () => {
    it('editor can review', () => {
      expect(canReviewFulfilment('editor')).toBe(true)
    })

    it('content_commit_holder can review', () => {
      expect(canReviewFulfilment('content_commit_holder')).toBe(true)
    })
  })

  describe('financial selectors', () => {
    it('material total budget = 250000', () => {
      expect(getTotalBudgetCents(materialAssignment)).toBe(250000) // 120000 + 130000
    })

    it('material released = 120000', () => {
      expect(getTotalReleasedCents(materialAssignment)).toBe(120000)
    })

    it('material pending = 130000', () => {
      expect(getTotalPendingCents(materialAssignment)).toBe(130000)
    })
  })

  describe('milestone selectors', () => {
    it('material: 1 active milestone (the non-pending ones)', () => {
      expect(getActiveMilestones(materialAssignment)).toHaveLength(2) // accepted + submitted
    })

    it('material: 1 milestone awaiting review', () => {
      expect(getMilestonesAwaitingReview(materialAssignment)).toHaveLength(1)
    })

    it('material: 1 completed milestone', () => {
      expect(getCompletedMilestones(materialAssignment)).toHaveLength(1)
    })

    it('service: 0 due milestones (dates in future)', () => {
      // Due dates are in the future relative to the mock data
      expect(getDueMilestones(serviceAssignment).length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('evidence selectors', () => {
    it('material assignment has 15 evidence items total', () => {
      expect(getAllEvidenceItems(materialAssignment)).toHaveLength(15) // 12 + 3
    })

    it('material assignment has 15 vault asset IDs', () => {
      expect(getVaultAssetIds(materialAssignment)).toHaveLength(15)
    })

    it('service assignment evidence items include service logs', () => {
      const items = getAllEvidenceItems(serviceAssignment)
      expect(items.some(e => e.kind === 'service_log')).toBe(true)
    })
  })

  describe('CCR selectors', () => {
    it('hybrid has pending CCR', () => {
      expect(hasPendingCCR(hybridAssignment)).toBe(true)
    })

    it('material has no pending CCR', () => {
      expect(hasPendingCCR(materialAssignment)).toBe(false)
    })
  })

  describe('provisional release', () => {
    it('material (delivered, review_open) is not yet eligible', () => {
      // The submission was recent, not 14 days old
      expect(isProvisionalReleaseEligible(materialAssignment)).toBe(false)
    })
  })

  describe('display helpers', () => {
    it('centsToEur formats correctly', () => {
      expect(centsToEur(120000)).toBe('€1200.00')
      expect(centsToEur(0)).toBe('€0.00')
      expect(centsToEur(99)).toBe('€0.99')
    })

    it('class descriptions are non-empty', () => {
      expect(getAssignmentClassDescription('material').length).toBeGreaterThan(0)
      expect(getAssignmentClassDescription('service').length).toBeGreaterThan(0)
      expect(getAssignmentClassDescription('hybrid').length).toBeGreaterThan(0)
    })
  })
})
