/**
 * Test Helpers — shared factories for Assignment Engine tests.
 *
 * All factory functions produce minimal valid objects. Override
 * only what a specific test scenario requires.
 */

import type {
  Assignment,
  AssignmentState,
  AssignmentSubState,
  Milestone,
  MilestoneState,
  MilestoneType,
  FulfilmentSubmission,
  EvidenceItem,
  EvidenceItemKind,
  FulfilmentType,
  EscrowRecord,
  CommissionChangeRequest,
  CCRState,
  AssignmentRightsRecord,
  ServiceLog,
} from '@/lib/types'

// ══════════════════════════════════════════════
// CANONICAL ACTOR IDs
// ══════════════════════════════════════════════

export const BUYER_ID = 'buyer-test-01'
export const CREATOR_ID = 'creator-test-01'
export const STRANGER_ID = 'stranger-test-99'
export const STAFF_ID = 'staff-test-01'

// ══════════════════════════════════════════════
// ESCROW FACTORY
// ══════════════════════════════════════════════

export function makeEscrow(overrides?: Partial<EscrowRecord>): EscrowRecord {
  return {
    stripePaymentIntentId: null,
    totalCapturedCents: 0,
    totalReleasedCents: 0,
    totalRefundedCents: 0,
    totalFrozenCents: 0,
    capturedAt: null,
    ...overrides,
  }
}

export function makeCapturedEscrow(capturedCents = 100_000): EscrowRecord {
  return makeEscrow({
    stripePaymentIntentId: 'pi-test-001',
    totalCapturedCents: capturedCents,
    capturedAt: new Date().toISOString(),
  })
}

// ══════════════════════════════════════════════
// EVIDENCE ITEM FACTORIES
// ══════════════════════════════════════════════

function makeServiceLog(): ServiceLog {
  return {
    date: '2026-04-01',
    startTime: '09:00',
    endTime: '17:00',
    location: 'Test location',
    role: 'Fixer / logistics coordinator',
    completedDuties: 'Coordinated press access and ground transport.',
  }
}

