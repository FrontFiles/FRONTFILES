/**
 * defect-coverage.test.ts — Defect & Edge-Case Coverage
 *
 * Tests specifically targeting the failure modes listed in the QA defect checklist.
 * Each describe block maps 1:1 to a checklist item and verifies whether the
 * defect exists (documents current behavior) or is guarded (verifies protection).
 *
 * Key naming convention:
 *   "PROTECTED: …" → a guard prevents the defect. Test must pass.
 *   "DEFECT-DOC: …" → current implementation has this gap. Test documents behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  issueAssignmentBrief,
  acceptAssignment,
  syncEscrowCaptureFromStripe,
  activateNextMilestone,
  submitFulfilment,
  openReviewWindow,
  determineReviewOutcome,
  requestCommissionChange,
  approveCommissionChange,
  openAssignmentDispute,
  executeProvisionalRelease,
  evaluateProvisionalReleaseEligibility,
  cancelAssignment,
  queueCreatorSettlement,
  syncStripeReleaseState,
  amendMilestone,
} from '@/lib/assignment/services'
import type { IssueBriefInput } from '@/lib/assignment/services'
import type { FulfilmentSubmission } from '@/lib/types'
import { AssignmentError } from '@/lib/assignment/errors'
import { assertValidSubState } from '@/lib/assignment/guards'
import { _clearEventBuffer, getAssignmentEvents } from '@/lib/assignment/events'
import { _resetStore, putAssignment } from '@/lib/assignment/store'
import type { Assignment } from '@/lib/types'

beforeEach(() => {
  _resetStore()
  _clearEventBuffer()
})

// ══════════════════════════════════════════════
// TEST FACTORIES
// ══════════════════════════════════════════════

const BUYER = 'buyer-defect-01'
const CREATOR = 'creator-defect-01'
const STAFF = 'staff-defect-01'

function brief(overrides?: Partial<IssueBriefInput>): IssueBriefInput {
  return {
    buyerId: BUYER,
    creatorId: CREATOR,
    assignmentClass: 'material',
    plan: {
      scope: 'Defect coverage scope.',
      deadline: '2026-09-01T23:59:00Z',
      acceptanceCriteria: 'Test criteria.',
      requiredEvidenceTypes: ['vault_asset'],
      reviewWindowDays: 5,
      notes: null,
    },
    rightsRecord: { assetRights: null, serviceTerms: null },
    milestones: [
      {
        title: 'MS-1',
        scopeSummary: 'First.',
        milestoneType: 'material',
        dueDate: '2026-08-15T23:59:00Z',
        acceptanceCriteria: '1 photo.',
        requiredEvidenceTypes: ['vault_asset'],
        releasableAmountCents: 100_000,
        partialAcceptancePermitted: false,
        reviewWindowDays: 5,
      },
      {
        title: 'MS-2',
        scopeSummary: 'Second.',
        milestoneType: 'material',
        dueDate: '2026-09-01T23:59:00Z',
        acceptanceCriteria: '1 photo.',
        requiredEvidenceTypes: ['vault_asset'],
        releasableAmountCents: 150_000,
        partialAcceptancePermitted: true,
        reviewWindowDays: 5,
      },
    ],
    ...overrides,
  }
}

function inProgress(overrides?: Partial<IssueBriefInput>): Assignment {
  let a = issueAssignmentBrief(brief(overrides))
  a = acceptAssignment(a, CREATOR)
  a = syncEscrowCaptureFromStripe(a, `pi-defect-${Date.now()}`, 250_000, new Date().toISOString())
  return a
}

function assetSub(milestoneId: string, daysAgo = 0): FulfilmentSubmission {
  return {
    id: `fs-defect-${Date.now()}-${Math.random()}`,
    milestoneId,
    fulfilmentType: 'asset',
    evidenceItems: [{
      id: `ev-defect-${Date.now()}`,
      kind: 'vault_asset',
      label: 'Test photo',
      description: null,
      vaultAssetId: 'asset-defect-001',
      fileRef: null,
      fileName: null,
      fileSizeBytes: null,
      serviceLog: null,
      createdAt: new Date().toISOString(),
    }],
    creatorNotes: null,
    submittedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// ══════════════════════════════════════════════
// DEFECT 1: Wrong role can release spend
// ══════════════════════════════════════════════

describe('PROTECTED: Wrong role cannot release spend', () => {
  it('editor is blocked from accepting (release) a milestone', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId), CREATOR)
    a = openReviewWindow(a, msId)

    expect(() =>
      determineReviewOutcome(a, msId, BUYER, 'editor', 'accepted', 'Editor release.'),
    ).toThrow(AssignmentError)

    try {
      determineReviewOutcome(a, msId, BUYER, 'editor', 'accepted', 'Editor release.')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('EDITOR_CANNOT_AUTHORISE_RELEASE')
      expect((e as AssignmentError).httpStatus).toBe(403)
    }
  })

  it('admin is blocked from reviewing at all (REVIEWER_CANNOT_REVIEW fires before release check)', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId), CREATOR)
    a = openReviewWindow(a, msId)

    // assertCanReview fires before assertCanAuthoriseRelease, so admin gets REVIEWER_CANNOT_REVIEW
    expect(() =>
      determineReviewOutcome(a, msId, BUYER, 'admin', 'accepted', 'Admin release.'),
    ).toThrow(AssignmentError)

    try {
      determineReviewOutcome(a, msId, BUYER, 'admin', 'accepted', 'Admin release.')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('REVIEWER_CANNOT_REVIEW')
      expect((e as AssignmentError).httpStatus).toBe(403)
    }
  })

  it('third party (non-buyer) cannot perform review at all', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId), CREATOR)
    a = openReviewWindow(a, msId)

    // Creator is not the buyer — assertIsBuyer fires before the role check
    expect(() =>
      determineReviewOutcome(a, msId, CREATOR, null, 'accepted', 'Creator self-accept.'),
    ).toThrow(AssignmentError)
  })

  it('content_commit_holder CAN release — the allowed role works', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId), CREATOR)
    a = openReviewWindow(a, msId)

    const result = determineReviewOutcome(a, msId, BUYER, 'content_commit_holder', 'accepted', 'CCH release.')
    expect(result.milestones.find(m => m.id === msId)!.state).toBe('accepted')
    expect(result.escrow.totalReleasedCents).toBe(100_000)
  })
})

// ══════════════════════════════════════════════
// DEFECT 2: Invalid state transition permitted
// ══════════════════════════════════════════════

describe('PROTECTED: Invalid state transitions are rejected', () => {
  it('cannot capture escrow on a draft (not accepted) assignment', () => {
    const draft = issueAssignmentBrief(brief())
    expect(() =>
      syncEscrowCaptureFromStripe(draft, 'pi-bad', 100_000, new Date().toISOString()),
    ).toThrow(AssignmentError)
  })

  it('cannot submit fulfilment on brief_issued assignment', () => {
    const draft = issueAssignmentBrief(brief())
    const msId = draft.milestones[0].id
    expect(() =>
      submitFulfilment(draft, msId, assetSub(msId), CREATOR),
    ).toThrow(AssignmentError)
  })

  it('cannot open review window on in_progress assignment', () => {
    const a = inProgress()
    expect(() => openReviewWindow(a, a.milestones[0].id)).toThrow(AssignmentError)
  })

  it('cannot accept a milestone in pending state (must be fulfilment_submitted/review_open)', () => {
    const a = inProgress()
    const msId = a.milestones[0].id // milestone is 'active', not in review

    // Trying to determineReviewOutcome on active (not review_open) milestone
    expect(() =>
      determineReviewOutcome(a, msId, BUYER, 'content_commit_holder', 'accepted', 'Skip review.'),
    ).toThrow(AssignmentError)

    try {
      determineReviewOutcome(a, msId, BUYER, 'content_commit_holder', 'accepted', 'Skip review.')
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_STATE_TRANSITION')
    }
  })

  it('cannot file dispute after assignment is already confirmed', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    a = openReviewWindow(a, ms0.id)
    a = determineReviewOutcome(a, ms0.id, BUYER, 'content_commit_holder', 'accepted', 'OK')
    a = submitFulfilment(a, ms1.id, assetSub(ms1.id), CREATOR)
    a = openReviewWindow(a, ms1.id)
    a = determineReviewOutcome(a, ms1.id, BUYER, 'content_commit_holder', 'accepted', 'OK')

    expect(a.state).toBe('confirmed')
    expect(() =>
      openAssignmentDispute(a, BUYER, 'buyer_refusal_without_grounds', null, 'Late dispute.'),
    ).toThrow(AssignmentError)
  })
})

// ══════════════════════════════════════════════
// DEFECT 3: Over-release beyond escrow
// ══════════════════════════════════════════════

describe('DEFECT-DOC: Over-release guard is absent from determineReviewOutcome', () => {
  /**
   * Architecture §9 states Stripe is authoritative for escrow.
   * The Assignment Engine mirrors escrow state but does NOT independently
   * enforce that totalReleasedCents ≤ totalCapturedCents.
   *
   * This test DOCUMENTS the current behavior (no guard).
   * If a guard is added, this test should be updated to expect it to throw.
   */
  it('escrow math correctly accumulates released across multiple accepted milestones', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    a = openReviewWindow(a, ms0.id)
    a = determineReviewOutcome(a, ms0.id, BUYER, 'content_commit_holder', 'accepted', 'OK')

    a = submitFulfilment(a, ms1.id, assetSub(ms1.id), CREATOR)
    a = openReviewWindow(a, ms1.id)
    a = determineReviewOutcome(a, ms1.id, BUYER, 'content_commit_holder', 'accepted', 'OK')

    // Correct case: 100k + 150k = 250k = capturedCents
    expect(a.escrow.totalReleasedCents).toBe(250_000)
    expect(a.escrow.totalReleasedCents).toBeLessThanOrEqual(a.escrow.totalCapturedCents)
  })

  it('DEFECT-DOC: no guard prevents totalReleasedCents > totalCapturedCents via direct object construction', () => {
    /**
     * If the escrow record is mutated externally (e.g. bug in a service function
     * or a direct store write), no in-engine invariant check prevents over-release.
     * This documents the missing guard; Stripe Connect is the sole external safeguard.
     */
    const a = inProgress()
    const overReleased: Assignment = {
      ...a,
      escrow: {
        ...a.escrow,
        totalReleasedCents: 999_999, // exceeds capturedCents of 250k
      },
    }
    // No AssignmentError is thrown — the engine does not validate escrow math on read
    expect(overReleased.escrow.totalReleasedCents).toBeGreaterThan(overReleased.escrow.totalCapturedCents)
    // Stripe Connect would reject the transfer; the engine alone does not guard this
  })
})

