/**
 * GET /api/assignment/[id] — Get a single assignment by ID
 */

import { resolveAssignment, success } from '@/lib/assignment/api-helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [assignment, err] = resolveAssignment(id)
  if (err) return err
  return success(assignment)
}
