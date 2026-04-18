import { describe, it, expect, beforeEach } from 'vitest'

import { createBatch, commitBatch } from '../batch-service'
import { __testing as storeTesting } from '../batch-store'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseConfigured() returns false. batch-store's
// insertBatch / transitionToCommitted route through the in-memory
// Map branches, honouring storeTesting.reset() / storeTesting.seed().
// See KD-9-audit.md §Phase 4.A §KD-9.1.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

const CREATOR_A = '11111111-1111-4111-8111-111111111111'
const CREATOR_B = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  storeTesting.reset()
})

describe('createBatch', () => {
  it('creates a batch in state "open" with server timestamps', async () => {
    const result = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.batch.creatorId).toBe(CREATOR_A)
    expect(result.batch.state).toBe('open')
    expect(result.batch.newsroomMode).toBe(false)
    expect(result.batch.committedAt).toBeNull()
    expect(result.batch.cancelledAt).toBeNull()
    expect(result.batch.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(result.batch.updatedAt).toBe(result.batch.createdAt)
  })

  it('persists newsroomMode=true', async () => {
    const result = await createBatch({ creatorId: CREATOR_A, newsroomMode: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.batch.newsroomMode).toBe(true)
  })

  it('generates a unique id per call', async () => {
    const a = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
    const b = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.batch.id).not.toBe(b.batch.id)
  })
})

describe('commitBatch', () => {
  it('transitions an open batch to committed and sets committedAt', async () => {
    const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
    if (!created.ok) throw new Error('setup failed')

    const committed = await commitBatch({
      batchId: created.batch.id,
      creatorId: CREATOR_A,
    })

    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.batch.id).toBe(created.batch.id)
    expect(committed.batch.state).toBe('committed')
    expect(committed.batch.committedAt).not.toBeNull()
  })

  it('returns not_found for an unknown batch id', async () => {
    const result = await commitBatch({
      batchId: '99999999-9999-4999-8999-999999999999',
      creatorId: CREATOR_A,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('not_found')
  })

  it('returns forbidden when the creator does not own the batch', async () => {
    const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
    if (!created.ok) throw new Error('setup failed')

    const result = await commitBatch({
      batchId: created.batch.id,
      creatorId: CREATOR_B,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('forbidden')
  })

  it('returns invalid_state when committing a batch twice', async () => {
    const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
    if (!created.ok) throw new Error('setup failed')

    const first = await commitBatch({
      batchId: created.batch.id,
      creatorId: CREATOR_A,
    })
    expect(first.ok).toBe(true)

    const second = await commitBatch({
      batchId: created.batch.id,
      creatorId: CREATOR_A,
    })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.code).toBe('invalid_state')
    expect(second.currentState).toBe('committed')
  })

  it('returns invalid_state when the batch is cancelled', async () => {
    const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
    if (!created.ok) throw new Error('setup failed')

    // Directly mutate the mock store to the cancelled state — the
    // cancel endpoint is out of PR 1.2 scope but the state machine
    // still rejects commits from a cancelled batch.
    storeTesting.seed({
      ...created.batch,
      state: 'cancelled',
      cancelledAt: new Date().toISOString(),
    })

    const result = await commitBatch({
      batchId: created.batch.id,
      creatorId: CREATOR_A,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid_state')
    expect(result.currentState).toBe('cancelled')
  })
})
