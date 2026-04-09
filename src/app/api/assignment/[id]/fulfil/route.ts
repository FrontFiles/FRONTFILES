/**
 * POST /api/assignment/[id]/fulfil — Creator submits fulfilment for a milestone
 *
 * Body: { milestoneId: string, submission: FulfilmentSubmission, creatorId: string }
 */

import { submitFulfilment } from '@/lib/assignment/services'
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
    if (!body.milestoneId || !body.submission || !body.creatorId) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: milestoneId, submission, creatorId')
    }

    const updated = submitFulfilment(
      assignment,
      body.milestoneId,
      body.submission,
      body.creatorId,
    )
    putAssignment(updated)
    return success(updated)
  })
}
