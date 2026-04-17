/**
 * Assignment Closing — Mock Closing Engine
 *
 * Simulates the post-escrow closing pipeline:
 *   1. Update assignment with escrow capture
 *   2. Generate canonical assignment documents (4 per assignment)
 *   3. Collect signatures on signable documents
 *   4. Issue work authorization
 *   5. Activate first milestone
 *
 * In production this would be a server-side pipeline.
 * Here it runs client-side with simulated delays.
 */

import { PLATFORM_FEES } from '@/lib/types'
import type { Assignment, MilestoneState } from '@/lib/types'
import { putAssignment, putClosingResult } from './store'
import {
  ASSIGNMENT_DOCUMENT_REGISTRY,
  type AssignmentDocumentTypeId,
  type AssignmentDocumentReadiness,
  type AssignmentDocumentReadinessItem,
  type AssignmentSignatureReadiness,
  type AssignmentDocReadinessStatus,
  type AssignmentSigReadinessStatus,
  type WorkAuthorization,
} from './closing-types'
import type { AssignmentClosingAction } from './closing-reducer'
import { computeEscrowAmountCents } from './closing-reducer'
import type { DocumentStatus } from '@/lib/documents/types'

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/**
 * Run the full closing pipeline after escrow capture succeeds.
 * Dispatches state transitions as each phase completes.
 *
 * PRECONDITION: Caller must have confirmed escrow capture
 * before calling. The reducer guards START_CLOSING against
 * non-captured escrow.
 */
export async function runAssignmentClosing(
  assignment: Assignment,
  stripePaymentIntentId: string,
  capturedAt: string,
  dispatch: (action: AssignmentClosingAction) => void,
): Promise<void> {
  const escrowAmountCents = computeEscrowAmountCents(assignment)

  // Phase 1: Update assignment with escrow data
  const escrowedAssignment: Assignment = {
    ...assignment,
    state: 'escrow_captured',
    subState: 'accepted_pending_escrow',
    escrow: {
      stripePaymentIntentId,
      totalCapturedCents: escrowAmountCents,
      totalReleasedCents: 0,
      totalRefundedCents: 0,
      totalFrozenCents: 0,
      capturedAt,
    },
  }

  dispatch({ type: 'START_CLOSING', payload: { updatedAssignment: escrowedAssignment } })
  await delay(400)

  // Phase 2: Generate documents
  dispatch({ type: 'CLOSING_DOCUMENTS_GENERATING' })
  await delay(600)

  // Phase 3: Collect signatures
  dispatch({ type: 'CLOSING_AWAITING_SIGNATURES' })
  await delay(500)

  // Phase 4: Work authorization
  dispatch({ type: 'CLOSING_WORK_AUTHORIZATION_PENDING' })
  await delay(400)

  // Phase 5: Compute readiness + activate
  const documentReadiness = buildAssignmentDocumentReadiness(assignment.id)
  const signatureReadiness = buildAssignmentSignatureReadiness(assignment.id)
  const workAuthorization = buildWorkAuthorization(assignment)

  // Activate the assignment: in_progress / active, first milestone activated
  const activatedAssignment: Assignment = {
    ...escrowedAssignment,
    state: 'in_progress',
    subState: 'active',
    milestones: escrowedAssignment.milestones.map((m, i) =>
      i === 0 ? { ...m, state: 'active' as MilestoneState } : m
    ),
  }

  // Dispatch first so reducer state is consistent before store write
  dispatch({
    type: 'CLOSING_ACTIVATED',
    payload: {
      documentReadiness,
      signatureReadiness,
      workAuthorization,
      activatedAssignment,
    },
  })

  // Persist to store so activate page and detail page can read actual pipeline data
  putAssignment(activatedAssignment)
  putClosingResult({
    assignmentId: assignment.id,
    documentReadiness,
    signatureReadiness,
    workAuthorization,
  })
}

// ══════════════════════════════════════════════
// DOCUMENT READINESS
// ══════════════════════════════════════════════

// TODO: production — derive document status from actual document generation pipeline.
// Currently hard-codes all documents as 'finalized'. Must support pending/failed/blocked paths
// and class-specific document content (material vs service vs hybrid).
export function buildAssignmentDocumentReadiness(
  assignmentId: string,
): AssignmentDocumentReadiness {
  const documents: AssignmentDocumentReadinessItem[] = ASSIGNMENT_DOCUMENT_REGISTRY.map(entry => {
    const status: DocumentStatus = 'finalized'
    const signatureStatus: AssignmentSigReadinessStatus | null = entry.signable ? 'ready' : null

    return {
      documentTypeId: entry.id,
      label: entry.label,
      shortLabel: entry.shortLabel,
      status,
      signable: entry.signable,
      signatureStatus,
    }
  })

  const allFinalized = documents.every(d => d.status === 'finalized')
  const overallStatus: AssignmentDocReadinessStatus = allFinalized ? 'ready' : 'pending'

  return { assignmentId, overallStatus, documents }
}

// ══════════════════════════════════════════════
// SIGNATURE READINESS
// ══════════════════════════════════════════════

// TODO: production — derive signature counts from actual signature collection.
// Currently hard-codes 6/6 signed. Must support partial and zero-signature states.
export function buildAssignmentSignatureReadiness(
  assignmentId: string,
): AssignmentSignatureReadiness {
  // 2 signable docs (assignment_agreement + rights_schedule)
  // Each needs 3 signatures (buyer, creator, Frontfiles)
  const totalRequired = 6
  const totalSigned = 6
  const totalPending = 0

  return {
    assignmentId,
    overallStatus: 'ready',
    totalRequired,
    totalSigned,
    totalPending,
  }
}

// ══════════════════════════════════════════════
// WORK AUTHORIZATION
// ══════════════════════════════════════════════

// TODO: production — derive authorization from actual document + signature verification.
// Currently always returns 'authorized'. Must support pending/suspended/revoked states
// and class-specific authorization rules (material vs service vs hybrid).
export function buildWorkAuthorization(
  assignment: Assignment,
): WorkAuthorization {
  // Activate the first pending milestone
  const firstPendingMilestone = assignment.milestones.find(m => m.state === 'pending')
  const activatedMilestoneIds = firstPendingMilestone ? [firstPendingMilestone.id] : []

  // Contract documents that authorize work
  const contractDocumentIds: AssignmentDocumentTypeId[] = ASSIGNMENT_DOCUMENT_REGISTRY
    .filter(e => e.signable)
    .map(e => e.id)

  return {
    assignmentId: assignment.id,
    status: 'authorized',
    authorizedAt: new Date().toISOString(),
    activatedMilestoneIds,
    contractDocumentIds,
  }
}

// ══════════════════════════════════════════════
// UTIL
// ══════════════════════════════════════════════

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
