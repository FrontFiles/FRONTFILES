/**
 * POST /api/assignment/[id]/accept — Creator accepts assignment brief
 *
 * Body: { creatorId: string }
 */

import { acceptAssignment } from '@/lib/assignment/services'
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
    if (!body.creatorId) {
      return errorResponse('VALIDATION_ERROR', 'Missing required field: creatorId')
    }

    const updated = acceptAssignment(assignment, body.creatorId)
    putAssignment(updated)
    return success(updated)
  })
}