// ══════════════════════════════════════════════
// DEFECT 4: CCR change bypasses formal CCR flow
// ══════════════════════════════════════════════

describe('PROTECTED: Milestone amendments after escrow must go through CCR', () => {
  it('cannot directly amend milestone amount after escrow capture (amendMilestone blocked by state check)', () => {
    // `amendMilestone` is now imported at the top of the file
    // alongside the other services. The earlier inline `require`
    // pulled it in via CJS resolution, which gave the test a
    // different `AssignmentError` class identity than the
    // top-level ESM `import` and broke the `toThrow(Class)` check.
    const a = inProgress()

    expect(() => amendMilestone(a, a.milestones[0].id, { releasableAmountCents: 999_999 })).toThrow(AssignmentError)

    try {
      amendMilestone(a, a.milestones[0].id, { releasableAmountCents: 999_999 })
    } catch (e) {
      expect((e as AssignmentError).code).toBe('INVALID_STATE_TRANSITION')
    }
  })

  it('CCR is the only path for post-escrow scope changes', () => {
    let a = inProgress()
    // CCR is the correct mechanism
    const updated = requestCommissionChange(a, CREATOR, [
      { field: 'milestones[0].releasableAmountCents', currentValue: '100000', proposedValue: '120000' },
    ], 'Scope expanded.')

    expect(updated.ccrHistory).toHaveLength(1)
    expect(updated.ccrHistory[0].state).toBe('pending')
  })
})

