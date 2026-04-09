/**
 * POST /api/assignment/[id]/review — Buyer records review determination for a milestone
 *
 * Body: {
 *   milestoneId: string
 *   reviewerId: string
 *   reviewerRole: BuyerCompanyRole | null
 *   determination: ReviewDetermination
 *   notes: string
 *   acceptedAmountCents?: number  (required for accepted_partial)
 * }
 */

import { determineReviewOutcome } from '@/lib/assignment/services'
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
    if (!body.milestoneId || !body.reviewerId || !body.determination || body.notes === undefined) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: milestoneId, reviewerId, determination, notes')
    }

    const updated = determineReviewOutcome(
      assignment,
      body.milestoneId,
      body.reviewerId,
      body.reviewerRole ?? null,
      body.determination,
      body.notes,
      body.acceptedAmountCents,
    )
    putAssignment(updated)
    return success(updated)
  })
}
