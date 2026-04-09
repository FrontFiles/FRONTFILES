/**
 * Assignment Engine — Machine-Readable Error Codes
 *
 * Every domain rejection maps to exactly one code.
 * API handlers return these in { error: { code, message } }.
 */

export type AssignmentErrorCode =
  // State machine violations
  | 'INVALID_STATE_TRANSITION'
  | 'INVALID_SUB_STATE'
  | 'ASSIGNMENT_NOT_FOUND'
  | 'MILESTONE_NOT_FOUND'

  // Lifecycle
  | 'ASSIGNMENT_ALREADY_ACCEPTED'
  | 'ASSIGNMENT_NOT_ACCEPTING'
  | 'ESCROW_NOT_CAPTURED'
  | 'ESCROW_ALREADY_CAPTURED'
  | 'ASSIGNMENT_NOT_CANCELLABLE'

  // Fulfilment
  | 'MILESTONE_NOT_ACTIVE'
  | 'MILESTONE_NOT_SUBMITTABLE'
  | 'FULFILMENT_EMPTY'
  | 'EVIDENCE_TYPE_MISMATCH'
  | 'MATERIAL_MILESTONE_REQUIRES_ASSETS'
  | 'SERVICE_MILESTONE_REQUIRES_LOGS'

  // Review
  | 'MILESTONE_NOT_REVIEWABLE'
  | 'EDITOR_CANNOT_AUTHORISE_RELEASE'
  | 'PARTIAL_RELEASE_NOT_PERMITTED'
  | 'PARTIAL_AMOUNT_EXCEEDS_RELEASABLE'
  | 'REVIEWER_CANNOT_REVIEW'

  // CCR
  | 'CCR_ALREADY_PENDING'
  | 'CCR_NOT_FOUND'
  | 'CCR_NOT_PENDING'
  | 'CCR_RESPONSE_WINDOW_EXPIRED'
  | 'CCR_NOT_AMENDABLE_IN_STATE'

  // Dispute
  | 'DISPUTE_ALREADY_OPEN'
  | 'DISPUTE_NOT_FOUND'
  | 'INVALID_DISPUTE_TRIGGER'
  | 'ASSIGNMENT_NOT_DISPUTABLE'

  // Provisional release
  | 'NOT_PROVISIONAL_RELEASE_ELIGIBLE'
  | 'DISPUTE_FREEZE_OVERRIDES_RELEASE'

  // Authorization
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_ROLE'
  | 'NOT_ASSIGNMENT_PARTY'

export class AssignmentError extends Error {
  readonly code: AssignmentErrorCode
  readonly httpStatus: number

  constructor(code: AssignmentErrorCode, message: string, httpStatus: number = 400) {
    super(message)
    this.name = 'AssignmentError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

// Convenience factories
export function notFound(entity: string, id: string): AssignmentError {
  return new AssignmentError(
    entity === 'milestone' ? 'MILESTONE_NOT_FOUND' : 'ASSIGNMENT_NOT_FOUND',
    `${entity} ${id} not found`,
    404,
  )
}

export function forbidden(code: AssignmentErrorCode, message: string): AssignmentError {
  return new AssignmentError(code, message, 403)
}

export function badTransition(from: string, attempted: string): AssignmentError {
  return new AssignmentError(
    'INVALID_STATE_TRANSITION',
    `Cannot transition from ${from} to ${attempted}`,
  )
}