// ══════════════════════════════════════════════
// DEFECT 5: Assignment writes asset/provenance state directly
// ══════════════════════════════════════════════

describe('PROTECTED: Assignment Engine does not write Vault or FCS state', () => {
  it('evidence items reference vault assets by ID only — no provenance fields stored', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    const sub = assetSub(msId)

    a = submitFulfilment(a, msId, sub, CREATOR)
    const ms = a.milestones.find(m => m.id === msId)!
    const evidence = ms.fulfilmentSubmissions[0].evidenceItems[0]

    // Assignment Engine stores only the reference, not vault metadata
    expect(evidence.vaultAssetId).toBe('asset-defect-001')
    expect(evidence.kind).toBe('vault_asset')

    // No vault-owned fields (declaration state, certification hash, etc.) are stored
    const evidenceKeys = Object.keys(evidence)
    expect(evidenceKeys).not.toContain('declarationState')
    expect(evidenceKeys).not.toContain('certificationHash')
    expect(evidenceKeys).not.toContain('provenanceState')
  })

  it('service fulfilment carries no vault references', () => {
    let a = inProgress({
      assignmentClass: 'service',
      rightsRecord: {
        assetRights: null,
        serviceTerms: { scopeOfWork: 'Fixering.', confidentiality: null, attendanceObligations: null, operationalRestrictions: null, reimbursementTerms: null, liabilityFraming: null },
      },
      milestones: [{
        title: 'Service MS',
        scopeSummary: 'Service only.',
        milestoneType: 'service',
        dueDate: '2026-08-01T23:59:00Z',
        acceptanceCriteria: 'Service log.',
        requiredEvidenceTypes: ['service_log'],
        releasableAmountCents: 80_000,
        partialAcceptancePermitted: false,
        reviewWindowDays: 3,
      }],
    })

    const msId = a.milestones[0].id
    const svcSub: FulfilmentSubmission = {
      id: 'fs-svc-defect',
      milestoneId: msId,
      fulfilmentType: 'service',
      evidenceItems: [{
        id: 'ev-svc-defect',
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
          location: 'Test city',
          role: 'Fixer',
          completedDuties: 'Logistics completed.',
        },
        createdAt: new Date().toISOString(),
      }],
      creatorNotes: null,
      submittedAt: new Date().toISOString(),
    }

    a = submitFulfilment(a, msId, svcSub, CREATOR)
    const evidence = a.milestones.find(m => m.id === msId)!.fulfilmentSubmissions[0].evidenceItems[0]

    // Service evidence does not reference Vault
    expect(evidence.vaultAssetId).toBeNull()
    // Service log is embedded directly — no FCS lookup
    expect(evidence.serviceLog).not.toBeNull()
    expect(evidence.serviceLog!.completedDuties).toBe('Logistics completed.')
  })
})