export function makeEvidenceItem(kind: EvidenceItemKind, idSuffix = '01'): EvidenceItem {
  return {
    id: `ev-${kind}-${idSuffix}`,
    kind,
    label: `Test evidence — ${kind}`,
    description: null,
    vaultAssetId: kind === 'vault_asset' ? `asset-test-${idSuffix}` : null,
    fileRef: kind === 'support_document' ? `file-ref-${idSuffix}` : null,
    fileName: kind === 'support_document' ? `doc-${idSuffix}.pdf` : null,
    fileSizeBytes: kind === 'support_document' ? 204_800 : null,
    serviceLog: kind === 'service_log' ? makeServiceLog() : null,
    createdAt: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════
// FULFILMENT SUBMISSION FACTORY
// ══════════════════════════════════════════════

export function makeSubmission(
  kinds: EvidenceItemKind[],
  milestoneId = 'ms-test-01',
  submittedDaysAgo = 0,
): FulfilmentSubmission {
  const fulfilmentType: FulfilmentType =
    kinds.includes('vault_asset') && kinds.includes('service_log')
      ? 'hybrid'
      : kinds.includes('vault_asset')
        ? 'asset'
        : 'service'

  const submittedAt = new Date(
    Date.now() - submittedDaysAgo * 24 * 60 * 60 * 1000,
  ).toISOString()

  return {
    id: `fs-test-${Date.now()}`,
    milestoneId,
    fulfilmentType,
    evidenceItems: kinds.map((k, i) => makeEvidenceItem(k, String(i + 1).padStart(2, '0'))),
    creatorNotes: null,
    submittedAt,
  }
}

// ══════════════════════════════════════════════
// MILESTONE FACTORY
// ══════════════════════════════════════════════

export function makeMilestone(overrides?: Partial<Milestone>): Milestone {
  return {
    id: 'ms-test-01',
    assignmentId: 'asgn-test-01',
    ordinal: 1,
    title: 'Test Milestone',
    scopeSummary: 'Test scope summary.',
    milestoneType: 'material',
    state: 'pending',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    acceptanceCriteria: '≥1 vault asset linked.',
    requiredEvidenceTypes: ['vault_asset'],
    releasableAmountCents: 100_000,
    partialAcceptancePermitted: false,
    reviewWindowDays: 5,
    fulfilmentSubmissions: [],
    reviewDetermination: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  }
}

export function makeActiveMilestone(overrides?: Partial<Milestone>): Milestone {
  return makeMilestone({ state: 'active', ...overrides })
}

export function makeServiceMilestone(overrides?: Partial<Milestone>): Milestone {
  return makeMilestone({
    milestoneType: 'service',
    requiredEvidenceTypes: ['service_log'],
    ...overrides,
  })
}

export function makeHybridMilestone(overrides?: Partial<Milestone>): Milestone {
  return makeMilestone({
    milestoneType: 'hybrid',
    requiredEvidenceTypes: ['vault_asset', 'service_log'],
    ...overrides,
  })
}

// ══════════════════════════════════════════════
// ASSIGNMENT FACTORY
// ══════════════════════════════════════════════

const BASE_RIGHTS: AssignmentRightsRecord = {
  assetRights: null,
  serviceTerms: null,
}

export function makeAssignment(overrides?: Partial<Assignment>): Assignment {
  return {
    id: 'asgn-test-01',
    buyerId: BUYER_ID,
    creatorId: CREATOR_ID,
    assignmentClass: 'material',
    state: 'brief_issued',
    subState: 'draft',
    plan: {
      scope: 'Test assignment scope.',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      acceptanceCriteria: 'Minimum 1 vault-linked asset per milestone.',
      requiredEvidenceTypes: ['vault_asset'],
      reviewWindowDays: 5,
      notes: null,
    },
    milestones: [makeMilestone()],
    rightsRecord: BASE_RIGHTS,
    escrow: makeEscrow(),
    ccrHistory: [],
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  }
}

/** Assignment in brief_issued/accepted_pending_escrow — creator accepted, waiting for Stripe capture. */
export function makeAcceptedPendingEscrowAssignment(): Assignment {
  return makeAssignment({
    state: 'brief_issued',
    subState: 'accepted_pending_escrow',
    acceptedAt: new Date().toISOString(),
    milestones: [makeMilestone({ state: 'pending' })],
  })
}

/** Assignment in in_progress/active — escrow captured, first milestone active. */
export function makeInProgressAssignment(overrides?: Partial<Assignment>): Assignment {
  return makeAssignment({
    state: 'in_progress',
    subState: 'active',
    acceptedAt: new Date().toISOString(),
    milestones: [makeActiveMilestone()],
    escrow: makeCapturedEscrow(),
    ...overrides,
  })
}

/** Assignment in delivered/fulfilment_submitted. */
export function makeDeliveredAssignment(
  milestoneState: MilestoneState = 'fulfilment_submitted',
  submittedDaysAgo = 0,
): Assignment {
  const submission = makeSubmission(['vault_asset'], 'ms-test-01', submittedDaysAgo)
  const milestone = makeActiveMilestone({
    state: milestoneState,
    fulfilmentSubmissions: [submission],
  })
  return makeAssignment({
    state: 'delivered',
    subState: 'fulfilment_submitted',
    acceptedAt: new Date().toISOString(),
    milestones: [milestone],
    escrow: makeCapturedEscrow(),
  })
}

/** Two-milestone in_progress assignment — one active, one pending. */
export function makeTwoMilestoneInProgressAssignment(): Assignment {
  const ms1 = makeActiveMilestone({ id: 'ms-test-01', ordinal: 1 })
  const ms2 = makeMilestone({ id: 'ms-test-02', ordinal: 2, state: 'pending' })
  return makeInProgressAssignment({ milestones: [ms1, ms2] })
}

// ══════════════════════════════════════════════
// CCR FACTORY
// ══════════════════════════════════════════════

export function makePendingCCR(
  assignmentId: string,
  requesterId: string,
  overrides?: Partial<CommissionChangeRequest>,
): CommissionChangeRequest {
  return {
    id: 'ccr-test-01',
    assignmentId,
    requesterId,
    state: 'pending',
    rationale: 'Test rationale — scope clarification required.',
    amendedFields: [
      {
        field: 'milestones[0].releasableAmountCents',
        currentValue: '100000',
        proposedValue: '120000',
      },
    ],
    responseDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: null,
    responseNote: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeExpiredCCR(
  assignmentId: string,
  requesterId: string,
): CommissionChangeRequest {
  return makePendingCCR(assignmentId, requesterId, {
    id: 'ccr-expired-01',
    responseDeadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day past deadline
  })
}

// ══════════════════════════════════════════════
// ASSERTION HELPERS
// ══════════════════════════════════════════════

/** Asserts that a function throws an AssignmentError with the given code. */
import { AssignmentError } from '@/lib/assignment/errors'

export function expectAssignmentError(
  fn: () => unknown,
  expectedCode: string,
): void {
  let caught: unknown
  try {
    fn()
  } catch (err) {
    caught = err
  }
  if (!(caught instanceof AssignmentError)) {
    throw new Error(
      `Expected AssignmentError with code '${expectedCode}', but no error was thrown or error was of wrong type. Got: ${caught}`,
    )
  }
  if (caught.code !== expectedCode) {
    throw new Error(
      `Expected AssignmentError code '${expectedCode}', got '${caught.code}': ${caught.message}`,
    )
  }
}
