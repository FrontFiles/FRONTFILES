/**
 * Assignment Engine — API Route Helpers
 *
 * Shared utilities for Assignment API route handlers.
 * Thin wrappers: parse body, catch domain errors, return JSON.
 */

import { AssignmentError } from './errors'
import { getAssignment } from './store'
import type { Assignment } from '@/lib/types'

/** Standard success response. */
export function success<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
}

/** Standard error response from AssignmentError. */
export function domainError(err: AssignmentError): Response {
  return Response.json(
    { error: { code: err.code, message: err.message } },
    { status: err.httpStatus },
  )
}

/** Generic error response. */
export function errorResponse(code: string, message: string, status = 400): Response {
  return Response.json(
    { error: { code, message } },
    { status },
  )
}

/**
 * Resolve assignment by ID from URL params.
 * Returns [assignment, null] on success, [null, Response] on failure.
 */
export function resolveAssignment(
  id: string,
): [Assignment, null] | [null, Response] {
  const assignment = getAssignment(id)
  if (!assignment) {
    return [null, errorResponse('ASSIGNMENT_NOT_FOUND', `Assignment ${id} not found`, 404)]
  }
  return [assignment, null]
}

/**
 * Wrap a domain service call: catches AssignmentError and returns
 * the appropriate JSON response.
 */
export async function withDomainError(
  fn: () => Response | Promise<Response>,
): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof AssignmentError) {
      return domainError(err)
    }
    const clientMessage = process.env.NODE_ENV !== 'production'
      ? (err instanceof Error ? err.message : String(err))
      : 'Internal server error'
    return errorResponse('INTERNAL_ERROR', clientMessage, 500)
  }
}