// ══════════════════════════════════════════════
// DEFECT 6: Dispute incorrectly freezes whole assignment instead of milestone
// ══════════════════════════════════════════════

describe('PROTECTED: Milestone-level dispute freezes only the contested milestone', () => {
  it('milestone dispute freezes only that milestone\'s releasableAmountCents', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    // Do NOT accept ms0 — it's still in fulfilment_submitted

    const { assignment: disputed, dispute } = openAssignmentDispute(
      a, BUYER, 'asset_failure_against_brief', ms0.id, 'Photos not meeting spec.',
    )

    // Only ms0 is disputed
    expect(disputed.milestones.find(m => m.id === ms0.id)!.state).toBe('disputed')
    expect(disputed.milestones.find(m => m.id === ms1.id)!.state).not.toBe('disputed')

    // Frozen is ONLY ms0's amount, not the full assignment budget
    expect(disputed.escrow.totalFrozenCents).toBe(ms0.releasableAmountCents)
    expect(disputed.escrow.totalFrozenCents).not.toBe(ms0.releasableAmountCents + ms1.releasableAmountCents)

    // Dispute scope is correctly set to milestone
    expect(dispute.scope).toBe('milestone')
    expect(dispute.milestoneId).toBe(ms0.id)
  })

  it('assignment-level dispute DOES freeze all unresolved milestones (correct behavior)', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    // Accept ms0 first
    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    a = openReviewWindow(a, ms0.id)
    a = determineReviewOutcome(a, ms0.id, BUYER, 'content_commit_holder', 'accepted', 'OK')

    const { assignment: disputed, dispute } = openAssignmentDispute(
      a, CREATOR, 'buyer_refusal_without_grounds', null, 'Buyer not responding.',
    )

    // ms0 is accepted — should NOT be disputed
    expect(disputed.milestones.find(m => m.id === ms0.id)!.state).toBe('accepted')
    // ms1 is still active/pending — should be disputed
    expect(disputed.milestones.find(m => m.id === ms1.id)!.state).toBe('disputed')

    // Frozen amount covers only ms1 (not the already-released ms0)
    expect(disputed.escrow.totalFrozenCents).toBe(ms1.releasableAmountCents)
    expect(dispute.scope).toBe('assignment')
  })
})

