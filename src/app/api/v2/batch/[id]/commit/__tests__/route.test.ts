import { describe, it, expect, beforeEach } from 'vitest'

import { POST } from '../route'
import { __testing as storeTesting } from '@/lib/upload/batch-store'
import { createBatch } from '@/lib/upload/batch-service'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseConfigured() returns false. The route still
// gates on FFF_REAL_UPLOAD (toggled per-test via local withEnv),
// but downstream batch-store calls (via createBatch setup + the
// route itself) route through the in-memory Map branches.
// See KD-9-audit.md §Phase 4.A §KD-9.1.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

const CREATOR_A = '11111111-1111-4111-8111-111111111111'
const CREATOR_B = '22222222-2222-4222-8222-222222222222'

function withEnv(
  mutations: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(mutations)) saved[key] = process.env[key]
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  for (const [key, value] of Object.entries(mutations)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return fn().finally(restore)
}

function makeRequest(batchId: string, headers?: Record<string, string>): Request {
  return new Request(`http://localhost/api/v2/batch/${batchId}/commit`, {
    method: 'POST',
    headers: new Headers(headers ?? {}),
  })
}

async function callPost(
  batchId: string,
  headers?: Record<string, string>,
): Promise<Response> {
  return POST(
    makeRequest(batchId, headers) as unknown as Parameters<typeof POST>[0],
    { params: Promise.resolve({ id: batchId }) },
  )
}

beforeEach(() => {
  storeTesting.reset()
})

describe('POST /api/v2/batch/[id]/commit — flag gate', () => {
  it('returns 503 when FFF_REAL_UPLOAD is unset', async () => {
    await withEnv({ FFF_REAL_UPLOAD: undefined }, async () => {
      const res = await callPost('00000000-0000-4000-8000-000000000000')
      expect(res.status).toBe(503)
    })
  })
})

describe('POST /api/v2/batch/[id]/commit — validation', () => {
  it('returns 400 when the batch id is not a UUID', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await callPost('not-a-uuid', { 'x-creator-id': CREATOR_A })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.code).toBe('bad_request')
    })
  })

  it('returns 401 when X-Creator-Id is missing', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await callPost('00000000-0000-4000-8000-000000000000')
      expect(res.status).toBe(401)
    })
  })
})

describe('POST /api/v2/batch/[id]/commit — happy path', () => {
  it('returns 200 with state=committed when the batch exists and is open', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
      if (!created.ok) throw new Error('setup failed')

      const res = await callPost(created.batch.id, { 'x-creator-id': CREATOR_A })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(created.batch.id)
      expect(body.state).toBe('committed')
      expect(body.committed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})

describe('POST /api/v2/batch/[id]/commit — error paths', () => {
  it('returns 404 when the batch does not exist', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await callPost('99999999-9999-4999-8999-999999999999', {
        'x-creator-id': CREATOR_A,
      })
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.code).toBe('not_found')
    })
  })

  it('returns 403 when the creator does not own the batch', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
      if (!created.ok) throw new Error('setup failed')

      const res = await callPost(created.batch.id, { 'x-creator-id': CREATOR_B })
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.code).toBe('forbidden')
    })
  })

  it('returns 409 when the batch is already committed', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
      if (!created.ok) throw new Error('setup failed')

      const first = await callPost(created.batch.id, { 'x-creator-id': CREATOR_A })
      expect(first.status).toBe(200)

      const second = await callPost(created.batch.id, { 'x-creator-id': CREATOR_A })
      expect(second.status).toBe(409)
      const body = await second.json()
      expect(body.code).toBe('invalid_state')
      expect(body.current_state).toBe('committed')
    })
  })

  it('returns 409 when the batch is cancelled', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const created = await createBatch({ creatorId: CREATOR_A, newsroomMode: false })
      if (!created.ok) throw new Error('setup failed')

      storeTesting.seed({
        ...created.batch,
        state: 'cancelled',
        cancelledAt: new Date().toISOString(),
      })

      const res = await callPost(created.batch.id, { 'x-creator-id': CREATOR_A })
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe('invalid_state')
      expect(body.current_state).toBe('cancelled')
    })
  })
})
