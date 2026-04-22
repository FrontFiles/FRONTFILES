// ═══════════════════════════════════════════════════════════════
// classifyRpcError — P0001..P0008 scoped SQLSTATE+SQLERRM coverage
//
// Table-driven. Each row asserts one (SQLSTATE, SQLERRM) pair
// maps to the spec-canonical { kind, httpStatus, code } bundle.
// Scoping discipline is exercised by the negative rows — a
// SQLSTATE that matches without the SQLERRM prefix must fall
// through to 'unknown'. This is the property that distinguishes
// this module from a plain SQLSTATE switch.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'

import { classifyRpcError } from '../rpc-errors'

describe('classifyRpcError — happy-path SQLSTATE+SQLERRM pairs', () => {
  it.each([
    {
      case: 'P0001 retry_exhausted',
      code: 'P0001',
      message:
        '_emit_offer_event_with_retry exhausted 3 attempts on thread offer/abc (event_type=offer.created)',
      kind: 'retry_exhausted' as const,
      httpStatus: 503,
      stableCode: 'LEDGER_CONTENTION',
    },
    {
      case: 'P0002 rate_limit',
      code: 'P0002',
      message:
        'rate_limit: max 3 pending offers per buyer/creator (current=3)',
      kind: 'rate_limit' as const,
      httpStatus: 429,
      stableCode: 'RATE_LIMIT',
    },
    {
      case: 'P0003 offer_not_found',
      code: 'P0003',
      message:
        'offer_not_found: 11111111-2222-3333-4444-555555555555',
      kind: 'offer_not_found' as const,
      httpStatus: 404,
      stableCode: 'OFFER_NOT_FOUND',
    },
    {
      case: 'P0003 invalid_state',
      code: 'P0003',
      message: 'invalid_state: offer is accepted',
      kind: 'invalid_state' as const,
      httpStatus: 409,
      stableCode: 'INVALID_STATE',
    },
    {
      case: 'P0003 invalid_state — expired variant (case-sensitive prefix)',
      code: 'P0003',
      message: 'invalid_state: offer is expired',
      kind: 'invalid_state' as const,
      httpStatus: 409,
      stableCode: 'INVALID_STATE',
    },
    {
      case: 'P0004 not_party (base)',
      code: 'P0004',
      message: 'not_party',
      kind: 'not_party' as const,
      httpStatus: 403,
      stableCode: 'NOT_PARTY',
    },
    {
      case: 'P0004 not_party (buyer-only variant from cancel)',
      code: 'P0004',
      message: 'not_party: cancel is buyer-only',
      kind: 'not_party' as const,
      httpStatus: 403,
      stableCode: 'NOT_PARTY',
    },
    {
      case: 'P0005 not_last_turn',
      code: 'P0005',
      message: 'not_last_turn',
      kind: 'not_last_turn' as const,
      httpStatus: 409,
      stableCode: 'NOT_LAST_TURN',
    },
    {
      case: 'P0006 not_system',
      code: 'P0006',
      message: 'not_system',
      kind: 'not_system' as const,
      httpStatus: 403,
      stableCode: 'NOT_SYSTEM',
    },
    {
      case: 'P0007 not_yet_expired',
      code: 'P0007',
      message:
        'not_yet_expired: expires_at=2026-04-30T00:00:00+00:00',
      kind: 'not_yet_expired' as const,
      httpStatus: 409,
      stableCode: 'NOT_YET_EXPIRED',
    },
    {
      case: 'P0008 actor_mismatch',
      code: 'P0008',
      message: 'actor_mismatch',
      kind: 'actor_mismatch' as const,
      httpStatus: 401,
      stableCode: 'ACTOR_MISMATCH',
    },
  ])(
    'classifies $case',
    ({ code, message, kind, httpStatus, stableCode }) => {
      const result = classifyRpcError({ code, message })
      expect(result.kind).toBe(kind)
      expect(result.httpStatus).toBe(httpStatus)
      expect(result.code).toBe(stableCode)
      expect(result.raw).toEqual({ code, message })
    },
  )
})

describe('classifyRpcError — scoping discipline (SQLSTATE alone is not enough)', () => {
  it(
    "P0003 with unrelated SQLERRM falls through to unknown (not silently 'offer_not_found')",
    () => {
      const result = classifyRpcError({
        code: 'P0003',
        message: 'some unrelated P0003 condition the migration does not raise today',
      })
      expect(result.kind).toBe('unknown')
      expect(result.httpStatus).toBe(500)
      expect(result.code).toBe('INTERNAL')
    },
  )

  it('P0001 without the retry substring falls through to unknown', () => {
    const result = classifyRpcError({
      code: 'P0001',
      message: 'completely different P0001 condition',
    })
    expect(result.kind).toBe('unknown')
  })

  it('P0004 without not_party substring falls through to unknown', () => {
    const result = classifyRpcError({
      code: 'P0004',
      message: 'something else using P0004',
    })
    expect(result.kind).toBe('unknown')
  })

  it('P0005 without not_last_turn substring falls through to unknown', () => {
    const result = classifyRpcError({
      code: 'P0005',
      message: 'noisy P0005 message',
    })
    expect(result.kind).toBe('unknown')
  })

  it('P0008 without actor_mismatch substring falls through to unknown', () => {
    const result = classifyRpcError({
      code: 'P0008',
      message: 'some other auth thing',
    })
    expect(result.kind).toBe('unknown')
  })
})

describe('classifyRpcError — defensive input handling', () => {
  it('returns unknown on null', () => {
    const result = classifyRpcError(null)
    expect(result.kind).toBe('unknown')
    expect(result.httpStatus).toBe(500)
    expect(result.code).toBe('INTERNAL')
  })

  it('returns unknown on undefined', () => {
    const result = classifyRpcError(undefined)
    expect(result.kind).toBe('unknown')
  })

  it('returns unknown on {} (no code, no message)', () => {
    const result = classifyRpcError({})
    expect(result.kind).toBe('unknown')
    expect(result.raw).toEqual({ code: undefined, message: undefined })
  })

  it('returns unknown on a non-Postgres SQLSTATE (e.g. 23505 unique violation)', () => {
    const result = classifyRpcError({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    })
    expect(result.kind).toBe('unknown')
  })

  it('preserves raw fields on unknown for operator logs', () => {
    const result = classifyRpcError({
      code: 'XX000',
      message: 'internal pg error',
    })
    expect(result.raw).toEqual({ code: 'XX000', message: 'internal pg error' })
  })
})

describe('classifyRpcError — response-body safety', () => {
  it('does not echo the raw SQLERRM into the client-facing message', () => {
    const raw = 'offer_not_found: 55555555-6666-7777-8888-999999999999'
    const result = classifyRpcError({ code: 'P0003', message: raw })
    expect(result.kind).toBe('offer_not_found')
    // Client-safe: no UUID leak.
    expect(result.message).toBe('Offer not found.')
    expect(result.message).not.toContain('55555555')
    // Raw retained only for server-side logging.
    expect(result.raw.message).toBe(raw)
  })
})
