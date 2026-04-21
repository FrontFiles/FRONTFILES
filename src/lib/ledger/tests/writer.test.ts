import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { emitEvent } from '@/lib/ledger/writer'

// ─── Stub Supabase client ─────────────────────────────────────────
//
// The writer only calls `db.rpc('rpc_append_ledger_event', {...})`.
// A single-method stub is enough; the rest of the SupabaseClient
// surface is irrelevant here.

type RpcResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code?: string; message: string } }

function makeStubClient(result: RpcResult<unknown>): {
  db: SupabaseClient
  rpcSpy: ReturnType<typeof vi.fn>
} {
  const rpcSpy = vi.fn().mockResolvedValue(result)
  const db = { rpc: rpcSpy } as unknown as SupabaseClient
  return { db, rpcSpy }
}

const ACTOR_REF = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const THREAD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const EVENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const EVENT_HASH = 'deadbeefcafef00d'

function validOfferCreatedPayload() {
  return {
    v: 1 as const,
    target_type: 'brief_pack' as const,
    items: ['slot-a'],
    gross_fee: 10000,
    platform_fee_bps: 1500,
    currency: 'EUR',
    rights: { scope: 'editorial' },
    expires_at: '2026-05-01T00:00:00.000Z',
    note: 'seed',
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('emitEvent', () => {
  it('returns { ok: true, eventHash, eventId } on a valid payload + successful RPC', async () => {
    const { db, rpcSpy } = makeStubClient({
      data: [{ id: EVENT_ID, event_hash: EVENT_HASH }],
      error: null,
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      payload: validOfferCreatedPayload(),
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    expect(result).toEqual({
      ok: true,
      eventHash: EVENT_HASH,
      eventId: EVENT_ID,
    })
    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith('rpc_append_ledger_event', {
      p_thread_type: 'offer',
      p_thread_id: THREAD_ID,
      p_event_type: 'offer.created',
      p_payload_version: 'v1',
      p_payload: validOfferCreatedPayload(),
      p_actor_ref: ACTOR_REF,
      p_prev_event_hash: null,
    })
  })

  it('returns PAYLOAD_VALIDATION_FAILED when payload.v is not the v=1 literal', async () => {
    const { db, rpcSpy } = makeStubClient({
      data: [{ id: EVENT_ID, event_hash: EVENT_HASH }],
      error: null,
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      // @ts-expect-error — deliberately violate the v: 1 literal to probe Zod
      payload: { ...validOfferCreatedPayload(), v: 2 },
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('PAYLOAD_VALIDATION_FAILED')
    }
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('returns PAYLOAD_VALIDATION_FAILED when eventType is not a known event type at runtime', async () => {
    const { db, rpcSpy } = makeStubClient({
      data: [{ id: EVENT_ID, event_hash: EVENT_HASH }],
      error: null,
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      // Cast through `as any` so TS allows the bogus literal — runtime
      // guard in the writer (plus the EventPayloadSchemas lookup) is
      // what we're exercising.
      eventType: 'offer.bogus_event' as unknown as 'offer.created',
      payload: validOfferCreatedPayload(),
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('PAYLOAD_VALIDATION_FAILED')
    }
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('classifies the trigger RAISE as HASH_CHAIN_VIOLATION by its SQLSTATE / substring', async () => {
    const { db } = makeStubClient({
      data: null,
      error: {
        code: '23514',
        message:
          'ledger_events hash-chain violation: expected prev_event_hash=abc, got def',
      },
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      payload: validOfferCreatedPayload(),
      actorRef: ACTOR_REF,
      prevEventHash: 'abc',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('HASH_CHAIN_VIOLATION')
    }
  })

  it('classifies unique-violation on the ledger prev-hash index as CONCURRENT_CHAIN_ADVANCE', async () => {
    // Race case: the BEFORE-INSERT trigger `enforce_ledger_hash_chain()`
    // passed (two concurrent inserts both read the same stale thread
    // tail under read-committed), but the UNIQUE index added by
    // migration 20260421000006 caught the second commit. The writer
    // must classify this distinctly from HASH_CHAIN_VIOLATION so
    // telemetry can separate programmer-error stale-prev bugs from
    // legitimate infra races. Caller retry semantics are identical.
    const { db } = makeStubClient({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint '
          + '"ledger_events_thread_prev_hash_unique"',
      },
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      payload: validOfferCreatedPayload(),
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('CONCURRENT_CHAIN_ADVANCE')
    }
  })

  it('classifies unique-violations from unrelated constraints as INSERT_FAILED (not CONCURRENT_CHAIN_ADVANCE)', async () => {
    // Load-bearing test: plain SQLSTATE 23505 matching would misclassify
    // every UNIQUE violation in the schema as a ledger-chain race. The
    // classifier requires BOTH SQLSTATE 23505 AND the specific
    // `ledger_events_thread_prev_hash_unique` index name in the RAISE
    // text. A 23505 raised by, e.g., `actor_handles_auth_user_id_key`
    // must fall through to INSERT_FAILED.
    const { db } = makeStubClient({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint '
          + '"actor_handles_auth_user_id_key"',
      },
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      payload: validOfferCreatedPayload(),
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('INSERT_FAILED')
    }
  })

  it('classifies unrecognised Supabase errors as INSERT_FAILED', async () => {
    const { db } = makeStubClient({
      data: null,
      error: {
        code: 'XX000',
        message: 'some other internal error',
      },
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      payload: validOfferCreatedPayload(),
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('INSERT_FAILED')
    }
  })

  it('returns INSERT_FAILED when the RPC surfaces no error but also no row', async () => {
    const { db } = makeStubClient({
      data: [],
      error: null,
    })

    const result = await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      payload: validOfferCreatedPayload(),
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('INSERT_FAILED')
    }
  })

  it('never logs the payload contents at info/log level (PII discipline per §8 / §12)', async () => {
    const { db } = makeStubClient({
      data: [{ id: EVENT_ID, event_hash: EVENT_HASH }],
      error: null,
    })
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const payload = {
      ...validOfferCreatedPayload(),
      note: 'PAYLOAD_FREE_TEXT_CANARY',
    }
    await emitEvent({
      db,
      threadType: 'offer',
      threadId: THREAD_ID,
      eventType: 'offer.created',
      payload,
      actorRef: ACTOR_REF,
      prevEventHash: null,
    })

    const joinedInfo = infoSpy.mock.calls.flat().join(' ')
    const joinedLog = logSpy.mock.calls.flat().join(' ')
    expect(joinedInfo).not.toContain('PAYLOAD_FREE_TEXT_CANARY')
    expect(joinedLog).not.toContain('PAYLOAD_FREE_TEXT_CANARY')
  })
})
