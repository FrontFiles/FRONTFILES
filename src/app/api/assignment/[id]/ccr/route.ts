/**
 * POST /api/assignment/[id]/ccr — Commission Change Request operations
 *
 * action: 'submit' | 'approve' | 'reject'
 *
 * Submit body:  { action: 'submit', requesterId, amendedFields, rationale }
 * Approve body: { action: 'approve', ccrId, responderId, responseNote }
 * Reject body:  { action: 'reject', ccrId, responderId, responseNote }
 */

import {
  requestCommissionChange,
  approveCommissionChange,
  rejectCommissionChange,
} from '@/lib/assignment/services'
import { putAssignment } from '@/lib/assignment/store'
import { resolveAssignment, success, errorResponse, withDomainError } from '@/lib/assignment/api-helpers'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  return withDomainError(async () => {
    const [assignment, err] = resolveAssignment(id)
    if (err) return err

    const body = await request.json()

    switch (body.action) {
      case 'submit': {
        if (!body.requesterId || !body.amendedFields || !body.rationale) {
          return errorResponse('VALIDATION_ERROR', 'Missing required fields: requesterId, amendedFields, rationale')
        }
        const updated = requestCommissionChange(
          assignment,
          body.requesterId,
          body.amendedFields,
          body.rationale,
        )
        putAssignment(updated)
        return success(updated)
      }

      case 'approve': {
        if (!body.ccrId || !body.responderId || body.responseNote === undefined) {
          return errorResponse('VALIDATION_ERROR', 'Missing required fields: ccrId, responderId, responseNote')
        }
        const updated = approveCommissionChange(
          assignment,
          body.ccrId,
          body.responderId,
          body.responseNote,
        )
        putAssignment(updated)
        return success(updated)
      }

      case 'reject': {
        if (!body.ccrId || !body.responderId || body.responseNote === undefined) {
          return errorResponse('VALIDATION_ERROR', 'Missing required fields: ccrId, responderId, responseNote')
        }
        const updated = rejectCommissionChange(
          assignment,
          body.ccrId,
          body.responderId,
          body.responseNote,
        )
        putAssignment(updated)
        return success(updated)
      }

      default:
        return errorResponse('VALIDATION_ERROR', "Invalid action. Expected 'submit', 'approve', or 'reject'")
    }
  })
}