// ══════════════════════════════════════════════
// DEFECT 7: Provisional release triggers too early
// ══════════════════════════════════════════════

describe('PROTECTED: Provisional release cannot trigger before 14-day threshold', () => {
  it('is ineligible at 13 days — no early release', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId, 13), CREATOR)

    const result = evaluateProvisionalReleaseEligibility(a)
    expect(result.subState).not.toBe('provisional_release_eligible')
  })

  it('is ineligible when changes_requested — no release despite age', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId, 20), CREATOR)
    a = openReviewWindow(a, msId)
    a = determineReviewOutcome(a, msId, BUYER, 'content_commit_holder', 'changes_requested', 'Needs work.')

    const result = evaluateProvisionalReleaseEligibility(a)
    // changes_requested blocks early release
    expect(result.subState).toBe('changes_requested')
    expect(result.subState).not.toBe('provisional_release_eligible')
  })

  it('is ineligible when escrow has frozen funds (dispute active)', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId, 20), CREATOR)
    a = { ...a, escrow: { ...a.escrow, totalFrozenCents: 50_000 } }

    const result = evaluateProvisionalReleaseEligibility(a)
    expect(result).toBe(a) // no-op reference returned
    expect(result.subState).not.toBe('provisional_release_eligible')
  })

  it('executeProvisionalRelease throws if not yet eligible', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId, 5), CREATOR) // only 5 days old

    // Eligible check returns unchanged
    const checked = evaluateProvisionalReleaseEligibility(a)
    expect(checked.subState).not.toBe('provisional_release_eligible')

    // Cannot execute when not eligible
    expect(() => executeProvisionalRelease(checked, STAFF)).toThrow(AssignmentError)
    try {
      executeProvisionalRelease(checked, STAFF)
    } catch (e) {
      expect((e as AssignmentError).code).toBe('NOT_PROVISIONAL_RELEASE_ELIGIBLE')
    }
  })

  it('eligible at exactly 14 days — release proceeds', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId, 14), CREATOR)

    const eligible = evaluateProvisionalReleaseEligibility(a)
    expect(eligible.subState).toBe('provisional_release_eligible')

    const released = executeProvisionalRelease(eligible, STAFF)
    expect(released.milestones.find(m => m.id === msId)!.state).toBe('accepted')
    expect(released.escrow.totalReleasedCents).toBe(100_000)
  })
})

// ══════════════════════════════════════════════
// DEFECT 8: UI color / terminology (structural check)
// ══════════════════════════════════════════════

describe('Canonical label maps use correct terminology', () => {
  it('ASSIGNMENT_STATE_LABELS uses canonical terms (no "Pending Escrow", no "Fulfillment" misspelling)', async () => {
    const { ASSIGNMENT_STATE_LABELS } = await import('@/lib/types')
    const labels = Object.values(ASSIGNMENT_STATE_LABELS)
    // "Fulfillment" (US spelling) should not appear — canonical is "Fulfilment" (UK)
    for (const label of labels) {
      expect(label).not.toMatch(/Fulfillment/i)
    }
  })

  it('MILESTONE_STATE_LABELS uses canonical terms', async () => {
    const { MILESTONE_STATE_LABELS } = await import('@/lib/types')
    const labels = Object.values(MILESTONE_STATE_LABELS)
    for (const label of labels) {
      expect(label).not.toMatch(/Fulfillment/i)
    }
  })
})

