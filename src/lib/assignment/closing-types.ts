/**
 * Assignment Closing Flow — Types
 *
 * Canonical types for the governed path from an accepted assignment brief
 * to a funded, contract-bound, operational assignment.
 *
 * Flow: review → escrow capture → documents → signatures → work authorization → activation
 *
 * BOUNDARIES:
 *   - Closing review owns buyer confirmation, not entitlement
 *   - Funding owns escrow state, not assignment state
 *   - Document readiness owns canonical record generation
 *   - Signature readiness owns counterparty agreement proof
 *   - Work authorization owns the go/no-go for first milestone activation
 *   - Assignment state machine owns lifecycle transitions
 */

import type { Assignment } from '@/lib/types'
import type { DocumentStatus } from '@/lib/documents/types'

// ══════════════════════════════════════════════
// ASSIGNMENT DOCUMENT REGISTRY
// ══════════════════════════════════════════════

export type AssignmentDocumentTypeId =
  | 'assignment_agreement'
  | 'rights_schedule'
  | 'escrow_confirmation'
  | 'milestone_schedule'

export type AssignmentDocumentCategory = 'contract' | 'rights' | 'finance' | 'schedule'

export interface AssignmentDocumentRegistryEntry {
  id: AssignmentDocumentTypeId
  label: string
  shortLabel: string
  category: AssignmentDocumentCategory
  signable: boolean
  inBuyerPack: boolean
  inCreatorPack: boolean
  displayOrder: number
}

export const ASSIGNMENT_DOCUMENT_REGISTRY: AssignmentDocumentRegistryEntry[] = [
  {
    id: 'assignment_agreement',
    label: 'Assignment Agreement',
    shortLabel: 'Agreement',
    category: 'contract',
    signable: true,
    inBuyerPack: true,
    inCreatorPack: true,
    displayOrder: 1,
  },
  {
    id: 'rights_schedule',
    label: 'Rights & Terms Schedule',
    shortLabel: 'Rights',
    category: 'rights',
    signable: true,
    inBuyerPack: true,
    inCreatorPack: true,
    displayOrder: 2,
  },
  {
    id: 'escrow_confirmation',
    label: 'Escrow Capture Confirmation',
    shortLabel: 'Escrow',
    category: 'finance',
    signable: false,
    inBuyerPack: true,
    inCreatorPack: false,
    displayOrder: 3,
  },
  {
    id: 'milestone_schedule',
    label: 'Milestone & Payment Schedule',
    shortLabel: 'Milestones',
    category: 'schedule',
    signable: false,
    inBuyerPack: true,
    inCreatorPack: true,
    displayOrder: 4,
  },
]

export const ASSIGNMENT_DOCUMENT_REGISTRY_MAP: Record<AssignmentDocumentTypeId, AssignmentDocumentRegistryEntry> =
  Object.fromEntries(ASSIGNMENT_DOCUMENT_REGISTRY.map(e => [e.id, e])) as Record<AssignmentDocumentTypeId, AssignmentDocumentRegistryEntry>

// ══════════════════════════════════════════════
// FUNDING STATUS
// ══════════════════════════════════════════════

export type FundingStatus =
  | 'awaiting_funding'
  | 'escrow_processing'
  | 'escrow_captured'
  | 'escrow_failed'

// ══════════════════════════════════════════════
// CLOSING PIPELINE STATUS
// ══════════════════════════════════════════════

export type ClosingPipelineStatus =
  | 'not_started'
  | 'closing'
  | 'documents_generating'
  | 'awaiting_signatures'
  | 'work_authorization_pending'
  | 'activated'
  | 'closing_failed'

// ══════════════════════════════════════════════
// CLOSING FLOW PHASE
// ══════════════════════════════════════════════

export type ClosingFlowPhase =
  | 'review'
  | 'funding'
  | 'closing'
  | 'activation'

// ══════════════════════════════════════════════
// CLOSING REVIEW (buyer confirmations)
// ══════════════════════════════════════════════

export interface ClosingReview {
  scopeReviewed: boolean
  milestonesReviewed: boolean
  rightsReviewed: boolean
  escrowAmountConfirmed: boolean
  termsConfirmed: boolean
}

// ══════════════════════════════════════════════
// FUNDING RECORD
// ══════════════════════════════════════════════

export interface FundingRecord {
  id: string
  assignmentId: string
  status: FundingStatus
  escrowAmountCents: number
  currency: string
  stripePaymentIntentId: string | null
  failureReason: string | null
  initiatedAt: string
  capturedAt: string | null
}

// ══════════════════════════════════════════════
// DOCUMENT READINESS
// ══════════════════════════════════════════════

export type AssignmentDocReadinessStatus = 'not_started' | 'pending' | 'partial' | 'ready' | 'blocked'

export interface AssignmentDocumentReadiness {
  assignmentId: string
  overallStatus: AssignmentDocReadinessStatus
  documents: AssignmentDocumentReadinessItem[]
}

export interface AssignmentDocumentReadinessItem {
  documentTypeId: AssignmentDocumentTypeId
  label: string
  shortLabel: string
  status: DocumentStatus
  signable: boolean
  signatureStatus: AssignmentSigReadinessStatus | null
}

// ══════════════════════════════════════════════
// SIGNATURE READINESS
// ══════════════════════════════════════════════

export type AssignmentSigReadinessStatus = 'not_started' | 'pending' | 'partial' | 'ready' | 'blocked'

export interface AssignmentSignatureReadiness {
  assignmentId: string
  overallStatus: AssignmentSigReadinessStatus
  totalRequired: number
  totalSigned: number
  totalPending: number
}

// ══════════════════════════════════════════════
// WORK AUTHORIZATION
// ══════════════════════════════════════════════

export type WorkAuthorizationStatus = 'pending' | 'authorized' | 'suspended' | 'revoked'

export interface WorkAuthorization {
  assignmentId: string
  status: WorkAuthorizationStatus
  authorizedAt: string | null
  /** IDs of milestones activated as part of authorization */
  activatedMilestoneIds: string[]
  /** IDs of contract documents that authorize this work */
  contractDocumentIds: AssignmentDocumentTypeId[]
}

// ══════════════════════════════════════════════
// FULL CLOSING FLOW STATE
// ══════════════════════════════════════════════

export interface AssignmentClosingFlowState {
  phase: ClosingFlowPhase
  assignment: Assignment | null
  review: ClosingReview
  funding: FundingRecord | null
  closingStatus: ClosingPipelineStatus
  documentReadiness: AssignmentDocumentReadiness | null
  signatureReadiness: AssignmentSignatureReadiness | null
  workAuthorization: WorkAuthorization | null
}
