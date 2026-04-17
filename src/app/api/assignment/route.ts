/**
 * POST /api/assignment — Issue a new assignment brief
 * GET  /api/assignment — List assignments (optional ?buyerId= or ?creatorId=)
 */

import type { NextRequest } from 'next/server'
import { issueAssignmentBrief } from '@/lib/assignment/services'
import { listAssignments, putAssignment } from '@/lib/assignment/store'
import { success, errorResponse, withDomainError } from '@/lib/assignment/api-helpers'
import { requireGrant } from '@/lib/identity/guards'

export async function POST(request: NextRequest) {
  return withDomainError(async () => {
    const body = await request.json()

    if (!body.buyerId || !body.creatorId || !body.assignmentClass || !body.plan || !body.milestones) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: buyerId, creatorId, assignmentClass, plan, milestones')
    }

    // Phase B — server-side role gate.
    // Issuing an assignment brief is a buyer-scoped action, so
    // the acting `buyerId` must hold the 'buyer' grant. This is
    // the second of two proof-of-concept wirings for the new
    // `requireGrant` helper; the rest of the API surface will
    // be retrofitted in a later phase.
    const grantDenial = await requireGrant(body.buyerId, 'buyer')
    if (grantDenial) return grantDenial

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
