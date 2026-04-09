/**
 * POST /api/assignment/[id]/cancel — Cancel an assignment
 *
 * Body: { actorId, reason }
 */

import { cancelAssignment } from '@/lib/assignment/services'
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
    if (!body.actorId || body.reason === undefined) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: actorId, reason')
    }

    const updated = cancelAssignment(assignment, body.actorId, body.reason)
    putAssignment(updated)
    return success(updated)
  })
}
