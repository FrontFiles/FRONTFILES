/**
 * POST /api/assignment/[id]/review-open — Open review window for a milestone
 *
 * Body: { milestoneId: string }
 */

import { openReviewWindow } from '@/lib/assignment/services'
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
    if (!body.milestoneId) {
      return errorResponse('VALIDATION_ERROR', 'Missing required field: milestoneId')
    }

    const updated = openReviewWindow(assignment, body.milestoneId)
    putAssignment(updated)
    return success(updated)
  })
}
