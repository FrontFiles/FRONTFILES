/**
 * api-helpers.test.ts — API Route Helper Unit Tests
 *
 * Tests the shared helpers used by every Assignment API route:
 *   success(), domainError(), errorResponse(), resolveAssignment(), withDomainError()
 *
 * These are pure functions with no Next.js router dependency, so they run
 * cleanly in the vitest/node environment via the web platform's Response API.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  success,
  domainError,
  errorResponse,
  resolveAssignment,
  withDomainError,
} from '@/lib/assignment/api-helpers'
import { AssignmentError } from '@/lib/assignment/errors'
import { putAssignment, _resetStore, listAssignments } from '@/lib/assignment/store'
import {
  issueAssignmentBrief,
  acceptAssignment,
} from '@/lib/assignment/services'
import { _clearEventBuffer } from '@/lib/assignment/events'
import type { IssueBriefInput } from '@/lib/assignment/services'

beforeEach(() => {
  _resetStore()
  _clearEventBuffer()
})

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function minimalBrief(): IssueBriefInput {
  return {
    buyerId: 'buyer-api-01',
    creatorId: 'creator-api-01',
    assignmentClass: 'material',
    plan: {
      scope: 'API helper test scope.',
      deadline: '2026-09-01T23:59:00Z',
      acceptanceCriteria: 'API criteria.',
      requiredEvidenceTypes: ['vault_asset'],
      reviewWindowDays: 5,
      notes: null,
    },
    rightsRecord: {
      assetRights: null,
      serviceTerms: null,
    },
    milestones: [
      {
        title: 'Single MS',
        scopeSummary: 'API test.',
        milestoneType: 'material',
        dueDate: '2026-08-01T23:59:00Z',
        acceptanceCriteria: '1 photo.',
        requiredEvidenceTypes: ['vault_asset'],
        releasableAmountCents: 50_000,
        partialAcceptancePermitted: false,
        reviewWindowDays: 5,
      },
    ],
  }
}

async function readJson(r: Response): Promise<unknown> {
  return r.json()
}

// ══════════════════════════════════════════════
// success()
// ══════════════════════════════════════════════

describe('success()', () => {
  it('returns 200 by default with data wrapped in { data }', async () => {
    const r = success({ id: 'asgn-01', state: 'brief_issued' })
    expect(r.status).toBe(200)
    const body = await readJson(r) as Record<string, unknown>
    expect(body).toHaveProperty('data')
    expect((body.data as Record<string, unknown>).id).toBe('asgn-01')
  })

  it('accepts a custom HTTP status code', async () => {
    const r = success({ created: true }, 201)
    expect(r.status).toBe(201)
  })

  it('wraps arrays in { data }', async () => {
    const r = success([{ id: '1' }, { id: '2' }])
    const body = await readJson(r) as Record<string, unknown>
    expect(Array.isArray(body.data)).toBe(true)
    expect((body.data as unknown[]).length).toBe(2)
  })

  it('wraps null in { data }', async () => {
    const r = success(null)
    const body = await readJson(r) as Record<string, unknown>
    expect(body.data).toBeNull()
  })
})

// ══════════════════════════════════════════════
// errorResponse()
// ══════════════════════════════════════════════

describe('errorResponse()', () => {
  it('returns 400 by default with { error: { code, message } }', async () => {
    const r = errorResponse('VALIDATION_ERROR', 'Missing required field')
    expect(r.status).toBe(400)
    const body = await readJson(r) as Record<string, unknown>
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('Missing required field')
  })

  it('accepts a custom HTTP status', async () => {
    const r = errorResponse('ASSIGNMENT_NOT_FOUND', 'Not found', 404)
    expect(r.status).toBe(404)
  })

  it('returns 500 for internal errors when explicitly set', async () => {
    const r = errorResponse('INTERNAL_ERROR', 'Something went wrong', 500)
    expect(r.status).toBe(500)
    const body = await readJson(r) as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('INTERNAL_ERROR')
  })
})

// ══════════════════════════════════════════════
// domainError()
// ══════════════════════════════════════════════

describe('domainError()', () => {
  it('maps AssignmentError.httpStatus to the response status', async () => {
    const err = new AssignmentError('FORBIDDEN_ROLE', 'Access denied', 403)
    const r = domainError(err)
    expect(r.status).toBe(403)
  })

  it('maps AssignmentError.code to error.code in response body', async () => {
    const err = new AssignmentError('MILESTONE_NOT_FOUND', 'Milestone not found', 404)
    const r = domainError(err)
    const body = await readJson(r) as Record<string, unknown>
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('MILESTONE_NOT_FOUND')
    expect(error.message).toBe('Milestone not found')
  })

  it('maps 400-status AssignmentError correctly', async () => {
    const err = new AssignmentError('INVALID_STATE_TRANSITION', 'Cannot transition', 400)
    const r = domainError(err)
    expect(r.status).toBe(400)
    const body = await readJson(r) as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('INVALID_STATE_TRANSITION')
  })

  it('maps EDITOR_CANNOT_AUTHORISE_RELEASE to 403', async () => {
    const err = new AssignmentError(
      'EDITOR_CANNOT_AUTHORISE_RELEASE',
      'Editor cannot independently authorise final spend release.',
      403,
    )
    const r = domainError(err)
    expect(r.status).toBe(403)
  })
})

// ══════════════════════════════════════════════
// resolveAssignment()
// ══════════════════════════════════════════════

describe('resolveAssignment()', () => {
  it('returns [assignment, null] when assignment exists in store', () => {
    const a = issueAssignmentBrief(minimalBrief())
    putAssignment(a)

    const [assignment, err] = resolveAssignment(a.id)
    expect(err).toBeNull()
    expect(assignment).not.toBeNull()
    expect(assignment!.id).toBe(a.id)
  })

  it('returns [null, errorResponse] when assignment is not found', async () => {
    const [assignment, err] = resolveAssignment('asgn-nonexistent-id')
    expect(assignment).toBeNull()
    expect(err).not.toBeNull()

    const body = await readJson(err!) as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('ASSIGNMENT_NOT_FOUND')
    expect(err!.status).toBe(404)
  })

  it('resolves mock data assignments by their IDs', () => {
    // The store is seeded from mockAssignments on module load
    // After _resetStore(), mock data is restored
    const allAssignments = listAssignments()
    expect(allAssignments.length).toBeGreaterThan(0)

    const mockId = allAssignments[0].id
    const [assignment, err] = resolveAssignment(mockId)
    expect(err).toBeNull()
    expect(assignment!.id).toBe(mockId)
  })
})

// ══════════════════════════════════════════════
// withDomainError()
// ══════════════════════════════════════════════

describe('withDomainError()', () => {
  it('returns the result of the wrapped function when no error is thrown', async () => {
    const r = await withDomainError(async () => success({ ok: true }))
    expect(r.status).toBe(200)
    const body = await readJson(r) as Record<string, unknown>
    expect((body.data as Record<string, unknown>).ok).toBe(true)
  })

  it('catches AssignmentError and returns domainError response', async () => {
    const r = await withDomainError(async () => {
      throw new AssignmentError('FORBIDDEN_ROLE', 'Not allowed', 403)
    })
    expect(r.status).toBe(403)
    const body = await readJson(r) as Record<string, unknown>
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('FORBIDDEN_ROLE')
    expect(error.message).toBe('Not allowed')
  })

  it('catches INVALID_STATE_TRANSITION and returns 400', async () => {
    const r = await withDomainError(async () => {
      throw new AssignmentError('INVALID_STATE_TRANSITION', 'Cannot do that', 400)
    })
    expect(r.status).toBe(400)
    const body = await readJson(r) as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('INVALID_STATE_TRANSITION')
  })

  it('catches ASSIGNMENT_NOT_FOUND and returns 404', async () => {
    const r = await withDomainError(async () => {
      throw new AssignmentError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404)
    })
    expect(r.status).toBe(404)
  })

  it('catches generic Error and returns 500 INTERNAL_ERROR', async () => {
    const r = await withDomainError(async () => {
      throw new Error('Unexpected database failure')
    })
    expect(r.status).toBe(500)
    const body = await readJson(r) as Record<string, unknown>
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.message).toBe('Unexpected database failure')
  })

  it('catches thrown non-Error and returns 500 INTERNAL_ERROR', async () => {
    const r = await withDomainError(async () => {
      throw 'raw string error' // eslint-disable-line no-throw-literal
    })
    expect(r.status).toBe(500)
    const body = await readJson(r) as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('INTERNAL_ERROR')
  })

  it('wraps synchronous function that returns a Response', async () => {
    const r = await withDomainError(() => success({ sync: true }, 201))
    expect(r.status).toBe(201)
    const body = await readJson(r) as Record<string, unknown>
    expect((body.data as Record<string, unknown>).sync).toBe(true)
  })

  it('propagates correct HTTP status for each AssignmentError code', async () => {
    const cases: Array<[import('@/lib/assignment/errors').AssignmentErrorCode, number]> = [
      ['EDITOR_CANNOT_AUTHORISE_RELEASE', 403],
      ['FORBIDDEN_ROLE', 403],
      ['NOT_ASSIGNMENT_PARTY', 403],
      ['ASSIGNMENT_NOT_FOUND', 404],
      ['MILESTONE_NOT_FOUND', 404],
      ['INVALID_STATE_TRANSITION', 400],
      ['CCR_ALREADY_PENDING', 400],
      ['DISPUTE_ALREADY_OPEN', 400],
    ]

    for (const [code, expectedStatus] of cases) {
      const r = await withDomainError(async () => {
        throw new AssignmentError(code, `Test: ${code}`, expectedStatus)
      })
      expect(r.status).toBe(expectedStatus)
      const body = await readJson(r) as Record<string, unknown>
      expect((body.error as Record<string, unknown>).code).toBe(code)
    }
  })
})
