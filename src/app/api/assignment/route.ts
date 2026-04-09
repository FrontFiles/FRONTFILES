/**
 * POST /api/assignment — Issue a new assignment brief
 * GET  /api/assignment — List assignments (optional ?buyerId= or ?creatorId=)
 */

import type { NextRequest } from 'next/server'
import { issueAssignmentBrief } from '@/lib/assignment/services'
import { listAssignments, putAssignment } from '@/lib/assignment/store'
import { success, errorResponse, withDomainError } from '@/lib/assignment/api-helpers'

export async function POST(request: NextRequest) {
  return withDomainError(async () => {
    const body = await request.json()

    if (!body.buyerId || !body.creatorId || !body.assignmentClass || !body.plan || !body.milestones) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: buyerId, creatorId, assignmentClass, plan, milestones')
    }

    const assignment = issueAssignmentBrief({
      buyerId: body.buyerId,
      creatorId: body.creatorId,
      assignmentClass: body.assignmentClass,
      plan: body.plan,
      rightsRecord: body.rightsRecord ?? { assetRights: null, serviceTerms: null },
      milestones: body.milestones,
    })

    putAssignment(assignment)
    return success(assignment, 201)
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const buyerId = searchParams.get('buyerId') ?? undefined
  const creatorId = searchParams.get('creatorId') ?? undefined

  const assignments = listAssignments(
    buyerId || creatorId ? { buyerId, creatorId } : undefined,
  )

  return success(assignments)
}