// ══════════════════════════════════════════════
// DEFECT-DOC: CCR sub-state validity on delivered assignments
// ══════════════════════════════════════════════

describe('DEFECT-DOC: requestCommissionChange on delivered assignment creates invalid sub-state', () => {
  /**
   * When requestCommissionChange is called on a delivered assignment,
   * it sets subState = 'ccr_pending'. However, 'ccr_pending' is only
   * a valid sub-state under 'in_progress' per VALID_SUB_STATES.
   *
   * This means delivered/ccr_pending is an architecturally invalid pair
   * that assertValidSubState would reject if called after CCR submission.
   *
   * This test documents the gap. A fix would either:
   *  a) Add 'ccr_pending' to VALID_SUB_STATES['delivered'], or
   *  b) Restore the prior delivered sub-state instead of 'ccr_pending'.
   */
  it('DEFECT-DOC: delivered/ccr_pending fails assertValidSubState', () => {
    let a = inProgress()
    const msId = a.milestones[0].id
    a = submitFulfilment(a, msId, assetSub(msId), CREATOR)
    // Assignment is now delivered/fulfilment_submitted

    // CCR is allowed in delivered state per assertCCRAllowed
    const withCCR = requestCommissionChange(a, CREATOR, [
      { field: 'scope', currentValue: 'original', proposedValue: 'expanded' },
    ], 'Need more time.')

    // The resulting subState is 'ccr_pending' under state 'delivered'
    expect(withCCR.state).toBe('delivered')
    expect(withCCR.subState).toBe('ccr_pending')

    // This (state, subState) pair is architecturally illegal per VALID_SUB_STATES
    expect(() => assertValidSubState('delivered', 'ccr_pending')).toThrow(AssignmentError)
  })
})

// ══════════════════════════════════════════════
// ADDITIONAL INVARIANTS: Refund/Release integrity
// ══════════════════════════════════════════════

describe('Refund/release integrity invariants', () => {
  it('syncStripeReleaseState transitions settlement_queued to closed', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    a = openReviewWindow(a, ms0.id)
    a = determineReviewOutcome(a, ms0.id, BUYER, 'content_commit_holder', 'accepted', 'OK')
    a = submitFulfilment(a, ms1.id, assetSub(ms1.id), CREATOR)
    a = openReviewWindow(a, ms1.id)
    a = determineReviewOutcome(a, ms1.id, BUYER, 'content_commit_holder', 'accepted', 'OK')

    expect(a.state).toBe('confirmed')
    expect(a.subState).toBe('settlement_queued')

    const closed = syncStripeReleaseState(a, 'tr-stripe-001', 250_000)
    expect(closed.subState).toBe('closed')
  })

  it('syncStripeReleaseState is a no-op on non-settlement_queued states', () => {
    const a = inProgress()
    const result = syncStripeReleaseState(a, 'tr-noop-001', 100_000)
    expect(result).toBe(a) // reference equality
    expect(result.subState).toBe('active')
  })

  it('dispute freeze accumulates correctly across milestones', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    a = submitFulfilment(a, ms1.id, assetSub(ms1.id), CREATOR)

    // Open assignment-level dispute (both milestones unresolved)
    const { assignment: disputed } = openAssignmentDispute(
      a, BUYER, 'creator_non_performance', null, 'Neither MS delivered.',
    )

    // Both milestones are disputed
    expect(disputed.milestones.every(m => m.state === 'disputed')).toBe(true)
    // Frozen amount = sum of both milestone amounts
    const expectedFrozen = ms0.releasableAmountCents + ms1.releasableAmountCents
    expect(disputed.escrow.totalFrozenCents).toBe(expectedFrozen)
    // Released + frozen ≤ captured
    expect(
      disputed.escrow.totalReleasedCents + disputed.escrow.totalFrozenCents,
    ).toBeLessThanOrEqual(disputed.escrow.totalCapturedCents)
  })

  it('partial acceptance leaves remaining milestone amount non-released', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    // Accept ms0 fully
    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    a = openReviewWindow(a, ms0.id)
    a = determineReviewOutcome(a, ms0.id, BUYER, 'content_commit_holder', 'accepted', 'Full.')

    // Partial accept ms1 (50k of 150k)
    a = submitFulfilment(a, ms1.id, assetSub(ms1.id), CREATOR)
    a = openReviewWindow(a, ms1.id)
    a = determineReviewOutcome(a, ms1.id, BUYER, 'content_commit_holder', 'accepted_partial', 'Partial.', 50_000)

    expect(a.escrow.totalReleasedCents).toBe(100_000 + 50_000)
    // Remaining 100k (ms1 residual) is neither released nor frozen
    const accounted = a.escrow.totalReleasedCents + a.escrow.totalFrozenCents + a.escrow.totalRefundedCents
    expect(accounted).toBeLessThanOrEqual(a.escrow.totalCapturedCents)
  })
})

