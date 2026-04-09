/**
 * POST /api/assignment/[id]/dispute — Open a dispute on an assignment or milestone
 *
 * Body: { filerId, trigger, milestoneId (nullable), reason }
 */

import { openAssignmentDispute } from '@/lib/assignment/services'
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
    if (!body.filerId || !body.trigger || body.reason === undefined) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: filerId, trigger, reason')
    }

    const result = openAssignmentDispute(
      assignment,
      body.filerId,
      body.trigger,
      body.milestoneId ?? null,
      body.reason,
    )
    putAssignment(result.assignment)
    return success({ assignment: result.assignment, dispute: result.dispute })
  })
}