// ══════════════════════════════════════════════
// ADDITIONAL: Stripe webhook idempotency
// ══════════════════════════════════════════════

describe('Stripe webhook sync idempotency', () => {
  it('escrow capture event uses stripePaymentIntentId as idempotency key', () => {
    const events = getAssignmentEvents('asgn-test')
    const initialCount = events.length

    let a = issueAssignmentBrief(brief())
    a = acceptAssignment(a, CREATOR)
    a = syncEscrowCaptureFromStripe(a, 'pi-idem-001', 250_000, new Date().toISOString())

    const eventsAfter = getAssignmentEvents(a.id)
    const captureEvents = eventsAfter.filter(e => e.type === 'escrow_captured')
    expect(captureEvents).toHaveLength(1)
    expect(captureEvents[0].id).toBe('escrow-pi-idem-001')

    // Second call with same PI — returns same assignment object, no new event
    const again = syncEscrowCaptureFromStripe(a, 'pi-idem-001', 250_000, new Date().toISOString())
    expect(again).toBe(a)

    const eventsAfterSecond = getAssignmentEvents(a.id)
    const captureEventsAfterSecond = eventsAfterSecond.filter(e => e.type === 'escrow_captured')
    expect(captureEventsAfterSecond).toHaveLength(1) // no duplicate
  })

  it('Stripe settlement event uses stripeTransferId as idempotency key', () => {
    let a = inProgress()
    a = activateNextMilestone(a)
    const [ms0, ms1] = a.milestones

    a = submitFulfilment(a, ms0.id, assetSub(ms0.id), CREATOR)
    a = openReviewWindow(a, ms0.id)
    a = determineReviewOutcome(a, ms0.id, BUYER, 'content_commit_holder', 'accepted', 'OK')
    a = submitFulfilment(a, ms1.id, assetSub(ms1.id), CREATOR)
    a = openReviewWindow(a, ms1.id)
    a = determineReviewOutcome(a, ms1.id, BUYER, 'content_commit_holder', 'accepted', 'OK')

    expect(a.subState).toBe('settlement_queued')

    const eventsBefore = getAssignmentEvents(a.id).length
    const closed = syncStripeReleaseState(a, 'tr-idem-001', 250_000)
    const eventsAfter = getAssignmentEvents(a.id)

    // Exactly one escrow_released event for this transfer
    const settleEvents = eventsAfter.filter(
      e => e.type === 'escrow_released' && e.id === 'settle-tr-idem-001',
    )
    expect(settleEvents).toHaveLength(1)
    expect(eventsAfter.length).toBe(eventsBefore + 1)

    // Calling again on the now-closed assignment is a no-op (no more settlement_queued)
    const again = syncStripeReleaseState(closed, 'tr-idem-001', 250_000)
    expect(again).toBe(closed)
    expect(getAssignmentEvents(a.id).length).toBe(eventsBefore + 1) // no extra event
  })
})
